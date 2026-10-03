# Ralplan — Critic lane review (main-lane substitution, see .omx/plans/ralplan-review-substitution.md)

Date: 2026-10-03 | Verdict: **APPROVE**
Inputs: PRD rev1 + Planner rev2 + Architect rev1 (ITERATE) + Architect rev2 (APPROVE)

## Quality criteria checks

### 1. Principle-option consistency
- Principle "单一来源"（init 唯一载体）↔ 选项 1（共享 init + BASH_ENV）一致；选项 2/3 被合理否决
  （现状未解痛点 / 全局污染且用户否决）。无矛盾。
- Principle "幂等可逆" ↔ W1 ensureDefaultRc 全块清理 + 单行 source 幂等、install/doctor 自愈、
  uninstall 清理注入：一致。
- Principle "三平台一致性" ↔ 各平台按其真实能力落法（Claude env / OpenCode 现状 / Codex 文档）：
  一致，未被破坏。
- Principle "最小副作用" ↔ 无全局 env、无逃生口、SessionStart 只读：一致。

### 2. Fair alternatives
Planner DR 提供了 3 个有界选项（共享 init / 现状 + 前缀 / 全局 env），pros/cons 对等呈现，
否决理由充分（痛点未解 / 全局副作用 + 用户否决）。替代方案没有被稻草人化。PASS。

### 3. Risk mitigation clarity
- rc 替换风险：rev2 W1 全块删除 + 幂等测试 C1（v3+v2 堆叠）覆盖 -> 明确。
- BASH_ENV 路径风险：rev2 W2 POSIX 转换 + 测试 B1 断言 -> 明确。
- init 缺失/自愈：doctor D1/D2 + SessionStart 只读校验 -> 明确。
- uninstall 语义（是否删 init）：PRD Open items 标记为执行方决定，不阻塞 -> 明确。
- 双源一致性张力（.niubashrc 不再自包含）：Architect 建议文档注明 init 由 win-bash 管理 ->
  rev2 纳入 W5 文档说明。PASS。

### 4. Testable acceptance criteria
验收 1-6 全部可测且与 PRD W 步骤、test-spec A-D 映射：
1 Claude env BASH_ENV + bash -lc awk -> Git usr/bin（真机 QA1 + 单测 B1）
2 OpenCode 现状不破坏（真机 QA2 回归）
3 Codex SessionStart 无警告 + 前缀取 awk（真机 QA5 + C3）
4 init 幂等（单测 A2 + QA3）
5 .niubashrc REPL 继承（真机 QA2 + C1/C2）
6 doctor 自愈 + uninstall 清理（单测 D1/D2 + QA4）
无不可测/悬空验收项。PASS。

### 5. Concrete verification steps
W4 npm test 全绿（基线 52/52）+ LSP 干净；W5 真机手动 QA1-6（含重装 0.1.7 重启会话）。
验证步骤具体、可复现。PASS。

### 6. Deliberate-mode
普通规划，未触发 high-risk 信号（非 auth/安全/迁移/破坏性/合规）。无需 pre-mortem 三场景。
合理。

## Residual risk（记录，不阻塞）
- Codex 侧无自动 BASH_ENV 注入（宿主能力限制）依赖文档引导；已由用户明确接受（R2）。
- uninstall 是否删共享 init 未拍板：执行方选择并报告（Open item）。
- 真机 QA 依赖本机 Niubash/Git Bash 环境（已知存在）。

## Synthesis
原则-选项一致、替代方案公平、风险缓解清晰、验收可测、验证具体。rev2 吸收全部 Architect
发现后无质量缺口。APPROVE。
