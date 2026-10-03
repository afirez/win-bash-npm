# win-bash 注入行为全链路（Codex 深度 + 三平台对比）

> 权威说明：win-bash 在 Codex / Claude Code / OpenCode 三个平台上如何把 shell 命令
> 路由到 Niubash Bash。本文按**当前实现与实测**编写（win-bash-ai 0.4.2 / plugin 0.1.6）。
> 每个事实尽量带出处（源码路径或实证命令）；标注 `[known-limitation]` 的是已验证的
> 已知限制，当前**不改行为**、仅如实记录。

## 0. 三平台机制一览

| 平台 | 机制 | 注入点 | 状态来源 | 故障兜底 |
| --- | --- | --- | --- | --- |
| Codex | **hook 动态**：SessionStart + PreToolUse | `~/.codex/plugins/cache/local-win-bash/win-bash/0.1.6/hooks/*.json` | `~/.config/win-bash/win-bash.json` + 动态探测 | Git Bash → pwsh |
| Claude Code | **静态 env**：`CLAUDE_CODE_GIT_BASH_PATH` / `CLAUDE_CODE_SHELL` | `~/.claude/settings.json` env | 安装时 `resolveShellForInstall()` 写死 | Git Bash → pwsh |
| OpenCode | **静态 shell 键**：`shell` | `~/.config/opencode/opencode.json` | 安装时 `resolveShellForInstall()` 写死 | Git Bash → pwsh |

三平台共用同一份配置 `~/.config/win-bash/win-bash.json`（含 `platforms` 标记），
卸载只移除本安装器写入的值。（出处：`src/paths.js`、`src/config.js`、`src/{codex,claude,opencode}.js`）

---

## 1. Codex — SessionStart 全链路

**注册**（`plugin/codex/hooks/session-start-resolve-win-bash.json`）：
- matcher `startup|resume|clear`
- 命令：`node -e "<spawnSync 包装>" "<PLUGIN_ROOT>/scripts/win-bash-hook.js" session-start`，
  包装器剥离 `\\?\` 长路径前缀后转发。（出处：hooks/*.json）

**行为**（`win-bash-hook.js` `main('session-start')`）：
1. `configure()`（主 shell 链 + 策略 X）：
   - 主 shell 选择：`config.shell` 存在且有效 → 尊重（手动覆盖优先）；否则
     Niubash（`resolveNiubashPure()`）→ Git Bash → pwsh → none。
   - 落盘三路径 `niubash_path`/`gitbash_path`/`pwsh_path`：仅在缺失或失效时
     才解析并补写（策略 X），已有有效值不重复覆盖；`config.platforms.codex`
     无变化时不写盘。
   - 三平台的 `resolve*Path()`（`src/niubash.js`）与 hook 解析器都优先读
     对应 `*_path`（存在且 `isFile` 才用；pwsh 直接信任），否则回退动态链。
   - `ensureDefaultRc()`：确保 `~/.niubashrc` 存在（含 `win-bash-git-inherit-v3`
     动态 Git 继承块）。
2. 警告注入（`emitContext('SessionStart', ...)`，会话起点，安全时机）：
   - 无 Niubash → 提示 `win-bash bash install` 或设 `WIN_BASH_PATH`；
   - 无 Git Bash → 提示装 Git for Windows（`https://git-scm.com/downloads`）；
   - Niubash、Git Bash、pwsh 皆无 → 提示装 PowerShell 7（`winget install Microsoft.PowerShell`）。
3. 本机实证（2026-10-03）：三样齐全 → 无输出、无警告。

**为何 SessionStart 是唯一 allowed 的 additionalContext 注入点**：它在会话开始、
工具调用链之外触发，绝不会落在并行 tool_calls 批中间，因此不会造成
"PreToolUse 在并行批里注入 additionalContext 导致会话中毒"一类问题。
（出处：win-bash-hook.js `emitContext` 只在 SessionStart 分支使用；历史修复记录见
`docs/hook-chain-commandwrap-0.4.0.md` 与 `.omc/specs/deep-interview-win-bash-hook-chain.md`。）

---

## 2. Codex — PreToolUse 全链路

**注册**（`plugin/codex/hooks/pre-tool-use-inject-win-bash.json`）：
- matcher `^(exec_command|functions\.exec_command|Bash)$`
- 命令：同样走 `node -e <spawnSync 包装> ... win-bash-hook.js pre-tool-use`，stdin 传 payload。

**入口守卫**（`win-bash-hook.js` `main('pre-tool-use')`）：
- `isWindowsHost()`；
- `payload.hook_event_name === 'PreToolUse'`；
- `tool_name` ∈ `{exec_command, functions.exec_command, bash, shell}`。

