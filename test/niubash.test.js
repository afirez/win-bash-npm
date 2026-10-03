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

import path from 'node:path';
import { withTempHome } from './helpers.js';

function writeWinBashConfig(home, value) {
  const cfgPath = path.join(home, '.config', 'win-bash', 'win-bash.json');
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
  fs.writeFileSync(cfgPath, JSON.stringify(value, null, 2) + '\n');
}

test('resolveBashPath prefers a valid config.niubash_path', () => {
  withTempHome((home) => {
    const fake = path.join(home, 'fake-niubash.exe');
    fs.writeFileSync(fake, '');
    writeWinBashConfig(home, { niubash_path: fake });
    assert.equal(resolveBashPath(), fake, 'config niubash_path must win over dynamic discovery');
  });
});

test('resolveBashPath ignores an invalid config.niubash_path and falls back', () => {
  withTempHome((home) => {
    const invalid = path.join(home, 'does-not-exist.exe');
    writeWinBashConfig(home, { niubash_path: invalid });
    assert.notEqual(resolveBashPath(), invalid, 'invalid config path must be ignored');
  });
});

test('resolveGitBashPath prefers a valid config.gitbash_path', () => {
  withTempHome((home) => {
    const fake = path.join(home, 'fake-git-bash.exe');
    fs.writeFileSync(fake, '');
    writeWinBashConfig(home, { gitbash_path: fake });
    assert.equal(resolveGitBashPath(), fake, 'config gitbash_path must win');
  });
});

test('resolveGitBashPath ignores an invalid config.gitbash_path and falls back', () => {
  withTempHome((home) => {
    const invalid = path.join(home, 'does-not-exist.exe');
    writeWinBashConfig(home, { gitbash_path: invalid });
    assert.notEqual(resolveGitBashPath(), invalid, 'invalid config gitbash_path must be ignored');
  });
});

test('resolvePwshPath prefers a recorded config.pwsh_path', () => {
  withTempHome((home) => {
    writeWinBashConfig(home, { pwsh_path: 'C:\\custom\\pwsh.exe' });
    assert.equal(resolvePwshPath(), 'C:\\custom\\pwsh.exe', 'config pwsh_path must be trusted');
  });
});
