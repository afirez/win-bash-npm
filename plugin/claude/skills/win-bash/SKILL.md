---
name: win-bash
description: Use on Windows when shell commands need Bash semantics through Claude Code. Applies when Claude Code should use the user-approved Niubash Bash executable instead of the default Windows shell.
---

# Win Bash

This environment is configured to use Niubash Bash for Claude Code shell operations.

1. Run shell commands normally; they execute in Niubash Bash.
2. Git Bash command inheritance comes from the shared init
   `~/.config/win-bash/git-inherit.sh` (managed by win-bash; created by
   `install`, self-healed by `win-bash doctor`). Claude Code's settings env
   sets `BASH_ENV` to that init, so even tool-driven `bash -lc '<cmd>'`
   sessions load it and inherit `awk`/`gzip`/`perl`/`tar`/`sed` from Git
   Bash. `.niubashrc` also sources the same init for interactive/REPL sessions.
4. Verify the active shell with `printf 'bash=%s\n' "$BASH_VERSION"` when behavior is unexpected.
5. Do not replace `CLAUDE_CODE_GIT_BASH_PATH` or `CLAUDE_CODE_SHELL` with Git Bash, WSL, or a bare `bash`.
6. Use PowerShell only when a Windows-native operation cannot run in Bash.

## Fallback

If Niubash cannot be resolved or installed, `win-bash install --target claude`
statically writes the standard Git Bash, then PowerShell 7 (`pwsh`), into
`CLAUDE_CODE_GIT_BASH_PATH` / `CLAUDE_CODE_SHELL` so Claude Code still gets a
working shell. Re-run the install after restoring Niubash to switch back.
