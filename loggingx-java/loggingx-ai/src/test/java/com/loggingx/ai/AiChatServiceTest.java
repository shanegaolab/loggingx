package com.loggingx.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.loggingx.common.exception.BadGatewayException;
import com.loggingx.common.exception.BadRequestException;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Runs the client against a local server that answers like the loggingx-ai service.
 */
class AiChatServiceTest {

    private static final String REPLY = """
            {"provider":"qwen","model":"qwen-plus","content":"pong","promptTokens":11,"completionTokens":3}""";
    private static final String STREAM = """
            event: delta
            data: {"content": "po"}

            event: delta
            data: {"content": "ng"}

            event: result
            data: {"provider": "deepseek", "model": "deepseek-chat", "content": "pong", "promptTokens": 5, "completionTokens": 2}

            event: done
            data: {}

            """;

    private HttpServer server;
    private final Map<String, String> requests = new ConcurrentHashMap<>();
    private final Map<String, String> headers = new ConcurrentHashMap<>();
    private volatile int status = 200;
    private volatile String body = REPLY;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/health", exchange -> respond(exchange, 200, "application/json",
                "{\"status\":\"ok\",\"providers\":[\"qwen\",\"deepseek\"]}"));
        server.createContext("/api/v1/chat", exchange -> {
            String path = exchange.getRequestURI().getPath();
            requests.put(path, new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            headers.put(path, String.valueOf(exchange.getRequestHeaders().getFirst("X-API-Key")));
            boolean stream = path.endsWith("/stream");
            respond(exchange, status, stream && status == 200 ? "text/event-stream" : "application/json",
                    stream && status == 200 ? STREAM : body);
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private static void respond(com.sun.net.httpserver.HttpExchange exchange, int code, String type, String text)
            throws IOException {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", type);
        exchange.sendResponseHeaders(code, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private AiChatService service(String apiKey) {
        return new AiChatService("http://127.0.0.1:" + server.getAddress().getPort() + "/", apiKey,
                Duration.ofSeconds(10));
    }

    @Test
    void providersAreTheOnesTheServiceReportsInDeclarationOrder() {
        assertThat(service("").providers()).containsExactly(AiProvider.DEEPSEEK, AiProvider.QWEN);
    }

    @Test
    void providersAreEmptyWhenTheServiceIsDown() {
        AiChatService service = service("");
        server.stop(0);
        assertThat(service.providers()).isEmpty();
    }

    @Test
    void chatSendsTheCommandAndReturnsTheAnswer() {
        AiChatReply reply = service("secret").chat(new AiChatCommand("qwen", "ping", "be brief", " "));

        assertThat(reply).isEqualTo(new AiChatReply("qwen", "qwen-plus", "pong", 11, 3));
        assertThat(requests.get("/api/v1/chat"))
                .isEqualTo("{\"provider\":\"qwen\",\"model\":null,\"message\":\"ping\",\"systemPrompt\":\"be brief\"}");
        assertThat(headers.get("/api/v1/chat")).isEqualTo("secret");
    }

    @Test
    void anUnconfiguredProviderIsABadRequest() {
        status = 400;
        body = "{\"detail\":\"AI provider 'qwen' is not configured\"}";

        assertThatThrownBy(() -> service("").chat(new AiChatCommand("qwen", "ping", null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("AI provider 'qwen' is not configured");
    }

    @Test
    void aFailedModelCallIsABadGateway() {
        status = 502;
        body = "{\"detail\":\"deepseek:deepseek-chat 调用失败：401\"}";

        assertThatThrownBy(() -> service("").chat(new AiChatCommand(null, "ping", null, null)))
                .isInstanceOf(BadGatewayException.class)
                .hasMessageContaining("调用失败");
    }

    @Test
    void streamsDeltasThenTheWholeAnswer() {
        List<AiChatStreamEvent> events = service("").stream(new AiChatCommand(null, "ping", null, null))
                .collectList().block(Duration.ofSeconds(10));

        assertThat(events).containsExactly(
                new AiChatStreamEvent.Delta("po"),
                new AiChatStreamEvent.Delta("ng"),
                new AiChatStreamEvent.Done(new AiChatReply("deepseek", "deepseek-chat", "pong", 5, 2)));
    }

    @Test
    void streamRejectsAnUnknownProviderBeforeStarting() {
        assertThatThrownBy(() -> service("").stream(new AiChatCommand("openai", "ping", null, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void anUnreachableServiceIsABadGateway() {
        AiChatService service = service("");
        server.stop(0);
        assertThatThrownBy(() -> service.chat(new AiChatCommand(null, "ping", null, null)))
                .isInstanceOf(BadGatewayException.class)
                .hasMessageContaining("Cannot reach loggingx-ai");
    }
}
