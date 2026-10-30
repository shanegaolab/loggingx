package com.loggingx.biz.ai;

import com.loggingx.ai.AiChatService;
import com.loggingx.biz.ai.CodeRepositories.CodeRef;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Multi-agent diagnosis by the loggingx-ai service: log analysis, code analysis, root cause, fix and review on
 * DeepSeek and Qwen.
 */
@Component
public class AiAgentClient {

    /** The provider recorded on diagnoses made by loggingx-ai. */
    public static final String PROVIDER = "loggingx-ai";

    private final AiChatService service;

    public AiAgentClient(AiChatService service) {
        this.service = service;
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

        JsonNode answer = service.post("/api/v1/diagnoses", body);
        String diff = answer.path("diff").asString("").strip();
        return new Result(answer.path("summary").asString("").strip(), answer.path("rootCause").asString("").strip(),
                answer.path("suggestion").asString("").strip(), diff.isEmpty() ? null : diff,
                answer.path("confidence").asString(null), answer.path("model").asString(null),
                answer.path("promptTokens").asInt(0), answer.path("completionTokens").asInt(0));
    }
}
