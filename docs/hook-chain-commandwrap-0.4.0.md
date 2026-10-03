# win-bash Codex PreToolUse 注入逻辑存档（command-wrap 版，0.4.0）

> 存档快照：记录 0.4.0（plugin 0.1.4）在改成 `updatedInput.shell` 之前，PreToolUse 的
> command-wrap 注入全链路。此版本逻辑源码备份：
> `plugin/codex/scripts/win-bash-hook.js.bak-commandwrap-0.4.0`
> 保存时间：2026-10-03。

## 全链路（PreToolUse，command-wrap 版）

1. **触发**：Codex PreToolUse 事件，matcher
   `^(exec_command|functions\.exec_command|Bash)$`，外加 SHELL_TOOLS
   （exec_command / functions.exec_command / bash / shell）兜底。
2. **调用**：`plugin/codex/hooks/pre-tool-use-inject-win-bash.json` 用
   `node -e "<spawnSync wrapper>" "<PLUGIN_ROOT>\scripts\win-bash-hook.js" pre-tool-use`
   执行，hook payload JSON 通过 stdin 传入。
3. **输入**：`{ hook_event_name:'PreToolUse', tool_name, tool_input }`
   → `parseToolInput` → `{ command|cmd, workdir, shell?, ... }`。
4. **决策 `decide(input)`**（纯函数，`route` 子命令可复用）：
   - `WIN_BASH_SKIP=1` → `skip`（不改写，去掉标记）。
   - `WIN_BASH_SHELL=<path>` → `force`（仅当路径存在；去掉标记）。
   - 模型已显式传 `shell` → `respect`（不改写）。
   - `classify(cmd)`：
     - 原生工具作为命令出现（行首或 `; & | (` 分隔符后）→ `none`（留在宿主原生 shell）。
     - PS Verb-Noun cmdlet、cmd 内建（dir/cls/copy/del/ren/move/md/rd/type/start）、
       `.ps1/.psm1/.psd1/.bat/.cmd` 脚本 → `none`。
     - bash / POSIX 工具 / shell 脚本 / 管道与重定向 / node/npm/Windows exe /
       其余一切 → `niubash`（默认）。
   - `niubash` 分支：`resolveBash()` 解析 Niubash bash
     （`WIN_BASH_PATH` → `~/.config/win-bash/win-bash.json` 的 shell →
     候选安装路径 → PATH 里 winuxcmd 的 bash）。
     - `bareBashIsNiubash()` 为真 → 注入裸 `bash`；否则注入绝对路径。
     - 命令前缀 `export PATH="$PATH:<git dirs>"; `（Git 命令继承）。
     - 无 Niubash → 回退 Git Bash → pwsh → `none`。
5. **输出（command-wrap）**：
   - `canWrap` 为真时 `wrapInBashInvocation(shell, cmd)`
     = `` & <token> -lc '<cmd>' ``（单引号双写转义），把整个命令包成一行。
   - `finalCmd == original` → 不输出（无操作）。
   - 否则 `hookSpecificOutput = {
     hookEventName:'PreToolUse',
     permissionDecision:'allow',
     updatedInput: { ...input, command: finalCmd }
     }`，`command` 被替换为包装后的串。
   - **不注入 additionalContext**。
6. **宿主处理**：Codex 的 with_updated_hook_input 只取 `updatedInput.command`
   写入 exec 参数、丢弃 `updatedInput.shell` → 最终在宿主原生 shell 里执行
   `` & bash -lc '<cmd>' ``。

## SessionStart（未变，仍保留）

- matcher `startup|resume|clear`。
- `configure()`：解析并写入 shell 配置 + 确保 `~/.niubashrc`（含 Git 继承块）。
- 有警告时 `emitContext('SessionStart', warnings)` 注入 additionalContext
  （会话起点，安全时机，不落并行 tool_calls 批中间）。

## 路由决策实证（本机 route 输出样例）

- `git status` → `{action:niubash, shell:bash, cmd:"export PATH=...; git status"}`
- 原生工具 / PS cmdlet / cmd 内建 / .ps1 脚本 → `{action:none}`
- 显式 shell → `{action:respect}`；`WIN_BASH_SKIP` → `{action:skip}`；
  `WIN_BASH_SHELL` → `{action:force}`
- 参数位置出现原生工具名 → 不误判（仍 niubash）

## 改动去向

0.4.0 之后的版本把 PreToolUse 注入改为 `updatedInput.shell`（回到 0.3.1 风格：
设置 shell、不包装 command、不带 additionalContext）。此文档为改前基线。
