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
