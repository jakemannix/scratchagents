package com.react.agent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Spring Boot Application Entry Point
 *
 * This is the main class that starts the ReAct Agent server.
 * It initializes Spring Boot and all its auto-configurations.
 */
@SpringBootApplication
public class ReactAgentApplication {

    public static void main(String[] args) {
        SpringApplication.run(ReactAgentApplication.class, args);
        System.out.println("\n=================================");
        System.out.println("ReAct Agent Server Started!");
        System.out.println("API available at: http://localhost:8080/api");
        System.out.println("=================================\n");
    }
}
