package com.loggingx;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * AI diagnosis handed to the loggingx-ai multi-agent service, against a fake of it that reports no chat provider.
 */
class AiAgentDiagnosisIntegrationTest extends ApiIntegrationTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String ANSWER = """
            {"summary":"支付网关超时后没有重试","rootCause":"reserve 调用支付网关时没有设置超时和重试。",
             "suggestion":"为网关调用设置超时并重试一次。","diff":"","confidence":"MEDIUM","errorType":null,
             "fingerprint":"x","errorCategory":"超时","codeRefs":[],"reviewIssues":[],"provider":"deepseek",
             "model":"deepseek-chat","promptTokens":3200,"completionTokens":800,"steps":[]}""";
    private static final List<JsonNode> REQUESTS = new CopyOnWriteArrayList<>();
    private static final List<String> API_KEYS = new CopyOnWriteArrayList<>();
    private static final HttpServer AGENT = startAgent();

    @DynamicPropertySource
    static void aiProperties(DynamicPropertyRegistry registry) {
        registry.add("loggingx.ai.agent.url", () -> "http://127.0.0.1:" + AGENT.getAddress().getPort() + "/");
        registry.add("loggingx.ai.agent.api-key", () -> "agent-key");
    }

    @AfterAll
    static void stopAgent() {
        AGENT.stop(0);
    }

    private static HttpServer startAgent() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/api/v1/diagnoses", exchange -> {
                REQUESTS.add(JSON.readTree(exchange.getRequestBody().readAllBytes()));
                API_KEYS.add(exchange.getRequestHeaders().getFirst("X-API-Key"));
                byte[] body = ANSWER.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Test
    void diagnosisGoesToTheAgentService() throws Exception {
        String token = login("super", DEMO_PASSWORD);
        String created = send("POST", "/api/logstore", token,
                "{\"code\":\"it-ai-agent\",\"name\":\"Payments\",\"retentionDays\":7,\"enabled\":true}").body();
        String storeId = extract(created, "\"storeId\":(\\d+)");

        String settings = send("GET", "/api/ai-diagnosis/settings", token, null).body();
        assertTrue(settings.contains("\"agent\":true") && settings.contains("\"providers\":[]"), settings);

        HttpResponse<String> manual = send("POST", "/api/ai-diagnosis/analyze", token, "{\"storeId\":" + storeId
                + ",\"message\":\"payment timeout\\n\\tat com.shop.PaymentService.pay(PaymentService.java:42)\","
                + "\"host\":\"pay-1\"}");
        assertEquals(202, manual.statusCode(), manual.body());

        String list = "";
        for (int i = 0; i < 100 && !list.contains("\"status\":\"success\"") && !list.contains("\"status\":\"failed\"");
             i++) {
            Thread.sleep(100);
            list = send("GET", "/api/ai-diagnosis/diagnoses?storeId=" + storeId, token, null).body();
        }
        assertTrue(list.contains("\"status\":\"success\""), list);
        String detail = send("GET", "/api/ai-diagnosis/diagnoses/" + extract(list, "\"id\":(\\d+)"), token, null)
                .body();
        assertTrue(detail.contains("\"summary\":\"支付网关超时后没有重试\""), detail);
        assertTrue(detail.contains("\"provider\":\"loggingx-ai\"") && detail.contains("\"model\":\"deepseek-chat\""),
                detail);
        assertTrue(detail.contains("\"confidence\":\"medium\""), detail);
        assertTrue(detail.contains("\"promptTokens\":3200"), detail);

        JsonNode request = REQUESTS.get(0);
        assertTrue(request.path("logText").asString().contains("PaymentService.java:42"), request.toString());
        assertEquals("Payments", request.path("storeName").asString());
        assertEquals("pay-1", request.path("host").asString());
        assertTrue(request.path("codeRefs").isArray(), request.toString());
        assertEquals("agent-key", API_KEYS.get(0));

        assertEquals(200, send("DELETE", "/api/logstore/" + storeId, token, null).statusCode());
    }
}
