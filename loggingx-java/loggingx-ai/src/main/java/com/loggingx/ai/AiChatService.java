package com.loggingx.ai;

import com.loggingx.common.exception.BadGatewayException;
import com.loggingx.common.exception.BadRequestException;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Flux;
import reactor.core.publisher.SynchronousSink;
import reactor.core.scheduler.Schedulers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Talks to the Python loggingx-ai service, which owns the model providers (DeepSeek and Qwen): chat, streamed chat
 * and the other endpoints the AI features call through {@link #post}.
 */
public class AiChatService {

    private static final Logger log = LoggerFactory.getLogger(AiChatService.class);
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final Duration PROVIDERS_TTL = Duration.ofSeconds(30);

    private final String url;
    private final String apiKey;
    private final Duration timeout;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private volatile CachedProviders cachedProviders;

    private record CachedProviders(List<AiProvider> providers, Instant until) {
    }

    /**
     * @param url empty disables AI features
     */
    public AiChatService(String url, String apiKey, Duration timeout) {
        this.url = url == null ? "" : url.strip().replaceAll("/+$", "");
        this.apiKey = apiKey == null ? "" : apiKey.strip();
        this.timeout = timeout;
    }

    public boolean enabled() {
        return !url.isEmpty();
    }

    public String url() {
        return url;
    }

    /**
     * The providers the service has a key for, in its preference order; empty when it is not configured or not
     * reachable. Cached briefly, as the settings page and every question ask for it.
     */
    public List<AiProvider> providers() {
        if (!enabled()) {
            return List.of();
        }
        CachedProviders cached = cachedProviders;
        if (cached != null && cached.until().isAfter(Instant.now())) {
            return cached.providers();
        }
        List<AiProvider> providers = new ArrayList<>();
        try {
            HttpResponse<String> response = http.send(request("/health").timeout(Duration.ofSeconds(5)).GET().build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 200) {
                JSON.readTree(response.body()).path("providers")
                        .forEach(node -> AiProvider.fromId(node.asString("")).ifPresent(providers::add));
            }
        } catch (IOException | RuntimeException e) {
            log.warn("Cannot reach loggingx-ai at {}: {}", url, e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        cachedProviders = new CachedProviders(List.copyOf(providers), Instant.now().plus(PROVIDERS_TTL));
        return cachedProviders.providers();
    }

    public AiChatReply chat(AiChatCommand command) {
        return reply(post("/api/v1/chat", body(command)));
    }

    /**
     * Streams the answer as it is generated. The request is sent right away, so one the service rejects throws here,
     * before anything is streamed; failures after that end the stream with a {@link BadGatewayException}. The
     * returned stream can be subscribed to once. Cancelling the subscription (e.g. the client disconnecting) closes
     * the connection to the service, which stops the model.
     */
    public Flux<AiChatStreamEvent> stream(AiChatCommand command) {
        HttpRequest request = request("/api/v1/chat/stream")
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body(command)),
                        StandardCharsets.UTF_8))
                .build();
        Stream<String> opened = open(request);
        return Flux.using(() -> opened, lines -> Flux.fromStream(lines)
                        .handle(new SseParser()::accept), Stream::close)
                .subscribeOn(Schedulers.boundedElastic());
    }

    /**
     * Sends a JSON request to one of the service's endpoints.
     *
     * @return the JSON answer
     * @throws BadRequestException when the service is not configured
     * @throws BadGatewayException when it cannot be reached or answers with an error
     */
    public JsonNode post(String path, Object body) {
        HttpRequest request = request(path)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        JsonNode answer;
        try {
            answer = JSON.readTree(response.body());
        } catch (RuntimeException e) {
            throw new BadGatewayException("Unexpected answer from loggingx-ai (HTTP " + response.statusCode() + ")");
        }
        if (response.statusCode() != 200) {
            throw failure(response.statusCode(), answer);
        }
        return answer;
    }

    private HttpRequest.Builder request(String path) {
        if (!enabled()) {
            throw new BadRequestException("AI is not configured: set LOGGINGX_AI_URL to the loggingx-ai service");
        }
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url + path)).timeout(timeout);
        if (!apiKey.isEmpty()) {
            builder.header("X-API-Key", apiKey);
        }
        return builder;
    }

    private <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> handler) {
        try {
            return http.send(request, handler);
        } catch (IOException e) {
            throw new BadGatewayException("Cannot reach loggingx-ai at " + url + ": " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BadGatewayException("Interrupted while waiting for loggingx-ai");
        }
    }

    private Stream<String> open(HttpRequest request) {
        HttpResponse<Stream<String>> response = send(request, HttpResponse.BodyHandlers.ofLines());
        if (response.statusCode() != 200) {
            String body;
            try (Stream<String> lines = response.body()) {
                body = String.join("\n", lines.toList());
            } catch (UncheckedIOException e) {
                body = "";
            }
            JsonNode answer;
            try {
                answer = JSON.readTree(body);
            } catch (RuntimeException e) {
                answer = JSON.createObjectNode();
            }
            throw failure(response.statusCode(), answer);
        }
        return response.body();
    }

    private static Map<String, Object> body(AiChatCommand command) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", command.message());
        body.put("systemPrompt", blankToNull(command.systemPrompt()));
        body.put("provider", blankToNull(command.provider()));
        body.put("model", blankToNull(command.model()));
        return body;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static AiChatReply reply(JsonNode node) {
        return new AiChatReply(node.path("provider").asString(null), node.path("model").asString(null),
                node.path("content").asString(""), integer(node.path("promptTokens")),
                integer(node.path("completionTokens")));
    }

    private static Integer integer(JsonNode node) {
        return node.isNumber() ? node.asInt() : null;
    }

    /**
     * FastAPI reports errors as {@code {"detail": "..."}}, or a list of problems for an invalid request.
     */
    private static RuntimeException failure(int status, JsonNode answer) {
        JsonNode detail = answer.path("detail");
        String message = detail.isString() ? detail.asString() : detail.isMissingNode() ? "" : detail.toString();
        if (status == 400 || status == 422) {
            return new BadRequestException("loggingx-ai rejected the request: " + message);
        }
        return new BadGatewayException("loggingx-ai failed (HTTP " + status + "): " + message);
    }

    /**
     * Turns the service's server-sent events into stream events: {@code message} carries a piece of text,
     * {@code done} the whole reply and {@code error} a failure.
     */
    private static final class SseParser {

        private String event = "message";
        private final StringBuilder data = new StringBuilder();

        void accept(String line, SynchronousSink<AiChatStreamEvent> sink) {
            if (line.isEmpty()) {
                dispatch(sink);
            } else if (line.startsWith("event:")) {
                event = line.substring(6).strip();
            } else if (line.startsWith("data:")) {
                data.append(line.substring(5).strip());
            }
        }

        private void dispatch(SynchronousSink<AiChatStreamEvent> sink) {
            if (data.isEmpty()) {
                return;
            }
            JsonNode node = JSON.readTree(data.toString());
            String type = event;
            event = "message";
            data.setLength(0);
            switch (type) {
                case "message" -> sink.next(new AiChatStreamEvent.Delta(node.path("content").asString("")));
                case "done" -> sink.next(new AiChatStreamEvent.Done(reply(node)));
                case "error" -> sink.error(new BadGatewayException("loggingx-ai failed: "
                        + node.path("message").asString("")));
                default -> {
                }
            }
        }
    }
}
