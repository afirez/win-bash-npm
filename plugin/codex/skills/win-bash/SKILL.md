---
name: win-bash
description: Use on Windows when shell commands need POSIX/Bash semantics through Codex exec_command. Applies to pipes, shell scripts, grep/sed/awk, git workflows, and other commands that should run in Bash instead of the default PowerShell. Skip for Windows-native operations that require PowerShell.
metadata:
  short-description: Route Windows shell commands through the right shell (Git Bash / PowerShell)
---

# Win Bash

Route Windows shell work through the right shell: POSIX/Bash commands run in the
standard Git Bash, Windows-native commands stay in PowerShell, and Niubash Bash
is used only when explicitly requested.

## Auto-routing (Codex PreToolUse hook)

The `win-bash` PreToolUse hook classifies each `exec_command` and rewrites
`shell` only when needed:

- **`bash` command execution -> Niubash Bash.** A bare `bash` invocation
  (`bash -c '...'`, `bash <cmd>`) runs in your Niubash Bash. Exception: when the
  `bash` command runs a `.sh` script or uses `awk` (Niubash has no `awk`), it
  routes to standard Git Bash instead.
- **POSIX -> standard Git Bash.** POSIX utilities and bash builtins
  (`grep`, `sed`, `awk`, `find`, `ls`, `cat`, `cd`, `curl`, `git`, ...), shell
  scripts (`./x.sh`, `sh x.sh`, `bash x.sh`, `source env.sh`), and piped/chained
  commands (`|`, `&&`, `||`, `$(...)`, `>`).
- **Windows-native -> keep PowerShell.** `psmux`, `pmux`, `tmux`, `powershell`,
  `pwsh`, PowerShell cmdlets (`Get-Content`, `Select-String`), and Windows
  commands (`where`, `dir`, `reg`, `netstat`, ...) are left untouched.
- **Everything else -> keep the host shell.** Ambiguous or cross-platform
  commands (`node`, `npm`, ...) are not rewritten.
- **Niubash Bash is the default only for bare `bash` command execution**, and
  is otherwise used when explicitly requested (see escape hatches below). It is
  never the default for other POSIX or Windows-native commands.

If the model already passed an explicit `shell`, the hook respects it and does
not rewrite.

## Per-command override (escape hatches)

Prefix the command with an escape hatch; the hook strips the marker before the
command runs:

- `WIN_BASH_SKIP=1 <cmd>` — never rewrite the shell for this command.
- `WIN_BASH_SHELL=<path> <cmd>` — force this shell for this command. Quote the
  path if it contains spaces:
  `WIN_BASH_SHELL="C:\Program Files\Git\bin\bash.exe" <cmd>`

Examples:

```bash
WIN_BASH_SKIP=1 psmux attach main
WIN_BASH_SHELL="F:\studio\apps\Niubash\winuxcmd\bin\bash.exe" ./niubash-only.sh
```

## Required invocation (fallback)

If the hook is unavailable or ignored, call `exec_command` with the absolute
Bash executable:

```json
{
  "cmd": "pwd; printf 'bash=%s\\n' \"$BASH_VERSION\"",
  "workdir": "F:\\studio\\ai_agent\\UltraWorker",
  "shell": "C:\\Program Files\\Git\\bin\\bash.exe"
}
```

Do not use a bare `bash`; PATH may resolve to WSL or a different Bash.

## Rules

- Prefer Bash for POSIX pipelines, shell scripts, `grep`, `sed`, `awk`, `find`,
  and Git commands (auto-routed to standard Git Bash).
- Use PowerShell for Windows-native operations that cannot run correctly in
  Bash (auto-left on PowerShell; force with `WIN_BASH_SKIP=1` if needed).
- If a command depends on a native Windows program, pass a Windows-compatible
  path to that program; Bash utilities may still use POSIX-style paths.
- Verify the shell with `$BASH_VERSION` when a command's behavior suggests the
  wrong shell was used.
