# win-bash shell routing (Plan B — Niubash unified)

Task: route Codex `exec_command` through the Niubash Bash so every bash/POSIX
command and shell script runs there, while Niubash inherits standard Git Bash
commands (`awk`/`gzip`/`perl`/`tar`/`sed`) it does not ship with.

## Design

The hook (`plugin/codex/scripts/win-bash-hook.js`) routes each `exec_command`
via a pure `decide(input)` function, exposed as a `route` subcommand for tests
and real-machine verification.

Decision order:
1. Escape hatch `WIN_BASH_SKIP=1` -> never rewrite (marker stripped).
2. Escape hatch `WIN_BASH_SHELL=<path>` -> force that shell (marker stripped;
   ignored when the path does not exist).
3. Explicit `shell` in the tool input -> respected, never rewritten.
4. Windows-native -> no rewrite (stays on host PowerShell):
   - `psmux|pmux|tmux|powershell|pwsh` when RUN as a command (start of line or
     right after a `; & | (` separator), never as an argument such as
     `grep tmux`;
   - PowerShell Verb-Noun cmdlets (`Get-Content`, `Select-String`, ...);
   - cmd.exe builtins with no standalone `.exe` (`dir`, `cls`, `copy`, `del`,
     `ren`, `move`, `md`, `rd`, `type`, `start`);
   - Windows shell scripts (`.ps1`, `.psm1`, `.psd1`, `.bat`, `.cmd`).
5. bash/POSIX (`bash`, `grep/sed/awk/find/ls/cat/cd/git/curl/...`, `./x.sh`,
   `sh x.sh`, `bash x.sh`, `source env.sh`, pipes/`&&`/`$(...)` operators) ->
   rewrite `shell` to the Niubash Bash via `resolveBash()` and prefix `cmd`
   with `export PATH="$PATH:<git dirs>"; ` so Niubash inherits Git Bash
   commands.
6. Everything else -> rewrite to the Niubash Bash (the default): `node`, `npm`,
   `npx`, Windows executables (`where`, `reg`, `ping`, `netstat`, `ipconfig`,
   `whoami`, `tasklist`, `tree`, ...), `cmd /c ...`, and any command not matched
   above all route to Niubash with the same Git PATH prefix.

The Git dirs are derived from `resolveGitBash()` (standard Git Bash, never a
`winuxcmd\bin\bash.exe` Niubash candidate): `<git>/usr/bin`, `<git>/bin`,
`<git>/cmd`, in MSYS/POSIX form. Git dirs are appended AFTER the existing PATH
(`$PATH:<git dirs>`) so Niubash's own `bash`/`sed`/`grep`/`find`/`sort` stay
primary and an inner `bash` still resolves to Niubash (verified: with Git
prepended, `bash` resolves to Git Bash 5.2 instead of Niubash 5.3). `awk`/
`gzip`/`perl` (which Niubash lacks) resolve to the Git versions. `tar` resolves
to `C:\Windows\system32\tar.exe` (bsdtar) exactly as Niubash does natively
with no injection; use `WIN_BASH_SHELL` to force Git Bash if GNU tar is
required.

`resolveGitBash()` resolves dynamically first: the `OMO_CODEX_GIT_BASH_PATH`
env override, `bash.exe` found on PATH under a Git root
(`<git>\bin\bash.exe`), the official Git for Windows registry key
`HKLM\SOFTWARE\GitForWindows\InstallPath`, then roots derived from `git.exe`
on PATH (`<git>/cmd/git.exe` or `<git>/bin/git.exe`). Only when none of those
find a Git Bash does it fall back to the common install roots
(`C:\Program Files\Git`, `C:\Program Files (x86)\Git`,
`%LOCALAPPDATA%\Programs\Git`), so a Git that is installed but not on PATH is
still honored. Every candidate is validated with `isFile()` and rejects any
`winuxcmd\bin\bash.exe` Niubash candidate, so a Niubash-valued
`OMO_CODEX_GIT_BASH_PATH` env override (which Niubash sets on this machine)
cannot leak into the injected Git PATH.

Injection behavior depends on what shells are available:

- Niubash found -> every Niubash-routed command gets
  `shell = <Niubash Bash>` and `cmd = export PATH="$PATH:<git dirs>"; <cmd>`
  when Git Bash is also found, or `cmd` unchanged (no PATH prefix) when Git
  Bash is missing (Niubash then uses only its own tools; `awk`/`gzip`/`perl`
  are unavailable unless Niubash ships them). The hook never fails a command
  because Git is missing.
