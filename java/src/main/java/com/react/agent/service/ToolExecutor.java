package com.react.agent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.react.agent.model.Tool;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import java.net.URI;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;

/**
 * Tool Executor Service
 *
 * Handles the execution of tools called by the agent.
 * Each tool is registered with a name and an executor function.
 *
 * Tools use real APIs where possible:
 * - Weather: Open-Meteo API (free, no API key required)
 * - Search: DuckDuckGo Instant Answer API (free, no API key required)
 */
@Service
public class ToolExecutor {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();
    private final Map<String, Function<Map<String, Object>, Map<String, Object>>> executors = new HashMap<>();
    private final List<Tool> availableTools = new ArrayList<>();

    public ToolExecutor() {
        registerDefaultTools();
    }

    /**
     * Register the default set of tools.
     */
    private void registerDefaultTools() {
        // Calculator tool
        registerTool(
            new Tool(
                "calculator",
                "Evaluate a mathematical expression. Supports +, -, *, /, parentheses, and basic functions.",
                new Tool.Parameters(
                    "object",
                    Map.of(
                        "expression", new Tool.Property("string", "The math expression to evaluate", null, null)
                    ),
                    List.of("expression")
                )
            ),
            this::executeCalculator
        );

        // Weather tool (real API)
        registerTool(
            new Tool(
                "get_weather",
                "Get the current weather for a location. Returns temperature, conditions, humidity. Uses Open-Meteo API for real weather data.",
                new Tool.Parameters(
                    "object",
                    Map.of(
                        "location", new Tool.Property("string", "The city name", null, null),
                        "units", new Tool.Property("string", "Temperature units", List.of("celsius", "fahrenheit"), "celsius")
                    ),
                    List.of("location")
                )
            ),
            this::executeGetWeather
        );

        // Web search tool (real API)
        registerTool(
            new Tool(
                "search_web",
                "Search the web for information using DuckDuckGo. Returns instant answers, abstracts, and related topics.",
                new Tool.Parameters(
                    "object",
                    Map.of(
                        "query", new Tool.Property("string", "The search query", null, null)
                    ),
                    List.of("query")
                )
            ),
            this::executeSearchWeb
        );

        // Current time tool
        registerTool(
            new Tool(
                "get_current_time",
                "Get the current date and time. Optionally specify a timezone (e.g., 'America/New_York').",
                new Tool.Parameters(
                    "object",
                    Map.of(
                        "timezone", new Tool.Property("string", "IANA timezone name", null, "UTC")
                    ),
                    List.of()
                )
            ),
            this::executeGetCurrentTime
        );
    }

    /**
     * Register a tool with its executor.
     */
    public void registerTool(Tool tool, Function<Map<String, Object>, Map<String, Object>> executor) {
        availableTools.add(tool);
        executors.put(tool.name(), executor);
    }

    /**
     * Get all available tools.
     */
    public List<Tool> getAvailableTools() {
        return Collections.unmodifiableList(availableTools);
    }

    /**
     * Execute a tool by name with the given arguments.
     *
     * @param name The tool name
     * @param argumentsJson JSON string of arguments
     * @return JSON string result
     */
    public String execute(String name, String argumentsJson) {
        try {
            Map<String, Object> args = objectMapper.readValue(argumentsJson, Map.class);
            return execute(name, args);
        } catch (Exception e) {
            return toJson(Map.of("error", "Failed to parse arguments: " + e.getMessage()));
        }
    }

    /**
     * Execute a tool with parsed arguments.
     */
    public String execute(String name, Map<String, Object> arguments) {
        Function<Map<String, Object>, Map<String, Object>> executor = executors.get(name);
        if (executor == null) {
            return toJson(Map.of("error", "Unknown tool: " + name));
        }

        try {
            Map<String, Object> result = executor.apply(arguments);
            return toJson(result);
        } catch (Exception e) {
            return toJson(Map.of("error", "Tool execution failed: " + e.getMessage()));
        }
    }

