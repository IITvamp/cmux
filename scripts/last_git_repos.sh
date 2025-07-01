#!/usr/bin/env bash

# Default number of repos to show
N=${1:-20}

# Show help
show_help() {
    echo "Usage: $0 [N]"
    echo ""
    echo "Lists the last N git repositories from your shell history."
    echo ""
    echo "Options:"
    echo "  N       Number of repositories to show (default: 20)"
    echo ""
    echo "Examples:"
    echo "  $0         # Show last 20 git repos"
    echo "  $0 10      # Show last 10 git repos"
}

# Main function
find_git_repos() {
    # Get cd commands from zsh history and check each directory
    {
        if [ -f "$HOME/.zsh_history" ]; then
            # Extract cd commands from zsh history
            strings "$HOME/.zsh_history" 2>/dev/null | \
            grep -E "^: [0-9]+:[0-9]+;cd " | \
            sed 's/^: [0-9]*:[0-9]*;//' | \
            sed 's/^cd //' | \
            sed 's/[[:space:]]*$//' | \
            grep -v '^-$' | \
            tail -1000
        fi
        
        if [ -f "$HOME/.bash_history" ]; then
            grep "^cd " "$HOME/.bash_history" 2>/dev/null | \
            sed 's/^cd //' | \
            sed 's/[[:space:]]*$//' | \
            grep -v '^-$' | \
            tail -1000
        fi
    } | while IFS= read -r dir; do
        # Skip empty lines
        [ -z "$dir" ] && continue
        
        # Handle escaped spaces
        dir=$(echo "$dir" | sed 's/\\ / /g')
        
        # Expand tilde
        dir="${dir/#\~/$HOME}"
        
        # Try to resolve the directory
        resolved_dir=""
        
        if [[ "$dir" = /* ]]; then
            # Absolute path
            [ -d "$dir" ] && resolved_dir="$dir"
        else
            # Relative path - try common locations
            for base in "$HOME" "$HOME/fun" "$HOME/projects" "$HOME/work" "$HOME/dev"; do
                if [ -d "$base/$dir" ]; then
                    resolved_dir="$base/$dir"
                    break
                fi
            done
        fi
        
        # If we found a valid directory, check if it's a git repo
        if [ -n "$resolved_dir" ] && [ -d "$resolved_dir" ]; then
            git_root=$(cd "$resolved_dir" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)
            [ -n "$git_root" ] && echo "$git_root"
        fi
    done | tac | awk '!seen[$0]++' | head -n "$N"
}

# Main logic
case "${1:-}" in
    --help|-h|help)
        show_help
        ;;
    *)
        if [[ "$1" =~ ^[0-9]+$ ]]; then
            N=$1
        elif [[ -n "$1" ]]; then
            echo "Error: Invalid argument '$1'"
            exit 1
        fi
        find_git_repos
        ;;
esac