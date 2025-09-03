#!/bin/sh
# Auto-install envctl hook for interactive bash shells
# Ensures each new shell session picks up env changes from envd

# Only for interactive shells
case $- in
  *i*) ;; # interactive
  *) return ;; # non-interactive: skip
esac

# Bash only (container defaults to bash)
if [ -n "$BASH_VERSION" ]; then
  if command -v envctl >/dev/null 2>&1; then
    eval "$(envctl hook bash)"
  fi
fi

