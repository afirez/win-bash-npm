import assert from 'node:assert/strict';
import test from 'node:test';
import { applyClaudeEnv } from '../src/claude.js';
import { BASH_PATH, MODEL_CLAUDE } from './helpers.js';

test('Claude env merge preserves unrelated settings', () => {
  const settings = {
    model: MODEL_CLAUDE,
    env: { EXISTING_VALUE: '1', CLAUDE_CODE_SHELL: 'old' },
  };
  const merged = applyClaudeEnv(settings, BASH_PATH);
  assert.equal(merged.model, MODEL_CLAUDE);
  assert.equal(merged.env.EXISTING_VALUE, '1');
  assert.equal(merged.env.CLAUDE_CODE_GIT_BASH_PATH, merged.env.CLAUDE_CODE_SHELL);
});
