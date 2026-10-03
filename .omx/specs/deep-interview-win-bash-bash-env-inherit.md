# Spec — Niubash Git 继承改用 BASH_ENV

Metadata: profile=standard | rounds=8 | final_ambiguity≈0.24 → 逐轮确认收敛 | threshold=0.20 | context=brownfield
Context snapshot: .omx/context/win-bash-bash-env-inherit-20261003T184840Z.md
Transcript: .omx/interviews/win-bash-bash-env-inherit-20261003T191611Z.md
Prompt-safe initial-context summary: not_needed（上下文量适中）

## Intent
工具驱动的非交互场景（Codex/Claude/OpenCode 的 `bash -lc`）下，Niubash 无法继承 Git Bash 命令
（awk/gzip/perl/tar/sed/...）。根因是继承目前放在 `~/.niubashrc`（Niubash 的交互式 rc，只在
REPL/交互会话加载），工具驱动的 `bash -lc` 不读它。用户希望改用 **BASH_ENV** 指向一个共享 init
文件，让非交互 bash 启动时自动 append Git usr/bin 到 PATH，使工具驱动路径真正继承，而不是靠
"命令内手动 export PATH" 或 "只对交互 REPL 成立"。

## Desired Outcome
- 共享 init `~/.config/win-bash/git-inherit.sh`（动态 Git 发现 + append usr/bin，幂等）成为
  Git 继承的唯一来源；`.niubashrc` 与 BASH_ENV 都 source 它，单一来源、无重复逻辑。
- Claude Code：`~/.claude/settings.json` env 注入 `BASH_ENV=<shared-init>`（install + doctor），
  使 `bash -lc` 下 awk/gzip/perl 解析到 `C:\Program Files\Git\usr\bin\*.exe`。
- Codex：不改 PreToolUse；聚焦 SessionStart hook（只读校验/报告共享 init 存在性）+ SKILL.md /
  AGENTS.md USER:SHELL 文档引导（显式 shell + 命令前缀 `BASH_ENV="<shared-init>"`）。
- OpenCode：本次不做 BASH_ENV（顶层 config 无 `env` 键，schema 实证），保持现状 `shell` 键。
- 交互 REPL（`niu -C`）仍继承 Git（`.niubashrc` 一行 `. ~/.config/win-bash/git-inherit.sh`）。

## In-Scope
1. `src/paths.js`：新增 `getWinBashGitInheritInitPath()`（`~/.config/win-bash/git-inherit.sh`）。
2. 共享 init 内容：抽取当前 `GIT_INHERIT_RC`（v3 动态发现块）为共享文件，要求幂等（重复 source
   不会重复 append Git dirs）、POSIX-style paths（反斜杠会被 bash 解码为转义）。
3. `src/install.js` / `plugin/codex/scripts/install.ps1`：install 时创建/确保共享 init（幂等）。
4. `src/claude.js`：`applyClaudeEnv` 增加 `BASH_ENV=<shared-init>`（与现有
   `CLAUDE_CODE_GIT_BASH_PATH`/`CLAUDE_CODE_SHELL` 并存）；install + doctor 确保共享 init。
5. `src/doctor.js`：自愈——检测共享 init 缺失时补写（doctor 也注入 Claude env）。
6. `plugin/codex/scripts/win-bash-hook.js`：SessionStart 只读校验/报告共享 init（不写，R4）；
   `ensureDefaultRc` 改为干净替换——删除 v2+v3 内联块，替换为一行
   `. ~/.config/win-bash/git-inherit.sh`；清理遗留 v2 块。
7. `test/*`：共享 init 幂等性、Claude env BASH_ENV、doctor 自愈、`.niubashrc` 单行替换。
8. 版本：`package.json` → `0.5.0`；`plugin/codex/.codex-plugin/plugin.json` → `0.1.7`。
9. 文档：`docs/win-bash-injection-chain.md` / `docs/win-bash-routing.md` /
   `plugin/codex/skills/win-bash/SKILL.md` 替换"known-limitation"章节（工具驱动路径现在
   能继承 Git 命令）；AGENTS.md USER:SHELL 部分补 BASH_ENV 前缀指引。

