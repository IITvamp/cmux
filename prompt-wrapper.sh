#!/bin/bash
# A wrapper script that pipes a prompt to a command
# Usage: prompt-wrapper.sh --prompt "prompt text" -- <command> [args...]

PROMPT=""
COMMAND_ARGS=()
PARSING_PROMPT=false
PARSING_COMMAND=false

# Parse arguments
for arg in "$@"; do
    if [ "$arg" = "--prompt" ]; then
        PARSING_PROMPT=true
        PARSING_COMMAND=false
    elif [ "$arg" = "--" ]; then
        PARSING_PROMPT=false
        PARSING_COMMAND=true
    elif [ "$PARSING_PROMPT" = true ]; then
        PROMPT="$arg"
        PARSING_PROMPT=false
    elif [ "$PARSING_COMMAND" = true ]; then
        COMMAND_ARGS+=("$arg")
    fi
done

# If no command was provided after --, show usage
if [ ${#COMMAND_ARGS[@]} -eq 0 ]; then
    echo "Usage: $0 --prompt \"prompt text\" -- <command> [args...]"
    exit 1
fi

# Execute the command with the prompt piped to it
echo "$PROMPT" | "${COMMAND_ARGS[@]}"