import assert from 'node:assert/strict';
import test from 'node:test';
import { isWinuxBashPath } from '../src/niubash.js';

test('isWinuxBashPath matches only winuxcmd/bin/bash.exe entries', () => {
  assert.equal(isWinuxBashPath('F:\\studio\\apps\\Niubash\\winuxcmd\\bin\\bash.exe'), true);
  assert.equal(isWinuxBashPath('D:\\apps\\Niubash\\winuxcmd\\bin\\bash.exe'), true);
  assert.equal(isWinuxBashPath('C:\\anywhere\\mybash\\winuxcmd\\bin\\bash.exe'), true, 'install root must be irrelevant');
  assert.equal(isWinuxBashPath('F:\\studio\\apps\\Niubash\\winuxcmd\\usr\\bin\\bash.exe'), false, 'usr\\bin is not the shell entry');
  assert.equal(isWinuxBashPath('F:\\studio\\apps\\Niubash\\winuxcmd\\bin\\niu.exe'), false, 'never niu.exe');
  assert.equal(isWinuxBashPath('F:\\studio\\apps\\Niubash\\winuxcmd\\bin\\bash.exe.old'), false, 'suffix must be anchored');
  assert.equal(isWinuxBashPath('C:\\Windows\\System32\\bash.exe'), false, 'WSL/other bash excluded');
});

import fs from 'node:fs';
import { resolveBashPath, resolveGitBashPath, resolvePwshPath, resolveShellPath } from '../src/niubash.js';

test('resolveShellPath prefers Niubash when a Niubash bash is present', () => {
  const niubash = resolveBashPath();
  if (!niubash) return; // skip on hosts without Niubash
  assert.equal(resolveShellPath(), niubash);
});

test('resolveGitBashPath returns the standard Git for Windows bash when installed', () => {
  const expected = 'C:\\Program Files\\Git\\bin\\bash.exe';
  if (!fs.existsSync(expected)) return; // skip on hosts without Git for Windows
  assert.equal(resolveGitBashPath(), expected);
});

test('resolvePwshPath returns a runnable pwsh path or null', () => {
  const pwsh = resolvePwshPath();
  assert.ok(pwsh === null || pwsh.length > 0, 'pwsh must resolve to a path or null');
});
