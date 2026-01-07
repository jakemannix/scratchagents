#!/usr/bin/env python3
"""
ReAct Agent CLI Interface

This module provides a command-line interface for interacting with the
ReAct agent. It supports:
- Interactive chat mode
- Single query mode
- Loading custom agent configurations
- Verbose mode to see the agent's reasoning

Usage:
    python main.py                          # Interactive chat
    python main.py --query "What is 2+2?"   # Single query
    python main.py --agent config.json      # Custom agent file
    python main.py --verbose                # See tool calls
"""

import argparse
import json
import sys
from pathlib import Path

# Try to import colorama for colored output (optional)
try:
    from colorama import init, Fore, Style
    init()  # Initialize colorama for Windows support
    HAS_COLOR = True
except ImportError:
    HAS_COLOR = False
    # Create dummy color constants
    class Fore:
        GREEN = YELLOW = CYAN = RED = RESET = ""
    class Style:
        BRIGHT = RESET_ALL = ""

from agent import ReactAgent
from openrouter import OpenRouterError


def print_colored(text: str, color: str = "", bright: bool = False) -> None:
    """Print text with optional color."""
    prefix = ""
    suffix = ""
    if HAS_COLOR:
        prefix = color
        if bright:
            prefix = Style.BRIGHT + prefix
        suffix = Style.RESET_ALL
    print(f"{prefix}{text}{suffix}")


def print_tool_call(name: str, args: dict) -> None:
    """Print a formatted tool call."""
    args_str = json.dumps(args, indent=2)
    print_colored(f"  → Calling {name}:", Fore.YELLOW)
    for line in args_str.split("\n"):
        print_colored(f"    {line}", Fore.YELLOW)


def print_tool_result(name: str, result: str) -> None:
    """Print a formatted tool result."""
    try:
        # Try to pretty-print JSON results
        result_obj = json.loads(result)
        result_str = json.dumps(result_obj, indent=2)
    except json.JSONDecodeError:
        result_str = result

    print_colored(f"  ← {name} returned:", Fore.CYAN)
    # Truncate very long results
    lines = result_str.split("\n")
    for i, line in enumerate(lines[:10]):
        print_colored(f"    {line}", Fore.CYAN)
    if len(lines) > 10:
        print_colored(f"    ... ({len(lines) - 10} more lines)", Fore.CYAN)


def load_agentfile(path: str) -> dict:
    """Load and parse an agentfile."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print_colored(f"Error: Agent file not found: {path}", Fore.RED)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print_colored(f"Error: Invalid JSON in agent file: {e}", Fore.RED)
        sys.exit(1)


def run_interactive(agent: ReactAgent, verbose: bool = False) -> None:
    """
    Run an interactive chat session.

    Args:
        agent: The ReactAgent instance to use
        verbose: Whether to show tool calls
    """
    print_colored("\nReAct Agent Chat", Fore.GREEN, bright=True)
    print_colored(f"Using model: {agent.model}", Fore.GREEN)
    print_colored("Type 'quit' or 'exit' to end the session", Fore.GREEN)
    print_colored("Type 'reset' to clear conversation history", Fore.GREEN)
    print_colored("-" * 50, Fore.GREEN)
    print()

    # Set up callbacks if verbose mode
    if verbose:
        agent.on_tool_call = print_tool_call
        agent.on_tool_result = print_tool_result

    while True:
        try:
            # Get user input
            user_input = input(f"{Fore.GREEN}You: {Style.RESET_ALL}" if HAS_COLOR else "You: ")
            user_input = user_input.strip()

            # Check for special commands
            if not user_input:
                continue
            if user_input.lower() in ("quit", "exit"):
                print_colored("\nGoodbye!", Fore.GREEN)
                break
            if user_input.lower() == "reset":
                agent.reset()
                print_colored("Conversation history cleared.", Fore.YELLOW)
                continue
            if user_input.lower() == "history":
                # Debug: show message history
                for i, msg in enumerate(agent.get_history()):
                    print(f"{i}: {msg['role']}: {str(msg.get('content', msg))[:100]}...")
                continue

            # Get response from agent
            if verbose:
                print()  # Add spacing before tool calls

            response = agent.chat(user_input)

            if verbose:
                print()  # Add spacing after tool calls

            # Print the response
            print(f"\n{Fore.CYAN}Assistant: {Style.RESET_ALL}{response}\n" if HAS_COLOR else f"\nAssistant: {response}\n")

        except OpenRouterError as e:
            print_colored(f"\nAPI Error: {e}\n", Fore.RED)
        except KeyboardInterrupt:
            print_colored("\n\nInterrupted. Goodbye!", Fore.YELLOW)
            break
        except Exception as e:
            print_colored(f"\nError: {e}\n", Fore.RED)
            if verbose:
                import traceback
                traceback.print_exc()


def run_single_query(agent: ReactAgent, query: str, verbose: bool = False) -> None:
    """
    Run a single query and print the response.

    Args:
        agent: The ReactAgent instance to use
        query: The query to send
        verbose: Whether to show tool calls
    """
    if verbose:
        agent.on_tool_call = print_tool_call
        agent.on_tool_result = print_tool_result
        print()

    try:
        response = agent.chat(query)
        if verbose:
            print()
        print(response)
    except OpenRouterError as e:
        print_colored(f"API Error: {e}", Fore.RED)
        sys.exit(1)
    except Exception as e:
        print_colored(f"Error: {e}", Fore.RED)
        sys.exit(1)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="ReAct Agent - A simple reasoning and acting chatbot",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                              # Interactive chat
  python main.py --query "What is 15 * 7?"    # Single query
  python main.py --agent ../example.agentfile.json  # Custom agent
  python main.py --verbose                    # See tool usage
  python main.py --model anthropic/claude-3-haiku  # Different model
        """
    )

    parser.add_argument(
        "--agent", "-a",
        type=str,
        help="Path to an agentfile.json configuration"
    )

    parser.add_argument(
        "--query", "-q",
        type=str,
        help="Single query to run (non-interactive mode)"
    )

    parser.add_argument(
        "--model", "-m",
        type=str,
        default="openai/gpt-4o-mini",
        help="OpenRouter model to use (default: openai/gpt-4o-mini)"
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show tool calls and results"
    )

    parser.add_argument(
        "--temperature", "-t",
        type=float,
        default=0.7,
        help="LLM temperature (0-2, default: 0.7)"
    )

    args = parser.parse_args()

    # Create the agent
    if args.agent:
        # Load from agentfile
        agentfile = load_agentfile(args.agent)
        agent = ReactAgent.from_agentfile(agentfile, verbose=args.verbose)
        # Override model if specified
        if args.model != "openai/gpt-4o-mini":
            agent.model = args.model
    else:
        # Create with command-line options
        agent = ReactAgent(
            model=args.model,
            temperature=args.temperature,
            verbose=args.verbose
        )

    # Run in appropriate mode
    if args.query:
        run_single_query(agent, args.query, args.verbose)
    else:
        run_interactive(agent, args.verbose)


if __name__ == "__main__":
    main()
