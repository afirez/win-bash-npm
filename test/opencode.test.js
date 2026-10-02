import assert from 'node:assert/strict';
import test from 'node:test';
import { applyOpencodeConfig } from '../src/opencode.js';
import { getBashPath, withTempHome } from './helpers.js';

test('opencode config merge adds the shell path', () => {
  withTempHome(() => {
    const bashPath = getBashPath();
    const merged = applyOpencodeConfig({}, bashPath);
    assert.equal(merged.shell, bashPath);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('opencode install uses the Niubash -> Git Bash -> pwsh fallback chain', () => {
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'opencode.js'), 'utf8');
  assert.ok(src.includes('resolveShellForInstall'), 'installOpencode must resolve via resolveShellForInstall');
  assert.ok(!src.includes('const bashPath = installBash()'), 'installOpencode must not call installBash directly');
});
