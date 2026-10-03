# PRD — Niubash Git 继承改用 BASH_ENV（win-bash-ai 0.5.0 / plugin 0.1.7）

Source of truth: `.omx/specs/deep-interview-win-bash-bash-env-inherit.md`
Transcript: `.omx/interviews/win-bash-bash-env-inherit-20261003T191611Z.md`
Context: `.omx/context/win-bash-bash-env-inherit-20261003T184840Z.md`
Planner: $ralplan Planner lane | Date: 2026-10-03

## 1. Goal

让 Niubash 在**工具驱动的非交互场景**（`bash -lc`/`-c`，即 Codex/Claude/OpenCode 执行命令的形态）
下真正继承 Git Bash 命令（awk/gzip/perl/tar/sed/...）。改用 **BASH_ENV** 指向共享 init，替代
目前只对交互 REPL 生效的 `~/.niubashrc` 内联继承块。

## 2. Outcome contract（验收 1-6，来自 spec）

1. Claude：`~/.claude/settings.json` env 含 `BASH_ENV=<shared-init>`；`bash -lc 'awk --version'` → Git usr/bin。
2. OpenCode：无行为变更，现有 `shell` 键不受破坏。
3. Codex：SessionStart 无警告；SKILL/AGENTS.md 文档引导可用；显式 shell + `BASH_ENV="<init>"` 前缀取到 awk。
4. 共享 init 幂等（重复 source 不重复 append Git dirs）。
5. `.niubashrc` REPL（`niu -C`）仍继承 Git。
6. `win-bash doctor` 自愈补写共享 init；uninstall 清理 Claude env 注入。

## 3. Work breakdown（每个步骤原子可验证）

### W1 — 共享 init 基建（src + hook 只读接入）
- `src/paths.js`：新增 `getWinBashGitInheritInitPath()` → `~/.config/win-bash/git-inherit.sh`。
- 共享 init 内容：抽取 `plugin/codex/scripts/win-bash-hook.js` 的 `GIT_INHERIT_RC`（v3 动态发现块）为
  共享文件（POSIX 路径、幂等 append、动态 Git 发现）。
- `plugin/codex/scripts/win-bash-hook.js`：
  - `ensureDefaultRc()` 改为**干净替换**：删除 v2/v3 内联块，替换为一行 `. ~/.config/win-bash/git-inherit.sh`；
    清理遗留 v2 块（本机 `.niubashrc` 现同时有 v3 + 遗留 v2）。
  - SessionStart：**只读**校验共享 init 存在性（缺失时提示 `win-bash doctor`/重装），不写入。

### W2 — 写入方（install / doctor / claude）
- `src/install.js` + `plugin/codex/scripts/install.ps1`：install 时创建/确保共享 init（幂等）。
- `src/claude.js`：`applyClaudeEnv()` 增加 `BASH_ENV=<shared-init>`（与 CLAUDE_CODE_* 并存）；install 确保 init。
- `src/doctor.js`：自愈——检测共享 init 缺失时补写，并补 Claude env `BASH_ENV`。

### W3 — OpenCode（保持现状，仅验证）
- 不改 opencode 注入逻辑；回归验证现有 `shell` 键与技能安装不受影响（本次无新注入通道）。

### W4 — 版本 + 测试
- `package.json` → `0.5.0`；`plugin/codex/.codex-plugin/plugin.json` → `0.1.7`。
- 新增/更新测试：
  - `test/niubash.test.js` 或新增 `test/git-inherit.test.js`：共享 init 幂等（重复 source 不重复 append）。
  - `test/claude.test.js`：`applyClaudeEnv` 注入 `BASH_ENV=<init>`。
  - `test/hooks.test.js`：`ensureDefaultRc` 干净替换 v2/v3 → 单行 source（断言无内联块、无 v2 遗留）；
    SessionStart 只读校验。
  - `test/doctor.test.js`（新增）：删 init → doctor 自愈补写。
- 全部 `npm test` 通过（基线 52/52）。

### W5 — 文档
- `docs/win-bash-injection-chain.md`：替换 known-limitation 章节为 BASH_ENV 继承描述；Claude env 表加 BASH_ENV。
- `docs/win-bash-routing.md`：同步 Git 继承现状。
- `plugin/codex/skills/win-bash/SKILL.md`：替换 "Known limitation" 章节 → BASH_ENV 继承说明 + Codex 前缀示例。
- 用户级 AGENTS.md USER:SHELL 部分：补 `BASH_ENV="<init>"` 前缀指引（文档层面，代码不写宿主 env）。

