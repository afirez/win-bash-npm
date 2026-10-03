# Deep-Interview Context Snapshot — Niubash Git inheritance via BASH_ENV

- **Timestamp**: 2026-10-03T (Asia/Shanghai)
- **Task slug**: `win-bash-bash-env-inherit`
- **Task statement**: 将 Niubash 的 Git Bash 继承能力改用 BASH_ENV 方式实现
- **Desired outcome**: 工具驱动的非交互场景（Codex/Claude/OpenCode 的 `bash -lc`）下，
  Niubash 能继承 Git Bash 命令（awk/gzip/perl/...），不再依赖只对交互 REPL 生效的 `~/.niubashrc`。

## Stated solution
用 `BASH_ENV` 指向一个 git-inherit init 文件，让非交互 bash 启动时自动 append Git usr/bin 到 PATH。

## Probable intent hypothesis
之前 SKILL/docs 声称"Niubash 继承 Git 命令"只在交互 REPL 成立；工具驱动路径 awk/perl/gzip MISSING。
用户希望工具驱动路径也真正继承，而不是靠"命令内手动 export PATH"。

## Known facts / evidence（本机实测 2026-10-03）
- Niubash `bash -lc`（Codex 工具驱动形态）默认**不读** `~/.niubashrc` → awk/gzip/perl MISSING；
  sed/grep 来自 Niubash 自带 winuxcmd/usr/bin；git 来自 PATH 上 `C:\Program Files\Git\cmd`。
- Windows 系统 PATH（User+Machine）只有 `C:\Program Files\Git\cmd`，**没有** Git usr/bin/mingw64/bin。
- `~/.niubashrc` 只在 Niubash REPL（`niu -C` / 交互终端）加载；`bash.exe` 直接调用任何模式都不读它。
- **关键新发现**：`BASH_ENV=<init>` 在 Niubash 的 `-c` / `-lc` / `-ic` 全部生效（实测 LOADED）。
- **完整链路已实测通过**：BASH_ENV 指向一个 append Git usr/bin 的 init 文件后，Niubash `-lc` 下
  awk/gzip/perl → `/c/Program Files/Git/usr/bin/*.exe`；sed/grep → Niubash 自带；git → mingw64/bin。
- 注意：Windows 路径若用反斜杠会被 bash 吃（需转 POSIX 形式 `/c/...` 或正斜杠）。
- 会话 transcript 里曾有 "we need set NIU_ENV or BASH_ENV" 讨论，但收敛时未实现，无记录。

## Constraints
- 不破坏现有 install/doctor/uninstall 命令与三平台（codex/claude/opencode）一致性。
- 不破坏交互 REPL 的 git 继承（`.niubashrc` 可保留或与 BASH_ENV 并存）。
- Codex PreToolUse hook 只注入 updatedInput.shell + 剥标记，**不**注入 additionalContext、不 wrap 命令。
- 配置单一来源 `~/.config/win-bash/win-bash.json`（shell + niubash_path/gitbash_path/pwsh_path）。
- Codex CLI 0.156.1 宿主丢弃 updatedInput.shell → 工具驱动真正靠 shell 路由 + BASH_ENV。

## Unknowns / open questions（访谈重点）
- BASH_ENV init 文件放哪、由谁写入（hook configure / install.ps1 / 单独命令）？
- 三平台如何注入 BASH_ENV：Claude（settings.json env）/ OpenCode（shell 配置或 env）/ Codex（hook 不能改宿主 env）？
- Codex 侧无法改宿主进程 env，如何让每次 exec_command 的 bash 拿到 BASH_ENV？
  （可能：命令前缀 `BASH_ENV=... bash -lc`？还是 hook updatedInput 无法传 env → 需宿主级 env / AGENTS.md？）
- `.niubashrc` 与 BASH_ENV 的关系：替换 / 并存 / 保留 .niubashrc 只给交互？
- init 文件内容：与 `.niubashrc` v3 块相同（动态 git 发现 + append）？是否需幂等？
- 卸载时是否移除 BASH_ENV 注入？
- 是否要新增 CLI 子命令（如 `win-bash bash env-init`）？

## Decision-boundary unknowns
- 哪些平台在本次范围（codex 必须？claude/opencode 一并？）
- 是否允许新增 init 文件写入 ~/.config/win-bash/ 下
- 版本号策略（0.4.x？plugin 0.1.x？）
- 是否更新 SKILL.md / docs 里"known limitation"

## Likely codebase touchpoints
- `plugin/codex/scripts/win-bash-hook.js`（configure/ensureDefaultRc/session-start/pre-tool-use）
- `src/niubash.js`（resolve*Path / installBash）
- `src/claude.js` / `src/opencode.js`（env / shell 配置注入）
- `src/config.js` / `src/paths.js`（新 init 文件路径）
- `plugin/codex/scripts/install.ps1`
- `test/hooks.test.js` / `test/niubash.test.js`
- `docs/win-bash-injection-chain.md` / `docs/win-bash-routing.md` / `SKILL.md`

## Relevant repo docs/rules/context inspected
- `.omx/specs/deep-interview-win-bash-gitonly-convergence.md`
- `docs/win-bash-injection-chain.md`（含 known-limitation）
- `plugin/codex/skills/win-bash/SKILL.md`
- `src/{config,claude,opencode,niubash}.js`、`plugin/codex/scripts/win-bash-hook.js`
- 用户级 AGENTS.md USER:SHELL 块

## Terminology / doc-code conflicts
- SKILL/docs 写"Niubash inherits Git commands"，但代码+实测只在交互 REPL 成立 → 本次正是修复此差距。

## Prompt-safe initial-context summary status
`not_needed`（上下文量适中）
