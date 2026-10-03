# Win Bash

Route Windows shell work through the Niubash Bash. On Windows, bash/POSIX
commands and shell scripts should run in the Niubash Bash; Windows-native
operations stay in PowerShell. Niubash inherits standard Git Bash commands (`awk`, `gzip`, `perl`,
`tar`, `sed`, ...) from a single shared init
`~/.config/win-bash/git-inherit.sh`: interactive/REPL sessions via one
`~/.niubashrc` source line, and tool-driven (`bash -lc`) sessions via
`BASH_ENV` (see "Git command inheritance" below).

## Auto-routing (Codex PreToolUse hook)

The `win-bash` PreToolUse hook classifies each `exec_command` and, when it
decides a command should run in a Bash shell, writes `updatedInput.shell`
(set to the Niubash Bash, or a bare `bash` when that resolves to Niubash).
The command itself is **left unchanged** (only `WIN_BASH_SKIP` /
`WIN_BASH_SHELL` markers are stripped). The hook never injects
`additionalContext` and never wraps the command.

Classification:

- **bash/POSIX -> Niubash Bash.** A bare `bash` invocation (`bash -c '...'`,
  `bash <cmd>`), POSIX utilities and bash builtins (`grep`, `sed`, `awk`,
  `find`, `ls`, `cat`, `cd`, `curl`, `git`, ...), shell scripts
  (`./x.sh`, `sh x.sh`, `bash x.sh`, `source env.sh`), and piped/chained
  commands (`|`, `&&`, `||`, `$(...)`, `>`). The hook writes `updatedInput.shell`.
- **Windows-native -> keep PowerShell.** `psmux`, `pmux`, `tmux`, `powershell`,
  `pwsh`, PowerShell cmdlets (`Get-Content`, `Select-String`), cmd.exe builtins
  with no standalone `.exe` (`dir`, `copy`, `type`, `cls`, `start`, ...), and
  Windows shell scripts (`.ps1`, `.bat`, `.cmd`) are left untouched.
- **Everything else -> Niubash Bash.** `node`, `npm`, `npx`, Windows
  executables (`where`, `reg`, `ping`, `netstat`, `ipconfig`, `whoami`, ...),
  `cmd /c ...`, and any other command route to the Niubash Bash, unless they
  explicitly need PowerShell.

Shell resolution order for the injected `updatedInput.shell`: the shared
config `~/.config/win-bash/win-bash.json` is the single source of truth for
the main shell chain **Niubash -> Git Bash -> pwsh -> none**:

- `shell` - the effective main shell (a valid manual override always wins and
  is never overwritten by configure).
- `niubash_path` / `gitbash_path` / `pwsh_path` - the three recorded
  candidate paths, written at install/configure time (strategy X: only
  filled when missing or no longer valid). Resolvers prefer a recorded path
  and fall back to dynamic discovery (`WIN_BASH_PATH` env override, config
  `shell`, install candidates, then `bash` on PATH that resolves to a
  `winuxcmd\bin\bash.exe`).

If no Niubash is installed, bash/POSIX commands fall back to the standard
Git Bash, then to PowerShell 7 (`pwsh`) as the last-resort fallback shell.
When a fallback is missing (Git for Windows, or all shells), the hook emits
a one-time install prompt at session start (`https://git-scm.com/downloads`,
`winget install Microsoft.PowerShell`); PreToolUse never injects context.

> Note: Codex's hook rewrite currently adopts `updatedInput.command` but
> drops `updatedInput.shell` (verified against Codex CLI 0.156.1). So the
> PreToolUse hook's practical effect in Codex is to strip escape-hatch
> markers and never break the command; real shell routing relies on the
> explicit `shell` guidance below plus the SessionStart hook and the
> user-level `USER:SHELL` policy in `AGENTS.md`.

If the model already passed an explicit `shell`, the hook respects it and does
not rewrite.

## Git command inheritance (0.5.0+)

Git Bash command inheritance now has a **single source of truth**: the shared
init `~/.config/win-bash/git-inherit.sh` (dynamic Git discovery + append
`usr/bin:bin:cmd`, idempotent, POSIX paths). It is managed by win-bash (created
by `install`, self-healed by `doctor`); **do not hand-edit it** — run
`win-bash doctor` to restore it.

- **Interactive / REPL** (`niu -C`): `~/.niubashrc` sources the shared init
  with a single line, so `awk`/`perl`/`gzip`/`tar`/`sed` resolve to Git.
- **Tool-driven** (`bash -lc '<cmd>'`): bash reads the init only when
  `BASH_ENV` points at it. Codex cannot change the host env, so in a
  tool-driven session prefix the command with
  `BASH_ENV="<shared init>" ` (or include the Git dirs on PATH explicitly).

Explicit prefix example (verify with `awk --version` / `$BASH_VERSION`):

```bash
BASH_ENV="$HOME/.config/win-bash/git-inherit.sh" awk --version
```

SessionStart warns (read-only) when the shared init is missing; run
`win-bash doctor` to restore it.

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
Niubash Bash executable and set `BASH_ENV` to the shared init (POSIX form) so
tool-driven `bash -lc` inherits Git Bash commands:

```json
{
  "cmd": "BASH_ENV=\"$HOME/.config/win-bash/git-inherit.sh\" pwd; printf 'bash=%s\\n' \"$BASH_VERSION\"; awk --version | head -1",
  "workdir": "F:\\studio\\ai_agent\\UltraWorker",
  "shell": "F:\\studio\\apps\\Niubash\\winuxcmd\\bin\\bash.exe"
}
```

Do not use a bare `bash`; PATH may resolve to WSL or a different Bash.

## Rules

- Prefer Bash for POSIX pipelines, shell scripts, `grep`, `sed`, `awk`, `find`,
  and Git commands. In a tool-driven session, keep the Git dirs on PATH inside
  the command when the tools (`awk`, `perl`, `gzip`, ...) are needed.
- Use PowerShell for Windows-native operations that cannot run correctly in
  Bash (auto-left on PowerShell; force with `WIN_BASH_SKIP=1` if needed).
- If a command depends on a native Windows program, pass a Windows-compatible
  path to that program; Bash utilities may still use POSIX-style paths.
- Verify the shell with `$BASH_VERSION` when a command's behavior suggests the
  wrong shell was used.
