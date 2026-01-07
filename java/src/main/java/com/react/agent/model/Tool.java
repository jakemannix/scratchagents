package com.react.agent.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

/**
 * Tool Definition Model
 *
 * Represents a tool that the agent can use. Each tool has:
 * - A unique name (identifier)
 * - A description (shown to the LLM)
 * - Parameters defined using JSON Schema
 */
public record Tool(
    String name,
    String description,
    Parameters parameters
) {
    /**
     * JSON Schema parameters for a tool.
     */
    public record Parameters(
        String type,
        Map<String, Property> properties,
        List<String> required
    ) {}

    /**
     * A single parameter property.
     */
    public record Property(
        String type,
        String description,
        @JsonProperty("enum") List<String> enumValues,
        @JsonProperty("default") Object defaultValue
    ) {}

    /**
     * Convert to OpenAI function calling format.
     */
    public Map<String, Object> toOpenAIFormat() {
        return Map.of(
            "type", "function",
            "function", Map.of(
                "name", name,
                "description", description,
                "parameters", Map.of(
                    "type", parameters.type(),
                    "properties", parameters.properties(),
                    "required", parameters.required() != null ? parameters.required() : List.of()
                )
            )
        );
    }
}
