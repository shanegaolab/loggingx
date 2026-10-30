package com.loggingx;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Against a fake loggingx-ai with only DeepSeek configured. It fails any model call whose message contains
 * {@value #FAIL}, as it does when the provider rejects the API key.
 */
class AiApiIntegrationTest extends ApiIntegrationTest {

    private static final String FAIL = "please fail";
    private static final String SLOW = "please hold back";
    private static final String REPLY = """
            {"provider":"deepseek","model":"deepseek-v4-flash","content":"pong","promptTokens":7,"completionTokens":1}""";
    private static final String STREAM = """
            event: delta
            data: {"content": "po"}

            event: delta
            data: {"content": "ng"}

            event: result
            data: %s

            event: done
            data: {}

            """.formatted(REPLY);
    private static final String STREAM_FAILED = """
            event: error
            data: {"message": "deepseek:deepseek-v4-flash 调用失败：Authentication Fails"}

            event: done
            data: {}

            """;

    private static final HttpServer LOGGINGX_AI = startLoggingxAi();
    private static volatile CountDownLatch firstChunkReceived = new CountDownLatch(1);
    private static volatile boolean heldBackChunkReleased;

    @DynamicPropertySource
    static void aiProperties(DynamicPropertyRegistry registry) {
        registry.add("loggingx.ai.agent.url", () -> "http://127.0.0.1:" + LOGGINGX_AI.getAddress().getPort());
    }

    @AfterAll
    static void stopLoggingxAi() {
        LOGGINGX_AI.stop(0);
    }

    @Test
    void listsConfiguredProviders() throws Exception {
        HttpResponse<String> response = send("GET", "/api/ai/providers", login("user", DEMO_PASSWORD), null);

        assertEquals(200, response.statusCode(), response.body());
        assertTrue(response.body().contains("\"data\":[\"deepseek\"]"), response.body());
    }

    @Test
    void chatsWithConfiguredProvider() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat", login("user", DEMO_PASSWORD),
                "{\"provider\":\"deepseek\",\"message\":\"ping\"}");

        assertEquals(200, response.statusCode(), response.body());
        assertTrue(response.body().contains("\"content\":\"pong\""), response.body());
        assertTrue(response.body().contains("\"model\":\"deepseek-v4-flash\""), response.body());
        assertTrue(response.body().contains("\"promptTokens\":7"), response.body());
    }

    @Test
    void rejectsUnconfiguredProvider() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat", login("user", DEMO_PASSWORD),
                "{\"provider\":\"qwen\",\"message\":\"ping\"}");

        assertEquals(400, response.statusCode(), response.body());
        assertTrue(response.body().contains("not configured"), response.body());
    }

    @Test
    void rejectsBlankMessage() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat", login("user", DEMO_PASSWORD),
                "{\"provider\":\"deepseek\",\"message\":\" \"}");

        assertEquals(400, response.statusCode(), response.body());
        assertTrue(response.body().contains("message must not be blank"), response.body());
    }

    @Test
    void reportsProviderFailureAsBadGateway() throws Exception {
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
     * The provider holds back its second chunk until the client has received the first, which only happens if
     * events are flushed as they arrive rather than buffered until the answer is complete.
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
    void streamReportsProviderFailureAsErrorEvent() throws Exception {
        HttpResponse<String> response = send("POST", "/api/ai/chat/stream", login("user", DEMO_PASSWORD),
                "{\"provider\":\"deepseek\",\"message\":\"" + FAIL + "\"}", "text/event-stream");

        assertEquals(200, response.statusCode(), response.body());
        String body = response.body().replace("\r\n", "\n");
        assertTrue(body.startsWith("event:error\ndata:{\"code\":502,\"msg\":\"AI request failed: deepseek:deepseek-v4-flash"),
                body);
        assertTrue(!body.contains("event:done"), body);
    }

    @Test
    void streamRejectsInvalidRequestBeforeStreaming() throws Exception {
        String token = login("user", DEMO_PASSWORD);

        HttpResponse<String> unconfigured = send("POST", "/api/ai/chat/stream", token,
                "{\"provider\":\"qwen\",\"message\":\"ping\"}", "text/event-stream");
        assertEquals(400, unconfigured.statusCode(), unconfigured.body());
        assertTrue(unconfigured.body().contains("not configured"), unconfigured.body());

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

    private static HttpServer startLoggingxAi() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/health", exchange -> respond(exchange, 200, "application/json",
                    "{\"status\":\"ok\",\"providers\":[\"deepseek\"]}"));
            server.createContext("/api/v1/chat", exchange -> {
                String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                boolean stream = exchange.getRequestURI().getPath().endsWith("/stream");
                if (!request.contains("\"provider\":\"deepseek\"") && !request.contains("\"provider\":null")) {
                    respond(exchange, 400, "application/json", "{\"detail\":\"AI provider is not configured\"}");
                } else if (stream && request.contains(SLOW)) {
                    streamSlowly(exchange);
                } else if (stream) {
                    respond(exchange, 200, "text/event-stream", request.contains(FAIL) ? STREAM_FAILED : STREAM);
                } else if (request.contains(FAIL)) {
                    respond(exchange, 502, "application/json",
                            "{\"detail\":\"deepseek:deepseek-v4-flash 调用失败：Authentication Fails\"}");
                } else {
                    respond(exchange, 200, "application/json", REPLY);
                }
            });
            server.start();
            return server;
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    private static void respond(HttpExchange exchange, int status, String type, String text) throws IOException {
        byte[] body = text.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", type);
        exchange.sendResponseHeaders(status, body.length);
        exchange.getResponseBody().write(body);
        exchange.close();
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