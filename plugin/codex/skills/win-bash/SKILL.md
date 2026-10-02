# Win Bash

Route Windows shell work through the Niubash Bash. Every bash/POSIX command and
shell script runs in your Niubash Bash, which inherits standard Git Bash
commands (`awk`, `gzip`, `perl`, `tar`, `sed`, ...) so Niubash behaves like a
complete POSIX shell. Windows-native commands stay in PowerShell.

## Auto-routing (Codex PreToolUse hook)

The `win-bash` PreToolUse hook classifies each `exec_command` and rewrites
`shell` (and the `cmd` prefix) only when needed:

- **bash/POSIX -> Niubash Bash + Git command inheritance.** A bare `bash`
  invocation (`bash -c '...'`, `bash <cmd>`), POSIX utilities and bash builtins
  (`grep`, `sed`, `awk`, `find`, `ls`, `cat`, `cd`, `curl`, `git`, ...), shell
  scripts (`./x.sh`, `sh x.sh`, `bash x.sh`, `source env.sh`), and piped/chained
  commands (`|`, `&&`, `||`, `$(...)`, `>`). The hook sets
  `shell = <Niubash Bash>` and prefixes the command with
  `export PATH="<git dirs>:$PATH"; ` so Niubash can run the standard Git Bash
  tools it does not ship with.
- **Windows-native -> keep PowerShell.** `psmux`, `pmux`, `tmux`, `powershell`,
  `pwsh`, PowerShell cmdlets (`Get-Content`, `Select-String`), and Windows
  commands (`where`, `dir`, `reg`, `netstat`, ...) are left untouched.
- **Everything else -> keep the host shell.** Ambiguous or cross-platform
  commands (`node`, `npm`, ...) are not rewritten.
- If no Niubash is installed, the hook falls back to the standard Git Bash for
  bash/POSIX commands.

The Niubash profile (`~/.niubashrc`) is also configured by `win-bash` to inherit
the same Git Bash commands for interactive Niubash sessions.

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
Niubash Bash executable:

```json
{
  "cmd": "export PATH=\"/c/Program Files/Git/usr/bin:/c/Program Files/Git/bin:/c/Program Files/Git/cmd:$PATH\"; pwd; printf 'bash=%s\\n' \"$BASH_VERSION\"",
  "workdir": "F:\\studio\\ai_agent\\UltraWorker",
  "shell": "F:\\studio\\apps\\Niubash\\winuxcmd\\bin\\bash.exe"
}
```

Do not use a bare `bash`; PATH may resolve to WSL or a different Bash.

## Rules

- Prefer Bash for POSIX pipelines, shell scripts, `grep`, `sed`, `awk`, `find`,
  and Git commands (auto-routed to Niubash with Git command inheritance).
- Use PowerShell for Windows-native operations that cannot run correctly in
  Bash (auto-left on PowerShell; force with `WIN_BASH_SKIP=1` if needed).
- If a command depends on a native Windows program, pass a Windows-compatible
  path to that program; Bash utilities may still use POSIX-style paths.
- Verify the shell with `$BASH_VERSION` when a command's behavior suggests the
  wrong shell was used.
