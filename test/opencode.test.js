import assert from 'node:assert/strict';
import test from 'node:test';
import { applyOpencodeConfig } from '../src/opencode.js';

test('opencode config merge preserves unrelated settings and adds shell', () => {
  const config = {
    model: 'opencode/mimo-v2.6-flash-free',
    plugin: ['oh-my-openagent@latest'],
    agents: { architect: { model: 'opencode-go/deepseek-v4.1-flash' } },
  };
  const merged = applyOpencodeConfig(config, 'F:\\studio\\apps\\Niubash\\winuxcmd\\bin\\bash.exe');
  assert.equal(merged.model, 'opencode/mimo-v2.6-flash-free');
  assert.deepEqual(merged.plugin, ['oh-my-openagent@latest']);
  assert.deepEqual(merged.agents.architect, { model: 'opencode-go/deepseek-v4.1-flash' });
  assert.equal(merged.shell, 'F:\\studio\\apps\\Niubash\\winuxcmd\\bin\\bash.exe');
});