## Out-of-Scope / Non-goals
- **不做全局环境变量注入**（不改 Windows 系统 PATH / 不设用户级环境变量）。
- **不加 `WIN_BASH_NO_ENV` 逃生口**（用户曾要求后明确"先不加"，本次范围剔除，留待以后）。
- **不改 Codex PreToolUse hook**（宿主丢弃 updatedInput.shell；本次聚焦 SessionStart + 文档）。
- **OpenCode 不做 BASH_ENV**（顶层 config 无 `env` 键；保持现状，之后若改全局 BASH_ENV 再覆盖）。
- **不新增依赖**；不重写 install.ps1 整体结构。
- 不为缺失 Git Bash 的极端场景新增兜底逻辑（保持现状链 Niubash → Git Bash → pwsh）。

## Decision Boundaries（OMX 可自主决定，无需再确认）
- 共享 init 的具体内容措辞、幂等写法（case ":$PATH:" 防重复）细节。
- install.ps1 与 src/install.js 谁先创建共享 init 的先后顺序（结果一致即可，幂等）。
- Claude env 注入时与现有两个键的合并方式（保留其它用户 env）。
- doctor 自愈的具体触发点与提示文案。
- 测试命名 / 文档措辞细节。
- 版本号 bump 与重装流程按既有约定（0.5.0 / plugin 0.1.7）。

## Constraints
- 不破坏现有 install/doctor/uninstall 命令与三平台（codex/claude/opencode）一致性。
- 不破坏交互 REPL 的 git 继承（`.niubashrc` 单行 source 共享 init）。
- 单一配置来源 `~/.config/win-bash/win-bash.json`（shell + niubash_path/gitbash_path/pwsh_path）。
- Codex PreToolUse hook 只注入 updatedInput.shell + 剥标记，不注入 additionalContext、不 wrap。
- 共享 init 必须幂等；POSIX-style paths。
- SessionStart 对共享 init 只读不写（R4）。

## Testable Acceptance Criteria
1. **Claude**：`~/.claude/settings.json` env 有 `BASH_ENV=<shared-init>`；Niubash `bash -lc 'awk --version'`
   → Git usr/bin（`/c/Program Files/Git/usr/bin/awk.exe`）。
2. **OpenCode**：本次无变更，确认未破坏（现有 `shell` → Niubash）。
3. **Codex**：SessionStart 无警告；SKILL/AGENTS.md 引导可用；显式 shell + 命令前缀
   `BASH_ENV="<shared-init>"` 能取到 awk。
4. **共享 init 幂等**：重复 source 不重复 append Git dirs（case ":$PATH:" 守卫）。
5. **`.niubashrc` REPL**（`niu -C`）仍继承 Git 命令。
6. **doctor 自愈**：删掉共享 init 后 `win-bash doctor` 补写；卸载清理 Claude env 注入。

## Assumptions & Resolutions
- 假设：Niubash `bash -lc` 读取 `$BASH_ENV`。=> **已实测确认**（2026-10-03）：`-c`/`-lc`/`-ic`
  全部加载；BASH_ENV 指向 append Git usr/bin 的 init 后 awk/gzip/perl → Git usr/bin。
- 假设：Windows 反斜杠路径在 bash init 中会被吃。=> **已实测**：需 POSIX 形式 `/c/...` 或正斜杠。
- 假设：Claude Code 尊重 settings.json env 里的 `BASH_ENV` 传给子 bash。=> 依赖官方机制，
  验收 1 以真机验证为准（settings.json env 已用于 CLAUDE_CODE_*，BASH_ENV 属同机制）。
- 假设：Codex 无法通过 hook 改宿主 env。=> 事实（宿主丢弃 updatedInput.shell），故走文档引导。

## Pressure-pass findings
- R1 逃生口先加后删：用户最初要求 `WIN_BASH_NO_ENV`，随后明确"先不加"，范围收敛。
- R2 动机张力：最初"工具驱动自动继承"与"Codex 不做自动注入（文档引导）"冲突，已向用户显式
  提出并确认走文档引导。