    // ============================================================================
    // Tool Implementations
    // ============================================================================

    private Map<String, Object> executeCalculator(Map<String, Object> args) {
        String expression = (String) args.get("expression");
        if (expression == null || expression.isEmpty()) {
            return Map.of("error", "Expression is required");
        }

        try {
            // Simple expression evaluator using JavaScript engine
            // Note: In production, use a proper math expression parser
            ScriptEngineManager manager = new ScriptEngineManager();
            ScriptEngine engine = manager.getEngineByName("JavaScript");

            if (engine == null) {
                // Fallback for simple expressions
                double result = evaluateSimpleExpression(expression);
                return Map.of("result", result, "expression", expression);
            }

            // Replace common math functions
            String jsExpression = expression
                .replace("sqrt", "Math.sqrt")
                .replace("sin", "Math.sin")
                .replace("cos", "Math.cos")
                .replace("tan", "Math.tan")
                .replace("log", "Math.log")
                .replace("abs", "Math.abs")
                .replace("pow", "Math.pow")
                .replace("pi", "Math.PI")
                .replace("^", "**");

            Object result = engine.eval(jsExpression);
            double numResult = ((Number) result).doubleValue();

            // Format nicely
            if (numResult == Math.floor(numResult) && !Double.isInfinite(numResult)) {
                return Map.of("result", (long) numResult, "expression", expression);
            }
            return Map.of("result", numResult, "expression", expression);

        } catch (Exception e) {
            return Map.of("error", "Calculation failed: " + e.getMessage());
        }
    }

    private double evaluateSimpleExpression(String expr) {
        // Very basic expression evaluator for simple arithmetic
        expr = expr.replaceAll("\\s+", "");
        return evaluateAddSubtract(expr, new int[]{0});
    }

    private double evaluateAddSubtract(String expr, int[] pos) {
        double result = evaluateMultiplyDivide(expr, pos);
        while (pos[0] < expr.length()) {
            char op = expr.charAt(pos[0]);
            if (op == '+') {
                pos[0]++;
                result += evaluateMultiplyDivide(expr, pos);
            } else if (op == '-') {
                pos[0]++;
                result -= evaluateMultiplyDivide(expr, pos);
            } else {
                break;
            }
        }
        return result;
    }

    private double evaluateMultiplyDivide(String expr, int[] pos) {
        double result = evaluateNumber(expr, pos);
        while (pos[0] < expr.length()) {
            char op = expr.charAt(pos[0]);
            if (op == '*') {
                pos[0]++;
                result *= evaluateNumber(expr, pos);
            } else if (op == '/') {
                pos[0]++;
                result /= evaluateNumber(expr, pos);
            } else {
                break;
            }
        }
        return result;
    }

    private double evaluateNumber(String expr, int[] pos) {
        if (pos[0] < expr.length() && expr.charAt(pos[0]) == '(') {
            pos[0]++; // skip '('
            double result = evaluateAddSubtract(expr, pos);
            pos[0]++; // skip ')'
            return result;
        }

        int start = pos[0];
        while (pos[0] < expr.length() && (Character.isDigit(expr.charAt(pos[0])) || expr.charAt(pos[0]) == '.')) {
            pos[0]++;
        }
        return Double.parseDouble(expr.substring(start, pos[0]));
    }