## 4. Sequence & dependencies

W1（基建+rc 替换）→ W2（写入方）→ W3（opencode 回归）→ W4（版本+测试）→ W5（文档）。
W4 依赖 W1/W2 代码落地；W5 依赖 W4 通过。W3 可与 W4 并行（只读回归）。

## 5. Verification plan

- `npm test`（node --test test/*.test.js）全绿。
- 真机手动 QA：
  1. Claude settings.json env 含 BASH_ENV；`<niu> bash -lc 'awk --version'` → Git usr/bin。
  2. `.niubashrc` 只剩单行 source；`niu -C` REPL `awk --version` 正常。
  3. 共享 init 连续 source 两次，PATH 无重复 Git dirs。
  4. 删共享 init → `win-bash doctor` 补写。
  5. Codex 显式 shell + `BASH_ENV="<init>"` 前缀取到 awk。
  6. 重装插件到 `C:\Users\alphazz\.codex\plugins\cache\local-win-bash\win-bash\0.1.7\` 并重启会话验证。
- LSP 诊断干净（changed files）。

## 6. Non-goals（继承自 spec）

- 不加 `WIN_BASH_NO_ENV` 逃生口；不改 Codex PreToolUse 行为（宿主丢弃 updatedInput.shell）。
- OpenCode 本次不做 BASH_ENV（顶层 config 无 env 键）。
- 不改三平台机制一致性；不新增依赖；不重写 install.ps1 整体结构。

## 7. Open items（执行时定夺，不阻塞）

- uninstall 是否删除共享 init：建议保留孤立文件 + 清理 Claude env 注入（一致性优先），执行方决定并报告。

---

## RALPLAN-DR Summary

### Principles
1. 单一来源：Git 继承逻辑只存于共享 init `~/.config/win-bash/git-inherit.sh`，`.niubashrc` 与 BASH_ENV 都 source 它，不复制逻辑。
2. 幂等与可逆：共享 init 可重复 source；install/doctor 可自愈；uninstall 清理注入，不破坏用户文件。
3. 三平台一致性：不改 install/doctor/uninstall 命令契约与各平台注入机制本身；Codex PreToolUse 行为保持不变。
4. 最小副作用：SessionStart 对共享 init 只读；无全局环境变量；无逃生口（本次）。
5. 事实优先：Claude env 与 OpenCode 无 env 键的能力差异已实测，方案按各平台真实能力注入。

### Decision Drivers
1. 工具驱动路径（`bash -lc`）当前无法继承 Git 命令——这是要解决的核心痛点。
2. BASH_ENV 在 Niubash `-c/-lc/-ic` 均生效（已实测），是唯一不依赖宿主改写命令的注入通道。
3. 各平台注入能力不同（Claude=settings env、OpenCode=无 env 键、Codex=不能改宿主 env），方案必须分平台落法。

### Viable Options
1. **BASH_ENV 共享 init（选定）**：一个 init 文件，Claude 用 env 指向、Codex 用文档前缀、`.niubashrc` 单行 source。
   - Pro: 单一来源、幂等、交互+非交互全继承；三平台各自能力匹配。
   - Con: Codex 无自动注入，需文档引导（可接受，宿主能力限制）。
2. 继续用 `.niubashrc` 内联块 + 每命令前缀（现状）。
   - Pro: 零新文件、零版本变更。
   - Con: 工具驱动路径仍不继承（痛点未解）；命令内手动 export 不可靠、易漏。
   - 否决：未解决目标问题。
3. 全局用户环境变量 BASH_ENV。
   - Pro: Codex/Claude/OpenCode 一次生效。
   - Con: 全局副作用（影响所有 bash 会话，非 win-bash 作用域）、需改用户级 env（破坏性）、用户已否决。
   - 否决：全局污染，超出本次范围。

### Deliberate-mode 判定
普通规划（非 auth/安全/迁移/破坏性/合规），无需 `--deliberate`。风险点集中在 rc 替换与 Claude env 合并，
已由单元测试 + 真机 QA 覆盖，不需 pre-mortem 三场景。
