# Ralplan — Architect lane re-review (rev2)

Date: 2026-10-03 | Verdict: **APPROVE**（rev2）

## Findings disposition
- F1 (stacked v2/v3 block cleanup) -> rev2 W1 rewritten to remove ALL win-bash inherit blocks
  (loop/regex over all `# win-bash: inherit standard Git Bash commands` ... `unset __wb_`), then
  single-line source; test C1 uses the real stacked v3+v2 form. RESOLVED.
- F2 (BASH_ENV POSIX path) -> rev2 W2 applies POSIX conversion in applyClaudeEnv; test B1 asserts
  POSIX form. RESOLVED.
- F3 (init-creation ordering before rc/env writes) -> rev2 W1/W2 sequence guarantees init-first.
  RESOLVED.

## Residual architectural check
- Steelman (global user BASH_ENV) remains rejected on scope-control grounds; unchanged, still valid.
- Tradeoff tension (.niubashrc no longer self-contained) mitigated by doctor self-heal + SessionStart
  read-only check + install-managed lifecycle; documented as "init is win-bash-managed, do not hand-delete".
- PreToolUse buildGitPathPrefix (Plan-B route-diagnostic prefix) coexists harmlessly with BASH_ENV:
  BASH_ENV is the real inheritance; the route prefix remains only as a diagnostic/fallback note and
  does not conflict (PreToolUse behavior unchanged per spec).
- No new platform inconsistency; install/doctor/uninstall contracts preserved.

Synthesis: rev2 addresses both must-fix findings and the ordering suggestion. No outstanding
architectural blocker. APPROVE.