    /**
     * Get real weather data using Open-Meteo API.
     */
    private Map<String, Object> executeGetWeather(Map<String, Object> args) {
        String location = (String) args.get("location");
        String units = (String) args.getOrDefault("units", "celsius");

        if (location == null || location.isEmpty()) {
            return Map.of("error", "Location is required");
        }

        try {
            // Step 1: Geocode the location
            URI geocodeUri = UriComponentsBuilder
                .fromHttpUrl("https://geocoding-api.open-meteo.com/v1/search")
                .queryParam("name", location)
                .queryParam("count", 1)
                .queryParam("language", "en")
                .queryParam("format", "json")
                .build()
                .toUri();

            String geocodeResponse = restTemplate.getForObject(geocodeUri, String.class);
            JsonNode geocodeData = objectMapper.readTree(geocodeResponse);

            if (!geocodeData.has("results") || geocodeData.get("results").isEmpty()) {
                return Map.of("error", "Location not found: " + location);
            }

            JsonNode place = geocodeData.get("results").get(0);
            double lat = place.get("latitude").asDouble();
            double lon = place.get("longitude").asDouble();
            String resolvedName = place.has("name") ? place.get("name").asText() : location;
            String country = place.has("country") ? place.get("country").asText() : "";

            // Step 2: Get weather data
            String tempUnit = units.equals("fahrenheit") ? "fahrenheit" : "celsius";
            URI weatherUri = UriComponentsBuilder
                .fromHttpUrl("https://api.open-meteo.com/v1/forecast")
                .queryParam("latitude", lat)
                .queryParam("longitude", lon)
                .queryParam("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m")
                .queryParam("temperature_unit", tempUnit)
                .queryParam("wind_speed_unit", "kmh")
                .queryParam("timezone", "auto")
                .build()
                .toUri();

            String weatherResponse = restTemplate.getForObject(weatherUri, String.class);
            JsonNode weatherData = objectMapper.readTree(weatherResponse);
            JsonNode current = weatherData.get("current");

            int weatherCode = current.has("weather_code") ? current.get("weather_code").asInt() : 0;
            String conditions = weatherCodeToDescription(weatherCode);
            String tempSymbol = units.equals("fahrenheit") ? "°F" : "°C";

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("location", country.isEmpty() ? resolvedName : resolvedName + ", " + country);
            result.put("coordinates", Map.of("latitude", lat, "longitude", lon));
            result.put("temperature", current.has("temperature_2m") ? current.get("temperature_2m").asDouble() : null);
            result.put("feels_like", current.has("apparent_temperature") ? current.get("apparent_temperature").asDouble() : null);
            result.put("units", tempSymbol);
            result.put("conditions", conditions);
            result.put("humidity", (current.has("relative_humidity_2m") ? current.get("relative_humidity_2m").asInt() : "N/A") + "%");
            result.put("wind_speed", (current.has("wind_speed_10m") ? current.get("wind_speed_10m").asDouble() : "N/A") + " km/h");
            result.put("source", "Open-Meteo API");

            return result;

        } catch (Exception e) {
            return Map.of("error", "Failed to get weather: " + e.getMessage());
        }
    }

    /**
     * Map WMO weather codes to human-readable descriptions.
     */
    private String weatherCodeToDescription(int code) {
        return switch (code) {
            case 0 -> "Clear sky";
            case 1 -> "Mainly clear";
            case 2 -> "Partly cloudy";
            case 3 -> "Overcast";
            case 45 -> "Foggy";
            case 48 -> "Depositing rime fog";
            case 51 -> "Light drizzle";
            case 53 -> "Moderate drizzle";
            case 55 -> "Dense drizzle";
            case 56 -> "Light freezing drizzle";
            case 57 -> "Dense freezing drizzle";
            case 61 -> "Slight rain";
            case 63 -> "Moderate rain";
            case 65 -> "Heavy rain";
            case 66 -> "Light freezing rain";
            case 67 -> "Heavy freezing rain";
            case 71 -> "Slight snow";
            case 73 -> "Moderate snow";
            case 75 -> "Heavy snow";
            case 77 -> "Snow grains";
            case 80 -> "Slight rain showers";
            case 81 -> "Moderate rain showers";
            case 82 -> "Violent rain showers";
            case 85 -> "Slight snow showers";
            case 86 -> "Heavy snow showers";
            case 95 -> "Thunderstorm";
            case 96 -> "Thunderstorm with slight hail";
            case 99 -> "Thunderstorm with heavy hail";
            default -> "Unknown (code " + code + ")";
        };
    }

