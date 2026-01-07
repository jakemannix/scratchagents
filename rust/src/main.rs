//! ReAct Agent CLI
//!
//! This module provides a command-line interface for interacting with the
//! ReAct agent. It supports interactive chat and single-query modes.

mod agent;
mod openrouter;
mod tools;

use agent::ReactAgent;
use anyhow::Result;
use clap::Parser;
use colored::*;
use std::io::{self, Write};

/// ReAct Agent - A simple reasoning and acting chatbot
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Single query to run (non-interactive mode)
    #[arg(short, long)]
    query: Option<String>,

    /// OpenRouter model to use
    #[arg(short, long, default_value = "openai/gpt-4o-mini")]
    model: String,

    /// Show tool calls and results
    #[arg(short, long)]
    verbose: bool,

    /// Maximum tool-use iterations
    #[arg(long, default_value = "10")]
    max_iterations: u32,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    // Create the agent
    let mut agent = ReactAgent::new(&args.model)?;
    agent.set_max_iterations(args.max_iterations);

    // Set up callbacks for verbose mode
    if args.verbose {
        agent.on_tool_call = Some(Box::new(|name, arguments| {
            println!(
                "\n{}",
                format!("[Calling {}({})]", name, truncate(arguments, 100)).yellow()
            );
        }));

        agent.on_tool_result = Some(Box::new(|name, result| {
            println!(
                "{}",
                format!("[Result from {}: {}]", name, truncate(result, 200)).cyan()
            );
        }));
    }

    // Run in appropriate mode
    if let Some(query) = args.query {
        run_single_query(&mut agent, &query, args.verbose).await?;
    } else {
        run_interactive(&mut agent, args.verbose).await?;
    }

    Ok(())
}

/// Run a single query and print the response.
async fn run_single_query(agent: &mut ReactAgent, query: &str, verbose: bool) -> Result<()> {
    if verbose {
        println!();
    }

    match agent.chat(query).await {
        Ok(result) => {
            if verbose {
                println!();
            }
            println!("{}", result.response);
        }
        Err(e) => {
            eprintln!("{}", format!("Error: {}", e).red());
        }
    }

    Ok(())
}

/// Run an interactive chat session.
async fn run_interactive(agent: &mut ReactAgent, verbose: bool) -> Result<()> {
    println!("\n{}", "ReAct Agent (Rust)".green().bold());
    println!("{}", format!("Model: {}", agent.get_model()).green());
    println!(
        "{}",
        "Type 'quit' to exit, 'reset' to clear history".green()
    );
    println!("{}", "-".repeat(50).green());
    println!();

    loop {
        // Print prompt
        print!("{}", "You: ".green().bold());
        io::stdout().flush()?;

        // Read input
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let input = input.trim();

        // Handle special commands
        if input.is_empty() {
            continue;
        }

        match input.to_lowercase().as_str() {
            "quit" | "exit" => {
                println!("\n{}", "Goodbye!".green());
                break;
            }
            "reset" => {
                agent.reset();
                println!("{}", "Conversation history cleared.".yellow());
                continue;
            }
            "history" => {
                println!("\n{}", "Conversation History:".cyan().bold());
                for (i, msg) in agent.get_history().iter().enumerate() {
                    let content = msg.content.as_deref().unwrap_or("[tool calls]");
                    let truncated = truncate(content, 100);
                    println!("  {}: {} - {}", i, msg.role.cyan(), truncated);
                }
                println!();
                continue;
            }
            _ => {}
        }

        // Get response from agent
        if verbose {
            println!();
        }

        match agent.chat(input).await {
            Ok(result) => {
                if verbose {
                    println!();
                }
                println!(
                    "\n{}{}\n",
                    "Assistant: ".cyan().bold(),
                    result.response
                );
            }
            Err(e) => {
                eprintln!("\n{}\n", format!("Error: {}", e).red());
            }
        }
    }

    Ok(())
}

/// Truncate a string to a maximum length.
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}
