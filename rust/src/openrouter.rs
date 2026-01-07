//! OpenRouter API Client
//!
//! This module provides a Rust client for calling LLMs via OpenRouter's API.
//! It handles authentication, request formatting, and response parsing.

use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

const OPENROUTER_API_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

/// A tool definition that can be sent to the LLM.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

impl Tool {
    /// Convert to OpenAI function calling format.
    pub fn to_openai_format(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters
            }
        })
    }
}

/// A chat message in the conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

impl Message {
    pub fn system(content: &str) -> Self {
        Self {
            role: "system".to_string(),
            content: Some(content.to_string()),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn user(content: &str) -> Self {
        Self {
            role: "user".to_string(),
            content: Some(content.to_string()),
            tool_calls: None,
            tool_call_id: None,
        }
    }

    pub fn tool_result(tool_call_id: &str, content: &str) -> Self {
        Self {
            role: "tool".to_string(),
            content: Some(content.to_string()),
            tool_calls: None,
            tool_call_id: Some(tool_call_id.to_string()),
        }
    }

    pub fn has_tool_calls(&self) -> bool {
        self.tool_calls.as_ref().map_or(false, |tc| !tc.is_empty())
    }
}

/// A tool call requested by the assistant.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: FunctionCall,
}

/// The function details within a tool call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String, // JSON string
}

/// Chat completion response from the API.
#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

/// OpenRouter API client.
pub struct OpenRouterClient {
    client: Client,
    api_key: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
}

impl OpenRouterClient {
    /// Create a new OpenRouter client.
    ///
    /// Reads the API key from the OPENROUTER_API_KEY environment variable.
    pub fn new(model: &str) -> Result<Self> {
        let api_key = env::var("OPENROUTER_API_KEY").map_err(|_| {
            anyhow!(
                "OPENROUTER_API_KEY environment variable not set.\n\
                 Get your API key at https://openrouter.ai/ and set it:\n\
                 Mac/Linux: export OPENROUTER_API_KEY='your-key'\n\
                 Windows:   set OPENROUTER_API_KEY=your-key"
            )
        })?;

        Ok(Self {
            client: Client::new(),
            api_key,
            model: model.to_string(),
            temperature: 0.7,
            max_tokens: 4096,
        })
    }

    /// Send a chat completion request to OpenRouter.
    pub async fn chat(&self, messages: &[Message], tools: Option<&[Tool]>) -> Result<Message> {
        // Build request payload
        let mut payload = serde_json::json!({
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        });

        // Add tools if provided
        if let Some(tools) = tools {
            let tools_formatted: Vec<serde_json::Value> =
                tools.iter().map(|t| t.to_openai_format()).collect();
            payload["tools"] = serde_json::json!(tools_formatted);
            payload["tool_choice"] = serde_json::json!("auto");
        }

        // Make the request
        let response = self
            .client
            .post(OPENROUTER_API_URL)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .header("HTTP-Referer", "https://github.com/scratchagents")
            .header("X-Title", "ScratchAgents-Rust")
            .json(&payload)
            .send()
            .await?;

        // Check for errors
        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await?;
            return Err(anyhow!("API request failed ({}): {}", status, error_text));
        }

        // Parse response
        let completion: ChatCompletionResponse = response.json().await?;
        let message = completion
            .choices
            .into_iter()
            .next()
            .ok_or_else(|| anyhow!("No choices in API response"))?
            .message;

        Ok(message)
    }
}
