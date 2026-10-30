package com.loggingx.ai;

/**
 * One chat turn. {@code provider}, {@code systemPrompt} and {@code model} are optional; loggingx-ai then uses its
 * first configured provider and that provider's default model ({@code LOGGINGX_AI_<PROVIDER>_MODEL}).
 */
public record AiChatCommand(String provider, String message, String systemPrompt, String model) {
}
