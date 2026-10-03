# Deep-Interview Transcript — Niubash Git inheritance via BASH_ENV

- **Timestamp**: 2026-10-03
- **Slug**: `win-bash-bash-env-inherit`
- **Profile**: standard（threshold ≤ 0.20）
- **Final ambiguity**: ~24% → closure reached（用户逐轮确认所有决策点）
- **Context type**: brownfield（win-bash-npm 现有实现改造）

## 访谈轮次摘要

### Round 1 — Scope / Injection boundary
用户选择：**B（仅 Claude/OpenCode 静态注入） + `WIN_BASH_NO_ENV=1` 逃生口**
→ 后修正：**逃生口暂不加**（用户：`先不加逃生口`，本次范围剔除，留待以后）。

### Round 2 — Codex 侧期望行为
用户选择：**A（只改文档/SKILL 引导，不动 PreToolUse hook）**
- Codex 聚焦 **SessionStart hook** + SKILL.md/AGENTS.md 文档引导；
- PreToolUse 保持现状（只注入 updatedInput.shell + 剥标记，不 wrap、不注入上下文）。

### Round 3 — 共享 init 与 `.niubashrc` 的关系
用户选择：**B（抽共享 init，两处都引用）**
- 共享 init：`~/.config/win-bash/git-inherit.sh`（示例路径）；
- `.niubashrc` 与 BASH_ENV 都 source 它，单一来源、无重复逻辑。

### Round 4 — 共享 init 写入口与生命周期
用户选择：**C（只由 install 写入；SessionStart 只读不写）**
- 共享 init 在安装时生成（幂等）；
- SessionStart 不负责写（减少 hook 副作用）。

### Round 5 — 存量安装生效路径
用户选择：**重装 或 `win-bash doctor` 自愈**
- 存量用户可重装，或跑 `win-bash doctor` 自动补写共享 init + 注入 BASH_ENV。

### Round 6 — 版本 + 验收标准
- 版本：**a（win-bash-ai 0.5.0 / plugin 0.1.7）**
- 验收 1–6 全部确认（见 spec）。

### Round 7 — OpenCode 侧 BASH_ENV 注入通道（可行性事实）
- 事实：opencode 1.18.34 顶层 Config **无 `env` 键**（schema 实证），无法像 Claude 那样写 env。
- 用户选择：**OpenCode 本次不做 BASH_ENV（保持现状，靠命令内前缀）；后续改全局 BASH_ENV 时再覆盖**。

### Round 8 — `.niubashrc` 与共享 init 衔接（收尾）
用户选择：**A（干净替换）**
- `.niubashrc` 删除 v2/v3 内联块，换成一行 `. ~/.config/win-bash/git-inherit.sh`；
- 顺带清理之前发现的重复 v2 遗留块。

## 压力测试记录
- Round 1→ 逃生口从"加"到"不加"，范围收敛；
- Round 2→ 明确 Codex 不做自动注入（与最初"工具驱动自动继承"动机的张力已向用户显式提出并确认走文档引导）；
- Round 7→ 事实驱动：OpenCode 无 env 注入能力，硬做 wrapper 有风险，用户选择务实方案。
