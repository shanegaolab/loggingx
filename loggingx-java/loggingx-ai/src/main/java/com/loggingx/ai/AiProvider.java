package com.loggingx.ai;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * Chat model providers of the loggingx-ai service; {@link #id()} is the name used in requests and settings.
 */
public enum AiProvider {
    DEEPSEEK("deepseek"),
    QWEN("qwen");

    private final String id;

    AiProvider(String id) {
        this.id = id;
    }

    public String id() {
        return id;
    }

    public static Optional<AiProvider> fromId(String id) {
        if (id == null) {
            return Optional.empty();
        }
        String normalized = id.trim().toLowerCase(Locale.ROOT);
        return Arrays.stream(values()).filter(provider -> provider.id.equals(normalized)).findFirst();
    }
}
