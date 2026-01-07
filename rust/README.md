# Rust ReAct Agent

A ReAct agent implementation in Rust, providing a CLI chat interface with async support.

## Architecture

```
rust/
├── README.md
├── Cargo.toml
└── src/
    ├── main.rs         # CLI entry point
    ├── openrouter.rs   # OpenRouter API client
    ├── tools.rs        # Tool definitions and executors
    └── agent.rs        # Core ReAct agent
```

## Prerequisites

- Rust 1.70 or higher (with Cargo)
- An OpenRouter API key

## Installation

### Mac/Linux

```bash
# Navigate to the rust directory
cd rust

# Build the project
cargo build --release

# Or build and run in one step
cargo run --release
```

### Windows

```cmd
cd rust
cargo build --release
cargo run --release
```

## Installing Rust

If you don't have Rust installed:

**Mac/Linux:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**Windows:**

Download and run the installer from [rustup.rs](https://rustup.rs/)

## Running the Agent

### Set your API key

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

### Start the chat

```bash
cargo run --release
```

Or run the compiled binary directly:

```bash
./target/release/react-agent
```

## Usage

### Interactive Mode (default)

```bash
cargo run --release
```

Type your messages and press Enter. Commands:
- `quit` or `exit` - End the session
- `reset` - Clear conversation history
- `history` - Show message history

### Single Query Mode

```bash
cargo run --release -- --query "What is 25 * 4?"
```

### With Custom Model

```bash
cargo run --release -- --model "anthropic/claude-3-haiku"
```

### Verbose Mode

```bash
cargo run --release -- --verbose
```

## Example Session

```
$ cargo run --release

ReAct Agent (Rust)
Model: openai/gpt-4o-mini
Type 'quit' to exit, 'reset' to clear history

You: What's the weather in Paris and convert 25°C to Fahrenheit?

[Calling get_weather({"location": "Paris"})]
[Result: {"location": "Paris", "temperature": 18, ...}]

[Calling calculator({"expression": "25 * 9/5 + 32"})]
[Result: {"result": 77, "expression": "25 * 9/5 + 32"}]