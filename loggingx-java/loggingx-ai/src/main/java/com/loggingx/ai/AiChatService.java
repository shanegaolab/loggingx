package com.loggingx.ai;

import com.loggingx.common.exception.BadGatewayException;
import com.loggingx.common.exception.BadRequestException;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Flux;
import reactor.core.publisher.SynchronousSink;
import reactor.core.scheduler.Schedulers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Sends chat requests to the loggingx-ai service ({@code POST /api/v1/chat} and {@code /api/v1/chat/stream}),
 * which holds the provider API keys and calls the models; the providers are the ones it reports as configured.
 */
public class AiChatService {

    private static final Logger log = LoggerFactory.getLogger(AiChatService.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Duration HEALTH_TIMEOUT = Duration.ofSeconds(3);

    private final String url;
    private final String apiKey;
    private final Duration timeout;
    // Uvicorn rejects the h2c upgrade that the client would otherwise attempt on plain HTTP.
    private final HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(5)).build();

    /**
     * @param url     the service's address, e.g. {@code http://localhost:8001}
     * @param apiKey  sent as {@code X-API-Key}, matching the service's {@code LOGGINGX_AI_API_KEY}; may be empty
     * @param timeout for a whole answer
     */
    public AiChatService(String url, String apiKey, Duration timeout) {
        this.url = url == null ? "" : url.strip().replaceAll("/+$", "");
        this.apiKey = apiKey == null ? "" : apiKey.strip();
        this.timeout = timeout;
    }

    /**
     * The providers loggingx-ai has an API key for, in declaration order; empty when it cannot be reached.
     */
    public List<AiProvider> providers() {
        if (url.isEmpty()) {
            return List.of();
        }
        try {
            HttpResponse<String> response = http.send(request("/health").timeout(HEALTH_TIMEOUT).GET().build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                log.warn("loggingx-ai health check failed with HTTP {}", response.statusCode());
                return List.of();
            }
            List<AiProvider> configured = JSON.readTree(response.body()).path("providers").valueStream()
                    .map(node -> AiProvider.fromId(node.asString(null)))
                    .flatMap(Optional::stream)
                    .toList();
            return Stream.of(AiProvider.values()).filter(configured::contains).toList();
        } catch (IOException | RuntimeException e) {
            log.warn("Cannot reach loggingx-ai at {}: {}", url, e.getMessage());
            return List.of();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return List.of();
        }
    }

    public AiChatReply chat(AiChatCommand command) {
        HttpResponse<String> response = send(post("/api/v1/chat", command),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        JsonNode answer = parse(response.body(), response.statusCode());
        if (response.statusCode() != 200) {
            throw failure(response.statusCode(), answer);
        }
        return reply(answer);
    }

    /**
     * Streams the answer as it is generated. An unknown or unconfigured provider is rejected before the stream
     * starts; failures reported while streaming end it with a {@link BadGatewayException}. Cancelling the
     * subscription (e.g. the client disconnecting) closes the connection to loggingx-ai.
     */
    public Flux<AiChatStreamEvent> stream(AiChatCommand command) {
        if (command.provider() != null && !command.provider().isBlank()) {
            AiProvider provider = AiProvider.fromId(command.provider())
                    .orElseThrow(() -> new BadRequestException("Unknown AI provider: " + command.provider()));
            if (!providers().contains(provider)) {
                throw new BadRequestException("AI provider '" + provider.id() + "' is not configured");
            }
        }
        HttpRequest request = post("/api/v1/chat/stream", command);
        return Flux.using(
                () -> send(request, HttpResponse.BodyHandlers.ofLines()),
                response -> {
                    if (response.statusCode() != 200) {
                        String body = String.join("\n", response.body().toList());
                        return Flux.error(failure(response.statusCode(), parse(body, response.statusCode())));
                    }
                    Iterator<String> lines = response.body().iterator();
                    ServerSentEvents events = new ServerSentEvents();
                    return Flux.<String>fromIterable(() -> lines).handle(events::accept);
                },
                response -> response.body().close())
                .subscribeOn(Schedulers.boundedElastic());
    }

    private HttpRequest.Builder request(String path) {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(url + path));
        if (!apiKey.isEmpty()) {
            request.header("X-API-Key", apiKey);
        }
        return request;
    }

    private HttpRequest post(String path, AiChatCommand command) {
        if (url.isEmpty()) {
            throw new BadRequestException("loggingx-ai is not configured: set LOGGINGX_AI_AGENT_URL");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("provider", blankToNull(command.provider()));
        body.put("model", blankToNull(command.model()));
        body.put("message", command.message());
        body.put("systemPrompt", blankToNull(command.systemPrompt()));
        return request(path).timeout(timeout)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();
    }

    private <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> handler) {
        try {
            return http.send(request, handler);
        } catch (IOException e) {
            log.warn("event=ai.chat.failed url={} error={}", url, e.toString());
            throw new BadGatewayException("Cannot reach loggingx-ai at " + url + ": " + e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BadGatewayException("Interrupted while waiting for loggingx-ai");
        }
    }

    private static JsonNode parse(String body, int status) {
        try {
            return JSON.readTree(body);
        } catch (RuntimeException e) {
            throw new BadGatewayException("Unexpected answer from loggingx-ai (HTTP " + status + ")");
        }
    }

    /**
     * loggingx-ai answers 400 for an unknown or unconfigured provider and 502 when the model call failed.
     */
    private static RuntimeException failure(int status, JsonNode answer) {
        JsonNode detail = answer.path("detail");
        String message = detail.isString() ? detail.asString() : detail.toString();
        if (status == 400) {
            return new BadRequestException(message);
        }
        log.warn("event=ai.chat.failed status={} detail={}", status, message);
        return new BadGatewayException("AI request failed (HTTP " + status + "): " + message);
    }

    private static AiChatReply reply(JsonNode answer) {
        return new AiChatReply(answer.path("provider").asString(null), answer.path("model").asString(null),
                answer.path("content").asString(""), intOrNull(answer.path("promptTokens")),
                intOrNull(answer.path("completionTokens")));
    }

    private static Integer intOrNull(JsonNode node) {
        return node.isNumber() ? node.asInt() : null;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    /**
     * Turns the service's server-sent events into stream events: {@code delta} pieces, then {@code result}, or
     * {@code error}.
     */
    private static final class ServerSentEvents {

        private String event = "message";
        private final StringBuilder data = new StringBuilder();

        void accept(String line, SynchronousSink<AiChatStreamEvent> sink) {
            if (line.isEmpty()) {
                dispatch(sink);
            } else if (line.startsWith("event:")) {
                event = line.substring(6).strip();
            } else if (line.startsWith("data:")) {
                data.append(data.isEmpty() ? "" : "\n").append(line.substring(5).strip());
            }
        }

        private void dispatch(SynchronousSink<AiChatStreamEvent> sink) {
            if (data.isEmpty()) {
                return;
            }
            JsonNode payload = parse(data.toString(), 200);
            String name = event;
            event = "message";
            data.setLength(0);
            switch (name) {
                case "delta" -> {
                    String content = payload.path("content").asString("");
                    if (!content.isEmpty()) {
                        sink.next(new AiChatStreamEvent.Delta(content));
                    }
                }
                case "result" -> sink.next(new AiChatStreamEvent.Done(reply(payload)));
                case "error" -> sink.error(new BadGatewayException("AI request failed: "
                        + payload.path("message").asString("")));
                case "done" -> sink.complete();
                default -> {
                }
            }
        }
    }
}
