import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { applyClaudeEnv, doctorClaude } from '../src/claude.js';
import { ensureGitInheritInit } from '../src/git-inherit.js';
import { getWinBashGitInheritInitPath, toPosixPath } from '../src/paths.js';
import { getBashPath, withTempHome } from './helpers.js';

test('Claude env merge injects the bash shell vars without touching other env', () => {
  withTempHome(() => {
    const bashPath = getBashPath();
    const settings = { env: { UNRELATED_ENV: '1', CLAUDE_CODE_SHELL: 'old' } };
    const merged = applyClaudeEnv(settings, bashPath);
    assert.equal(merged.env.UNRELATED_ENV, '1');
    assert.equal(merged.env.CLAUDE_CODE_GIT_BASH_PATH, merged.env.CLAUDE_CODE_SHELL);
    assert.equal(merged.env.CLAUDE_CODE_SHELL, bashPath);
  });
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('Claude install uses the Niubash -> Git Bash -> pwsh fallback chain', () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'claude.js'), 'utf8');
  assert.ok(src.includes('resolveShellForInstall'), 'installClaude must resolve via resolveShellForInstall');
  assert.ok(!src.includes('const bashPath = installBash()'), 'installClaude must not call installBash directly');
});

test('B1: applyClaudeEnv injects BASH_ENV as a POSIX path pointing at the shared init', () => {
  withTempHome(() => {
    const bashPath = getBashPath();
    const merged = applyClaudeEnv({ env: { UNRELATED: '1' } }, bashPath);
    const expected = toPosixPath(getWinBashGitInheritInitPath());
    assert.equal(merged.env.BASH_ENV, expected, 'BASH_ENV must be the POSIX form of the shared init path');
    assert.ok(/^\/[a-z]\//.test(merged.env.BASH_ENV), 'BASH_ENV must start with a lowercase /<drive>/ POSIX prefix');
    assert.equal(merged.env.BASH_ENV.includes('\\'), false, 'BASH_ENV must not contain backslashes');
    assert.equal(merged.env.UNRELATED, '1', 'other env keys must be preserved');
  });
});

test('B2: install/doctor ensure the shared Git-inherit init exists before env write', () => {
  withTempHome(() => {
    const init = ensureGitInheritInit();
    assert.equal(init.ensured, true);
    assert.equal(fs.existsSync(getWinBashGitInheritInitPath()), true, 'init must exist after ensure');
  });
});
