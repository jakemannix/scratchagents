/**
 * Tool Definitions and Executors
 *
 * This module defines the tools available to our ReAct agent.
 * Each tool has a definition (for the LLM) and an executor function.
 *
 * Tools use real APIs where possible:
 * - Weather: Open-Meteo API (free, no API key required)
 * - Search: DuckDuckGo Instant Answer API (free, no API key required)
 */

import type { Tool } from "./openrouter";

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const CALCULATOR_TOOL: Tool = {
  name: "calculator",
  description:
    "Evaluate a mathematical expression. Supports: +, -, *, /, ^ (power), parentheses, and functions like sqrt(), sin(), cos(), tan(), log(), abs(), round(), min(), max().",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description:
          "The mathematical expression to evaluate, e.g., '2 + 2', 'sqrt(16) * 3'",
      },
    },
    required: ["expression"],
  },
};

export const GET_WEATHER_TOOL: Tool = {
  name: "get_weather",
  description:
    "Get the current weather for a location. Returns temperature, conditions, and humidity. Uses the Open-Meteo API for real weather data.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The city name, e.g., 'San Francisco', 'London, UK'",
      },
      units: {
        type: "string",
        description: "Temperature units: 'celsius' or 'fahrenheit'",
        enum: ["celsius", "fahrenheit"],
      },
    },
    required: ["location"],
  },
};

export const SEARCH_WEB_TOOL: Tool = {
  name: "search_web",
  description:
    "Search the web for information using DuckDuckGo. Returns instant answers, abstracts, and related topics.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
    },
    required: ["query"],
  },
};

export const GET_CURRENT_TIME_TOOL: Tool = {
  name: "get_current_time",
  description:
    "Get the current date and time. Optionally specify a timezone (e.g., 'America/New_York').",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: "IANA timezone name (default: browser local time)",
      },
    },
    required: [],
  },
};

// All available tools
export const ALL_TOOLS: Tool[] = [
  CALCULATOR_TOOL,
  GET_WEATHER_TOOL,
  SEARCH_WEB_TOOL,
  GET_CURRENT_TIME_TOOL,
];

// ============================================================================
// TOOL EXECUTORS
// ============================================================================

/**
 * Safe math expression evaluator.
 * This is a simple recursive descent parser that avoids using eval().
 */
function evaluateMathExpression(expr: string): number {
  // Remove whitespace
  expr = expr.replace(/\s+/g, "");

  let pos = 0;

  function parseNumber(): number {
    let numStr = "";

    // Handle negative numbers
    if (expr[pos] === "-") {
      numStr += "-";
      pos++;
    }

    // Parse digits and decimal point
    while (pos < expr.length && /[\d.]/.test(expr[pos])) {
      numStr += expr[pos];
      pos++;
    }

    if (numStr === "" || numStr === "-") {
      throw new Error(`Expected number at position ${pos}`);
    }

    return parseFloat(numStr);
  }

  function parseFunction(): number {
    // Check for function names
    const functions: Record<string, (x: number, y?: number) => number> = {
      sqrt: Math.sqrt,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      abs: Math.abs,
      log: Math.log,
      log10: Math.log10,
      exp: Math.exp,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      min: Math.min,
      max: Math.max,
    };

    // Check for constants
    if (expr.substring(pos, pos + 2) === "pi") {
      pos += 2;
      return Math.PI;
    }
    if (expr.substring(pos, pos + 1) === "e" && !/[a-z]/i.test(expr[pos + 1] || "")) {
      pos += 1;
      return Math.E;
    }

    for (const [name, fn] of Object.entries(functions)) {
      if (expr.substring(pos, pos + name.length) === name) {
        pos += name.length;
        if (expr[pos] !== "(") {
          throw new Error(`Expected '(' after ${name}`);
        }
        pos++; // skip '('

        const arg = parseExpression();

        // Check for second argument (for min/max)
        let arg2: number | undefined;
        if (expr[pos] === ",") {
          pos++; // skip ','
          arg2 = parseExpression();
        }

        if (expr[pos] !== ")") {
          throw new Error(`Expected ')' after function argument`);
        }
        pos++; // skip ')'

        return arg2 !== undefined ? fn(arg, arg2) : fn(arg);
      }
    }

    // Not a function, try parsing as number or parenthesized expression
    if (expr[pos] === "(") {
      pos++; // skip '('
      const result = parseExpression();
      if (expr[pos] !== ")") {
        throw new Error(`Expected ')' at position ${pos}`);
      }
      pos++; // skip ')'
      return result;
    }

    return parseNumber();
  }

  function parseFactor(): number {
    return parseFunction();
  }

  function parsePower(): number {
    let left = parseFactor();

    while (pos < expr.length && (expr[pos] === "^" || expr.substring(pos, pos + 2) === "**")) {
      const op = expr[pos] === "^" ? "^" : "**";
      pos += op.length;
      const right = parseFactor();
      left = Math.pow(left, right);
    }

    return left;
  }

  function parseTerm(): number {
    let left = parsePower();

    while (pos < expr.length && (expr[pos] === "*" || expr[pos] === "/")) {
      const op = expr[pos];
      pos++;

      // Skip if this is **
      if (op === "*" && expr[pos] === "*") {
        pos--; // Revert, handled in parsePower
        break;
      }

      const right = parsePower();

      if (op === "*") {
        left *= right;
      } else {
        if (right === 0) throw new Error("Division by zero");
        left /= right;
      }
    }

    return left;
  }

  function parseExpression(): number {
    let left = parseTerm();

    while (pos < expr.length && (expr[pos] === "+" || expr[pos] === "-")) {
      const op = expr[pos];
      pos++;
      const right = parseTerm();

      if (op === "+") {
        left += right;
      } else {
        left -= right;
      }
    }

    return left;
  }

  const result = parseExpression();

  if (pos < expr.length) {
    throw new Error(`Unexpected character at position ${pos}: '${expr[pos]}'`);
  }

  return result;
}

