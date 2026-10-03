# Spec — win-bash 主 shell 收敛 + Git-only 分流移除

Metadata: profile=standard | rounds=3 | final_ambiguity≈0.10 | threshold=0.20 | context=brownfield
Context snapshot: .omx/context/win-bash-gitonly-convergence-20261003.md

## Intent
主 shell 收敛为一条显式链(Niubash -> Git Bash -> pwsh -> none)，Git 继承完全交给
~/.niubashrc v3 + 主 shell 能力；移除 Git-only 命令(awk/perl/gzip/bzip2/unzip/dash)
的 PreToolUse 分流补丁，因为 Git Bash 几乎总存在、Niubash 继承后这些命令本就可用。

## Desired Outcome
- win-bash.json 成为主 shell + 三条显式路径的单一来源: {shell, niubash_path, gitbash_path, pwsh_path, installedAt, platforms}。
- SessionStart(configure) 负责解析并落盘；PreToolUse 保持极简(仅 updatedInput.shell + 标记剥离)。
- 删掉 git-only 边缘分流，测试与文档同步。

## In-Scope
1. src/config.js: schema 增加 niubash_path/gitbash_path/pwsh_path；migrateConfig 保留旧字段兼容。
2. src/niubash.js: resolveBashPath/resolveGitBashPath/resolvePwshPath 优先读 config 对应 *_path(存在且 isFile 才用)，否则动态解析(现有链)。
3. hook session-start/configure: 解析三条路径 -> 写 config(策略 X: 缺失/失效才补写; shell 有效则尊重手动改); ensureDefaultRc 保留 v3。
4. hook decide(): 删除 GIT_ONLY_WORDS/hasGitOnlyCommand 与 !gitBash 分流分支; niubash 分支简化为 resolve 主 shell(链) + bareBashIsNiubash ? 'bash' : 绝对路径。
5. 主 shell 选择: config.shell 有效优先; 否则 Niubash -> Git -> pwsh -> none。
6. test/hooks.test.js: 更新/删除 `route: Git-only tools divert off Niubash when no Git Bash is available`；新增主 shell 链与写盘策略 X 的用例。
7. docs: win-bash-routing.md / win-bash-injection-chain.md / SKILL.md 同步(删 git-only 分流描述、补 *_path 字段)。

## Out-of-Scope / Non-goals
- 不改 PreToolUse 为 command-wrap 或 PATH 前缀注入(维持 updatedInput.shell-only)。
- 不为缺失 Git Bash 的极端场景做 pwsh 兜底(awk 等自然 command not found)。
- 不改三平台(claude/opencode)静态 shell 写入机制本身(它们已用 resolveShellPath 链)。
- 不新增依赖；不重写 install.ps1。

## Decision Boundaries (OMX 可自主决定，无需再确认)
- 具体 *_path 校验: 仅 isFile(路径) 判有效；pwsh 走 where.exe 结果(可能为 Store alias)直接信任。
- 写盘策略 X 的具体落法: config 有值且有效 -> 跳过；缺失/失效 -> 动态解析后补写。
- 测试命名/文档措辞细节。
- 版本号 bump 与重装流程由执行方按既有约定(0.4.x)。

## Constraints
- 兼容旧 config(仅 shell/installedAt/platforms)的读路径。
- ~/.niubashrc 升级保持 v3 追加式、幂等、不覆盖用户内容。
- PreToolUse 永不注入 additionalContext。

## Testable Acceptance Criteria
1. resolveBashPath/resolveGitBashPath/resolvePwshPath: 配置路径有效时用它; 配置缺失/失效时回退动态解析。
2. session-start 两次运行: 第二次 rc_result.reason='exists'、*_path 不重复覆盖、shell 手动值被保留(写盘策略 X)。
3. decide(): awk 等 git-only 命令不再出现 pwsh 分流; 仍按主 shell 链路由。
4. `route: Git-only tools divert off Niubash when no Git Bash is available` 删除或改写为主 shell 链断言。
5. npm test 全绿。

## Assumptions & Resolutions
- 假设: 主 shell=pwsh 时 POSIX 命令会注入 pwsh(而非 none)。=> 未最终拍板，风险低；建议按"主 shell 链路由到哪就注入哪"实现，none 仅当全链缺失。
- 假设: buildGitPathPrefix 维持现状(route/测试消费)，不接回 PreToolUse。=> 维持。

## Pressure-pass findings
- R1 假设"删除分流会破坏继承"被推翻: 继承是 rc v3 + 主 shell 能力，与 git-only 分流独立。
- R3 写盘策略: 强制全重写(Z)会抹掉手动 shell，与"用户可手动改"矛盾 -> 选定 X。

## Docs/Terminology Ledger
- Inspected: src/config.js, src/niubash.js, src/install.js, src/paths.js, docs/win-bash-routing.md, docs/win-bash-injection-chain.md, SKILL.md, AGENTS.md USER:SHELL 块。
- 术语: "主 shell"=config.shell 生效的 shell；"*_path"=本机可解析的三条候选路径。
- 冲突: 文档把 git-only 分流描述为能力保障(实际是边缘补丁) -> 需在 docs 纠正措辞。

## Handoff
默认 $ultragoal(目标化执行)。备选 $team(多lane并行)、$ralplan(如需要再评审 schema)。
