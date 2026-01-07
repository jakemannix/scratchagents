package com.react.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.react.agent.model.Tool;
import org.springframework.stereotype.Service;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;

/**
 * Tool Executor Service
 *
 * Handles the execution of tools called by the agent.
 * Each tool is registered with a name and an executor function.
 */
@Service
public class ToolExecutor {

    private final ObjectMapper objectMapper = new ObjectMapper();
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

        // Weather tool (mock)
        registerTool(
            new Tool(
                "get_weather",
                "Get the current weather for a location. Returns temperature, conditions, humidity. Note: Mock data for demo.",
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

        // Web search tool (mock)
        registerTool(
            new Tool(
                "search_web",
                "Search the web for information. Returns titles, URLs, and snippets. Note: Mock data for demo.",
                new Tool.Parameters(
                    "object",
                    Map.of(
                        "query", new Tool.Property("string", "The search query", null, null),
                        "num_results", new Tool.Property("integer", "Number of results (1-10)", null, 3)
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

    private Map<String, Object> executeGetWeather(Map<String, Object> args) {
        String location = (String) args.get("location");
        String units = (String) args.getOrDefault("units", "celsius");

        if (location == null || location.isEmpty()) {
            return Map.of("error", "Location is required");
        }

        // Generate deterministic mock weather based on location
        int seed = location.toLowerCase().chars().sum();
        Random random = new Random(seed);

        int tempC = random.nextInt(45) - 10; // -10 to 35
        int humidity = random.nextInt(60) + 30; // 30 to 90
        int windSpeed = random.nextInt(30); // 0 to 30

        String[] conditions = {"Sunny", "Partly cloudy", "Cloudy", "Overcast",
            "Light rain", "Rain", "Thunderstorm", "Snow", "Fog", "Clear"};
        String condition = conditions[seed % conditions.length];

        int temperature = units.equals("fahrenheit") ? (int) (tempC * 9.0 / 5 + 32) : tempC;
        String tempUnit = units.equals("fahrenheit") ? "°F" : "°C";

        return Map.of(
            "location", location,
            "temperature", temperature,
            "units", tempUnit,
            "conditions", condition,
            "humidity", humidity + "%",
            "wind_speed", windSpeed + " km/h",
            "note", "Mock data for demonstration"
        );
    }

    private Map<String, Object> executeSearchWeb(Map<String, Object> args) {
        String query = (String) args.get("query");
        int numResults = args.containsKey("num_results")
            ? ((Number) args.get("num_results")).intValue()
            : 3;
        numResults = Math.max(1, Math.min(10, numResults));

        if (query == null || query.isEmpty()) {
            return Map.of("error", "Query is required");
        }

        String slug = query.toLowerCase().replaceAll("\\s+", "-");
        List<Map<String, String>> results = new ArrayList<>();

        results.add(Map.of(
            "title", "Understanding " + query + " - Guide",
            "url", "https://example.com/guide/" + slug,
            "snippet", "A complete guide to " + query + ". Learn everything..."
        ));
        results.add(Map.of(
            "title", query + " - Wikipedia",
            "url", "https://en.wikipedia.org/wiki/" + query.replace(" ", "_"),
            "snippet", query + " refers to a concept that has been widely discussed..."
        ));
        results.add(Map.of(
            "title", "How to " + query + ": Tutorial",
            "url", "https://tutorial-site.com/" + slug,
            "snippet", "Step-by-step instructions to learn about " + query + "..."
        ));

        return Map.of(
            "query", query,
            "num_results", numResults,
            "results", results.subList(0, Math.min(numResults, results.size())),
            "note", "Mock results for demonstration"
        );
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
