---
name: win-bash
description: Use on Windows when shell commands need POSIX/Bash semantics through Codex exec_command. Applies to pipes, shell scripts, grep/sed/awk, git workflows, and other commands that should run in Niubash Bash instead of the default PowerShell. Skip for Windows-native operations that require PowerShell.
metadata:
  short-description: Run Windows shell commands through Niubash Bash
---

# Win Bash

Use Niubash Bash for Windows shell work when the command needs Bash/POSIX semantics.

## Required invocation

Call `exec_command` with the absolute Bash executable:

```json
{
  "cmd": "pwd; printf 'bash=%s\\n' \"$BASH_VERSION\"",
  "workdir": "F:\\studio\\ai_agent\\UltraWorker",
  "shell": "F:\\studio\\apps\\Niubash\\winuxcmd\\bin\\bash.exe"
}
```

Do not use a bare `bash`; PATH may resolve to a different Bash or WSL. Do not use the disabled OMO `git_bash` MCP.

## Rules

- Prefer this shell for POSIX pipelines, shell scripts, `grep`, `sed`, `awk`, `find`, and Git commands.
- Use PowerShell only for Windows-native operations that cannot run correctly in Bash.
- If a command depends on a native Windows program, pass a Windows-compatible path to that program; Bash utilities may still use POSIX-style paths.
- Verify the shell with `$BASH_VERSION` when a command's behavior suggests PowerShell was used.

## Hook enforcement

The user-level `win-bash` PreToolUse hook runs for `exec_command` and uses `updatedInput` to set `shell` to the resolved Niubash Bash path before the call executes. If the current Codex build ignores `updatedInput`, the explicit invocation rule above remains the required fallback.
