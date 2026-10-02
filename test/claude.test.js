import assert from 'node:assert/strict';
import test from 'node:test';
import { applyClaudeEnv } from '../src/claude.js';
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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('Claude install uses the Niubash -> Git Bash -> pwsh fallback chain', () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'claude.js'), 'utf8');
  assert.ok(src.includes('resolveShellForInstall'), 'installClaude must resolve via resolveShellForInstall');
  assert.ok(!src.includes('const bashPath = installBash()'), 'installClaude must not call installBash directly');
});
