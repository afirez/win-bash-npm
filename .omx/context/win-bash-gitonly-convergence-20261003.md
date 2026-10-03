# Context Snapshot — win-bash Git-only command convergence

- task_slug: win-bash-gitonly-convergence
- captured: 2026-10-03
- Task: 主 shell 为 Niubash 时，最终收敛为 Niubash 继承 Git Bash 能力；Git 独有命令(awk perl gzip bzip2 unzip dash)无需特殊分流。
- Desired outcome: 简化 PreToolUse 分流逻辑，去掉/弱化 Git-only 命令的特殊处理，依赖 ~/.niubashrc 继承（Plan B）。
- Stated solution: 删除或不再依赖 GIT_ONLY_WORDS + hasGitOnlyCommand 分流分支。
- Intent hypothesis: 减少"Niubash 无 Git 时把 awk 等导去 pwsh"的边缘复杂路径；Git Bash 几乎总是存在。
- Known facts:
  - GIT_INHERIT_RC (v3) 在 ~/.niubashrc 追加 $PATH:$git/usr/bin:$git/bin:$git/cmd
  - PreToolUse 只注入 updatedInput.shell + 剥离 escape hatch，命令不加 PATH 前缀（route 模式测试才带前缀）
  - decide(): niubash 分支里 !gitBash && hasGitOnlyCommand -> pwsh -> none 分流
- Constraints: 不破坏 install/doctor/uninstall、三平台一致性、SessionStart 注入。
- Unknowns/open: 无 Git 时 Git-only 命令到底应落到哪个 shell；"不用管"=删分支还是保留但不再分流。
- Decision-boundary unknowns: 无 Git 环境(边缘)期望行为。
- Touchpoints: plugin/codex/scripts/win-bash-hook.js (GIT_ONLY_WORDS/hasGitOnlyCommand/decide/classify), test/hooks.test.js, docs/win-bash-routing.md, docs/win-bash-injection-chain.md.
- Inspected docs: docs/win-bash-routing.md, docs/win-bash-injection-chain.md, docs/hook-chain-commandwrap-0.4.0.md, AGENTS.md USER:SHELL 块.

## Round 1 user answer (2026-10-03, expanded scope)
- 主 shell 可为：niubash（继承 git bash 能力）/ git bash / pwsh，兜底 none。
- 配置：win-bash.json `shell` = 主 shell 配置；新增 `niubash_path`/`gitbash_path`/`pwsh_path` 三个显式路径字段。
- 安装时若可获取路径，把本机三个路径写入配置；字段缺失或路径不可用时保持现有动态获取。
- 现存事实(src/niubash.js): resolveBashPath()=WIN_BASH_PATH->configShell->固定目录->where(winuxcmd); resolveGitBashPath()=env->PATH->注册表->git.exe->兜底根; resolvePwshPath()=where pwsh->Program Files 兜底; resolveShellPath()=Niubash->GitBash->pwsh。
- src/config.js: win-bash.json 现有 {shell, installedAt, platforms}；migrateConfig 吸收 legacy 配置；getShell() 读 shell。
- hook resolveBash() 的 config.shell 可直接指向任意存在的 shell 文件（不限于 winuxcmd）。