**decide(input)**（纯函数，`route` 子命令可复现）——决策顺序：
1. `WIN_BASH_SKIP=1` → `{action:skip, shell:null}`，剥标记；
2. `WIN_BASH_SHELL=<path>` → `{action:force, shell:path}`（路径存在才生效），剥标记；
3. 显式 `shell` 已在输入里 → `{action:respect}`，**不改写**；
4. `classify()`：
   - Windows-native（`psmux|pmux|tmux|powershell|pwsh` 作为命令运行、PS Verb-Noun
     cmdlet、cmd.exe 无独立 exe 的内建、`.ps1/.bat/.cmd`）→ `none`，不改写；
   - bash/POSIX/脚本/管道/默认 → `niubash`（`resolveBash()` 得 Niubash；无 Niubash 依次
     兜底 Git Bash → pwsh）。

**注入形态（当前 0.1.6，关键）**：
- 只写 `updatedInput.shell`（`shellChanged` 时），**command 原样保留**（仅剥 escape
  hatch 标记）；
- **不**注入 `additionalContext`；
- **不**做 command 包装（`& bash -lc '...'` 已移除）；
- `route` 子命令输出的 `cmd` 里仍带 `export PATH="$PATH:<git dirs>"; ` 前缀，但那
  只是诊断/测试输出，**不会**进入 PreToolUse 的 `updatedInput.command`。
  （出处：win-bash-hook.js pre-tool-use 分支 + 实测 JSON）

**宿主行为（实测 + 源码）**：
- Codex CLI 0.156.1 `codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs`
  的 `with_updated_hook_input` 只把 `updatedInput.command` 经
  `updated_hook_command()` 写回 `cmd` 参数，**丢弃 `updatedInput.shell`**。
- 因此当前形态在 Codex 上的实际效果 = **只剥 escape hatch 标记 + 不破坏命令 +
  永不注入上下文**；shell 字段本身不被宿主采纳。
- 真正的 shell 路由靠 SessionStart 引导 + 用户级 AGENTS.md `USER:SHELL` policy +
  SKILL.md 让模型**显式传 `shell`**。
- 实证（2026-10-03）：
  - `git status` → PRE 输出 `updatedInput:{command:"git status", shell:"bash"}`；
  - `tmux ls` / `Get-Process` → 无改写（不改写即不输出）；
  - `WIN_BASH_SKIP=1 psmux attach` → `updatedInput:{command:"psmux attach"}`（无 shell）；
  - session-start → 无警告。

---

## 3. Niubash 是否继承 Git Bash 命令能力（实测）

> 这是 SKILL/README 曾声称 "Niubash inherits standard Git Bash commands
> (`awk`, `gzip`, `perl`, `tar`, `sed`, ...)" 的验证结论。实测显示该声称
> **只在交互/REPL 模式成立**，在 Codex 等工具驱动路径下**不成立**。

| 调用方式 | `~/.niubashrc` 加载? | awk / perl / gzip |
| --- | --- | --- |
| `bash.exe -lc '<cmd>'`（Codex/工具驱动方式） | ❌ 不加载 | ❌ MISSING |
| `bash.exe -ic '...'` / `--rcfile ... -i -c` | ❌ 不加载 | ❌ MISSING |
| `niu.exe -c '<cmd>'`（Niubash 官方命令模式） | ❌ 不加载 | ❌ MISSING |
| `niu.exe -C '<cmd>'`（REPL 模式） | ✅ 加载 | ✅ awk/perl/gzip/tar/sed 全 OK（来自 `/c/Program Files/Git/usr/bin/`） |

根因：`~/.niubashrc` 是 Niubash 的**交互式 rc**，只在 REPL/交互会话加载；工具通过
`bash -lc` 调用时不加载，故 `win-bash-git-inherit-v3` 继承块不执行
（实测 `__wb_git_root` 保持 unset）。`git` 能用只因 `C:\Program Files\Git\cmd`
本就在 Windows PATH 里，与继承块无关。`[known-limitation]`：Codex/工具驱动路径下
Niubash 不含 awk/perl/gzip 等 Git Bash 专属命令；如命令自身带
`export PATH="$PATH:<git dirs>"; ` 前缀（见 SKILL fallback 示例）则仍可用。
当前按用户决定：**不改行为**，仅记录此限制。

---

## 4. Claude Code 全链路

**安装**（`src/claude.js`）：
1. `resolveShellForInstall()` 解析 Niubash（缺失则安装）；拿不到 Niubash 时回退 Git Bash → pwsh；
2. `applyClaudeEnv()`：把 `CLAUDE_CODE_GIT_BASH_PATH` 与 `CLAUDE_CODE_SHELL` 并入
   `~/.claude/settings.json` 的 `env`（写前备份 `settings.json.bak-win-bash-*`）；
