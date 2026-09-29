---
name: win-bash
description: Use on Windows when shell commands need Bash semantics through Claude Code. Applies when Claude Code should use the user-approved Niubash Bash executable instead of the default Windows shell.
---

# Win Bash

This environment is configured to use Niubash Bash for Claude Code shell operations.

1. Run shell commands normally.
2. Verify the active shell with `printf 'bash=%s\n' "$BASH_VERSION"` when behavior is unexpected.
3. Do not replace `CLAUDE_CODE_GIT_BASH_PATH` or `CLAUDE_CODE_SHELL` with Git Bash, WSL, or a bare `bash`.
4. Use PowerShell only when a Windows-native operation cannot run in Bash.
