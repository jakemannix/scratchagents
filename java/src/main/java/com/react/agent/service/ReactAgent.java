package com.react.agent.service;

import com.react.agent.model.Message;
import com.react.agent.model.Tool;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * ReAct Agent Service
 *
 * Implements the core ReAct (Reasoning + Acting) loop.
 * The agent:
 * 1. Receives a user message
 * 2. Calls the LLM with available tools
 * 3. Executes any requested tools
 * 4. Repeats until the LLM provides a final answer
 */
@Service
public class ReactAgent {

    private static final String DEFAULT_SYSTEM_PROMPT = """
        You are a helpful assistant with access to tools.

        When answering questions:
        1. Think about whether you need to use a tool to answer accurately
        2. If a tool would help, use it - don't guess or make up information
        3. You can use multiple tools in sequence if needed
        4. After getting tool results, provide a clear, helpful response
        5. If you're unsure about something, say so

        Be concise but thorough in your responses.
        """;

    private final OpenRouterClient openRouterClient;
    private final ToolExecutor toolExecutor;

    @Value("${agent.max-iterations:10}")
    private int maxIterations;

    @Value("${agent.system-prompt:}")
    private String configuredSystemPrompt;

    // Conversation state (per-session; in production, use proper session management)
    private final List<Message> messages = new CopyOnWriteArrayList<>();

    // Track tool calls for the current response
    private final List<ToolCallInfo> currentToolCalls = new CopyOnWriteArrayList<>();

    public ReactAgent(OpenRouterClient openRouterClient, ToolExecutor toolExecutor) {
        this.openRouterClient = openRouterClient;
        this.toolExecutor = toolExecutor;
        initializeConversation();
    }

    /**
     * Initialize the conversation with the system prompt.
     */
    private void initializeConversation() {
        String systemPrompt = (configuredSystemPrompt != null && !configuredSystemPrompt.isEmpty())
            ? configuredSystemPrompt
            : DEFAULT_SYSTEM_PROMPT;
        messages.add(Message.system(systemPrompt));
    }

    /**
     * Send a message to the agent and get a response.
     *
     * @param userMessage The user's input
     * @return The agent's response
     */
    public ChatResult chat(String userMessage) {
        // Clear previous tool calls
        currentToolCalls.clear();

        // Add user message
        messages.add(Message.user(userMessage));

        // Execute ReAct loop
        String response = reactLoop();

        return new ChatResult(response, new ArrayList<>(currentToolCalls));
    }

    /**
     * The core ReAct loop.
     */
    private String reactLoop() {
        int iteration = 0;
        List<Tool> tools = toolExecutor.getAvailableTools();

        while (iteration < maxIterations) {
            iteration++;

            // Call the LLM
            Message assistantMessage = openRouterClient.chat(messages, tools);
            messages.add(assistantMessage);

            // Check for tool calls
            if (assistantMessage.hasToolCalls()) {
                for (Message.ToolCall toolCall : assistantMessage.getToolCalls()) {
                    executeToolCall(toolCall);
                }
                // Continue loop to process tool results
            } else {
                // No tool calls = final response
                return assistantMessage.getContent();
            }
        }

        throw new RuntimeException("Agent exceeded maximum iterations (" + maxIterations + ")");
    }

    /**
     * Execute a single tool call and add result to messages.
     */
    private void executeToolCall(Message.ToolCall toolCall) {
        String toolName = toolCall.getFunction().getName();
        String arguments = toolCall.getFunction().getArguments();

        // Execute the tool
        String result = toolExecutor.execute(toolName, arguments);

        // Track the tool call
        currentToolCalls.add(new ToolCallInfo(toolName, arguments, result));

        // Add tool result to messages
        messages.add(Message.toolResult(toolCall.getId(), result));
    }

    /**
     * Reset the conversation.
     */
    public void reset() {
        messages.clear();
        currentToolCalls.clear();
        initializeConversation();
    }

    /**
     * Get the conversation history.
     */
    public List<Message> getHistory() {
        return new ArrayList<>(messages);
    }

    /**
     * Get the current model.
     */
    public String getModel() {
        return openRouterClient.getModel();
    }

    /**
     * Result of a chat interaction.
     */
    public record ChatResult(
        String response,
        List<ToolCallInfo> toolCalls
    ) {}

    /**
     * Information about a tool call.
     */
    public record ToolCallInfo(
        String name,
        String arguments,
        String result
    ) {}
}
