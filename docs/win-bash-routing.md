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
4. Windows-native (`psmux|pmux|tmux|powershell|pwsh` anywhere, PowerShell
   Verb-Noun cmdlets, Windows first-tokens like `where/dir/reg/netstat`) -> no
   rewrite (stays on host PowerShell).
5. bash/POSIX (`bash`, `grep/sed/awk/find/ls/cat/cd/git/curl/...`, `./x.sh`,
   `sh x.sh`, `bash x.sh`, `source env.sh`, pipes/`&&`/`$(...)` operators) ->
   rewrite `shell` to the Niubash Bash via `resolveBash()` and prefix `cmd`
   with `export PATH="<git dirs>:$PATH"; ` so Niubash inherits Git Bash
   commands.
6. Everything else (e.g. `node`, `npm`) -> no rewrite.

The Git dirs are derived from `resolveGitBash()` (standard Git Bash, never a
`winuxcmd\bin\bash.exe` Niubash candidate): `<git>/usr/bin`, `<git>/bin`,
`<git>/cmd`, in MSYS/POSIX form. Prepending Git dirs first is required so
`awk/gzip/perl/tar/sed` resolve to the standard GNU tools (an appended order
resolves `tar` to `C:\Windows\system32\tar.exe`, which is not GNU tar).

When no Niubash is installed, bash/POSIX commands fall back to the standard Git
Bash (no PATH prefix needed — Git Bash already has its own tools).

`resolveGitBash()` rejects any `winuxcmd\bin\bash.exe` candidate, so a
Niubash-valued `OMO_CODEX_GIT_BASH_PATH` env override (which Niubash sets on
this machine) cannot leak into the injected Git PATH.

The Niubash profile (`~/.niubashrc`) is also configured by win-bash: a
Git-inherit block is written on first create and idempotently appended to an
existing rc, so interactive `niu.exe` sessions get the same Git command
inheritance. User rc content is preserved.

`session-start`/`configure`/`doctor` still resolve Niubash (install/config
contract). The hook never emits `additionalContext` in PreToolUse.

## Acceptance mapping (real-machine)

| # | Acceptance | Evidence |
|---|---|---|
| 1 | ordinary command -> expected injected shell + PATH prefix | `route`: `grep foo`/`ls -la` -> Niubash shell + `export PATH="..."; ` prefix; `node --version` -> none |
| 2 | shell scripts -> Niubash + PATH prefix | `route`: `bash script.sh`/`./tools/sync.sh` -> Niubash shell + Git PATH prefix |
| 3 | psmux/tmux stays PowerShell, no ParserError | `route`: `psmux ls`/`tmux ls`/`powershell ...` -> action none (no rewrite) |
| 4 | WIN_BASH_SKIP / WIN_BASH_SHELL per-command | `route`: skip forces none+strip; force injects path+strip |
| 5 | Niubash inherits Git commands end-to-end | Niubash `-c` with the injected prefix runs `awk`/`gzip`/`perl`/`tar`/`sed` correctly |

## Reinstall

`node bin/win-bash.js install --target codex` -> syncs plugin/codex into the
local marketplace and re-caches `win-bash/0.1.4`. Session restart required for
the hook to load.

## Evidence (2026-10-03, Plan B)

- `npm test`: 23/23 pass (Plan B routing: bash/POSIX/scripts -> Niubash with Git
  PATH prefix; Windows-native -> none; escape hatches + explicit-shell respect;
  rc Git-inherit block present).
- Real-machine `route` probes:
  - `grep foo`, `bash script.sh`, `bash -c 'echo hi | awk ...'`, `ls -la` ->
    `action=niubash`, `shell=F:\studio\apps\Niubash\winuxcmd\bin\bash.exe`,
    `cmd=export PATH="/c/Program Files/Git/usr/bin:/c/Program Files/Git/bin:/c/Program Files/Git/cmd:$PATH"; <cmd>`
  - `psmux ls`, `tmux ls`, `powershell -Command Get-Process`, `node --version` ->
    `action=none` (no rewrite)
- End-to-end under Niubash with the injected prefix: `grep`/`awk`/`gzip|gunzip`/
  `perl`/`sed` all resolve from Git and run correctly; `bash script.sh` runs with
  Git Bash tools inherited.
- `.niubashrc`: created on fresh install with the Git-inherit block; appended
  idempotently to an existing rc (`reason=git-inherit-appended`) preserving user
  content; sourcing the block under Niubash resolves `awk/gzip/perl/tar` from
  Git.
