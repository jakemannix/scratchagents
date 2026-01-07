"""
Tool Definitions and Executors

This module defines the tools available to our ReAct agent. Each tool has:
1. A definition (name, description, parameters as JSON Schema)
2. An executor function that actually performs the action

Tools use real APIs where possible:
- Weather: Open-Meteo API (free, no API key required)
- Search: DuckDuckGo Instant Answer API (free, no API key required)
"""

import json
import math
from datetime import datetime, timezone
from typing import Any, Callable
from zoneinfo import ZoneInfo

import requests


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
    "description": "Get the current weather for a location. Returns temperature, conditions, humidity, and wind speed. Uses the Open-Meteo API for real weather data.",
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
    "description": "Search the web for information using DuckDuckGo. Returns instant answers, abstracts, and related topics.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query"
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
    Get real weather data for a location using Open-Meteo API.

    This uses two API calls:
    1. Geocoding API to convert location name to coordinates
    2. Weather API to get current conditions

    Args:
        location: City name (e.g., "San Francisco", "London, UK")
        units: 'celsius' or 'fahrenheit'

    Returns:
        Dictionary with weather information
    """
    try:
        # Step 1: Geocode the location to get coordinates
        geocode_url = "https://geocoding-api.open-meteo.com/v1/search"
        geocode_params = {
            "name": location,
            "count": 1,
            "language": "en",
            "format": "json"
        }

        geocode_response = requests.get(geocode_url, params=geocode_params, timeout=10)
        geocode_response.raise_for_status()
        geocode_data = geocode_response.json()

        if "results" not in geocode_data or len(geocode_data["results"]) == 0:
            return {"error": f"Location not found: {location}"}

        place = geocode_data["results"][0]
        lat = place["latitude"]
        lon = place["longitude"]
        resolved_name = place.get("name", location)
        country = place.get("country", "")

        # Step 2: Get weather data
        weather_url = "https://api.open-meteo.com/v1/forecast"
        temp_unit = "fahrenheit" if units == "fahrenheit" else "celsius"
        weather_params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
            "temperature_unit": temp_unit,
            "wind_speed_unit": "kmh",
            "timezone": "auto"
        }

        weather_response = requests.get(weather_url, params=weather_params, timeout=10)
        weather_response.raise_for_status()
        weather_data = weather_response.json()

        current = weather_data.get("current", {})

        # Map WMO weather codes to descriptions
        weather_code = current.get("weather_code", 0)
        conditions = _weather_code_to_description(weather_code)

        temp_symbol = "°F" if units == "fahrenheit" else "°C"

        return {
            "location": f"{resolved_name}, {country}" if country else resolved_name,
            "coordinates": {"latitude": lat, "longitude": lon},
            "temperature": current.get("temperature_2m"),
            "feels_like": current.get("apparent_temperature"),
            "units": temp_symbol,
            "conditions": conditions,
            "humidity": f"{current.get('relative_humidity_2m', 'N/A')}%",
            "wind_speed": f"{current.get('wind_speed_10m', 'N/A')} km/h",
            "source": "Open-Meteo API"
        }

    except requests.exceptions.Timeout:
        return {"error": "Weather API request timed out"}
    except requests.exceptions.RequestException as e:
        return {"error": f"Weather API request failed: {e}"}
    except Exception as e:
        return {"error": f"Failed to get weather: {e}"}


def _weather_code_to_description(code: int) -> str:
    """Convert WMO weather code to human-readable description."""
    weather_codes = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    }
    return weather_codes.get(code, f"Unknown (code {code})")


def execute_search_web(query: str) -> dict:
    """
    Search the web using DuckDuckGo Instant Answer API.

    This API provides:
    - Instant answers (calculations, definitions, etc.)
    - Abstract summaries from Wikipedia and other sources
    - Related topics

    Args:
        query: Search query string

    Returns:
        Dictionary with search results
    """
    try:
        # DuckDuckGo Instant Answer API
        url = "https://api.duckduckgo.com/"
        params = {
            "q": query,
            "format": "json",
            "no_html": 1,
            "skip_disambig": 1
        }

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        results = []

        # Add abstract (usually from Wikipedia)
        if data.get("Abstract"):
            results.append({
                "type": "abstract",
                "title": data.get("Heading", query),
                "text": data["Abstract"],
                "url": data.get("AbstractURL", ""),
                "source": data.get("AbstractSource", "")
            })

        # Add instant answer if available
        if data.get("Answer"):
            results.append({
                "type": "instant_answer",
                "text": data["Answer"],
                "answer_type": data.get("AnswerType", "")
            })

        # Add definition if available
        if data.get("Definition"):
            results.append({
                "type": "definition",
                "text": data["Definition"],
                "source": data.get("DefinitionSource", ""),
                "url": data.get("DefinitionURL", "")
            })

        # Add related topics
        related_topics = data.get("RelatedTopics", [])
        for topic in related_topics[:5]:  # Limit to 5 related topics
            if isinstance(topic, dict) and topic.get("Text"):
                results.append({
                    "type": "related",
                    "text": topic["Text"],
                    "url": topic.get("FirstURL", "")
                })

        # If no results, provide a helpful message
        if not results:
            return {
                "query": query,
                "message": "No instant answers found. Try a more specific query or search directly on a search engine.",
                "results": [],
                "source": "DuckDuckGo Instant Answer API"
            }

        return {
            "query": query,
            "results": results,
            "source": "DuckDuckGo Instant Answer API"
        }

    except requests.exceptions.Timeout:
        return {"error": "Search API request timed out"}
    except requests.exceptions.RequestException as e:
        return {"error": f"Search API request failed: {e}"}
    except Exception as e:
        return {"error": f"Search failed: {e}"}


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
    "search_web": lambda args: execute_search_web(args["query"]),
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
