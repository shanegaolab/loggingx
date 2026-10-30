package com.loggingx;

import com.sun.net.httpserver.HttpExchange;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;

import java.io.IOException;
import java.io.OutputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The chat API against a fake loggingx-ai service that only has a DeepSeek key. It fails any request whose message
 * contains {@value #FAIL}, as it does when the model rejects its key.
 */
class AiApiIntegrationTest extends ApiIntegrationTest {

    private static final String FAIL = "please fail";
    private static final String SLOW = "please hold back";
    private static final Map<String, Object> REPLY = Map.of("provider", "deepseek", "model", "deepseek-v4-flash",
            "content", "pong", "promptTokens", 7, "completionTokens", 1);
    private static final String STREAM = FakeLoggingxAi.event("message", Map.of("content", "po"))
            + FakeLoggingxAi.event("message", Map.of("content", "ng")) + FakeLoggingxAi.event("done", REPLY);

    private static final FakeLoggingxAi AI = new FakeLoggingxAi(List.of("deepseek"), AiApiIntegrationTest::answer);
    private static volatile CountDownLatch firstChunkReceived = new CountDownLatch(1);
    private static volatile boolean heldBackChunkReleased;

    @DynamicPropertySource
    static void aiProperties(DynamicPropertyRegistry registry) {
        registry.add("loggingx.ai.url", AI::url);
        registry.add("loggingx.ai.api-key", () -> FakeLoggingxAi.API_KEY);
    }

    @AfterAll
    static void stopAi() {
        AI.stop();
    }

    @Test
    void listsConfiguredProviders() throws Exception {
        HttpResponse<String> response = send("GET", "/api/ai/providers", login("user", DEMO_PASSWORD), null);

        assertEquals(200, response.statusCode(), response.body());
        assertTrue(response.body().contains("\"data\":[\"deepseek\"]"), response.body());
    }

    @Test
    void chatsThroughTheService() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat", login("user", DEMO_PASSWORD),
                "{\"provider\":\"deepseek\",\"message\":\"ping\",\"systemPrompt\":\"be brief\"}");

        assertEquals(200, response.statusCode(), response.body());
        assertTrue(response.body().contains("\"content\":\"pong\""), response.body());
        assertTrue(response.body().contains("\"model\":\"deepseek-v4-flash\""), response.body());
        assertTrue(response.body().contains("\"promptTokens\":7"), response.body());
        FakeLoggingxAi.Call call = AI.calls("/api/v1/chat").getLast();
        assertEquals("be brief", call.body().path("systemPrompt").asString());
        assertEquals(FakeLoggingxAi.API_KEY, call.apiKey());
    }

    @Test
    void theServicePicksTheProviderWhenNoneIsGiven() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat", login("user", DEMO_PASSWORD),
                "{\"message\":\"ping\"}");

        assertEquals(200, response.statusCode(), response.body());
        assertTrue(AI.calls("/api/v1/chat").getLast().body().path("provider").isNull());
    }

    @Test
    void rejectsUnknownAndUnconfiguredProviders() throws Exception {
        String token = login("user", DEMO_PASSWORD);
        HttpResponse<String> unknown = send("POST", "/api/ai/chat", token,
                "{\"provider\":\"openai\",\"message\":\"ping\"}");
        assertEquals(400, unknown.statusCode(), unknown.body());
        assertTrue(unknown.body().contains("provider must be deepseek or qwen"), unknown.body());

        HttpResponse<String> unconfigured = send("POST", "/api/ai/chat", token,
                "{\"provider\":\"qwen\",\"message\":\"ping\"}");
        assertEquals(400, unconfigured.statusCode(), unconfigured.body());
        assertTrue(unconfigured.body().contains("没有配置密钥"), unconfigured.body());
    }

    @Test
    void rejectsBlankMessage() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat", login("user", DEMO_PASSWORD),
                "{\"provider\":\"deepseek\",\"message\":\" \"}");

        assertEquals(400, response.statusCode(), response.body());
        assertTrue(response.body().contains("message must not be blank"), response.body());
    }

    @Test
    void reportsModelFailureAsBadGateway() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat", login("user", DEMO_PASSWORD),
                "{\"provider\":\"deepseek\",\"message\":\"" + FAIL + "\"}");

        assertEquals(502, response.statusCode(), response.body());
        assertTrue(response.body().contains("Authentication Fails"), response.body());
    }

    @Test
    void requiresAuthentication() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat", null,
                "{\"provider\":\"deepseek\",\"message\":\"ping\"}");

        assertEquals(401, response.statusCode(), response.body());
    }

    @Test
    void streamsAnswerAsServerSentEvents() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat/stream", login("user", DEMO_PASSWORD),
                "{\"provider\":\"deepseek\",\"message\":\"ping\"}", "text/event-stream");

        assertEquals(200, response.statusCode(), response.body());
        assertTrue(response.headers().firstValue("Content-Type").orElse("").startsWith("text/event-stream"),
                response.headers().toString());
        String body = response.body().replace("\r\n", "\n");
        assertTrue(body.contains("event:message\ndata:{\"content\":\"po\"}\n\n"
                + "event:message\ndata:{\"content\":\"ng\"}\n\n"
                + "event:done\ndata:{\"provider\":\"deepseek\",\"model\":\"deepseek-v4-flash\",\"content\":\"pong\","
                + "\"promptTokens\":7,\"completionTokens\":1}\n\n"), body);
    }

    /**
     * The service holds back its second piece until the client has received the first, which only happens if
     * events are passed on as they arrive rather than buffered until the answer is complete.
     */
    @Test
    void streamsEventsBeforeTheAnswerIsComplete() throws Exception {
        firstChunkReceived = new CountDownLatch(1);
        heldBackChunkReleased = false;
        HttpRequest request = HttpRequest.newBuilder(uri("/api/ai/chat/stream"))
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .header("Authorization", "Bearer " + login("user", DEMO_PASSWORD))
                .POST(HttpRequest.BodyPublishers.ofString("{\"provider\":\"deepseek\",\"message\":\"" + SLOW + "\"}"))
                .build();

        List<String> lines = HttpClient.newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofLines())
                .body()
                .peek(line -> {
                    if (line.equals("data:{\"content\":\"po\"}")) {
                        firstChunkReceived.countDown();
                    }
                })
                .toList();

        assertTrue(heldBackChunkReleased, "first event was not delivered before the stream completed");
        assertTrue(lines.contains("data:{\"content\":\"ng\"}"), lines.toString());
        assertTrue(lines.contains("event:done"), lines.toString());
    }

    @Test
    void streamReportsModelFailureAsErrorEvent() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat/stream", login("user", DEMO_PASSWORD),
                "{\"provider\":\"deepseek\",\"message\":\"" + FAIL + "\"}", "text/event-stream");

        assertEquals(200, response.statusCode(), response.body());
        String body = response.body().replace("\r\n", "\n");
        assertTrue(body.startsWith("event:error\ndata:{\"code\":502,\"msg\":\"loggingx-ai failed: "), body);
        assertTrue(body.contains("Authentication Fails") && !body.contains("event:done"), body);
    }

    @Test
    void streamRejectsInvalidRequestBeforeStreaming() throws Exception {
        String token = login("user", DEMO_PASSWORD);

        HttpResponse<String> unconfigured = send("POST", "/api/ai/chat/stream", token,
                "{\"provider\":\"qwen\",\"message\":\"ping\"}", "text/event-stream");
        assertEquals(400, unconfigured.statusCode(), unconfigured.body());
        assertTrue(unconfigured.body().contains("没有配置密钥"), unconfigured.body());

        HttpResponse<String> blank = send("POST", "/api/ai/chat/stream", token,
                "{\"provider\":\"deepseek\",\"message\":\"\"}", "text/event-stream");
        assertEquals(400, blank.statusCode(), blank.body());
        assertTrue(blank.body().contains("message must not be blank"), blank.body());
    }

    @Test
    void streamRequiresAuthentication() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat/stream", null,
                "{\"provider\":\"deepseek\",\"message\":\"ping\"}", "text/event-stream");

        assertEquals(401, response.statusCode(), response.body());
    }

    /**
     * Answers like loggingx-ai with only a DeepSeek key.
     */
    private static void answer(HttpExchange exchange, String path, JsonNode body) throws IOException {
        boolean stream = path.endsWith("/stream");
        String message = body.path("message").asString("");
        if ("qwen".equals(body.path("provider").asString(null))) {
            FakeLoggingxAi.respond(exchange, 400, "{\"detail\":\"AI 提供方 qwen 没有配置密钥\"}");
        } else if (message.contains(FAIL)) {
            String error = "调用模型失败：deepseek:deepseek-v4-flash: Authentication Fails";
            if (stream) {
                FakeLoggingxAi.stream(exchange, FakeLoggingxAi.event("error", Map.of("message", error)));
            } else {
                FakeLoggingxAi.respond(exchange, 502, FakeLoggingxAi.json(Map.of("detail", error)));
            }
        } else if (message.contains(SLOW)) {
            streamSlowly(exchange);
        } else if (stream) {
            FakeLoggingxAi.stream(exchange, STREAM);
        } else {
            FakeLoggingxAi.respond(exchange, 200, FakeLoggingxAi.json(REPLY));
        }
    }

    private static void streamSlowly(HttpExchange exchange) throws IOException {
        String[] chunks = STREAM.split("(?<=\n\n)", 2);
        exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
        exchange.sendResponseHeaders(200, 0);
        OutputStream out = exchange.getResponseBody();
        out.write(chunks[0].getBytes(StandardCharsets.UTF_8));
        out.flush();
        try {
            heldBackChunkReleased = firstChunkReceived.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
        out.write(chunks[1].getBytes(StandardCharsets.UTF_8));
        exchange.close();
    }
}
