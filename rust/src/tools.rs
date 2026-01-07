//! Tool Definitions and Executors
//!
//! This module defines the tools available to the ReAct agent.
//! Each tool has a definition (for the LLM) and an executor function.
//!
//! Tools use real APIs where possible:
//! - Weather: Open-Meteo API (free, no API key required)
//! - Search: DuckDuckGo Instant Answer API (free, no API key required)

use crate::openrouter::Tool;
use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use reqwest::Client;
use serde_json::{json, Value};

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
                      humidity. Uses the Open-Meteo API for real weather data."
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
        description: "Search the web for information using DuckDuckGo. Returns instant answers, \
                      abstracts, and related topics."
            .to_string(),
        parameters: json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query"
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
/// Some tools are async (weather, search) so this function is async.
pub async fn execute_tool(name: &str, arguments: &str) -> String {
    let args: Value = match serde_json::from_str(arguments) {
        Ok(v) => v,
        Err(e) => return json!({"error": format!("Failed to parse arguments: {}", e)}).to_string(),
    };

    let result = match name {
        "calculator" => execute_calculator(&args),
        "get_weather" => execute_get_weather(&args).await,
        "search_web" => execute_search_web(&args).await,
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

/// Map WMO weather codes to human-readable descriptions.
fn weather_code_to_description(code: i64) -> &'static str {
    match code {
        0 => "Clear sky",
        1 => "Mainly clear",
        2 => "Partly cloudy",
        3 => "Overcast",
        45 => "Foggy",
        48 => "Depositing rime fog",
        51 => "Light drizzle",
        53 => "Moderate drizzle",
        55 => "Dense drizzle",
        56 => "Light freezing drizzle",
        57 => "Dense freezing drizzle",
        61 => "Slight rain",
        63 => "Moderate rain",
        65 => "Heavy rain",
        66 => "Light freezing rain",
        67 => "Heavy freezing rain",
        71 => "Slight snow",
        73 => "Moderate snow",
        75 => "Heavy snow",
        77 => "Snow grains",
        80 => "Slight rain showers",
        81 => "Moderate rain showers",
        82 => "Violent rain showers",
        85 => "Slight snow showers",
        86 => "Heavy snow showers",
        95 => "Thunderstorm",
        96 => "Thunderstorm with slight hail",
        99 => "Thunderstorm with heavy hail",
        _ => "Unknown",
    }
}

/// Execute the weather tool using Open-Meteo API.
async fn execute_get_weather(args: &Value) -> Value {
    let location = match args.get("location").and_then(|v| v.as_str()) {
        Some(l) => l,
        None => return json!({"error": "Location is required"}),
    };

    let units = args
        .get("units")
        .and_then(|v| v.as_str())
        .unwrap_or("celsius");

    let client = Client::new();

    // Step 1: Geocode the location
    let geocode_url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=en&format=json",
        urlencoding::encode(location)
    );

    let geocode_response = match client.get(&geocode_url).send().await {
        Ok(resp) => resp,
        Err(e) => return json!({"error": format!("Geocoding request failed: {}", e)}),
    };

    let geocode_data: Value = match geocode_response.json().await {
        Ok(data) => data,
        Err(e) => return json!({"error": format!("Failed to parse geocoding response: {}", e)}),
    };

    let results = match geocode_data.get("results").and_then(|v| v.as_array()) {
        Some(r) if !r.is_empty() => r,
        _ => return json!({"error": format!("Location not found: {}", location)}),
    };

    let place = &results[0];
    let lat = place.get("latitude").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let lon = place.get("longitude").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let resolved_name = place.get("name").and_then(|v| v.as_str()).unwrap_or(location);
    let country = place.get("country").and_then(|v| v.as_str()).unwrap_or("");

    // Step 2: Get weather data
    let temp_unit = if units == "fahrenheit" { "fahrenheit" } else { "celsius" };
    let weather_url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit={}&wind_speed_unit=kmh&timezone=auto",
        lat, lon, temp_unit
    );

    let weather_response = match client.get(&weather_url).send().await {
        Ok(resp) => resp,
        Err(e) => return json!({"error": format!("Weather request failed: {}", e)}),
    };

    let weather_data: Value = match weather_response.json().await {
        Ok(data) => data,
        Err(e) => return json!({"error": format!("Failed to parse weather response: {}", e)}),
    };

    let current = weather_data.get("current").unwrap_or(&json!({}));
    let weather_code = current.get("weather_code").and_then(|v| v.as_i64()).unwrap_or(0);
    let conditions = weather_code_to_description(weather_code);
    let temp_symbol = if units == "fahrenheit" { "°F" } else { "°C" };

    let location_display = if country.is_empty() {
        resolved_name.to_string()
    } else {
        format!("{}, {}", resolved_name, country)
    };

    json!({
        "location": location_display,
        "coordinates": {"latitude": lat, "longitude": lon},
        "temperature": current.get("temperature_2m"),
        "feels_like": current.get("apparent_temperature"),
        "units": temp_symbol,
        "conditions": conditions,
        "humidity": format!("{}%", current.get("relative_humidity_2m").and_then(|v| v.as_i64()).unwrap_or(0)),
        "wind_speed": format!("{} km/h", current.get("wind_speed_10m").and_then(|v| v.as_f64()).unwrap_or(0.0)),
        "source": "Open-Meteo API"
    })
}

