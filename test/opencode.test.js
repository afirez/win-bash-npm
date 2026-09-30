import assert from 'node:assert/strict';
import test from 'node:test';
import { applyOpencodeConfig } from '../src/opencode.js';
import { BASH_PATH, MODEL_OPENCODE, MODEL_ARCHITECT } from './helpers.js';

test('opencode config merge preserves unrelated settings and adds shell', () => {
  const config = {
    model: MODEL_OPENCODE,
    plugin: ['oh-my-openagent@latest'],
    agents: { architect: { model: MODEL_ARCHITECT } },
  };
  const merged = applyOpencodeConfig(config, BASH_PATH);
  assert.equal(merged.model, MODEL_OPENCODE);
  assert.deepEqual(merged.plugin, ['oh-my-openagent@latest']);
  assert.deepEqual(merged.agents.architect, { model: MODEL_ARCHITECT });
  assert.equal(merged.shell, BASH_PATH);
});
