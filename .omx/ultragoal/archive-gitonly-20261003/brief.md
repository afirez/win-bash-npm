# Ultragoal Brief — win-bash 主 shell 收敛 + Git-only 分流移除

Source spec: .omx/specs/deep-interview-win-bash-gitonly-convergence.md
Contracts binding: intent, non-goals, decision boundaries, acceptance criteria from that spec.

### Stories

## Story 1: config schema 增加三条 *_path 字段
Objective: 在 src/config.js 的 win-bash.json 读写层支持 niubash_path/gitbash_path/pwsh_path：readConfig 透传新字段，writeConfig 保留，migrateConfig 兼容旧字段(shell/installedAt/platforms)不破坏；getShell 语义不变。验收: 写读往返保留三条字段；旧 config 读取不报错。

## Story 2: 路径解析优先读 config *_path
Objective: 在 src/niubash.js 的 resolveBashPath/resolveGitBashPath/resolvePwshPath 各自优先读 config 对应 *_path(存在且 isFile 才用)，否则回退现有动态链；resolveShellPath 链不变。验收: 配置路径有效时用它，缺失/失效时走动态解析；现有 niubash.test.js 通过。

## Story 3: hook configure 按策略 X 落盘三条路径
Objective: 改 plugin/codex/scripts/win-bash-hook.js 的 configure()/writeConfig：解析 niubash/git/pwsh 三路径，缺失或失效才补写对应 *_path；shell 已存在且有效则尊重(保留手动改)；ensureDefaultRc 保持 v3 幂等。验收: session-start 两次运行第二次 rc_result.reason='exists'、*_path 不重复覆盖、手动 shell 被保留。

## Story 4: 删除 git-only 分流分支
Objective: 删除 hook 中 GIT_ONLY_WORDS/hasGitOnlyCommand 及 decide() niubash 分支里 !gitBash && hasGitOnlyCommand 的 pwsh 分流；niubash 分支简化为主 shell 链 + bareBashIsNiubash?'bash':绝对路径；不注入 additionalContext。验收: awk/perl/gzip 不再导去 pwsh；主 shell 链路由不变；PreToolUse 只注入 updatedInput.shell + 标记剥离。

## Story 5: 测试与文档同步
Objective: 更新 test/hooks.test.js(删除或改写 `route: Git-only tools divert off Niubash when no Git Bash is available`，新增主 shell 链与写盘策略 X 用例)；同步 docs/win-bash-routing.md、docs/win-bash-injection-chain.md、SKILL.md(删 git-only 分流描述、补 *_path 字段)。验收: npm test 全绿；文档不再把 git-only 分流描述为能力保障。