/// Execute the web search tool using DuckDuckGo Instant Answer API.
async fn execute_search_web(args: &Value) -> Value {
    let query = match args.get("query").and_then(|v| v.as_str()) {
        Some(q) => q,
        None => return json!({"error": "Query is required"}),
    };

    let client = Client::new();

    let search_url = format!(
        "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
        urlencoding::encode(query)
    );

    let response = match client.get(&search_url).send().await {
        Ok(resp) => resp,
        Err(e) => return json!({"error": format!("Search request failed: {}", e)}),
    };

    let data: Value = match response.json().await {
        Ok(data) => data,
        Err(e) => return json!({"error": format!("Failed to parse search response: {}", e)}),
    };

    let mut results: Vec<Value> = Vec::new();

    // Add abstract (usually from Wikipedia)
    if let Some(abstract_text) = data.get("Abstract").and_then(|v| v.as_str()) {
        if !abstract_text.is_empty() {
            results.push(json!({
                "type": "abstract",
                "title": data.get("Heading").and_then(|v| v.as_str()).unwrap_or(query),
                "text": abstract_text,
                "url": data.get("AbstractURL").and_then(|v| v.as_str()).unwrap_or(""),
                "source": data.get("AbstractSource").and_then(|v| v.as_str()).unwrap_or("")
            }));
        }
    }

    // Add instant answer if available
    if let Some(answer) = data.get("Answer").and_then(|v| v.as_str()) {
        if !answer.is_empty() {
            results.push(json!({
                "type": "instant_answer",
                "text": answer,
                "answer_type": data.get("AnswerType").and_then(|v| v.as_str()).unwrap_or("")
            }));
        }
    }

    // Add definition if available
    if let Some(definition) = data.get("Definition").and_then(|v| v.as_str()) {
        if !definition.is_empty() {
            results.push(json!({
                "type": "definition",
                "text": definition,
                "source": data.get("DefinitionSource").and_then(|v| v.as_str()).unwrap_or(""),
                "url": data.get("DefinitionURL").and_then(|v| v.as_str()).unwrap_or("")
            }));
        }
    }

    // Add related topics
    if let Some(related_topics) = data.get("RelatedTopics").and_then(|v| v.as_array()) {
        for topic in related_topics.iter().take(5) {
            if let Some(text) = topic.get("Text").and_then(|v| v.as_str()) {
                if !text.is_empty() {
                    results.push(json!({
                        "type": "related",
                        "text": text,
                        "url": topic.get("FirstURL").and_then(|v| v.as_str()).unwrap_or("")
                    }));
                }
            }
        }
    }

    // If no results, provide a helpful message
    if results.is_empty() {
        return json!({
            "query": query,
            "message": "No instant answers found. Try a more specific query or search directly on a search engine.",
            "results": [],
            "source": "DuckDuckGo Instant Answer API"
        });
    }

    json!({
        "query": query,
        "results": results,
        "source": "DuckDuckGo Instant Answer API"
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
