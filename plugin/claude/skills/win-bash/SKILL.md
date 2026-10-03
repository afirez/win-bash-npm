---
name: win-bash
description: Use on Windows when shell commands need Bash semantics through Claude Code. Applies when Claude Code should use the user-approved Niubash Bash executable instead of the default Windows shell.
---

# Win Bash

This environment is configured to use Niubash Bash for Claude Code shell operations.

1. Run shell commands normally; they execute in Niubash Bash.
2. The Niubash profile (`~/.niubashrc`) configured by `win-bash` inherits standard
   Git Bash commands (`awk`, `gzip`, `perl`, `tar`, `sed`, ...) in interactive
   sessions, so Niubash behaves like a complete POSIX shell for pipelines,
   scripts, and Git workflows.
3. Known limitation: `~/.niubashrc` is Niubash's interactive rc. When a tool
   runs commands via `bash -lc '<cmd>'`, that rc is not loaded, so `awk`,
   `perl`, `gzip`, etc. from Git Bash may not be available. If a command needs
   such tools, prefix it with
   `export PATH="$PATH:/c/Program Files/Git/usr/bin:/c/Program Files/Git/bin:/c/Program Files/Git/cmd"; `
   inside the command.
4. Verify the active shell with `printf 'bash=%s\n' "$BASH_VERSION"` when behavior is unexpected.
5. Do not replace `CLAUDE_CODE_GIT_BASH_PATH` or `CLAUDE_CODE_SHELL` with Git Bash, WSL, or a bare `bash`.
6. Use PowerShell only when a Windows-native operation cannot run in Bash.

## Fallback

If Niubash cannot be resolved or installed, `win-bash install --target claude`
statically writes the standard Git Bash, then PowerShell 7 (`pwsh`), into
`CLAUDE_CODE_GIT_BASH_PATH` / `CLAUDE_CODE_SHELL` so Claude Code still gets a
working shell. Re-run the install after restoring Niubash to switch back.
