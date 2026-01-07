"""
Tool Definitions and Executors

This module defines the tools available to our ReAct agent. Each tool has:
1. A definition (name, description, parameters as JSON Schema)
2. An executor function that actually performs the action

Tools are intentionally simple - some are mock implementations to demonstrate
the pattern without requiring external API keys.
"""

import json
import math
import random
from datetime import datetime, timezone
from typing import Any, Callable
from zoneinfo import ZoneInfo


# ============================================================================
# TOOL DEFINITIONS
# These follow the OpenAI function calling format with JSON Schema parameters
# ============================================================================

CALCULATOR_TOOL = {
    "name": "calculator",
    "description": "Evaluate a mathematical expression. Supports basic arithmetic (+, -, *, /), exponents (**), parentheses, and functions like sqrt(), sin(), cos(), tan(), log(), abs(), round(), min(), max().",
    "parameters": {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "The mathematical expression to evaluate, e.g., '2 + 2', 'sqrt(16) * 3', 'sin(3.14159/2)'"
            }
        },
        "required": ["expression"]
    }
}

GET_WEATHER_TOOL = {
    "name": "get_weather",
    "description": "Get the current weather for a location. Returns temperature, conditions, humidity, and wind speed. Note: This is a mock implementation for demonstration.",
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "The city name, optionally with country, e.g., 'San Francisco', 'London, UK', 'Tokyo, Japan'"
            },
            "units": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"],
                "description": "Temperature units (default: celsius)"
            }
        },
        "required": ["location"]
    }
}

SEARCH_WEB_TOOL = {
    "name": "search_web",
    "description": "Search the web for information and return relevant results with titles, URLs, and snippets. Note: This is a mock implementation for demonstration.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query"
            },
            "num_results": {
                "type": "integer",
                "description": "Number of results to return (1-10, default: 3)"
            }
        },
        "required": ["query"]
    }
}

GET_CURRENT_TIME_TOOL = {
    "name": "get_current_time",
    "description": "Get the current date and time. Optionally specify a timezone using IANA timezone names (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo').",
    "parameters": {
        "type": "object",
        "properties": {
            "timezone": {
                "type": "string",
                "description": "IANA timezone name (e.g., 'America/New_York', 'UTC'). Defaults to UTC."
            }
        },
        "required": []
    }
}


# Collect all tool definitions
ALL_TOOLS = [
    CALCULATOR_TOOL,
    GET_WEATHER_TOOL,
    SEARCH_WEB_TOOL,
    GET_CURRENT_TIME_TOOL,
]


# ============================================================================
# TOOL EXECUTORS
# These functions perform the actual work when a tool is called
# ============================================================================

def execute_calculator(expression: str) -> dict:
    """
    Safely evaluate a mathematical expression.

    We use a restricted eval with only math functions available.
    This is safer than raw eval() but still allows useful calculations.

    Args:
        expression: Mathematical expression as a string

    Returns:
        Dictionary with the result or an error message
    """
    # Define allowed names (safe math functions and constants)
    allowed_names = {
        # Constants
        "pi": math.pi,
        "e": math.e,
        "tau": math.tau,
        "inf": math.inf,
        # Basic functions
        "abs": abs,
        "round": round,
        "min": min,
        "max": max,
        "sum": sum,
        "pow": pow,
        # Math functions
        "sqrt": math.sqrt,
        "exp": math.exp,
        "log": math.log,
        "log10": math.log10,
        "log2": math.log2,
        # Trigonometry
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "asin": math.asin,
        "acos": math.acos,
        "atan": math.atan,
        "atan2": math.atan2,
        # Hyperbolic
        "sinh": math.sinh,
        "cosh": math.cosh,
        "tanh": math.tanh,
        # Other
        "ceil": math.ceil,
        "floor": math.floor,
        "factorial": math.factorial,
        "gcd": math.gcd,
    }

    try:
        # Compile the expression to check for syntax errors
        code = compile(expression, "<string>", "eval")

        # Check that only allowed names are used
        for name in code.co_names:
            if name not in allowed_names:
                return {"error": f"Unknown function or variable: {name}"}

        # Evaluate with restricted namespace
        result = eval(code, {"__builtins__": {}}, allowed_names)

        # Format the result nicely
        if isinstance(result, float):
            # Avoid floating point weirdness in display
            if result == int(result):
                result = int(result)
            else:
                result = round(result, 10)

        return {"result": result, "expression": expression}

    except SyntaxError as e:
        return {"error": f"Invalid expression syntax: {e}"}
    except ZeroDivisionError:
        return {"error": "Division by zero"}
    except ValueError as e:
        return {"error": f"Math error: {e}"}
    except Exception as e:
        return {"error": f"Calculation failed: {e}"}


