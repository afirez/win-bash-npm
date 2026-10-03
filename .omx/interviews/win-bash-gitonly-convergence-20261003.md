# Deep-Interview Transcript — win-bash Git-only convergence (2026-10-03)

Profile: standard (default) | Context: brownfield | Final ambiguity: ~0.10

## Rounds
- R1 (Scope): 收敛方向 —— git 独有命令(awk/perl/gzip/bzip2/unzip/dash)是否删除分流。
  用户: 主 shell 可为 niubash(继承 git bash 能力)/ git bash / pwsh，兜底 none。
- R2 (Scope): shell 主 shell 由谁定？用户: A（固定链 Niubash->Git->pwsh->none 自动解析），且用户可手动改 shell 覆盖。
  附带: PreToolUse 只注入 updatedInput.shell + escape-hatch 剥离，聚焦 SessionStart 实现。
- R3 (Decision Boundaries): SessionStart 写盘策略 X/Y/Z。用户: X（只补写缺失/失效，不覆盖手动配置）。

## Confirmed decisions
- 主 shell 链: Niubash -> Git Bash -> pwsh -> none；shell 字段可被用户手动覆盖。
- win-bash.json 增加 niubash_path / gitbash_path / pwsh_path；安装时能解析则写入，缺失/失效回退动态解析。
- 写盘策略: X —— 只在缺失或路径失效时补写；shell 存在且有效则尊重(保留手动改)。
- 删除 GIT_ONLY_WORDS / hasGitOnlyCommand 及 decide() 里 !gitBash 的分流分支；同步删/改对应测试。
- PreToolUse 保持极简: 只注入 updatedInput.shell + escape-hatch 标记剥离，不注入 PATH 前缀/additionalContext。
- 继承机制: ~/.niubashrc GIT_INHERIT_RC v3 (追加式) 为主；buildGitPathPrefix 在 PreToolUse 实际不应用，仅 route/测试消费。

## Facts answered in-session
- GIT_ONLY_WORDS/hasGitOnlyCommand: 只做"无 Git Bash"边缘的 pwsh 分流补丁，与继承无关。
- Niubash 继承 Git 的机制: ① ~/.niubashrc GIT_INHERIT_RC v3(交互/REPL 加载, 追加式)；② buildGitPathPrefix 每命令前缀(PreToolUse 实际不应用, 仅 route/测试)。
- 删除 git-only 分流不影响继承。
