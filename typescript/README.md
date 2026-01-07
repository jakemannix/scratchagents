# TypeScript Browser-Based ReAct Agent

A ReAct agent implementation that runs entirely in the browser using TypeScript and Vite.

## Architecture

```
typescript/
├── README.md           # This file
├── package.json        # Node.js dependencies
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite bundler configuration
├── index.html          # Main HTML page with chat UI
└── src/
    ├── openrouter.ts   # OpenRouter API client
    ├── tools.ts        # Tool definitions and executors
    ├── agent.ts        # Core ReAct agent implementation
    └── main.ts         # UI integration and event handling
```

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- An OpenRouter API key

## Installation

### Mac/Linux

```bash
# Navigate to the typescript directory
cd typescript

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Windows

**PowerShell or Command Prompt:**
```cmd
cd typescript
npm install
npm run dev
```

## Running the Agent

### Development Mode

```bash
npm run dev
```

This starts a local development server (usually at `http://localhost:5173`). Open this URL in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## Usage

1. Open the app in your browser
2. Enter your OpenRouter API key in the settings panel
3. Start chatting! The agent will use tools when appropriate

## Security Note

**Important**: This demo requires entering your API key in the browser. The key is stored in `localStorage` and sent directly to OpenRouter. This is suitable for:
- Learning and experimentation
- Local development
- Personal projects

For production applications, you should:
- Use a backend proxy to hide the API key
- Implement proper authentication
- Use environment variables on the server

## Features

- Real-time chat interface
- Tool usage visualization
- Conversation history
- Configurable model selection
- Responsive design

## How It Works

### The ReAct Loop in TypeScript

```typescript
async function reactLoop(messages: Message[]): Promise<string> {
  while (iterations < maxIterations) {
    const response = await callLLM(messages, tools);
    const message = response.choices[0].message;

    messages.push(message);

    if (message.tool_calls) {
      // Execute tools and continue
      for (const toolCall of message.tool_calls) {
        const result = await executeTool(toolCall);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result
        });
      }
    } else {
      // Final answer
      return message.content;
    }
  }
}
```

### Browser-Specific Considerations

1. **No Native `eval`**: The calculator uses a safe expression parser
2. **localStorage**: API key is persisted locally
3. **CORS**: OpenRouter allows browser requests directly
4. **No File System**: Agent cannot read/write local files

## Customization

### Adding New Tools

Edit `src/tools.ts`:

```typescript
export const MY_TOOL: Tool = {
  name: "my_tool",
  description: "Does something useful",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "The input" }
    },
    required: ["input"]
  }
};

// Add executor
TOOL_EXECUTORS.set("my_tool", (args) => {
  return JSON.stringify({ result: args.input.toUpperCase() });
});
```

### Changing the Model

The UI includes a model selector, or you can modify the default in `src/agent.ts`.

## Troubleshooting

### "API key not set"

Enter your OpenRouter API key in the settings panel (gear icon).

### CORS Errors

OpenRouter should allow browser requests. If you see CORS errors:
- Check that you're using the correct API endpoint
- Ensure your API key is valid
- Try a different browser

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
```
