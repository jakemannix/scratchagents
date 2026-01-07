/**
 * Tool Definitions and Executors
 *
 * This module defines the tools available to our ReAct agent.
 * Each tool has a definition (for the LLM) and an executor function.
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
    "Get the current weather for a location. Returns temperature, conditions, and humidity. Note: Mock data for demonstration.",
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
    "Search the web for information. Returns titles, URLs, and snippets. Note: Mock data for demonstration.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
      num_results: {
        type: "integer",
        description: "Number of results (1-10, default: 3)",
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

function executeGetWeather(args: { location: string; units?: string }): string {
  const { location, units = "celsius" } = args;

  // Generate deterministic "random" weather based on location
  const seed = location
    .toLowerCase()
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const random = (min: number, max: number) => {
    const x = Math.sin(seed) * 10000;
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
  };

  const tempC = random(-10, 35);
  const humidity = random(30, 90);
  const windSpeed = random(0, 30);

  const conditions = [
    "Sunny",
    "Partly cloudy",
    "Cloudy",
    "Overcast",
    "Light rain",
    "Rain",
    "Thunderstorm",
    "Snow",
    "Fog",
    "Clear",
  ][seed % 10];

  const temperature = units === "fahrenheit" ? Math.round(tempC * 9 / 5 + 32) : tempC;
  const tempUnit = units === "fahrenheit" ? "°F" : "°C";

  return JSON.stringify({
    location,
    temperature,
    units: tempUnit,
    conditions,
    humidity: `${humidity}%`,
    wind_speed: `${windSpeed} km/h`,
    note: "Mock data for demonstration",
  });
}

function executeSearchWeb(args: { query: string; num_results?: number }): string {
  const { query, num_results = 3 } = args;
  const numResults = Math.max(1, Math.min(10, num_results));

  const mockResults = [
    {
      title: `Understanding ${query} - Comprehensive Guide`,
      url: `https://example.com/guide/${query.replace(/\s+/g, "-").toLowerCase()}`,
      snippet: `A complete guide to ${query}. Learn everything you need to know...`,
    },
    {
      title: `${query} - Wikipedia`,
      url: `https://en.wikipedia.org/wiki/${query.replace(/\s+/g, "_")}`,
      snippet: `${query} refers to a concept or topic that has been widely discussed...`,
    },
    {
      title: `How to ${query}: Step-by-Step Tutorial`,
      url: `https://tutorial-site.com/${query.replace(/\s+/g, "-").toLowerCase()}`,
      snippet: `Follow our step-by-step instructions to learn about ${query}...`,
    },
    {
      title: `Top 10 Things About ${query}`,
      url: `https://blog.example.com/top-10-${query.replace(/\s+/g, "-").toLowerCase()}`,
      snippet: `Discover the most important facts about ${query}...`,
    },
    {
      title: `${query} FAQ - Common Questions`,
      url: `https://faq.example.com/${query.replace(/\s+/g, "-").toLowerCase()}`,
      snippet: `Got questions about ${query}? Find answers here...`,
    },
  ];

  return JSON.stringify({
    query,
    num_results: numResults,
    results: mockResults.slice(0, numResults),
    note: "Mock results for demonstration",
  });
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

// Tool executor registry
type ToolExecutor = (args: Record<string, unknown>) => string;

const TOOL_EXECUTORS = new Map<string, ToolExecutor>([
  ["calculator", (args) => executeCalculator(args as { expression: string })],
  ["get_weather", (args) => executeGetWeather(args as { location: string; units?: string })],
  ["search_web", (args) => executeSearchWeb(args as { query: string; num_results?: number })],
  ["get_current_time", (args) => executeGetCurrentTime(args as { timezone?: string })],
]);

/**
 * Execute a tool by name with the given arguments.
 */
export function executeTool(name: string, args: Record<string, unknown>): string {
  const executor = TOOL_EXECUTORS.get(name);
  if (!executor) {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  try {
    return executor(args);
  } catch (error) {
    return JSON.stringify({ error: `Tool execution failed: ${error}` });
  }
}
