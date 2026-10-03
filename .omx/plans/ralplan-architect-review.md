# Ralplan — Architect lane review (main-lane substitution, see .omx/plans/ralplan-review-substitution.md)

Date: 2026-10-03 | Verdict: **ITERATE**（2 处必改 + 1 处建议，均映射到 W 步骤）

## Steelman antithesis（最强反向观点）
"共享 init + BASH_ENV" 引入了第三个 Git 继承载体（init 文件），而系统里已经有两个
（.niubashrc 内联块、PreToolUse decide() 的 buildGitPathPrefix route 输出）。最反方的设计
是把 Git 继承彻底只放在一个地方，且不新增任何文件——即直接给 `bash` 加 BASH_ENV 到
Windows 用户级环境变量（全局一次生效，Codex/Claude/OpenCode 全受益，无文件、无 rc 改动）。
这个观点有道理（少一个载体、无版本/重装负担），但被否决：全局用户环境变量是进程级副作用，
影响所有 bash 会话（非 win-bash 作用域），且用户已明确"不做全局环境变量注入"。共享 init
的取舍是"作用域可控（~/.config/win-bash/ 下）+ 可被 install/doctor 管理 + 不污染全局"，这是
对全局方案的严格改进，不是退化。抗辩不成立。

## 真实 tradeoff tension
**非交互继承（BASH_ENV）vs 交互 REPL 继承（.niubashrc）共用一份 init 的"双源一致性"张力**：
单一 init 是本次的核心收益（R3/R8 决策），但代价是 `.niubashrc` 不再是自包含的——如果用户
删掉 init 或换机迁移 .niubashrc，交互 REPL 会静默失去继承。缓解：doctor 自愈 + SessionStart
只读校验提示 + 幂等创建，使 init 生命周期被管理、不会被静默破坏。张力可接受，但必须在文档
里写明"init 由 win-bash 管理，勿手删"。

## Findings（按 PRD W 步骤映射）

### F1 [必改] W1 — swapGitInheritBlock 只替换第一个块，堆叠 v2 会残留
代码事实：`swapGitInheritBlock()` 找到**第一个** `# win-bash: inherit standard Git Bash commands`
header 和**第一个** `^unset __wb_` terminator，替换区间 [start..end]。本机实证 `.niubashrc`
现为 **v3 块 + v2 块堆叠**（2 个 header、2 个 unset），因此该函数只替换 v3，v2 遗留会保留。
而 R8/验收 5 要求"删 v2/v3 内联块 → 单行 source"。=> **必须在 W1 把 ensureDefaultRc 的清理改为
循环/正则删除所有 win-bash 继承块（含堆叠），再替换为单行 source**；测试 C1 必须用
"v3+v2 堆叠"真实形态断言（现有 hooks.test.js 只测单 v2→v3，覆盖不足）。
位置：win-bash-hook.js swapGitInheritBlock/ensureDefaultRc；本机 ~/.niubashrc。

### F2 [必改] W2 — BASH_ENV 值必须是 POSIX 路径（/c/... 或正斜杠），不能用 Windows 反斜杠
spec/context 已实证"Windows 路径反斜杠会被 bash 吃（需转 POSIX 形式）"。Claude env 注入的
BASH_ENV 值如果直接写 `C:\Users\...\git-inherit.sh`，非交互 bash 读取时反斜杠转义会破坏路径。
而 `applyClaudeEnv` 现有的 CLAUDE_CODE_* 值就是 Windows 反斜杠形式（bash 命令行 shell 参数可吃，
但 BASH_ENV 是 bash **内部读取的文件路径**，语义不同）。=> **W2 必须对 BASH_ENV 值做 POSIX 转换**
（复用/抽取 toPosixPath 逻辑；`/c/Users/.../git-inherit.sh` 或正斜杠）；测试 B1 应断言值为
POSIX 形态，不是 Windows 反斜杠。

### F3 [建议] W1/W2 — 创建顺序：共享 init 必须先于 ensureDefaultRc 的 source 行
install.ps1 现在先 `node $hook configure`（内部 ensureDefaultRc 会 append source 行）。若
W2 改为 ensureDefaultRc 写 `. ~/.config/win-bash/git-inherit.sh`，而 init 尚未创建，交互 REPL
会 source 一个缺失文件（bash 报 stderr 但不致命）。=> **W1/W2 实现顺序应为：先创建共享 init
（幂等），再运行 hook configure/ensureDefaultRc**。doctor 自愈同理（先补 init 再补 rc/env）。
建议不阻塞，按实现顺序保证即可。

## Synthesis
方向正确、约束守约（不破坏三平台一致性、不改 PreToolUse、无全局注入、无逃生口）。三处
发现中 F1/F2 是**正确性必改**（否则验收 4/5/1 会失败），F3 是实现顺序问题。修完 F1/F2、
落实 F3 后即可 APPROVE。架构无颠覆性问题。