3. 安装 skill 到 `~/.claude/skills/win-bash`；
4. `markPlatform('claude', bashPath)` 记录，供卸载精确定位。

**行为**：无 hook；Claude Code 官方按这两个 env 用指定 shell 执行命令。
本机实证（2026-10-03）：`~/.claude/settings.json` env 中两者均指向
`F:\studio\apps\Niubash\winuxcmd\bin\bash.exe`。

**skill 内容**（`plugin/claude/skills/win-bash/SKILL.md`）：指引 Claude Code 正常跑
命令、用 `$BASH_VERSION` 校验、不替换为 Git Bash/WSL/bare bash；说明静态 fallback。

**继承 Git 命令**：与第 3 节同因——仅当 Claude Code 以 REPL/交互方式加载
`~/.niubashrc` 时才继承；以 `bash -lc` 驱动时不继承。`[known-limitation]`。
实测（2026-10-03，`<niu> bash.exe -lc`）：awk/perl/gzip MISSING；sed/grep 来自
Niubash 自带 `winuxcmd/usr/bin`（非 Git 继承）；git 来自 Windows PATH 的
`C:\Program Files\Git\cmd`；tar 解析到 `C:\Windows\system32\tar.exe`（Windows bsdtar，
选项语义与 GNU tar 不同）。

---

## 5. OpenCode 全链路

**安装**（`src/opencode.js`）：
1. `resolveShellForInstall()` 解析 Niubash（缺失则安装）；拿不到 Niubash 时回退 Git Bash → pwsh；
2. `applyOpencodeConfig()`：把 `shell` 键并入 `~/.config/opencode/opencode.json`（写前备份）；
3. 安装 skill 到 `~/.config/opencode/skills/win-bash`；
4. `markPlatform('opencode', bashPath)`。

**行为**：无 hook、无 env 注入；OpenCode 的 bash 工具从 PATH 解析 Bash，`shell` 键
显式指定。本机实证：`~/.config/opencode/opencode.json` 的 `shell` 指向
`F:\studio\apps\Niubash\winuxcmd\bin\bash.exe`；skill 已安装。

**继承 Git 命令**：同第 3 节原因，工具驱动路径不加载交互 rc。`[known-limitation]`。
实测（2026-10-03，`<niu> bash.exe -c`）：awk/perl/gzip MISSING；git 来自 Windows PATH 的
`C:\Program Files\Git\cmd`。与 Codex/Claude 完全一致。

---

## 6. 平台差异小结

| 维度 | Codex | Claude Code | OpenCode |
| --- | --- | --- | --- |
| 注入机制 | SessionStart + PreToolUse hook（动态改写） | 静态 env（`CLAUDE_CODE_GIT_BASH_PATH`/`CLAUDE_CODE_SHELL`） | 静态 `shell` 键 |
| additionalContext | 仅 SessionStart（安全时机） | 无 | 无 |
| updatedInput.shell 是否被采纳 | ❌ 宿主丢弃 | 不适用（非 hook） | 不适用（非 hook） |
| 命令前缀注入 | 仅 `route` 诊断输出，不进 PRE | 不适用 | 不适用 |
| escape hatches | `WIN_BASH_SKIP` / `WIN_BASH_SHELL` | 无 | 无 |
| Git 命令继承 | 交互/REPL 下是；工具驱动否 `[known-limitation]` | 同左 | 同左 |
| 兜底 shell | Niubash → Git Bash → pwsh | 同左（安装时静态写入） | 同左（安装时静态写入） |

---

## 7. 出处清单

- hook 源码：`plugin/codex/scripts/win-bash-hook.js`（`main()`、`decide()`、`classify()`、`configure()`、`emitContext()`）
- hook 注册：`plugin/codex/hooks/pre-tool-use-inject-win-bash.json`、`session-start-resolve-win-bash.json`
- 平台实现：`src/codex.js`、`src/claude.js`、`src/opencode.js`、`src/paths.js`、`src/config.js`
- 共享配置：`~/.config/win-bash/win-bash.json`
- Claude env 实证：`~/.claude/settings.json`（env 键）
- OpenCode 实证：`~/.config/opencode/opencode.json`（shell 键）
- Codex 宿主丢弃 shell 字段：`codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs`（`with_updated_hook_input` / `updated_hook_command`）
- Niubash 继承实证：本机 2026-10-03（`bash -lc/-ic/--rcfile`、`niu -c/-C` 对照，见第 3 节表）
- 历史：`docs/hook-chain-commandwrap-0.4.0.md`、`.omc/specs/deep-interview-win-bash-hook-chain.md`、`.omc/specs/deep-interview-win-bash-inject-chain.md`
