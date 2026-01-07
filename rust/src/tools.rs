//! Tool Definitions and Executors
//!
//! This module defines the tools available to the ReAct agent.
//! Each tool has a definition (for the LLM) and an executor function.

use crate::openrouter::Tool;
use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use serde_json::{json, Value};
use std::collections::HashMap;

/// Get all available tools.
pub fn get_all_tools() -> Vec<Tool> {
    vec![
        calculator_tool(),
        get_weather_tool(),
        search_web_tool(),
        get_current_time_tool(),
    ]
}

/// Calculator tool definition.
fn calculator_tool() -> Tool {
    Tool {
        name: "calculator".to_string(),
        description: "Evaluate a mathematical expression. Supports +, -, *, /, ^, parentheses, \
                      and functions like sqrt(), sin(), cos(), tan(), log(), abs()."
            .to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "The mathematical expression to evaluate, e.g., '2 + 2' or 'sqrt(16) * 3'"
                }
            },
            "required": ["expression"]
        }),
    }
}

/// Weather tool definition.
fn get_weather_tool() -> Tool {
    Tool {
        name: "get_weather".to_string(),
        description: "Get the current weather for a location. Returns temperature, conditions, \
                      humidity. Note: Mock data for demonstration."
            .to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city name, e.g., 'San Francisco' or 'London, UK'"
                },
                "units": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "Temperature units (default: celsius)"
                }
            },
            "required": ["location"]
        }),
    }
}

/// Web search tool definition.
fn search_web_tool() -> Tool {
    Tool {
        name: "search_web".to_string(),
        description: "Search the web for information. Returns titles, URLs, and snippets. \
                      Note: Mock data for demonstration."
            .to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query"
                },
                "num_results": {
                    "type": "integer",
                    "description": "Number of results (1-10, default: 3)"
                }
            },
            "required": ["query"]
        }),
    }
}

/// Current time tool definition.
fn get_current_time_tool() -> Tool {
    Tool {
        name: "get_current_time".to_string(),
        description: "Get the current date and time. Optionally specify a timezone \
                      (e.g., 'America/New_York')."
            .to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "timezone": {
                    "type": "string",
                    "description": "IANA timezone name (default: UTC)"
                }
            },
            "required": []
        }),
    }
}

/// Execute a tool by name with the given arguments.
pub fn execute_tool(name: &str, arguments: &str) -> String {
    let args: Value = match serde_json::from_str(arguments) {
        Ok(v) => v,
        Err(e) => return json!({"error": format!("Failed to parse arguments: {}", e)}).to_string(),
    };

    let result = match name {
        "calculator" => execute_calculator(&args),
        "get_weather" => execute_get_weather(&args),
        "search_web" => execute_search_web(&args),
        "get_current_time" => execute_get_current_time(&args),
        _ => json!({"error": format!("Unknown tool: {}", name)}),
    };

    result.to_string()
}

/// Execute the calculator tool.
fn execute_calculator(args: &Value) -> Value {
    let expression = match args.get("expression").and_then(|v| v.as_str()) {
        Some(e) => e,
        None => return json!({"error": "Expression is required"}),
    };

    // Use meval for safe expression evaluation
    match meval::eval_str(expression) {
        Ok(result) => {
            // Format nicely
            let display_result = if result.fract() == 0.0 {
                json!(result as i64)
            } else {
                json!((result * 1e10).round() / 1e10)
            };
            json!({
                "result": display_result,
                "expression": expression
            })
        }
        Err(e) => json!({"error": format!("Calculation failed: {}", e)}),
    }
}

/// Execute the weather tool (mock implementation).
fn execute_get_weather(args: &Value) -> Value {
    let location = match args.get("location").and_then(|v| v.as_str()) {
        Some(l) => l,
        None => return json!({"error": "Location is required"}),
    };

    let units = args
        .get("units")
        .and_then(|v| v.as_str())
        .unwrap_or("celsius");

    // Generate deterministic "random" weather based on location
    let seed: u32 = location.chars().map(|c| c as u32).sum();

    let temp_c = ((seed % 45) as i32) - 10; // -10 to 35
    let humidity = (seed % 60) + 30; // 30 to 90
    let wind_speed = seed % 30; // 0 to 30

    let conditions = [
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
    ];
    let condition = conditions[(seed as usize) % conditions.len()];

    let (temperature, temp_unit) = if units == "fahrenheit" {
        ((temp_c * 9 / 5) + 32, "°F")
    } else {
        (temp_c, "°C")
    };

    json!({
        "location": location,
        "temperature": temperature,
        "units": temp_unit,
        "conditions": condition,
        "humidity": format!("{}%", humidity),
        "wind_speed": format!("{} km/h", wind_speed),
        "note": "Mock data for demonstration"
    })
}

/// Execute the web search tool (mock implementation).
fn execute_search_web(args: &Value) -> Value {
    let query = match args.get("query").and_then(|v| v.as_str()) {
        Some(q) => q,
        None => return json!({"error": "Query is required"}),
    };

    let num_results = args
        .get("num_results")
        .and_then(|v| v.as_i64())
        .unwrap_or(3)
        .clamp(1, 10) as usize;

    let slug = query.to_lowercase().replace(' ', "-");

    let mock_results = vec![
        json!({
            "title": format!("Understanding {} - Guide", query),
            "url": format!("https://example.com/guide/{}", slug),
            "snippet": format!("A complete guide to {}. Learn everything...", query)
        }),
        json!({
            "title": format!("{} - Wikipedia", query),
            "url": format!("https://en.wikipedia.org/wiki/{}", query.replace(' ', "_")),
            "snippet": format!("{} refers to a concept that has been widely discussed...", query)
        }),
        json!({
            "title": format!("How to {}: Tutorial", query),
            "url": format!("https://tutorial-site.com/{}", slug),
            "snippet": format!("Step-by-step instructions to learn about {}...", query)
        }),
    ];

    json!({
        "query": query,
        "num_results": num_results,
        "results": mock_results.into_iter().take(num_results).collect::<Vec<_>>(),
        "note": "Mock results for demonstration"
    })
}

/// Execute the current time tool.
fn execute_get_current_time(args: &Value) -> Value {
    let timezone_str = args
        .get("timezone")
        .and_then(|v| v.as_str())
        .unwrap_or("UTC");

    let now_utc: DateTime<Utc> = Utc::now();

    // Try to parse timezone
    if let Ok(tz) = timezone_str.parse::<Tz>() {
        let now = now_utc.with_timezone(&tz);
        json!({
            "datetime": now.to_rfc3339(),
            "date": now.format("%Y-%m-%d").to_string(),
            "time": now.format("%H:%M:%S").to_string(),
            "timezone": timezone_str,
            "day_of_week": now.format("%A").to_string(),
            "unix_timestamp": now.timestamp()
        })
    } else if timezone_str == "UTC" {
        json!({
            "datetime": now_utc.to_rfc3339(),
            "date": now_utc.format("%Y-%m-%d").to_string(),
            "time": now_utc.format("%H:%M:%S").to_string(),
            "timezone": "UTC",
            "day_of_week": now_utc.format("%A").to_string(),
            "unix_timestamp": now_utc.timestamp()
        })
    } else {
        json!({"error": format!("Invalid timezone: {}", timezone_str)})
    }
}
