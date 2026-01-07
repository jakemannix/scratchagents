package com.react.agent.controller;

import com.react.agent.model.Message;
import com.react.agent.service.ReactAgent;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for Chat API
 *
 * Provides HTTP endpoints for interacting with the ReAct agent.
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Allow browser requests for development
public class ChatController {

    private final ReactAgent reactAgent;

    public ChatController(ReactAgent reactAgent) {
        this.reactAgent = reactAgent;
    }

    /**
     * Send a chat message and get a response.
     *
     * POST /api/chat
     * Body: { "message": "What is 25 * 4?" }
     */
    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        if (request.message() == null || request.message().isBlank()) {
            return ResponseEntity.badRequest()
                .body(new ChatResponse("Message is required", List.of()));
        }

        try {
            ReactAgent.ChatResult result = reactAgent.chat(request.message());
            return ResponseEntity.ok(new ChatResponse(result.response(), result.toolCalls()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(new ChatResponse("Error: " + e.getMessage(), List.of()));
        }
    }

    /**
     * Reset the conversation history.
     *
     * POST /api/reset
     */
    @PostMapping("/reset")
    public ResponseEntity<Map<String, String>> reset() {
        reactAgent.reset();
        return ResponseEntity.ok(Map.of("status", "Conversation reset"));
    }

    /**
     * Get the conversation history.
     *
     * GET /api/history
     */
    @GetMapping("/history")
    public ResponseEntity<List<Message>> getHistory() {
        return ResponseEntity.ok(reactAgent.getHistory());
    }

    /**
     * Health check endpoint.
     *
     * GET /api/health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "model", reactAgent.getModel()
        ));
    }

    /**
     * Chat request body.
     */
    public record ChatRequest(String message) {}

    /**
     * Chat response body.
     */
    public record ChatResponse(
        String response,
        List<ReactAgent.ToolCallInfo> toolCalls
    ) {}
}