function executeCalculator(args: { expression: string }): string {
  try {
    const result = evaluateMathExpression(args.expression);

    // Format nicely
    let displayResult: number | string = result;
    if (Number.isFinite(result)) {
      if (result === Math.floor(result)) {
        displayResult = Math.floor(result);
      } else {
        displayResult = parseFloat(result.toFixed(10));
      }
    }

    return JSON.stringify({
      result: displayResult,
      expression: args.expression,
    });
  } catch (error) {
    return JSON.stringify({
      error: `Calculation failed: ${error}`,
    });
  }
}

/**
 * Map WMO weather codes to human-readable descriptions.
 */
function weatherCodeToDescription(code: number): string {
  const weatherCodes: Record<number, string> = {
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
  };
  return weatherCodes[code] || `Unknown (code ${code})`;
}

/**
 * Get real weather data using Open-Meteo API.
 */
async function executeGetWeather(args: { location: string; units?: string }): Promise<string> {
  const { location, units = "celsius" } = args;

  try {
    // Step 1: Geocode the location
    const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodeUrl.searchParams.set("name", location);
    geocodeUrl.searchParams.set("count", "1");
    geocodeUrl.searchParams.set("language", "en");
    geocodeUrl.searchParams.set("format", "json");

    const geocodeResponse = await fetch(geocodeUrl.toString());
    if (!geocodeResponse.ok) {
      throw new Error(`Geocoding failed: ${geocodeResponse.status}`);
    }

    const geocodeData = await geocodeResponse.json();

    if (!geocodeData.results || geocodeData.results.length === 0) {
      return JSON.stringify({ error: `Location not found: ${location}` });
    }

    const place = geocodeData.results[0];
    const lat = place.latitude;
    const lon = place.longitude;
    const resolvedName = place.name || location;
    const country = place.country || "";

    // Step 2: Get weather data
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.searchParams.set("latitude", lat.toString());
    weatherUrl.searchParams.set("longitude", lon.toString());
    weatherUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m");
    weatherUrl.searchParams.set("temperature_unit", units === "fahrenheit" ? "fahrenheit" : "celsius");
    weatherUrl.searchParams.set("wind_speed_unit", "kmh");
    weatherUrl.searchParams.set("timezone", "auto");

    const weatherResponse = await fetch(weatherUrl.toString());
    if (!weatherResponse.ok) {
      throw new Error(`Weather API failed: ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();
    const current = weatherData.current || {};

    const weatherCode = current.weather_code || 0;
    const conditions = weatherCodeToDescription(weatherCode);
    const tempSymbol = units === "fahrenheit" ? "°F" : "°C";

    return JSON.stringify({
      location: country ? `${resolvedName}, ${country}` : resolvedName,
      coordinates: { latitude: lat, longitude: lon },
      temperature: current.temperature_2m,
      feels_like: current.apparent_temperature,
      units: tempSymbol,
      conditions,
      humidity: `${current.relative_humidity_2m ?? "N/A"}%`,
      wind_speed: `${current.wind_speed_10m ?? "N/A"} km/h`,
      source: "Open-Meteo API",
    });
  } catch (error) {
    return JSON.stringify({ error: `Failed to get weather: ${error}` });
  }
}

/**
 * Search the web using DuckDuckGo Instant Answer API.
 */
async function executeSearchWeb(args: { query: string }): Promise<string> {
  const { query } = args;

  try {
    // DuckDuckGo Instant Answer API
    const url = new URL("https://api.duckduckgo.com/");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("no_html", "1");
    url.searchParams.set("skip_disambig", "1");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Search API failed: ${response.status}`);
    }

    const data = await response.json();
    const results: Array<Record<string, string>> = [];

    // Add abstract (usually from Wikipedia)
    if (data.Abstract) {
      results.push({
        type: "abstract",
        title: data.Heading || query,
        text: data.Abstract,
        url: data.AbstractURL || "",
        source: data.AbstractSource || "",
      });
    }

    // Add instant answer if available
    if (data.Answer) {
      results.push({
        type: "instant_answer",
        text: data.Answer,
        answer_type: data.AnswerType || "",
      });
    }

    // Add definition if available
    if (data.Definition) {
      results.push({
        type: "definition",
        text: data.Definition,
        source: data.DefinitionSource || "",
        url: data.DefinitionURL || "",
      });
    }

    // Add related topics
    const relatedTopics = data.RelatedTopics || [];
    for (const topic of relatedTopics.slice(0, 5)) {
      if (topic && typeof topic === "object" && topic.Text) {
        results.push({
          type: "related",
          text: topic.Text,
          url: topic.FirstURL || "",
        });
      }
    }

    // If no results, provide a helpful message
    if (results.length === 0) {
      return JSON.stringify({
        query,
        message: "No instant answers found. Try a more specific query or search directly on a search engine.",
        results: [],
        source: "DuckDuckGo Instant Answer API",
      });
    }

    return JSON.stringify({
      query,
      results,
      source: "DuckDuckGo Instant Answer API",
    });
  } catch (error) {
    return JSON.stringify({ error: `Search failed: ${error}` });
  }
}

