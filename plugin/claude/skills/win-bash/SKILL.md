---
name: win-bash
description: Use on Windows when shell commands need Bash semantics through Claude Code. Applies when Claude Code should use the user-approved Niubash Bash executable instead of the default Windows shell.
---

# Win Bash

This environment is configured to use Niubash Bash for Claude Code shell operations.

1. Run shell commands normally; they execute in Niubash Bash.
2. The Niubash profile (`~/.niubashrc`) configured by `win-bash` inherits standard
   Git Bash commands (`awk`, `gzip`, `perl`, `tar`, `sed`, ...), so Niubash
   behaves like a complete POSIX shell for pipelines, scripts, and Git workflows.
3. Verify the active shell with `printf 'bash=%s\n' "$BASH_VERSION"` when behavior is unexpected.
4. Do not replace `CLAUDE_CODE_GIT_BASH_PATH` or `CLAUDE_CODE_SHELL` with Git Bash, WSL, or a bare `bash`.
5. Use PowerShell only when a Windows-native operation cannot run in Bash.
