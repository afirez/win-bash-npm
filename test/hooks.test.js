import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { getBundledPluginRoot, getPluginVersion } from '../src/paths.js';

test('bundled Codex plugin version is fixed', () => {
  assert.match(getPluginVersion(), /^\d+\.\d+\.\d+$/);
});

test('PreToolUse hook never injects additionalContext', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.equal(hook.includes("emitContext('PreToolUse'"), false);
  assert.equal(hook.includes('additionalContext: `win-bash set exec_command.shell'), false);
});
