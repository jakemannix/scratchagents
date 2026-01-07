"""
ReAct Agent Implementation

This module implements the core ReAct (Reasoning + Acting) agent loop.
The agent:
1. Receives a user message
2. Calls the LLM with available tools
3. If the LLM wants to use a tool, execute it and feed results back
4. Repeat until the LLM provides a final answer

This is a minimal implementation to clearly demonstrate the pattern.
"""

import json
from typing import Callable

from openrouter import (
    call_llm,
    extract_message,
    has_tool_calls,
    get_tool_calls,
    OpenRouterError
)
from tools import execute_tool, ALL_TOOLS


# Default system prompt that instructs the agent on how to behave
DEFAULT_SYSTEM_PROMPT = """You are a helpful assistant with access to tools.

When answering questions:
1. Think about whether you need to use a tool to answer accurately
2. If a tool would help, use it - don't guess or make up information
3. You can use multiple tools in sequence if needed
4. After getting tool results, provide a clear, helpful response to the user
5. If you're unsure about something, say so

Be concise but thorough in your responses."""


class ReactAgent:
    """
    A ReAct (Reasoning + Acting) agent that can use tools to answer questions.

    The agent maintains a conversation history and executes a loop where it:
    1. Sends the conversation to the LLM
    2. Checks if the LLM wants to use any tools
    3. Executes requested tools and adds results to the conversation
    4. Repeats until the LLM responds without tool calls

    Attributes:
        model: The LLM model identifier for OpenRouter
        system_prompt: Instructions for the LLM's behavior
        tools: List of tool definitions available to the agent
        max_iterations: Safety limit on tool-use loops
        temperature: LLM sampling temperature
        verbose: Whether to print debug information
        messages: The conversation history
        on_tool_call: Optional callback when a tool is called
        on_tool_result: Optional callback when a tool returns
    """

    def __init__(
        self,
        model: str = "openai/gpt-4o-mini",
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        tools: list[dict] | None = None,
        max_iterations: int = 10,
        temperature: float = 0.7,
        verbose: bool = False
    ):
        """
        Initialize a new ReAct agent.

        Args:
            model: OpenRouter model identifier
            system_prompt: System instructions for the LLM
            tools: List of tool definitions (defaults to ALL_TOOLS)
            max_iterations: Maximum tool-use iterations per turn
            temperature: LLM sampling temperature (0-2)
            verbose: Print debug information
        """
        self.model = model
        self.system_prompt = system_prompt
        self.tools = tools if tools is not None else ALL_TOOLS
        self.max_iterations = max_iterations
        self.temperature = temperature
        self.verbose = verbose

        # Initialize conversation with system prompt
        self.messages: list[dict] = [
            {"role": "system", "content": self.system_prompt}
        ]

        # Optional callbacks for observing the agent's behavior
        self.on_tool_call: Callable[[str, dict], None] | None = None
        self.on_tool_result: Callable[[str, str], None] | None = None

    def _log(self, message: str) -> None:
        """Print a debug message if verbose mode is enabled."""
        if self.verbose:
            print(f"[Agent] {message}")

    def chat(self, user_message: str) -> str:
        """
        Send a message to the agent and get a response.

        This is the main entry point for interacting with the agent.
        It handles the full ReAct loop internally.

        Args:
            user_message: The user's input message

        Returns:
            The agent's final response text

        Raises:
            OpenRouterError: If the API call fails
            RuntimeError: If max iterations is exceeded
        """
        # Add the user's message to history
        self.messages.append({
            "role": "user",
            "content": user_message
        })

        # Run the ReAct loop
        response_text = self._react_loop()

        return response_text

    def _react_loop(self) -> str:
        """
        Execute the ReAct loop until a final response is generated.

        The loop:
        1. Calls the LLM with current messages and available tools
        2. If LLM requests tool calls, execute them and add results
        3. Repeat until LLM responds without tool calls (final answer)

        Returns:
            The final response text from the LLM

        Raises:
            RuntimeError: If max_iterations is exceeded
        """
        iteration = 0

        while iteration < self.max_iterations:
            iteration += 1
            self._log(f"Iteration {iteration}/{self.max_iterations}")

            # Call the LLM
            self._log("Calling LLM...")
            response = call_llm(
                messages=self.messages,
                model=self.model,
                tools=self.tools if self.tools else None,
                temperature=self.temperature
            )

            # Extract the assistant's message
            assistant_message = extract_message(response)

            # Add the assistant's message to history
            # (including any tool_calls it contains)
            self.messages.append(assistant_message)

            # Check if the LLM wants to use tools
            if has_tool_calls(assistant_message):
                # Execute each tool call
                tool_calls = get_tool_calls(assistant_message)
                self._log(f"LLM requested {len(tool_calls)} tool call(s)")

                for tool_call in tool_calls:
                    self._execute_tool_call(tool_call)

                # Continue the loop to let LLM process tool results
            else:
                # No tool calls = final response
                self._log("LLM provided final response")
                return assistant_message.get("content", "")

        # Safety: exceeded max iterations
        raise RuntimeError(
            f"Agent exceeded maximum iterations ({self.max_iterations}). "
            "The agent may be stuck in a loop."
        )

    def _execute_tool_call(self, tool_call: dict) -> None:
        """
        Execute a single tool call and add the result to messages.

        Args:
            tool_call: Dictionary containing tool call information:
                - id: Unique identifier for this call
                - function: Dict with 'name' and 'arguments'
        """
        tool_id = tool_call["id"]
        function = tool_call["function"]
        tool_name = function["name"]

        # Parse the arguments JSON
        try:
            arguments = json.loads(function["arguments"])
        except json.JSONDecodeError as e:
            arguments = {}
            self._log(f"Failed to parse tool arguments: {e}")

        self._log(f"Executing tool: {tool_name}({json.dumps(arguments)})")

        # Notify callback if set
        if self.on_tool_call:
            self.on_tool_call(tool_name, arguments)

        # Execute the tool
        result = execute_tool(tool_name, arguments)

        self._log(f"Tool result: {result[:100]}..." if len(result) > 100 else f"Tool result: {result}")

        # Notify callback if set
        if self.on_tool_result:
            self.on_tool_result(tool_name, result)

        # Add tool result to messages
        # This follows the OpenAI format for tool results
        self.messages.append({
            "role": "tool",
            "tool_call_id": tool_id,
            "content": result
        })

    def reset(self) -> None:
        """
        Reset the conversation history.

        Clears all messages except the system prompt, allowing
        a fresh conversation to start.
        """
        self.messages = [
            {"role": "system", "content": self.system_prompt}
        ]

    def get_history(self) -> list[dict]:
        """
        Get the full conversation history.

        Returns:
            List of message dictionaries
        """
        return self.messages.copy()

    @classmethod
    def from_agentfile(cls, agentfile: dict, verbose: bool = False) -> "ReactAgent":
        """
        Create an agent from an agentfile configuration.

        This factory method creates an agent using settings from
        an agentfile.json configuration file.

        Args:
            agentfile: Parsed agentfile dictionary
            verbose: Enable verbose logging

        Returns:
            A configured ReactAgent instance

        Example:
            >>> with open("example.agentfile.json") as f:
            ...     config = json.load(f)
            >>> agent = ReactAgent.from_agentfile(config)
        """
        settings = agentfile.get("settings", {})

        return cls(
            model=agentfile.get("model", "openai/gpt-4o-mini"),
            system_prompt=agentfile.get("system_prompt", DEFAULT_SYSTEM_PROMPT),
            tools=agentfile.get("tools", ALL_TOOLS),
            max_iterations=settings.get("max_iterations", 10),
            temperature=settings.get("temperature", 0.7),
            verbose=verbose
        )
