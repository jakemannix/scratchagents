/**
 * Main UI Integration
 *
 * This module handles the browser UI for the ReAct agent.
 * It manages the chat interface, settings, and message display.
 */

import { ReactAgent } from "./agent";
import { getApiKey, setApiKey, clearApiKey, OpenRouterError } from "./openrouter";
import { ALL_TOOLS } from "./tools";

// DOM Elements
let chatMessages: HTMLElement;
let chatInput: HTMLInputElement;
let sendButton: HTMLButtonElement;
let settingsButton: HTMLElement;
let settingsPanel: HTMLElement;
let apiKeyInput: HTMLInputElement;
let saveApiKeyButton: HTMLButtonElement;
let clearApiKeyButton: HTMLButtonElement;
let modelSelect: HTMLSelectElement;
let resetButton: HTMLButtonElement;

// Agent instance
let agent: ReactAgent;

// Available models for the dropdown
const AVAILABLE_MODELS = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (OpenAI)" },
  { id: "openai/gpt-4o", name: "GPT-4o (OpenAI)" },
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku (Anthropic)" },
  { id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet (Anthropic)" },
  { id: "meta-llama/llama-3-70b-instruct", name: "Llama 3 70B (Meta)" },
  { id: "google/gemini-pro", name: "Gemini Pro (Google)" },
];

/**
 * Initialize the application.
 */
function init(): void {
  // Get DOM elements
  chatMessages = document.getElementById("chat-messages")!;
  chatInput = document.getElementById("chat-input") as HTMLInputElement;
  sendButton = document.getElementById("send-button") as HTMLButtonElement;
  settingsButton = document.getElementById("settings-button")!;
  settingsPanel = document.getElementById("settings-panel")!;
  apiKeyInput = document.getElementById("api-key-input") as HTMLInputElement;
  saveApiKeyButton = document.getElementById("save-api-key") as HTMLButtonElement;
  clearApiKeyButton = document.getElementById("clear-api-key") as HTMLButtonElement;
  modelSelect = document.getElementById("model-select") as HTMLSelectElement;
  resetButton = document.getElementById("reset-button") as HTMLButtonElement;

  // Populate model dropdown
  populateModelSelect();

  // Initialize agent
  initializeAgent();

  // Load existing API key
  const existingKey = getApiKey();
  if (existingKey) {
    apiKeyInput.value = "••••••••••••••••";
    apiKeyInput.dataset.hasKey = "true";
  }

  // Set up event listeners
  setupEventListeners();

  // Show welcome message
  addSystemMessage("Welcome! Enter your OpenRouter API key in settings to get started.");
}

/**
 * Populate the model selection dropdown.
 */
function populateModelSelect(): void {
  modelSelect.innerHTML = "";
  for (const model of AVAILABLE_MODELS) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.name;
    modelSelect.appendChild(option);
  }
}

/**
 * Initialize or reinitialize the agent.
 */
function initializeAgent(): void {
  agent = new ReactAgent({
    model: modelSelect.value,
    tools: ALL_TOOLS,
  });

  // Set up agent callbacks
  agent.onToolCall = (event) => {
    addToolCallMessage(event.name, event.arguments);
  };

  agent.onToolResult = (event) => {
    addToolResultMessage(event.name, event.result);
  };

  agent.onThinking = () => {
    showThinking();
  };
}

/**
 * Set up event listeners.
 */
function setupEventListeners(): void {
  // Send message
  sendButton.addEventListener("click", sendMessage);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Settings panel toggle
  settingsButton.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
  });

  // Close settings when clicking outside
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!settingsPanel.contains(target) && !settingsButton.contains(target)) {
      settingsPanel.classList.add("hidden");
    }
  });

  // Save API key
  saveApiKeyButton.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (key && !key.includes("•")) {
      setApiKey(key);
      apiKeyInput.value = "••••••••••••••••";
      apiKeyInput.dataset.hasKey = "true";
      addSystemMessage("API key saved!");
    }
  });

  // Clear API key
  clearApiKeyButton.addEventListener("click", () => {
    clearApiKey();
    apiKeyInput.value = "";
    apiKeyInput.dataset.hasKey = "false";
    addSystemMessage("API key cleared.");
  });

  // Focus input to allow entering new key
  apiKeyInput.addEventListener("focus", () => {
    if (apiKeyInput.dataset.hasKey === "true") {
      apiKeyInput.value = "";
    }
  });

  // Blur without change restores masked key
  apiKeyInput.addEventListener("blur", () => {
    if (apiKeyInput.value === "" && getApiKey()) {
      apiKeyInput.value = "••••••••••••••••";
    }
  });

  // Model change
  modelSelect.addEventListener("change", () => {
    agent.model = modelSelect.value;
    addSystemMessage(`Switched to model: ${modelSelect.value}`);
  });

  // Reset conversation
  resetButton.addEventListener("click", () => {
    agent.reset();
    chatMessages.innerHTML = "";
    addSystemMessage("Conversation cleared.");
  });
}

