package com.loggingx.biz.ai;

import com.loggingx.biz.ai.CodeRepositories.CodeRef;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Client of the loggingx-ai service, which diagnoses an error with several agents (log analysis, code analysis, root
 * cause, fix and review on DeepSeek and Qwen). Disabled when {@code loggingx.ai.agent.url} is empty.
 */
@Component
public class AiAgentClient {

    /** The provider recorded on diagnoses made by loggingx-ai. */
    public static final String PROVIDER = "loggingx-ai";

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final String url;
    private final String apiKey;
    private final Duration timeout;
    // Uvicorn rejects the h2c upgrade that the client would otherwise attempt on plain HTTP.
    private final HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(10)).build();

    /**
     * @param url     the service's address, e.g. {@code http://localhost:8001}; empty disables it
     * @param apiKey  sent as {@code X-API-Key}, matching the service's {@code LOGGINGX_AI_API_KEY}
     * @param timeout for a whole diagnosis, which takes several model calls
     */
    public AiAgentClient(@Value("${loggingx.ai.agent.url:}") String url,
                         @Value("${loggingx.ai.agent.api-key:}") String apiKey,
                         @Value("${loggingx.ai.agent.timeout:5m}") Duration timeout) {
        this.url = url == null ? "" : url.strip().replaceAll("/+$", "");
        this.apiKey = apiKey == null ? "" : apiKey.strip();
        this.timeout = timeout;
    }

    public boolean enabled() {
        return !url.isEmpty();
    }

    /**
     * What to diagnose: the log, where it came from, and the code its stack trace points to.
     */
    public record Request(String logText, Long storeId, String storeName, String host, String source, Instant time,
                          String repoCommit, List<CodeRef> codeRefs) {
    }

    /**
     * The service's answer, in the fields of {@code ai_diagnosis}.
     *
     * @param model the model of the root cause agent
     */
    public record Result(String summary, String rootCause, String suggestion, String diff, String confidence,
                         String model, Integer promptTokens, Integer completionTokens) {
    }

    public Result diagnose(Request request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("logText", request.logText());
        body.put("storeId", request.storeId());
        body.put("storeName", request.storeName());
        body.put("host", request.host());
        body.put("source", request.source());
        body.put("time", request.time() == null ? null : request.time().toString());
        body.put("repoCommit", request.repoCommit());
        body.put("codeRefs", request.codeRefs());

        HttpRequest.Builder http = HttpRequest.newBuilder(URI.create(url + "/api/v1/diagnoses"))
                .timeout(timeout)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body), StandardCharsets.UTF_8));
        if (!apiKey.isEmpty()) {
            http.header("X-API-Key", apiKey);
        }
        HttpResponse<String> response;
        try {
            response = this.http.send(http.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new IllegalStateException("Cannot reach loggingx-ai at " + url + ": " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted");
        }
        JsonNode answer;
        try {
            answer = JSON.readTree(response.body());
        } catch (RuntimeException e) {
            throw new IllegalStateException("Unexpected answer from loggingx-ai (HTTP " + response.statusCode() + ")");
        }
        if (response.statusCode() != 200) {
            JsonNode detail = answer.path("detail");
            throw new IllegalStateException("loggingx-ai failed (HTTP " + response.statusCode() + "): "
                    + (detail.isString() ? detail.asString() : detail.toString()));
        }
        String diff = answer.path("diff").asString("").strip();
        return new Result(answer.path("summary").asString("").strip(), answer.path("rootCause").asString("").strip(),
                answer.path("suggestion").asString("").strip(), diff.isEmpty() ? null : diff,
                answer.path("confidence").asString(null), answer.path("model").asString(null),
                answer.path("promptTokens").asInt(0), answer.path("completionTokens").asInt(0));
    }
}
