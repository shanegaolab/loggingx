package com.loggingx.ai.config;

import com.loggingx.ai.AiChatService;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Every model call goes through the loggingx-ai service (../loggingx-ai in this repository), which holds the
 * provider API keys; this application only needs its address.
 */
@Configuration(proxyBeanMethods = false)
public class AiConfiguration {

    @Bean
    public AiChatService aiChatService(@Value("${loggingx.ai.agent.url:}") String url,
                                       @Value("${loggingx.ai.agent.api-key:}") String apiKey,
                                       @Value("${loggingx.ai.agent.timeout:5m}") Duration timeout) {
        return new AiChatService(url, apiKey, timeout);
    }
}
