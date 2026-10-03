# Ralplan — Planner revision after Architect ITERATE

Date: 2026-10-03 | Revision: rev2 | Based on .omx/plans/ralplan-architect-review.md

## Applied findings

### F1 [must-fix] -> W1 revised
`ensureDefaultRc()` 的清理改为**删除所有** win-bash 继承块（循环处理堆叠的 v2/v3，正则
匹配 `# win-bash: inherit standard Git Bash commands` header 到 `^unset __wb_` terminator
的所有出现，而非只替换第一个），然后替换为单行 `. ~/.config/win-bash/git-inherit.sh`。
测试 C1 改用 **v3+v2 堆叠**真实形态（本机 ~/.niubashrc 实证形态）断言：无 v2/v3 内联标记残留、
只有单行 source、幂等（二次运行 reason='exists'）。

### F2 [must-fix] -> W2 revised
Claude env 注入的 `BASH_ENV` 值必须为 **POSIX 形式**（`/c/Users/.../git-inherit.sh` 或
正斜杠），不能是 Windows 反斜杠（bash 内部读取文件路径，反斜杠会被吃）。`applyClaudeEnv`
对 BASH_ENV 值做 POSIX 转换（复用/抽取 toPosixPath）。测试 B1 断言 env.BASH_ENV 为 POSIX 形态。

### F3 [ordering] -> W1/W2 revised
共享 init 创建必须先于任何 `ensureDefaultRc()` 写 source 行（install.ps1 先建 init 再跑
hook configure；doctor 自愈先补 init 再补 rc/env）。实现顺序在代码注释与测试中明确。

## Revised W1 (final)
- src/paths.js: getWinBashGitInheritInitPath()
- 共享 init 内容（动态 Git 发现 + append usr/bin:bin:cmd，幂等，POSIX 路径）
- win-bash-hook.js:
  - ensureDefaultRc 删除所有继承块 -> 单行 source（幂等）
  - SessionStart 只读校验 init 存在性
  - install.ps1/install.js: 先建 init，再跑 configure

## Revised W2 (final)
- src/claude.js applyClaudeEnv: BASH_ENV=<POSIX init path> + 保留 CLAUDE_CODE_*
- src/install.js/install.ps1 + src/doctor.js: 确保 init 存在（自愈）且 Claude env 含 BASH_ENV
- 顺序保证：init 先于 rc/env 写入

## Revised test spec
- C1: v3+v2 堆叠 -> 单行 source，无残留，幂等
- B1: env.BASH_ENV 为 POSIX 路径（非反斜杠）
- D1/D2: doctor 自愈（init + Claude env）
- A1-A3: 共享 init 幂等
