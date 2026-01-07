# Python ReAct Agent

A simple, pedagogical implementation of a ReAct agent in Python using only standard libraries and `requests`.

## Architecture

```
python/
├── README.md           # This file
├── requirements.txt    # Python dependencies
├── agent.py           # Core ReAct agent implementation
├── tools.py           # Tool definitions and executors
├── openrouter.py      # OpenRouter API client
└── main.py            # CLI chat interface
```

## Prerequisites

- Python 3.8 or higher
- An OpenRouter API key

## Installation

### Mac/Linux

```bash
# Navigate to the python directory
cd python

# Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set your API key
export OPENROUTER_API_KEY="your-key-here"
```

### Windows

**PowerShell:**
```powershell
# Navigate to the python directory
cd python

# Create a virtual environment (recommended)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Set your API key
$env:OPENROUTER_API_KEY="your-key-here"
```

**Command Prompt:**
```cmd
cd python
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
set OPENROUTER_API_KEY=your-key-here
```

## Running the Agent

### Interactive Chat Mode

```bash
python main.py
```

This starts an interactive chat session. Type your messages and press Enter. Type `quit` or `exit` to end the session.

### With a Custom Agent File

```bash
python main.py --agent ../example.agentfile.json
```

### Single Query Mode

```bash
python main.py --query "What is 25 * 4 + 10?"
```

### Verbose Mode (see the ReAct loop)

```bash
python main.py --verbose
```

## Example Session

```
$ python main.py --verbose

ReAct Agent Chat
Using model: openai/gpt-4o-mini
Type 'quit' to exit

You: What's the weather in Tokyo and what time is it there?

  → Calling get_weather:
    {"location": "Tokyo"}
  ← get_weather returned:
    {"temperature": 18, "conditions": "Partly cloudy", ...}

  → Calling get_current_time:
    {"timezone": "Asia/Tokyo"}
  ← get_current_time returned:
    {"datetime": "2024-01-15T14:30:00+09:00", ...}