def execute_get_weather(location: str, units: str = "celsius") -> dict:
    """
    Get mock weather data for a location.

    This is a demonstration implementation that returns realistic-looking
    but fake weather data. In a real application, you'd call a weather API.

    Args:
        location: City name
        units: 'celsius' or 'fahrenheit'

    Returns:
        Dictionary with weather information
    """
    # Generate deterministic "random" weather based on location name
    # This makes the demo reproducible
    seed = sum(ord(c) for c in location.lower())
    random.seed(seed)

    # Generate weather data
    temp_c = random.randint(-10, 35)
    humidity = random.randint(30, 90)
    wind_speed = random.randint(0, 30)

    conditions = random.choice([
        "Sunny", "Partly cloudy", "Cloudy", "Overcast",
        "Light rain", "Rain", "Thunderstorm",
        "Snow", "Fog", "Clear"
    ])

    # Convert temperature if needed
    if units == "fahrenheit":
        temperature = round(temp_c * 9/5 + 32)
        temp_unit = "°F"
    else:
        temperature = temp_c
        temp_unit = "°C"

    return {
        "location": location,
        "temperature": temperature,
        "units": temp_unit,
        "conditions": conditions,
        "humidity": f"{humidity}%",
        "wind_speed": f"{wind_speed} km/h",
        "note": "This is mock data for demonstration purposes"
    }


def execute_search_web(query: str, num_results: int = 3) -> dict:
    """
    Return mock search results.

    This is a demonstration implementation that returns fake but
    realistic-looking search results. In a real application, you'd
    call a search API like Google, Bing, or Brave.

    Args:
        query: Search query string
        num_results: Number of results to return (1-10)

    Returns:
        Dictionary with search results
    """
    num_results = max(1, min(10, num_results))

    # Generate mock results based on the query
    mock_results = [
        {
            "title": f"Understanding {query} - Comprehensive Guide",
            "url": f"https://example.com/guide/{query.replace(' ', '-').lower()}",
            "snippet": f"A complete guide to {query}. Learn everything you need to know about this topic with our in-depth tutorial and examples..."
        },
        {
            "title": f"{query} - Wikipedia",
            "url": f"https://en.wikipedia.org/wiki/{query.replace(' ', '_')}",
            "snippet": f"{query} refers to a concept or topic that has been widely discussed. This article provides an overview of the key aspects..."
        },
        {
            "title": f"How to {query}: Step-by-Step Tutorial",
            "url": f"https://tutorial-site.com/{query.replace(' ', '-').lower()}",
            "snippet": f"Follow our step-by-step instructions to learn about {query}. Perfect for beginners and experts alike..."
        },
        {
            "title": f"Top 10 Things to Know About {query}",
            "url": f"https://blog.example.com/top-10-{query.replace(' ', '-').lower()}",
            "snippet": f"Discover the most important facts about {query}. Our experts have compiled this list to help you understand..."
        },
        {
            "title": f"{query} FAQ - Common Questions Answered",
            "url": f"https://faq.example.com/{query.replace(' ', '-').lower()}",
            "snippet": f"Got questions about {query}? Find answers to the most frequently asked questions in our comprehensive FAQ..."
        },
    ]

    return {
        "query": query,
        "num_results": num_results,
        "results": mock_results[:num_results],
        "note": "These are mock results for demonstration purposes"
    }


def execute_get_current_time(timezone_name: str = "UTC") -> dict:
    """
    Get the current date and time for a timezone.

    Args:
        timezone_name: IANA timezone name (e.g., 'America/New_York')

    Returns:
        Dictionary with current time information
    """
    try:
        if timezone_name == "UTC" or not timezone_name:
            tz = timezone.utc
        else:
            tz = ZoneInfo(timezone_name)

        now = datetime.now(tz)

        return {
            "datetime": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "timezone": str(tz),
            "day_of_week": now.strftime("%A"),
            "unix_timestamp": int(now.timestamp())
        }

    except Exception as e:
        return {"error": f"Invalid timezone '{timezone_name}': {e}"}


# ============================================================================
# TOOL DISPATCHER
# Maps tool names to their executor functions
# ============================================================================

TOOL_EXECUTORS: dict[str, Callable] = {
    "calculator": lambda args: execute_calculator(args["expression"]),
    "get_weather": lambda args: execute_get_weather(
        args["location"],
        args.get("units", "celsius")
    ),
    "search_web": lambda args: execute_search_web(
        args["query"],
        args.get("num_results", 3)
    ),
    "get_current_time": lambda args: execute_get_current_time(
        args.get("timezone", "UTC")
    ),
}


def execute_tool(name: str, arguments: dict) -> str:
    """
    Execute a tool by name with the given arguments.

    Args:
        name: The tool name (must be a key in TOOL_EXECUTORS)
        arguments: Dictionary of arguments to pass to the tool

    Returns:
        JSON string with the tool's result
    """
    if name not in TOOL_EXECUTORS:
        return json.dumps({"error": f"Unknown tool: {name}"})

    try:
        result = TOOL_EXECUTORS[name](arguments)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": f"Tool execution failed: {e}"})


def load_tools_from_agentfile(agentfile: dict) -> list[dict]:
    """
    Load tool definitions from an agent file.

    This allows tools to be configured via the agentfile.json format.
    Note: Custom tool executors would need to be registered separately.

    Args:
        agentfile: Parsed agent file dictionary

    Returns:
        List of tool definitions
    """
    return agentfile.get("tools", ALL_TOOLS)
