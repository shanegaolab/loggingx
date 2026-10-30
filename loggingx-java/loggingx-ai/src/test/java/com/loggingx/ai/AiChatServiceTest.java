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
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Runs the client against a local server that answers like the loggingx-ai service.
 */
class AiChatServiceTest {

    private static final String REPLY = """
            {"provider":"deepseek","model":"deepseek-chat","content":"pong","promptTokens":13,"completionTokens":5}""";
    private static final String STREAM = """
            event: message
            data: {"content": "po"}

            event: message
            data: {"content": "ng"}

            event: done
            data: {"provider": "qwen", "model": "qwen-plus", "content": "pong", "promptTokens": 9, "completionTokens": 2}

            """;

    private HttpServer server;
    private final Map<String, String> requests = new ConcurrentHashMap<>();
    private final Map<String, String> apiKeys = new ConcurrentHashMap<>();
    private final AtomicInteger healthCalls = new AtomicInteger();
    private volatile int chatStatus = 200;
    private volatile String chatBody = REPLY;
    private volatile String streamBody = STREAM;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/health", exchange -> {
            healthCalls.incrementAndGet();
            write(exchange, 200, "application/json", "{\"status\":\"ok\",\"providers\":[\"qwen\",\"deepseek\"]}");
        });
        server.createContext("/api/v1/chat", exchange -> {
            String path = exchange.getRequestURI().getPath();
            requests.put(path, new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            apiKeys.put(path, String.valueOf(exchange.getRequestHeaders().getFirst("X-API-Key")));
            if (path.endsWith("/stream")) {
                write(exchange, chatStatus, "text/event-stream", chatStatus == 200 ? streamBody : chatBody);
            } else {
                write(exchange, chatStatus, "application/json", chatBody);
            }
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private AiChatService service() {
        return new AiChatService("http://127.0.0.1:" + server.getAddress().getPort() + "/", "secret",
                Duration.ofSeconds(10));
    }

    @Test
    void withoutAUrlNothingIsAvailable() {
        AiChatService service = new AiChatService("", null, Duration.ofSeconds(1));
        assertThat(service.enabled()).isFalse();
        assertThat(service.providers()).isEmpty();
        assertThatThrownBy(() -> service.chat(new AiChatCommand(null, "ping", null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("LOGGINGX_AI_URL");
    }

    @Test
    void providersComeFromTheServiceAndAreCached() {
        AiChatService service = service();
        assertThat(service.providers()).containsExactly(AiProvider.QWEN, AiProvider.DEEPSEEK);
        assertThat(service.providers()).containsExactly(AiProvider.QWEN, AiProvider.DEEPSEEK);
        assertThat(healthCalls).hasValue(1);
    }

    @Test
    void chatSendsTheCommandAndReadsTheReply() {
        AiChatReply reply = service().chat(new AiChatCommand("deepseek", "ping", "be brief", " deepseek-reasoner "));

        assertThat(reply).isEqualTo(new AiChatReply("deepseek", "deepseek-chat", "pong", 13, 5));
        assertThat(requests.get("/api/v1/chat"))
                .contains("\"message\":\"ping\"", "\"systemPrompt\":\"be brief\"", "\"provider\":\"deepseek\"",
                        "\"model\":\"deepseek-reasoner\"");
        assertThat(apiKeys.get("/api/v1/chat")).isEqualTo("secret");
    }

    @Test
    void serviceErrorsBecomeBadGatewayAndRejectionsBadRequest() {
        chatStatus = 502;
        chatBody = "{\"detail\":\"调用模型失败：deepseek: 401\"}";
        assertThatThrownBy(() -> service().chat(new AiChatCommand(null, "ping", null, null)))
                .isInstanceOf(BadGatewayException.class)
                .hasMessageContaining("调用模型失败");

        chatStatus = 422;
        chatBody = "{\"detail\":[{\"msg\":\"String should have at least 1 character\"}]}";
        assertThatThrownBy(() -> service().chat(new AiChatCommand(null, "", null, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void unreachableServiceIsABadGateway() {
        AiChatService service = new AiChatService("http://127.0.0.1:1", null, Duration.ofSeconds(2));
        assertThat(service.providers()).isEmpty();
        assertThatThrownBy(() -> service.chat(new AiChatCommand(null, "ping", null, null)))
                .isInstanceOf(BadGatewayException.class)
                .hasMessageContaining("Cannot reach loggingx-ai");
    }

    @Test
    void streamsPiecesThenTheWholeReply() {
        List<AiChatStreamEvent> events = service().stream(new AiChatCommand(null, "ping", null, null))
                .collectList().block(Duration.ofSeconds(10));

        assertThat(events).containsExactly(
                new AiChatStreamEvent.Delta("po"),
                new AiChatStreamEvent.Delta("ng"),
                new AiChatStreamEvent.Done(new AiChatReply("qwen", "qwen-plus", "pong", 9, 2)));
        assertThat(requests.get("/api/v1/chat/stream")).contains("\"provider\":null");
    }

    @Test
    void streamErrorsBecomeBadGateway() {
        streamBody = "event: message\ndata: {\"content\": \"po\"}\n\nevent: error\ndata: {\"message\": \"quota\"}\n\n";
        assertThatThrownBy(() -> service().stream(new AiChatCommand(null, "ping", null, null))
                .collectList().block(Duration.ofSeconds(10)))
                .isInstanceOf(BadGatewayException.class)
                .hasMessageContaining("quota");

        chatStatus = 502;
        chatBody = "{\"detail\":\"no provider\"}";
        assertThatThrownBy(() -> service().stream(new AiChatCommand(null, "ping", null, null))
                .collectList().block(Duration.ofSeconds(10)))
                .isInstanceOf(BadGatewayException.class)
                .hasMessageContaining("no provider");
    }

    private static void write(com.sun.net.httpserver.HttpExchange exchange, int status, String type, String body)
            throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", type);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
