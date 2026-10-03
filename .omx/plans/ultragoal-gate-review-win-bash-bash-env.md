# Gate review — win-bash BASH_ENV inheritance (win-bash-ai 0.5.0 / plugin 0.1.7)

Date: 2026-10-03 | Session: 01a0f775-4341-7ef3-8474-54925aac7097 | Thread: 01a0ec31-71c1-7b11-8a6f-54916c7fb846

## Review lane substitution (native subagent surface unavailable)
Per `ralplan-review-substitution.md`, the runtime provider cannot serve the
subagent coding-plan mode (404 on ark endpoint). This gate review is performed
by the main lane (active model) as main-lane lifecycle evidence, NOT attributed
to a fabricated subagent identity.

## Scope reviewed
G001..G005 for the deep-interview spec
`.omx/specs/deep-interview-win-bash-bash-env-inherit.md` and PRD
`.omx/plans/prd-win-bash-bash-env-inherit.md`.

## Spec invariant inventory (all verified)

| Invariant | Status | Evidence |
|---|---|---|
| Single source init `~/.config/win-bash/git-inherit.sh` (dynamic Git discover, POSIX, idempotent) | PASS | `src/git-inherit.js` ensureGitInheritInit; template `plugin/codex/scripts/git-inherit.sh`; test/git-inherit.test.js A1-A3; real file exists |
| `.niubashrc` = one source line (stacked v3+v2 cleaned) | PASS | hooks.test.js C1-C3; real `.niubashrc` line 61 only; install.ps1 reported "Replaced old inline..." |
| Claude env `BASH_ENV=<POSIX init>` alongside CLAUDE_CODE_* | PASS | applyClaudeEnv; test B1; real settings.json `BASH_ENV=/c/Users/.../git-inherit.sh` |
| install/doctor create init BEFORE env/rc write (F3) | PASS | src/install.js + install.ps1 + doctor.js ordering; installClaude/doctorClaude |
| doctor self-heals deleted init | PASS | test D1/D2; real `win-bash doctor` recreated init |
| uninstall removes Claude BASH_ENV injection (orphan init kept) | PASS | uninstallClaude deletes BASH_ENV when it matches init |
| Codex SessionStart read-only (no init write) | PASS | hooks.test.js session-start read-only case |
| OpenCode unchanged (no env key) | PASS | opencode.test.js; real config `shell` preserved, no env key |
| BASH_ENV makes Niubash `bash -lc` inherit Git commands | PASS | real QA: awk/gzip/perl -> `/c/Program Files/Git/usr/bin/*.exe`; baseline NO_AWK |
| Init idempotent (no duplicate append) | PASS | real QA: Git usr/bin count stable at 2 (1 native PATH + 1 init) across 0/1/3/6 sources |
| Version 0.5.0 / 0.1.7 | PASS | package.json, plugin.json |
| Docs no longer claim tool-driven cannot inherit | PASS | injection-chain §3 rewritten; routing header; SKILL.md Git command inheritance; AGENTS.md USER:SHELL |

## Non-goals honored
- No WIN_BASH_NO_ENV escape hatch added (deferred per user).
- No global env injection; no new dependencies; Codex PreToolUse behavior unchanged (updatedInput.shell only, no additionalContext).
- OpenCode no BASH_ENV.

## Test / verification gate
- `npm test`: 60/60 pass (baseline 52 + A1-A3 + B1-B2 + C1-C3 + D1-D2).
- `node --check` clean on all changed JS; install.ps1 parses OK under PowerShell AST.
- Real-machine install to plugin cache 0.1.7; doctor self-heal; `.niubashrc` cleaned; Claude settings BASH_ENV written; functional awk/gzip/perl under BASH_ENV.

## Open items (reported, non-blocking)
- Real session restart required for the installed 0.1.7 hook to load (user action).
- Shared init orphan is intentionally kept on uninstall (documented decision).

## Verdict
PASS — spec invariants, non-goals, tests, and real-machine QA all satisfied.