- R7 事实驱动：OpenCode 顶层 config 无 `env` 键（schema 实证），硬做 wrapper 有风险，
  用户选择务实方案（本次不做）。
- R8 干净替换：`.niubashrc` 若继续保留 v3 内联块会导致双源不一致，用户选 A（单行 source）。

## Brownfield evidence vs inference notes
- evidence：`win-bash-hook.js` `GIT_INHERIT_RC`（v3 动态发现块）、`ensureDefaultRc()`、
  `configure()`（策略 X）、SessionStart 分支（emitContext 只在此用）；
  `src/claude.js` `applyClaudeEnv`（CLAUDE_CODE_GIT_BASH_PATH/CLAUDE_CODE_SHELL）；
  `src/opencode.js` `applyOpencodeConfig`（shell 键）；`src/paths.js` config 路径族；
  install.ps1（`$cfg.rc_result.created/appended` 分支）。
- evidence：本机 2026-10-03 实测 Niubash `bash -lc` 默认不读 `~/.niubashrc`（awk/perl/gzip
  MISSING）；`BASH_ENV=<init>` 在 `-c/-lc/-ic` 全部加载；sed/grep 来自 Niubash 自带
  winuxcmd/usr/bin；git 来自 Windows PATH 的 `C:\Program Files\Git\cmd`。
- inference：Claude env 的 `BASH_ENV` 会传给工具子 bash（与现有 CLAUDE_CODE_* 同机制）。
- inference：删除 `.niubashrc` v3 内联块不影响非交互（它们本就不在非交互加载）。

## Docs/Terminology Ledger
- Inspected：`plugin/codex/scripts/win-bash-hook.js`、`src/{paths,claude,opencode,config,niubash,install,doctor}.js`、
  `plugin/codex/scripts/install.ps1`、`package.json`、`plugin.json`、`docs/win-bash-injection-chain.md`、
  `plugin/codex/skills/win-bash/SKILL.md`、用户级 AGENTS.md USER:SHELL 块。
- 术语："共享 init"= `~/.config/win-bash/git-inherit.sh`；"BASH_ENV"= bash 非交互启动读取的
  init 文件环境变量；"工具驱动路径"= `bash -lc`/`-c` 形态。
- 冲突：SKILL/docs 写"Niubash inherits Git commands"，但代码+实测只在交互 REPL 成立 →
  本次修复此差距（known-limitation 章节替换）。

## Scenario/edge-case pressure findings
- `.niubashrc` 已有 v2+v3 双块（本机实测存在重复 v2 遗留）：R8 选 A 时需一并清理，避免双源。
- 用户可能手动改 `.niubashrc`：单行 source 替换必须保留其它用户内容，只删 win-bash 块。
- 无 Git Bash 时共享 init 的 `command -v git` 探测失败 → init 空转，PATH 不变，不报错。
- 卸载语义：清理三平台注入；共享 init 是否删除未明确（见 Open Questions），建议保留孤立文件
  或作为 spec 问题记录，不阻塞。

## Open Questions（不阻塞，交执行方合理处置）
- **Uninstall 是否删除共享 init**：用户未明确。建议三平台一致清理 Claude env 注入；共享 init
  保留（孤立文件无害），或随卸载一并移除——执行方选一并在最终报告说明即可。

## Technical context findings
- BASH_ENV 只在非交互/`-c`/`-lc`/`-ic` 下读取；交互 bash 读 rc（`.niubashrc`）。
- Niubash 继承 Git 命令依赖共享 init 的 append（`$PATH:$git/usr/bin:$git/bin:$git/cmd`）。
- Claude settings.json env 是唯一"静态 env"注入点；OpenCode 无 env 键；Codex 靠文档引导。

## Handoff
默认 **$ultragoal**（目标化执行，`create-goals --brief-file <spec>` → `complete-goals`）。
备选 **$team**（多 lane 并行）、**$ralplan**（如需再评审 BASH_ENV 注入边界）。
