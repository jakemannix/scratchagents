# Java SpringBoot ReAct Agent

A ReAct agent implementation using Java and Spring Boot, providing a REST API for chat interactions.

## Architecture

```
java/
├── README.md
├── pom.xml                           # Maven configuration
└── src/main/
    ├── java/com/react/agent/
    │   ├── ReactAgentApplication.java  # Spring Boot entry point
    │   ├── config/
    │   │   └── AgentConfig.java        # Configuration properties
    │   ├── model/
    │   │   ├── Tool.java               # Tool definition model
    │   │   ├── Message.java            # Chat message model
    │   │   └── AgentFile.java          # Agent configuration model
    │   ├── service/
    │   │   ├── OpenRouterClient.java   # OpenRouter API client
    │   │   ├── ToolExecutor.java       # Tool execution service
    │   │   └── ReactAgent.java         # Core ReAct agent
    │   └── controller/
    │       └── ChatController.java     # REST API endpoints
    └── resources/
        └── application.properties      # Application configuration
```

## Prerequisites

- Java 17 or higher
- Maven 3.6 or higher
- An OpenRouter API key

## Installation

### Mac/Linux

```bash
# Navigate to the java directory
cd java

# Build the project
./mvnw clean package

# Or if you have Maven installed globally
mvn clean package
```

### Windows

```cmd
cd java

# Build the project
mvnw.cmd clean package

# Or if you have Maven installed globally
mvn clean package
```

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

### Start the server

```bash
./mvnw spring-boot:run
```

Or run the JAR directly:

```bash
java -jar target/react-agent-1.0.0.jar
```

The server starts at `http://localhost:8080`.

## API Endpoints

### Chat

Send a message and get a response:

```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 25 * 4?"}'
```

Response:
```json
{
  "response": "25 * 4 equals 100.",
  "toolCalls": [
    {
      "name": "calculator",
      "arguments": {"expression": "25 * 4"},
      "result": {"result": 100}
    }
  ]
}
```

### Reset Conversation

```bash
curl -X POST http://localhost:8080/api/reset
```

### Get Conversation History

```bash
curl http://localhost:8080/api/history
```

### Health Check

```bash
curl http://localhost:8080/api/health
```

## Configuration

Edit `src/main/resources/application.properties`:

```properties
# OpenRouter API (can also use environment variable)
openrouter.api-key=${OPENROUTER_API_KEY}

# Model settings
agent.model=openai/gpt-4o-mini
agent.temperature=0.7
agent.max-iterations=10

# Server settings
server.port=8080
```

## Example Usage with curl

```bash
# Start a conversation
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather in Tokyo?"}'

# Continue the conversation
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "And what time is it there?"}'

# Reset when done
curl -X POST http://localhost:8080/api/reset
```

## Project Structure

### Key Classes

- **ReactAgentApplication**: Spring Boot entry point
- **ReactAgent**: Core ReAct loop implementation
- **OpenRouterClient**: HTTP client for OpenRouter API
- **ToolExecutor**: Executes tool calls and returns results
- **ChatController**: REST API endpoints

### The ReAct Loop in Java

```java
public String chat(String userMessage) {
    messages.add(new Message("user", userMessage));

    while (iterations < maxIterations) {
        ChatResponse response = openRouterClient.chat(messages, tools);
        Message assistantMessage = response.getMessage();
        messages.add(assistantMessage);

        if (assistantMessage.hasToolCalls()) {
            for (ToolCall toolCall : assistantMessage.getToolCalls()) {
                String result = toolExecutor.execute(toolCall);
                messages.add(new Message("tool", toolCall.getId(), result));
            }
        } else {
            return assistantMessage.getContent();
        }
    }
    throw new AgentException("Max iterations exceeded");
}
```

## Building for Production

```bash
# Create optimized JAR
./mvnw clean package -DskipTests

# Run with specific profile
java -jar target/react-agent-1.0.0.jar --spring.profiles.active=production
```

## Docker Support

Build and run with Docker:

```bash
# Build image
docker build -t react-agent-java .

# Run container
docker run -p 8080:8080 -e OPENROUTER_API_KEY=your-key react-agent-java
```

## Troubleshooting

### "API key not configured"

Set the `OPENROUTER_API_KEY` environment variable or add it to `application.properties`.

### Build fails with Java version error

Ensure you have Java 17+ installed:
```bash
java -version
```

### Port already in use

Change the port in `application.properties`:
```properties
server.port=8081
```
