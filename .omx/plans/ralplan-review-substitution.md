# Ralplan review-lane substitution record

Date: 2026-10-03 | Session: 01a0f775-4341-7ef3-8474-54925aac7097

## Blocker: native subagent spawn surface unavailable
Attempted to run the $ralplan sequential Architect -> Critic review lanes as
registered role subagents (momus for Architect lane, metis fallback). All spawn
attempts errored identically at the provider endpoint:

  unexpected status 404 Not Found: The requested model does not support the
  coding plan feature. ... ark.cn-beijing.volces.com/api/coding/v3/responses

Confirmed across:
- momus (registered deep plan reviewer, default gpt-6-astra) -> 404
- momus with model override deepseek-v4-flash (working parent model) -> 404
- metis (registered analyst, default gpt-6-astra) -> 404

Conclusion: the runtime provider cannot serve the subagent coding-plan mode at
all; this is endpoint-level, not role/model-specific. No native subagent review
lane is available in this session.

## Alternative workflow (per ralplan SKILL native-role-routing rule)
"When the native surface ... is unavailable, do not fabricate agent_type. Use a
Codex surface with documented root proof or a reviewed alternative workflow for
that authority."

`omx ralplan run` contract: "The active model performs the three sequential
lanes and persists their artifacts."

=> The main lane (active model, running the ralplan consensus runtime) performs
the Architect lane then the Critic lane sequentially, in the same strict order
(Architect first, await, then Critic). Review evidence is recorded as
main-lane lifecycle evidence, NOT as host-issued authority, and NOT attributed
to a fabricated subagent identity. Verdicts still gate the handoff exactly as
the sequential review contract requires.