    /**
     * Search the web using DuckDuckGo Instant Answer API.
     */
    private Map<String, Object> executeSearchWeb(Map<String, Object> args) {
        String query = (String) args.get("query");

        if (query == null || query.isEmpty()) {
            return Map.of("error", "Query is required");
        }

        try {
            URI searchUri = UriComponentsBuilder
                .fromHttpUrl("https://api.duckduckgo.com/")
                .queryParam("q", query)
                .queryParam("format", "json")
                .queryParam("no_html", 1)
                .queryParam("skip_disambig", 1)
                .build()
                .toUri();

            String response = restTemplate.getForObject(searchUri, String.class);
            JsonNode data = objectMapper.readTree(response);

            List<Map<String, String>> results = new ArrayList<>();

            // Add abstract (usually from Wikipedia)
            if (data.has("Abstract") && !data.get("Abstract").asText().isEmpty()) {
                results.add(Map.of(
                    "type", "abstract",
                    "title", data.has("Heading") ? data.get("Heading").asText() : query,
                    "text", data.get("Abstract").asText(),
                    "url", data.has("AbstractURL") ? data.get("AbstractURL").asText() : "",
                    "source", data.has("AbstractSource") ? data.get("AbstractSource").asText() : ""
                ));
            }

            // Add instant answer if available
            if (data.has("Answer") && !data.get("Answer").asText().isEmpty()) {
                results.add(Map.of(
                    "type", "instant_answer",
                    "text", data.get("Answer").asText(),
                    "answer_type", data.has("AnswerType") ? data.get("AnswerType").asText() : ""
                ));
            }

            // Add definition if available
            if (data.has("Definition") && !data.get("Definition").asText().isEmpty()) {
                results.add(Map.of(
                    "type", "definition",
                    "text", data.get("Definition").asText(),
                    "source", data.has("DefinitionSource") ? data.get("DefinitionSource").asText() : "",
                    "url", data.has("DefinitionURL") ? data.get("DefinitionURL").asText() : ""
                ));
            }

            // Add related topics
            if (data.has("RelatedTopics")) {
                JsonNode relatedTopics = data.get("RelatedTopics");
                int count = 0;
                for (JsonNode topic : relatedTopics) {
                    if (count >= 5) break;
                    if (topic.has("Text") && !topic.get("Text").asText().isEmpty()) {
                        results.add(Map.of(
                            "type", "related",
                            "text", topic.get("Text").asText(),
                            "url", topic.has("FirstURL") ? topic.get("FirstURL").asText() : ""
                        ));
                        count++;
                    }
                }
            }

            // If no results, provide a helpful message
            if (results.isEmpty()) {
                return Map.of(
                    "query", query,
                    "message", "No instant answers found. Try a more specific query or search directly on a search engine.",
                    "results", List.of(),
                    "source", "DuckDuckGo Instant Answer API"
                );
            }

            return Map.of(
                "query", query,
                "results", results,
                "source", "DuckDuckGo Instant Answer API"
            );

        } catch (Exception e) {
            return Map.of("error", "Search failed: " + e.getMessage());
        }
    }

    private Map<String, Object> executeGetCurrentTime(Map<String, Object> args) {
        String timezone = (String) args.getOrDefault("timezone", "UTC");

        try {
            ZoneId zoneId = ZoneId.of(timezone);
            ZonedDateTime now = ZonedDateTime.now(zoneId);

            return Map.of(
                "datetime", now.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                "date", now.format(DateTimeFormatter.ISO_LOCAL_DATE),
                "time", now.format(DateTimeFormatter.ISO_LOCAL_TIME),
                "timezone", timezone,
                "day_of_week", now.getDayOfWeek().toString(),
                "unix_timestamp", now.toEpochSecond()
            );
        } catch (Exception e) {
            return Map.of("error", "Invalid timezone: " + timezone);
        }
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    private String toJson(Map<String, Object> map) {
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return "{\"error\": \"Failed to serialize result\"}";
        }
    }
}
