import assert from 'node:assert/strict';
import test from 'node:test';
import { applyClaudeEnv } from '../src/claude.js';

test('Claude env merge preserves unrelated settings', () => {
  const settings = {
    model: 'deepseek',
    env: { EXISTING_VALUE: '1', CLAUDE_CODE_SHELL: 'old' },
  };
  const merged = applyClaudeEnv(settings, 'F:\\studio\\apps\\Niubash\\winuxcmd\\bin\\bash.exe');
  assert.equal(merged.model, 'deepseek');
  assert.equal(merged.env.EXISTING_VALUE, '1');
  assert.equal(merged.env.CLAUDE_CODE_GIT_BASH_PATH, merged.env.CLAUDE_CODE_SHELL);
});
