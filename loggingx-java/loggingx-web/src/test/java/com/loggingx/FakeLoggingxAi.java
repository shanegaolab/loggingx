package com.loggingx;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * A local stand-in for the Python loggingx-ai service: {@code /health} lists the given providers and every other
 * request is recorded and handed to the test's handler.
 */
final class FakeLoggingxAi {

    static final String API_KEY = "it-ai-key";
    private static final JsonMapper JSON = JsonMapper.builder().build();

    /**
     * A request the service received.
     */
    record Call(String path, JsonNode body, String apiKey) {
    }

    @FunctionalInterface
    interface Handler {
        void handle(HttpExchange exchange, String path, JsonNode body) throws IOException;
    }

    final List<Call> calls = new CopyOnWriteArrayList<>();
    private final HttpServer server;

    FakeLoggingxAi(List<String> providers, Handler handler) {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.createContext("/health", exchange -> respond(exchange, 200,
                json(Map.of("status", "ok", "providers", providers))));
        server.createContext("/api/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            JsonNode body = JSON.readTree(exchange.getRequestBody().readAllBytes());
            calls.add(new Call(path, body, exchange.getRequestHeaders().getFirst("X-API-Key")));
            handler.handle(exchange, path, body);
        });
        server.start();
    }

    String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/";
    }

    List<Call> calls(String path) {
        return calls.stream().filter(call -> call.path().equals(path)).toList();
    }

    void stop() {
        server.stop(0);
    }

    static void respond(HttpExchange exchange, int status, String json) throws IOException {
        write(exchange, status, "application/json", json);
    }

    static void stream(HttpExchange exchange, String events) throws IOException {
        write(exchange, 200, "text/event-stream", events);
    }

    static String event(String name, Object data) {
        return "event: " + name + "\ndata: " + json(data) + "\n\n";
    }

    static String json(Object value) {
        return JSON.writeValueAsString(value);
    }

    private static void write(HttpExchange exchange, int status, String type, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", type);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
