/**
 * ReAct Agent Implementation
 *
 * This module implements the core ReAct (Reasoning + Acting) agent loop.
 * The agent calls the LLM, executes tools when requested, and continues
 * until a final answer is produced.
 */

import {
  callLLM,
  extractMessage,
  hasToolCalls,
  getToolCalls,
  OpenRouterError,
  type Message,
  type Tool,
  type ToolCall,
} from "./openrouter";
import { executeTool, ALL_TOOLS } from "./tools";

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant with access to tools.

When answering questions:
1. Think about whether you need to use a tool to answer accurately
2. If a tool would help, use it - don't guess or make up information
3. You can use multiple tools in sequence if needed
4. After getting tool results, provide a clear, helpful response to the user
5. If you're unsure about something, say so

Be concise but thorough in your responses.`;

// Event types for the agent
export interface ToolCallEvent {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultEvent {
  name: string;
  result: string;
}

export interface AgentConfig {
  model?: string;
  systemPrompt?: string;
  tools?: Tool[];
  maxIterations?: number;
  temperature?: number;
}

/**
 * ReAct Agent class
 *
 * Manages conversation state and executes the ReAct loop.
 */
export class ReactAgent {
  model: string;
  systemPrompt: string;
  tools: Tool[];
  maxIterations: number;
  temperature: number;
  messages: Message[];

  // Event callbacks
  onToolCall?: (event: ToolCallEvent) => void;
  onToolResult?: (event: ToolResultEvent) => void;
  onThinking?: () => void;

  constructor(config: AgentConfig = {}) {
    this.model = config.model ?? "openai/gpt-4o-mini";
    this.systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.tools = config.tools ?? ALL_TOOLS;
    this.maxIterations = config.maxIterations ?? 10;
    this.temperature = config.temperature ?? 0.7;

    // Initialize with system prompt
    this.messages = [{ role: "system", content: this.systemPrompt }];
  }

  /**
   * Send a message and get a response.
   * This executes the full ReAct loop.
   */
  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    this.messages.push({ role: "user", content: userMessage });

    // Execute ReAct loop
    return await this.reactLoop();
  }

  /**
   * The core ReAct loop.
   */
  private async reactLoop(): Promise<string> {
    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;

      // Notify thinking
      this.onThinking?.();

      // Call the LLM
      const response = await callLLM(
        this.messages,
        this.model,
        this.tools,
        this.temperature
      );

      const assistantMessage = extractMessage(response);

      // Add assistant message to history
      this.messages.push(assistantMessage);

      // Check for tool calls
      if (hasToolCalls(assistantMessage)) {
        const toolCalls = getToolCalls(assistantMessage);

        for (const toolCall of toolCalls) {
          await this.executeToolCall(toolCall);
        }

        // Continue loop to process tool results
      } else {
        // No tool calls = final response
        return assistantMessage.content ?? "";
      }
    }

    // Safety: exceeded max iterations
    throw new OpenRouterError(
      `Agent exceeded maximum iterations (${this.maxIterations}). The agent may be stuck in a loop.`
    );
  }

  /**
   * Execute a single tool call and add result to messages.
   */
  private async executeToolCall(toolCall: ToolCall): Promise<void> {
    const toolName = toolCall.function.name;
    let args: Record<string, unknown>;

    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      args = {};
    }

    // Notify callback
    this.onToolCall?.({ name: toolName, arguments: args });

    // Execute the tool (async - may make HTTP requests)
    const result = await executeTool(toolName, args);

    // Notify callback
    this.onToolResult?.({ name: toolName, result });

    // Add tool result to messages
    this.messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: result,
    });
  }

  /**
   * Reset conversation history.
   */
  reset(): void {
    this.messages = [{ role: "system", content: this.systemPrompt }];
  }

  /**
   * Get conversation history.
   */
  getHistory(): Message[] {
    return [...this.messages];
  }

  /**
   * Create agent from agentfile configuration.
   */
  static fromAgentFile(agentFile: Record<string, unknown>): ReactAgent {
    const settings = (agentFile.settings ?? {}) as Record<string, unknown>;

    return new ReactAgent({
      model: agentFile.model as string,
      systemPrompt: agentFile.system_prompt as string,
      tools: agentFile.tools as Tool[],
      maxIterations: settings.max_iterations as number,
      temperature: settings.temperature as number,
    });
  }
}
