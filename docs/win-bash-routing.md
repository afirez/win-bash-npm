# win-bash shell routing fix (notepad)

Task: stop the Codex PreToolUse hook from unconditionally forcing Niubash Bash.

## Design

The hook (`plugin/codex/scripts/win-bash-hook.js`) now routes each `exec_command`
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
5. POSIX (`grep/sed/awk/find/ls/cat/cd/git/curl/...`, `./x.sh`, bash builtins,
   pipe/`&&`/`$(...)` operators) -> rewrite `shell` to the standard Git Bash
   via `resolveGitBash()` (never Niubash).
6. Everything else (e.g. `node`, `npm`) -> no rewrite.

Niubash is only used when explicitly requested (`WIN_BASH_SHELL=<niubash>` or an
explicit `shell`). `resolveGitBash()` rejects any `winuxcmd\bin\bash.exe`
candidate, so a Niubash-valued `OMO_CODEX_GIT_BASH_PATH` env override (which
Niubash sets on this machine) cannot hijack Git Bash resolution.

`session-start`/`configure`/`doctor` still resolve Niubash (install/config
contract). The hook never emits `additionalContext` in PreToolUse.

## Acceptance mapping (real-machine)

| # | Acceptance | Evidence |
|---|---|---|
| 1 | ordinary command -> expected injected shell or none | `route` probe: `pwd`->Git Bash, `node --version`->none |
| 2 | Niubash-failing script -> Git Bash | `route`: `bash script.sh`/`./tools/sync.sh`->`C:\Program Files\Git\bin\bash.exe` |
| 3 | psmux/tmux stays PowerShell, no ParserError | `route`: `psmux ls`/`tmux ls`->action none (no shell rewrite) |
| 4 | WIN_BASH_SKIP / WIN_BASH_SHELL per-command | `route`: skip forces none+strip; force injects path+strip |

## Reinstall

`node bin/win-bash.js install --target codex` -> syncs plugin/codex into the
local marketplace and re-caches `win-bash/0.1.4`. Session restart required for
the hook to load.

## Final evidence (2026-10-02)

- `npm test`: 20/20 pass (added 10 route tests; existing config/claude/opencode/niubash tests untouched).
- Real-machine `route` probes (repo + installed cache 0.1.4):
  - `git log --oneline | head`, `pwd`, `grep foo`, `bash script.sh`, `./tools/sync.sh` -> `bash` `C:\Program Files\Git\bin\bash.exe`
  - `psmux ls`, `tmux ls`, `powershell -Command Get-Process`, `Get-Content a.txt | Select-String x`, `node --version`, `npm test` -> `none` (no rewrite)
- Full `PreToolUse` payloads (repo hook, same file as cache):
  - POSIX `grep foo bar` -> `updatedInput.shell = C:\\Program Files\Git\bin\bash.exe`
  - `psmux ls` -> no output (unchanged)
  - `WIN_BASH_SKIP=1 psmux ls` -> strips marker, `cmd = psmux ls`, no shell
  - explicit `shell` -> no output (respected)
- `win-bash install --target codex` OK; cache `local-win-bash/win-bash/0.1.4` has the new hook (13.9kB), nested `package.json` (commonjs), routing SKILL.md; cache `route` works.
- `win-bash doctor --target codex` OK (Niubash resolve/install contract intact).
- Commit: `d1211ce fix(codex): route exec_command shells instead of forcing Niubash`.

## Self-review

Routing decision order is escape hatch -> respect explicit shell -> Windows-native
-> POSIX Git Bash -> default none; psmux/tmux/powershell can never be dragged into
Bash because the word check runs before operator detection. `resolveGitBash()`
rejects `winuxcmd\bin\bash.exe` so a Niubash-valued `OMO_CODEX_GIT_BASH_PATH`
(which Niubash sets on this machine) cannot hijack Git Bash. Niubash resolution
kept only for session-start/configure/doctor. No `additionalContext` in
PreToolUse. Session restart still required for the running Codex session to load
the new hook.