/**
 * Send a message to the agent.
 */
async function sendMessage(): Promise<void> {
  const message = chatInput.value.trim();
  if (!message) return;

  // Check for API key
  if (!getApiKey()) {
    addSystemMessage("Please enter your OpenRouter API key in settings first.");
    settingsPanel.classList.remove("hidden");
    return;
  }

  // Clear input
  chatInput.value = "";

  // Add user message to UI
  addUserMessage(message);

  // Disable input while processing
  setInputEnabled(false);

  try {
    // Get response from agent
    const response = await agent.chat(message);

    // Remove thinking indicator
    hideThinking();

    // Add assistant response
    addAssistantMessage(response);
  } catch (error) {
    hideThinking();
    if (error instanceof OpenRouterError) {
      addErrorMessage(error.message);
    } else {
      addErrorMessage(`Error: ${error}`);
    }
  } finally {
    setInputEnabled(true);
    chatInput.focus();
  }
}

/**
 * Enable/disable the input field.
 */
function setInputEnabled(enabled: boolean): void {
  chatInput.disabled = !enabled;
  sendButton.disabled = !enabled;
}

/**
 * Add a user message to the chat.
 */
function addUserMessage(text: string): void {
  const div = document.createElement("div");
  div.className = "message user-message";
  div.innerHTML = `<strong>You:</strong> ${escapeHtml(text)}`;
  chatMessages.appendChild(div);
  scrollToBottom();
}

/**
 * Add an assistant message to the chat.
 */
function addAssistantMessage(text: string): void {
  const div = document.createElement("div");
  div.className = "message assistant-message";
  div.innerHTML = `<strong>Assistant:</strong> ${formatMarkdown(text)}`;
  chatMessages.appendChild(div);
  scrollToBottom();
}

/**
 * Add a system message to the chat.
 */
function addSystemMessage(text: string): void {
  const div = document.createElement("div");
  div.className = "message system-message";
  div.textContent = text;
  chatMessages.appendChild(div);
  scrollToBottom();
}

/**
 * Add an error message to the chat.
 */
function addErrorMessage(text: string): void {
  const div = document.createElement("div");
  div.className = "message error-message";
  div.textContent = `Error: ${text}`;
  chatMessages.appendChild(div);
  scrollToBottom();
}

/**
 * Add a tool call message to the chat.
 */
function addToolCallMessage(name: string, args: Record<string, unknown>): void {
  const div = document.createElement("div");
  div.className = "message tool-message";
  div.innerHTML = `
    <span class="tool-label">Tool Call:</span>
    <code>${escapeHtml(name)}</code>
    <pre>${escapeHtml(JSON.stringify(args, null, 2))}</pre>
  `;
  chatMessages.appendChild(div);
  scrollToBottom();
}

/**
 * Add a tool result message to the chat.
 */
function addToolResultMessage(name: string, result: string): void {
  let formattedResult: string;
  try {
    const parsed = JSON.parse(result);
    formattedResult = JSON.stringify(parsed, null, 2);
  } catch {
    formattedResult = result;
  }

  const div = document.createElement("div");
  div.className = "message tool-result-message";
  div.innerHTML = `
    <span class="tool-label">Tool Result (${escapeHtml(name)}):</span>
    <pre>${escapeHtml(formattedResult)}</pre>
  `;
  chatMessages.appendChild(div);
  scrollToBottom();
}

/**
 * Show thinking indicator.
 */
function showThinking(): void {
  hideThinking(); // Remove any existing
  const div = document.createElement("div");
  div.className = "message thinking-message";
  div.id = "thinking-indicator";
  div.innerHTML = '<span class="thinking-dots">Thinking<span>.</span><span>.</span><span>.</span></span>';
  chatMessages.appendChild(div);
  scrollToBottom();
}

/**
 * Hide thinking indicator.
 */
function hideThinking(): void {
  const indicator = document.getElementById("thinking-indicator");
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Scroll chat to bottom.
 */
function scrollToBottom(): void {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Simple markdown formatting (bold, italic, code).
 */
function formatMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);