function executeGetCurrentTime(args: { timezone?: string }): string {
  const { timezone } = args;

  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      weekday: "long",
    };

    const formatter = new Intl.DateTimeFormat("en-US", options);
    const parts = formatter.formatToParts(now);

    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || "";

    return JSON.stringify({
      datetime: now.toISOString(),
      date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
      time: `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`,
      timezone: timezone || "local",
      day_of_week: getPart("weekday"),
      unix_timestamp: Math.floor(now.getTime() / 1000),
    });
  } catch (error) {
    return JSON.stringify({
      error: `Invalid timezone '${timezone}': ${error}`,
    });
  }
}

// Tool executor registry - now supports both sync and async executors
type ToolExecutor = (args: Record<string, unknown>) => string | Promise<string>;

const TOOL_EXECUTORS = new Map<string, ToolExecutor>([
  ["calculator", (args) => executeCalculator(args as { expression: string })],
  ["get_weather", (args) => executeGetWeather(args as { location: string; units?: string })],
  ["search_web", (args) => executeSearchWeb(args as { query: string })],
  ["get_current_time", (args) => executeGetCurrentTime(args as { timezone?: string })],
]);

/**
 * Execute a tool by name with the given arguments.
 * Returns a Promise since some tools (weather, search) are async.
 */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const executor = TOOL_EXECUTORS.get(name);
  if (!executor) {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  try {
    return await executor(args);
  } catch (error) {
    return JSON.stringify({ error: `Tool execution failed: ${error}` });
  }
}
