#!/bin/sh
# Auto-install envctl hook for interactive shells (bash/zsh)
# Ensures each new shell session picks up env changes from envd

# Only for interactive shells
case $- in
  *i*) ;; # interactive
  *) return ;; # non-interactive: skip
esac

if command -v envctl >/dev/null 2>&1; then
  # Bash
  if [ -n "$BASH_VERSION" ]; then
    eval "$(envctl hook bash)"
    # Force an initial refresh so existing values are available immediately
    __envctl_refresh 2>/dev/null || true
  # Zsh
  elif [ -n "$ZSH_VERSION" ]; then
    eval "$(envctl hook zsh)"
    # Force an initial refresh so existing values are available immediately
    __envctl_refresh 2>/dev/null || true
  fi
fi
