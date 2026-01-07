package com.react.agent.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

/**
 * Chat Message Model
 *
 * Represents a message in the conversation. Messages can be from:
 * - system: Initial instructions to the LLM
 * - user: Messages from the human user
 * - assistant: Responses from the LLM (may include tool calls)
 * - tool: Results from tool execution
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Message {
    private String role;
    private String content;

    @JsonProperty("tool_calls")
    private List<ToolCall> toolCalls;

    @JsonProperty("tool_call_id")
    private String toolCallId;

    // Constructors

    public Message() {}

    public Message(String role, String content) {
        this.role = role;
        this.content = content;
    }

    public Message(String role, String toolCallId, String content) {
        this.role = role;
        this.toolCallId = toolCallId;
        this.content = content;
    }

    // Static factory methods

    public static Message system(String content) {
        return new Message("system", content);
    }

    public static Message user(String content) {
        return new Message("user", content);
    }

    public static Message assistant(String content) {
        return new Message("assistant", content);
    }

    public static Message toolResult(String toolCallId, String content) {
        Message msg = new Message();
        msg.setRole("tool");
        msg.setToolCallId(toolCallId);
        msg.setContent(content);
        return msg;
    }

    // Helper methods

    public boolean hasToolCalls() {
        return toolCalls != null && !toolCalls.isEmpty();
    }

    // Getters and Setters

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public List<ToolCall> getToolCalls() {
        return toolCalls;
    }

    public void setToolCalls(List<ToolCall> toolCalls) {
        this.toolCalls = toolCalls;
    }

    public String getToolCallId() {
        return toolCallId;
    }

    public void setToolCallId(String toolCallId) {
        this.toolCallId = toolCallId;
    }

    /**
     * Represents a tool call requested by the assistant.
     */
    public static class ToolCall {
        private String id;
        private String type;
        private Function function;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public Function getFunction() {
            return function;
        }

        public void setFunction(Function function) {
            this.function = function;
        }
    }

    /**
     * The function details within a tool call.
     */
    public static class Function {
        private String name;
        private String arguments; // JSON string

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getArguments() {
            return arguments;
        }

        public void setArguments(String arguments) {
            this.arguments = arguments;
        }
    }
}
