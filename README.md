# ReAct Chatbot Agents from Scratch

A pedagogical collection of ReAct (Reasoning + Acting) agents implemented in multiple languages, designed to teach the fundamentals of agentic AI without relying on heavy frameworks like LangChain.

## What is a ReAct Agent?

ReAct agents follow a simple but powerful pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                      ReAct Loop                              │
│                                                              │
│   User Query ──▶ Think ──▶ Act ──▶ Observe ──┐              │
│                    ▲                          │              │
│                    └──────────────────────────┘              │
│                         (repeat until done)                  │
│                              │                               │
│                              ▼                               │
│                        Final Answer                          │
└─────────────────────────────────────────────────────────────┘
```

1. **Think**: The LLM reasons about what to do next
2. **Act**: Execute a tool/function based on the reasoning
3. **Observe**: Feed the tool's output back to the LLM
4. **Repeat**: Continue until the task is complete

## Project Structure

```
scratchagents/
├── README.md                 # This file
├── agentfile.schema.json     # JSON Schema for agent configuration
├── example.agentfile.json    # Example agent configuration
│
├── python/                   # Python implementation
│   ├── README.md
│   ├── requirements.txt
│   ├── agent.py              # Main ReAct agent
│   ├── tools.py              # Tool definitions
│   └── main.py               # CLI chat interface
│
├── typescript/               # Browser-based TypeScript implementation
│   ├── README.md
│   ├── package.json
│   ├── index.html            # Single-page chat UI
│   └── src/
│       ├── agent.ts          # Main ReAct agent
│       ├── tools.ts          # Tool definitions
│       └── main.ts           # UI integration
│
├── java/                     # Java SpringBoot implementation
│   ├── README.md
│   ├── pom.xml
│   └── src/main/java/com/react/agent/
│       ├── ReactAgentApplication.java
│       ├── Agent.java
│       ├── Tool.java
│       └── ChatController.java
│
└── rust/                     # Rust implementation
    ├── README.md
    ├── Cargo.toml
    └── src/
        ├── main.rs
        ├── agent.rs
        └── tools.rs
```

## The Agent Card Format

All implementations share a common configuration format (`.agentfile.json`):

```json
{
  "name": "my-assistant",
  "description": "A helpful assistant",
  "model": "openai/gpt-4o-mini",
  "system_prompt": "You are a helpful assistant...",
  "tools": [
    {
      "name": "calculator",
      "description": "Perform mathematical calculations",
      "parameters": {
        "type": "object",
        "properties": {
          "expression": {
            "type": "string",
            "description": "The math expression to evaluate"
          }
        },
        "required": ["expression"]
      }
    }
  ],
  "settings": {
    "max_iterations": 10,
    "temperature": 0.7
  }
}
```

## Quick Start

### Prerequisites

You'll need an OpenRouter API key. Get one at [openrouter.ai](https://openrouter.ai/).

Set your API key:

**Mac/Linux:**
```bash
export OPENROUTER_API_KEY="your-key-here"
```

**Windows (PowerShell):**
```powershell
$env:OPENROUTER_API_KEY="your-key-here"
```

**Windows (Command Prompt):**
```cmd
set OPENROUTER_API_KEY=your-key-here
```

### Running Each Implementation

| Language   | Directory     | Instructions |
|------------|---------------|--------------|
| Python     | `python/`     | [Python README](python/README.md) |
| TypeScript | `typescript/` | [TypeScript README](typescript/README.md) |
| Java       | `java/`       | [Java README](java/README.md) |
| Rust       | `rust/`       | [Rust README](rust/README.md) |

## Understanding the Code

Each implementation follows the same structure:

### 1. Tool Definition

Tools are defined using JSON Schema, making them portable across languages:

```python
# Python example
calculator_tool = {
    "name": "calculator",
    "description": "Evaluate mathematical expressions",
    "parameters": {
        "type": "object",
        "properties": {
            "expression": {"type": "string", "description": "Math expression"}
        },
        "required": ["expression"]
    }
}
```

### 2. The ReAct Loop

```python
def react_loop(user_message):
    messages = [system_prompt, user_message]

    while True:
        # Call LLM with tools
        response = call_llm(messages, tools)

        if response.has_tool_calls:
            # Execute tools and add results
            for tool_call in response.tool_calls:
                result = execute_tool(tool_call)
                messages.append(tool_result_message(result))
        else:
            # No tool calls = final answer
            return response.content
```

### 3. OpenRouter API Integration

All implementations use OpenRouter's OpenAI-compatible API:

```
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer $OPENROUTER_API_KEY
Content-Type: application/json

{
  "model": "openai/gpt-4o-mini",
  "messages": [...],
  "tools": [...]
}
```

## Built-in Tools

Each implementation includes these example tools:

| Tool | Description | API |
|------|-------------|-----|
| `calculator` | Evaluate mathematical expressions | Local |
| `get_weather` | Get real weather for a location | [Open-Meteo](https://open-meteo.com/) (free, no API key) |
| `search_web` | Search the web for instant answers | [DuckDuckGo](https://duckduckgo.com/api) (free, no API key) |
| `get_current_time` | Get current date/time | Local |

## Learning Path

1. **Start with Python** - Clearest syntax, easiest to understand
2. **Try TypeScript** - See how it works in the browser
3. **Explore Java** - Enterprise patterns with SpringBoot
4. **Challenge: Rust** - Systems programming perspective

## Key Concepts

### JSON Schema for Tools

Tools use JSON Schema to describe their parameters:

```json
{
  "type": "object",
  "properties": {
    "location": {
      "type": "string",
      "description": "City name"
    },
    "units": {
      "type": "string",
      "enum": ["celsius", "fahrenheit"],
      "default": "celsius"
    }
  },
  "required": ["location"]
}
```

### Message Format

The conversation follows the OpenAI message format:

```json
[
  {"role": "system", "content": "You are a helpful assistant..."},
  {"role": "user", "content": "What's 25 * 4?"},
  {"role": "assistant", "content": null, "tool_calls": [...]},
  {"role": "tool", "tool_call_id": "...", "content": "100"}
]
```

### Streaming vs Non-Streaming

Some implementations support streaming responses for a better UX. The core ReAct loop remains the same.

## Why No LangChain?

This project deliberately avoids agentic frameworks to:

1. **Understand the fundamentals** - See exactly what's happening
2. **Minimize dependencies** - Just HTTP and JSON
3. **Portability** - Easy to implement in any language
4. **Debugging** - No magic, just clear code paths

## License

MIT - Use this to learn and build!
