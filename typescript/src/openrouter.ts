/**
 * OpenRouter API Client
 *
 * This module provides a TypeScript client for calling LLMs via OpenRouter's API.
 * It handles authentication, request formatting, and response parsing.
 */

// OpenRouter API endpoint (OpenAI-compatible)
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Type definitions for the API

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ChatCompletionResponse {
  id: string;
  choices: {
    index: number;
    message: Message;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "OpenRouterError";
  }
}

/**
 * Get the API key from localStorage
 */
export function getApiKey(): string | null {
  return localStorage.getItem("openrouter_api_key");
}

/**
 * Set the API key in localStorage
 */
export function setApiKey(key: string): void {
  localStorage.setItem("openrouter_api_key", key);
}

/**
 * Clear the API key from localStorage
 */
export function clearApiKey(): void {
  localStorage.removeItem("openrouter_api_key");
}

/**
 * Call an LLM via the OpenRouter API.
 *
 * @param messages - Array of conversation messages
 * @param model - Model identifier (e.g., 'openai/gpt-4o-mini')
 * @param tools - Optional array of tool definitions
 * @param temperature - Sampling temperature (0-2)
 * @param maxTokens - Maximum tokens in response
 * @returns The API response
 */
export async function callLLM(
  messages: Message[],
  model: string = "openai/gpt-4o-mini",
  tools?: Tool[],
  temperature: number = 0.7,
  maxTokens: number = 4096
): Promise<ChatCompletionResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new OpenRouterError(
      "API key not set. Please enter your OpenRouter API key in the settings."
    );
  }

  // Build request payload
  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  // Add tools if provided
  if (tools && tools.length > 0) {
    payload.tools = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
    payload.tool_choice = "auto";
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "ScratchAgents",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new OpenRouterError(errorMessage, response.status);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof OpenRouterError) {
      throw error;
    }
    throw new OpenRouterError(`Network error: ${error}`);
  }
}

/**
 * Extract the assistant's message from an API response.
 */
export function extractMessage(response: ChatCompletionResponse): Message {
  return response.choices[0].message;
}

/**
 * Check if a message contains tool calls.
 */
export function hasToolCalls(message: Message): boolean {
  return Boolean(message.tool_calls && message.tool_calls.length > 0);
}

/**
 * Get tool calls from a message.
 */
export function getToolCalls(message: Message): ToolCall[] {
  return message.tool_calls || [];
}
