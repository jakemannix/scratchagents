package com.react.agent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.react.agent.model.Message;
import com.react.agent.model.Tool;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * OpenRouter API Client
 *
 * Handles communication with the OpenRouter API for LLM chat completions.
 * OpenRouter provides a unified API compatible with OpenAI's format
 * but routes requests to various model providers.
 */
@Service
public class OpenRouterClient {

    private static final String OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${openrouter.api-key:}")
    private String apiKey;

    @Value("${agent.model:openai/gpt-4o-mini}")
    private String defaultModel;

    @Value("${agent.temperature:0.7}")
    private double temperature;

    @Value("${agent.max-tokens:4096}")
    private int maxTokens;

    public OpenRouterClient() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Send a chat completion request to OpenRouter.
     *
     * @param messages The conversation messages
     * @param tools Available tools (optional)
     * @return The assistant's response message
     * @throws RuntimeException if the API call fails
     */
    public Message chat(List<Message> messages, List<Tool> tools) {
        return chat(messages, tools, defaultModel);
    }

    /**
     * Send a chat completion request with a specific model.
     *
     * @param messages The conversation messages
     * @param tools Available tools (optional)
     * @param model The model to use
     * @return The assistant's response message
     */
    public Message chat(List<Message> messages, List<Tool> tools, String model) {
        validateApiKey();

        // Build request body
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", messages);
        requestBody.put("temperature", temperature);
        requestBody.put("max_tokens", maxTokens);

        // Add tools if provided
        if (tools != null && !tools.isEmpty()) {
            List<Map<String, Object>> toolsFormatted = tools.stream()
                .map(Tool::toOpenAIFormat)
                .toList();
            requestBody.put("tools", toolsFormatted);
            requestBody.put("tool_choice", "auto");
        }

        // Set up headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        headers.set("HTTP-Referer", "https://github.com/scratchagents");
        headers.set("X-Title", "ScratchAgents-Java");

        try {
            // Make the request
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                OPENROUTER_API_URL,
                HttpMethod.POST,
                request,
                String.class
            );

            // Parse response
            return parseResponse(response.getBody());

        } catch (Exception e) {
            throw new RuntimeException("OpenRouter API call failed: " + e.getMessage(), e);
        }
    }

    /**
     * Parse the API response into a Message object.
     */
    private Message parseResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);

            // Check for errors
            if (root.has("error")) {
                String errorMessage = root.get("error").has("message")
                    ? root.get("error").get("message").asText()
                    : "Unknown error";
                throw new RuntimeException("API error: " + errorMessage);
            }

            // Extract the message from choices[0].message
            JsonNode messageNode = root.get("choices").get(0).get("message");
            return objectMapper.treeToValue(messageNode, Message.class);

        } catch (Exception e) {
            throw new RuntimeException("Failed to parse API response: " + e.getMessage(), e);
        }
    }

    /**
     * Validate that the API key is configured.
     */
    private void validateApiKey() {
        if (apiKey == null || apiKey.isEmpty()) {
            throw new RuntimeException(
                "OpenRouter API key not configured. " +
                "Set OPENROUTER_API_KEY environment variable or configure in application.properties"
            );
        }
    }

    /**
     * Get the current model being used.
     */
    public String getModel() {
        return defaultModel;
    }

    /**
     * Set the model to use.
     */
    public void setModel(String model) {
        this.defaultModel = model;
    }
}
