"""
OpenRouter API Client

This module provides a simple client for calling LLMs via OpenRouter's API.
OpenRouter provides a unified API that's compatible with OpenAI's format
but gives access to many different models.

API Documentation: https://openrouter.ai/docs
"""

import os
import json
import requests
from typing import Any


# OpenRouter API endpoint (OpenAI-compatible)
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterError(Exception):
    """Custom exception for OpenRouter API errors."""
    pass


def get_api_key() -> str:
    """
    Get the OpenRouter API key from environment variables.

    Returns:
        The API key string

    Raises:
        OpenRouterError: If the API key is not set
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise OpenRouterError(
            "OPENROUTER_API_KEY environment variable is not set.\n"
            "Get your API key at https://openrouter.ai/ and set it:\n"
            "  Mac/Linux: export OPENROUTER_API_KEY='your-key'\n"
            "  Windows:   set OPENROUTER_API_KEY=your-key"
        )
    return api_key


def call_llm(
    messages: list[dict],
    model: str = "openai/gpt-4o-mini",
    tools: list[dict] | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    timeout: int = 60
) -> dict:
    """
    Call an LLM via the OpenRouter API.

    This function sends a chat completion request to OpenRouter, which routes
    the request to the appropriate model provider (OpenAI, Anthropic, etc.).

    Args:
        messages: List of message dictionaries with 'role' and 'content' keys.
                  Roles can be: 'system', 'user', 'assistant', 'tool'
        model: The model identifier (e.g., 'openai/gpt-4o-mini', 'anthropic/claude-3-haiku')
        tools: Optional list of tool definitions in OpenAI function calling format
        temperature: Sampling temperature (0-2). Lower = more deterministic.
        max_tokens: Maximum tokens in the response
        timeout: Request timeout in seconds

    Returns:
        The API response as a dictionary containing:
        - choices: List of completion choices
        - usage: Token usage information

    Raises:
        OpenRouterError: If the API call fails

    Example:
        >>> messages = [
        ...     {"role": "system", "content": "You are helpful."},
        ...     {"role": "user", "content": "Hello!"}
        ... ]
        >>> response = call_llm(messages, model="openai/gpt-4o-mini")
        >>> print(response["choices"][0]["message"]["content"])
    """
    api_key = get_api_key()

    # Build the request payload
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    # Add tools if provided
    if tools:
        # Convert our tool format to OpenAI's function calling format
        payload["tools"] = [
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["parameters"]
                }
            }
            for tool in tools
        ]
        # Allow the model to choose whether to use tools
        payload["tool_choice"] = "auto"

    # Set up headers
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        # OpenRouter recommends setting these for better routing
        "HTTP-Referer": "https://github.com/scratchagents",
        "X-Title": "ScratchAgents"
    }

    try:
        response = requests.post(
            OPENROUTER_API_URL,
            headers=headers,
            json=payload,
            timeout=timeout
        )

        # Check for HTTP errors
        if response.status_code != 200:
            error_detail = response.text
            try:
                error_json = response.json()
                if "error" in error_json:
                    error_detail = error_json["error"].get("message", error_detail)
            except json.JSONDecodeError:
                pass

            raise OpenRouterError(
                f"API request failed with status {response.status_code}: {error_detail}"
            )

        return response.json()

    except requests.exceptions.Timeout:
        raise OpenRouterError(f"Request timed out after {timeout} seconds")
    except requests.exceptions.ConnectionError as e:
        raise OpenRouterError(f"Connection error: {e}")
    except requests.exceptions.RequestException as e:
        raise OpenRouterError(f"Request failed: {e}")


def extract_message(response: dict) -> dict:
    """
    Extract the assistant's message from an API response.

    Args:
        response: The raw API response dictionary

    Returns:
        The message dictionary containing 'role', 'content', and optionally 'tool_calls'

    Raises:
        OpenRouterError: If the response format is unexpected
    """
    try:
        return response["choices"][0]["message"]
    except (KeyError, IndexError) as e:
        raise OpenRouterError(f"Unexpected response format: {e}")


def has_tool_calls(message: dict) -> bool:
    """
    Check if a message contains tool calls.

    Args:
        message: The assistant's message dictionary

    Returns:
        True if the message contains tool calls, False otherwise
    """
    return bool(message.get("tool_calls"))


def get_tool_calls(message: dict) -> list[dict]:
    """
    Extract tool calls from a message.

    Args:
        message: The assistant's message dictionary

    Returns:
        List of tool call dictionaries, each containing:
        - id: Unique identifier for the tool call
        - function: Dict with 'name' and 'arguments' (JSON string)
    """
    return message.get("tool_calls", [])
