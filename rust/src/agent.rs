//! ReAct Agent Implementation
//!
//! This module implements the core ReAct (Reasoning + Acting) agent loop.
//! The agent calls the LLM, executes tools when requested, and continues
//! until a final answer is produced.

use anyhow::{anyhow, Result};

use crate::openrouter::{Message, OpenRouterClient, Tool, ToolCall};
use crate::tools::{execute_tool, get_all_tools};

/// Default system prompt for the agent.
const DEFAULT_SYSTEM_PROMPT: &str = r#"You are a helpful assistant with access to tools.

When answering questions:
1. Think about whether you need to use a tool to answer accurately
2. If a tool would help, use it - don't guess or make up information
3. You can use multiple tools in sequence if needed
4. After getting tool results, provide a clear, helpful response
5. If you're unsure about something, say so

Be concise but thorough in your responses."#;

/// Information about a tool call (for tracking/display).
#[derive(Debug, Clone)]
pub struct ToolCallInfo {
    pub name: String,
    pub arguments: String,
    pub result: String,
}

/// Result of a chat interaction.
pub struct ChatResult {
    pub response: String,
    pub tool_calls: Vec<ToolCallInfo>,
}

/// Callback type for tool call events.
pub type OnToolCall = Box<dyn Fn(&str, &str) + Send + Sync>;
pub type OnToolResult = Box<dyn Fn(&str, &str) + Send + Sync>;

/// ReAct Agent
///
/// Manages conversation state and executes the ReAct loop.
pub struct ReactAgent {
    client: OpenRouterClient,
    tools: Vec<Tool>,
    messages: Vec<Message>,
    max_iterations: u32,
    pub on_tool_call: Option<OnToolCall>,
    pub on_tool_result: Option<OnToolResult>,
}

impl ReactAgent {
    /// Create a new ReAct agent.
    pub fn new(model: &str) -> Result<Self> {
        let client = OpenRouterClient::new(model)?;
        let tools = get_all_tools();

        let mut messages = Vec::new();
        messages.push(Message::system(DEFAULT_SYSTEM_PROMPT));

        Ok(Self {
            client,
            tools,
            messages,
            max_iterations: 10,
            on_tool_call: None,
            on_tool_result: None,
        })
    }

    /// Create a new agent with a custom system prompt.
    pub fn with_system_prompt(model: &str, system_prompt: &str) -> Result<Self> {
        let mut agent = Self::new(model)?;
        agent.messages = vec![Message::system(system_prompt)];
        Ok(agent)
    }

    /// Set the maximum number of tool-use iterations.
    pub fn set_max_iterations(&mut self, max: u32) {
        self.max_iterations = max;
    }

    /// Send a message and get a response.
    pub async fn chat(&mut self, user_message: &str) -> Result<ChatResult> {
        // Add user message
        self.messages.push(Message::user(user_message));

        // Execute ReAct loop
        self.react_loop().await
    }

    /// The core ReAct loop.
    async fn react_loop(&mut self) -> Result<ChatResult> {
        let mut iteration = 0;
        let mut tool_calls_info = Vec::new();

        while iteration < self.max_iterations {
            iteration += 1;

            // Call the LLM
            let assistant_message = self
                .client
                .chat(&self.messages, Some(&self.tools))
                .await?;

            // Add assistant message to history
            self.messages.push(assistant_message.clone());

            // Check for tool calls
            if assistant_message.has_tool_calls() {
                if let Some(tool_calls) = &assistant_message.tool_calls {
                    for tool_call in tool_calls {
                        let info = self.execute_tool_call(tool_call);
                        tool_calls_info.push(info);
                    }
                }
                // Continue loop to process tool results
            } else {
                // No tool calls = final response
                let response = assistant_message.content.unwrap_or_default();
                return Ok(ChatResult {
                    response,
                    tool_calls: tool_calls_info,
                });
            }
        }

        Err(anyhow!(
            "Agent exceeded maximum iterations ({})",
            self.max_iterations
        ))
    }

    /// Execute a single tool call and add result to messages.
    fn execute_tool_call(&mut self, tool_call: &ToolCall) -> ToolCallInfo {
        let name = &tool_call.function.name;
        let arguments = &tool_call.function.arguments;

        // Notify callback
        if let Some(callback) = &self.on_tool_call {
            callback(name, arguments);
        }

        // Execute the tool
        let result = execute_tool(name, arguments);

        // Notify callback
        if let Some(callback) = &self.on_tool_result {
            callback(name, &result);
        }

        // Add tool result to messages
        self.messages
            .push(Message::tool_result(&tool_call.id, &result));

        ToolCallInfo {
            name: name.clone(),
            arguments: arguments.clone(),
            result,
        }
    }

    /// Reset the conversation.
    pub fn reset(&mut self) {
        self.messages = vec![Message::system(DEFAULT_SYSTEM_PROMPT)];
    }

    /// Get the conversation history.
    pub fn get_history(&self) -> &[Message] {
        &self.messages
    }

    /// Get the current model.
    pub fn get_model(&self) -> &str {
        &self.client.model
    }
}
