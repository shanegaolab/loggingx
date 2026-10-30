package com.loggingx.ai.config;

import com.loggingx.ai.AiChatService;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Connects to the loggingx-ai service ({@code loggingx.ai.*}), which holds the DeepSeek and Qwen keys and runs
 * every AI feature: the chat API, the assistant and multi-agent diagnosis.
 */
@Configuration(proxyBeanMethods = false)
public class AiConfiguration {

    private static final Logger log = LoggerFactory.getLogger(AiConfiguration.class);

    /**
     * @param url     the service's address, e.g. {@code http://localhost:8001}; empty disables AI features
     * @param apiKey  sent as {@code X-API-Key}, matching the service's {@code LOGGINGX_AI_API_KEY}
     * @param timeout for one request; a diagnosis takes several model calls
     */
    @Bean
    public AiChatService aiChatService(@Value("${loggingx.ai.url:}") String url,
                                       @Value("${loggingx.ai.api-key:}") String apiKey,
                                       @Value("${loggingx.ai.timeout:5m}") Duration timeout) {
        AiChatService service = new AiChatService(url, apiKey, timeout);
        if (service.enabled()) {
            log.info("AI features use the loggingx-ai service at {}", service.url());
        } else {
            log.warn("LOGGINGX_AI_URL is not set; AI features are unavailable");
        }
        return service;
    }
}
