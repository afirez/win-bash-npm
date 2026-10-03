# Ultragoal Brief — Niubash Git 继承改用 BASH_ENV

Source spec: .omx/specs/deep-interview-win-bash-bash-env-inherit.md
Contracts binding: intent, non-goals, decision boundaries, acceptance criteria from that spec.

### Stories

## Story 1: 共享 init 基建 + hook rc 干净替换 + SessionStart 只读
Objective: 在 src/paths.js 新增 getWinBashGitInheritInitPath() -> ~/.config/win-bash/git-inherit.sh；共享 init 内容为动态 Git 发现 + append usr/bin:bin:cmd(幂等、POSIX 路径)。改 plugin/codex/scripts/win-bash-hook.js：ensureDefaultRc 删除所有 win-bash 继承块(循环处理堆叠 v2/v3，非仅第一个)，替换为单行 . ~/.config/win-bash/git-inherit.sh(幂等)；SessionStart 只读校验 init 存在性(缺失提示 doctor/重装，不写入)。验收: init 文件生成且幂等；堆叠 v2/v3 的 .niubashrc 替换后无内联标记残留、仅单行 source、二次运行 reason='exists'；SessionStart 不写 init。

## Story 2: 写入方 install/doctor/Claude env BASH_ENV
Objective: src/install.js 与 plugin/codex/scripts/install.ps1 在 install 时创建/确保共享 init(先建 init 再跑 hook configure)；src/claude.js applyClaudeEnv 增加 BASH_ENV=<POSIX init 路径>(与 CLAUDE_CODE_GIT_BASH_PATH/CLAUDE_CODE_SHELL 并存，保留其它 env)；src/doctor.js 自愈——检测 init 缺失补写、Claude env 缺 BASH_ENV 补写(先补 init 再补 rc/env)。验收: install 后 init 存在且 Claude settings.json env 含 POSIX 形式 BASH_ENV；doctor 删 init 后自愈补写；Claude env 其它键不受影响。

## Story 3: OpenCode 保持现状（回归验证）
Objective: 不改 src/opencode.js 注入逻辑(顶层 config 无 env 键，schema 实证)；回归验证现有 shell 键与技能安装不受破坏。验收: opencode.test.js 通过；opencode.json 仍含 shell -> Niubash。

## Story 4: 版本 bump + 测试补齐
Objective: package.json -> 0.5.0；plugin/codex/.codex-plugin/plugin.json -> 0.1.7。新增/更新测试：共享 init 幂等(A1-A3，新 test/git-inherit.test.js 或并入)；Claude applyClaudeEnv BASH_ENV POSIX 断言(B1-B2，test/claude.test.js)；hook ensureDefaultRc 堆叠 v3+v2 单行替换+幂等+SessionStart 只读(C1-C3，test/hooks.test.js 改写)；doctor 自愈(D1-D2，新 test/doctor.test.js)。验收: npm test 全绿(基线 52/52)；LSP 诊断干净。

## Story 5: 文档同步
Objective: 更新 docs/win-bash-injection-chain.md(替换 known-limitation 章节为 BASH_ENV 继承描述、Claude env 表加 BASH_ENV、三平台继承现状)、docs/win-bash-routing.md、plugin/codex/skills/win-bash/SKILL.md(替换 Known limitation 章节 -> BASH_ENV 继承说明 + Codex 显式 shell + BASH_ENV 前缀示例 + 注明 init 由 win-bash 管理勿手删)、用户级 AGENTS.md USER:SHELL 部分(补 BASH_ENV="<init>" 前缀指引，代码不写宿主 env)。验收: 文档不再声称工具驱动路径不继承；验收 1-6 描述与真机 QA 步骤可复现。