- No Niubash, Git Bash found -> bash/POSIX commands fall back to the standard
  Git Bash (no PATH prefix needed — Git Bash already has its own tools).
- No Niubash and no Git Bash -> PowerShell 7 (`pwsh`) is the last-resort
  fallback shell (resolved via `where.exe pwsh.exe`, which also returns the
  Microsoft Store app-execution alias, then `C:\Program Files\PowerShell\7`).
- No Niubash, no Git Bash, and no pwsh -> `action=none` (stays on the host
  shell); nothing can route.

Install prompts: `session-start` emits a one-time warning (the only safe
injection point) whenever a fallback is missing - Git for Windows missing
(so Niubash cannot inherit awk/gzip/perl/tar/sed) and, only when Niubash AND
Git Bash AND pwsh are all missing, a PowerShell 7 install prompt. PreToolUse
never injects context.

The Niubash profile (`~/.niubashrc`) is also configured by win-bash: a
Git-inherit block (v2 marker `win-bash-git-inherit-v2`) is written on first
create and idempotently appended/upgraded on an existing rc. The block
discovers Git dynamically inside Niubash via `command -v git.exe` (derives the
root two levels up, normalizes the drive letter, and probes `usr/bin/awk.exe`)
instead of scanning hardcoded install dirs, so interactive `niu.exe` sessions
get the same Git command inheritance. User rc content is preserved.

`session-start`/`configure`/`doctor` still resolve Niubash (install/config
contract). The hook never emits `additionalContext` in PreToolUse.

## Acceptance mapping (real-machine)

| # | Acceptance | Evidence |
|---|---|---|
| 1 | ordinary command -> expected injected shell + PATH prefix | `route`: `grep foo`/`ls -la`/`node --version`/`npm test`/`cmd /c echo x` -> Niubash shell + `export PATH="..."; ` prefix |
| 2 | shell scripts -> Niubash + PATH prefix | `route`: `bash script.sh`/`./tools/sync.sh` -> Niubash shell + Git PATH prefix |
| 3 | psmux/tmux stays PowerShell, no ParserError | `route`: `psmux ls`/`tmux ls`/`powershell ...` -> action none (no rewrite) |
| 4 | WIN_BASH_SKIP / WIN_BASH_SHELL per-command | `route`: skip forces none+strip; force injects path+strip |
| 5 | Niubash inherits Git commands end-to-end | Niubash `-c` with the injected prefix runs `awk`/`gzip`/`perl`/`tar`/`sed` correctly |

## Reinstall

`node bin/win-bash.js install --target codex` -> syncs plugin/codex into the
local marketplace and re-caches `win-bash/0.1.4`. Session restart required for
the hook to load.

## Evidence (2026-10-03, Plan B)

- `npm test`: 26/26 pass (Plan B routing: everything except psmux/tmux/
  PowerShell cmdlets/cmd.exe builtins -> Niubash with Git PATH prefix; escape
  hatches + explicit-shell respect; rc Git-inherit block present).
- Real-machine `route` probes:
  - `grep foo`, `bash script.sh`, `bash -c 'echo hi | awk ...'`, `ls -la` ->
    `action=niubash`, `shell=F:\studio\apps\Niubash\winuxcmd\bin\bash.exe`,
    `cmd=export PATH="$PATH:/c/Program Files/Git/usr/bin:/c/Program Files/Git/bin:/c/Program Files/Git/cmd"; <cmd>`
  - `psmux ls`, `tmux ls`, `powershell -Command Get-Process`, `dir *.log`,
    `copy a b`, `deploy.ps1` -> `action=none` (no rewrite)
  - `node --version`, `npm test`, `where.exe bash.exe`, `reg query ...`,
    `ping -n 1 ...`, `netstat -ano`, `cmd /c echo x`, `grep tmux notes.md` ->
    `action=niubash` with Niubash shell + Git PATH prefix
- End-to-end under Niubash with the injected prefix: `grep`/`awk`/`gzip|gunzip`/
  `perl`/`sed` all resolve from Git and run correctly; `bash script.sh` runs with
  Git Bash tools inherited.
- `.niubashrc`: created on fresh install with the Git-inherit block; appended
  idempotently to an existing rc (`reason=git-inherit-appended`) preserving user
  content; sourcing the block under Niubash resolves `awk/gzip/perl/tar` from
  Git.
