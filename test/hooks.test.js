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

test('hook resolves config under ~/.config/win-bash/', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes("'.config', 'win-bash', 'win-bash.json'"), 'hook CONFIG_PATH must point into ~/.config/win-bash');
  assert.ok(hook.includes('LEGACY_CONFIG_PATH'), 'hook must keep legacy fallback path');
});

test('hook resolves only winuxcmd/bin/bash.exe entries and never niu.exe', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes(String.raw`/winuxcmd[\\/]bin[\\/]bash\.exe$/i`), 'hook filter must target winuxcmd\\bin\\bash.exe');
  assert.equal(hook.includes('/niubash/i'), false, 'hook must not use the broad /niubash/i filter');
  assert.equal(hook.includes('niu.exe'), false, 'hook must not reference niu.exe');
  assert.equal(hook.includes(String.raw`F:\studio\apps\Niubash`), false, 'hook must not hardcode the F: install path');
});
