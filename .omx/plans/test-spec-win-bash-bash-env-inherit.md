# Test Spec — Niubash Git 继承改用 BASH_ENV

Companion: `.omx/plans/prd-win-bash-bash-env-inherit.md` | Date: 2026-10-03

## Unit tests（node --test test/*.test.js）

### A. 共享 init 幂等（新 `test/git-inherit.test.js` 或并入 niubash.test.js）
- A1: init 内容含动态 Git 发现（command -v git）与 append `usr/bin:bin:cmd`。
- A2: 连续 source 两次，PATH 中 Git dirs 只出现一次（case ":$PATH:" 守卫）。
- A3: 无 Git 时 source 不报错、PATH 不变。

### B. Claude env BASH_ENV（test/claude.test.js 扩展）
- B1: `applyClaudeEnv(settings, bashPath)` 产出 env 含 `BASH_ENV=<shared-init>` 且保留其它 env。
- B2: install/doctor 确保共享 init 存在（存在性断言）。

### C. hook ensureDefaultRc 干净替换（test/hooks.test.js 改写）
- C1: 已有 v3+v2 双内联块的 `.niubashrc` → 替换为单行 `. ~/.config/win-bash/git-inherit.sh`，
  无 `win-bash-git-inherit-v2/v3` 内联标记残留。
- C2: 无内联块但已有该 source 行 → `reason:'exists'` 幂等。
- C3: SessionStart 对缺失共享 init 输出只读提示（不写 init）。

### D. doctor 自愈（新 test/doctor.test.js）
- D1: 删共享 init → doctor 补写（存在性断言）。
- D2: Claude env 缺失 BASH_ENV → doctor 补写（读 settings.json env）。

## 回归保障
- 现有 hooks.test.js / niubash.test.js / config.test.js / opencode.test.js / claude.test.js 全绿（基线 52/52）。
- 特别：`route:` 系列不改动断言（PreToolUse 行为不变）；`configure strategy X` 保留。

## 真机手动 QA（验收 1-6）
1. Claude settings.json env 含 BASH_ENV；`<niu> bash -lc 'awk --version'` → Git usr/bin。
2. `.niubashrc` 只剩单行 source；`niu -C` REPL awk 正常。
3. 共享 init 重复 source 无重复 Git dirs。
4. 删 init → `win-bash doctor` 补写。
5. Codex 显式 shell + `BASH_ENV="<init>"` 前缀取到 awk。
6. 重装插件到 0.1.7 并重启会话。
