package com.loggingx.ai;

/**
 * One chat turn. {@code provider}, {@code systemPrompt} and {@code model} are optional: without a provider the
 * service uses its default chat model (falling back to the other provider when it fails), without a model the
 * provider's default model.
 */
public record AiChatCommand(String provider, String message, String systemPrompt, String model) {
}
