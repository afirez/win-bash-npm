import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  ensureGitInheritInit,
  getGitInheritSourceLine,
  readGitInheritTemplate,
} from '../src/git-inherit.js';
import { withTempHome } from './helpers.js';

test('A1: shared Git-inherit init discovers Git dynamically and appends Git dirs after PATH', () => {
  const content = readGitInheritTemplate();
  assert.ok(content.includes('command -v git.exe'), 'init must discover Git dynamically from PATH');
  assert.ok(content.includes('export PATH="$PATH:$__wb_git_root/usr/bin:$__wb_git_root/bin:$__wb_git_root/cmd"'),
    'init must append the Git dirs AFTER the existing PATH');
  assert.ok(content.includes('case ":$PATH:" in'), 'init must be idempotent against repeated PATH appends');
  assert.ok(content.includes('usr/bin/awk.exe'), 'init must probe for a Git command (awk)');
  assert.equal(content.includes('PROGRAMFILES/Git'), false, 'init must not hardcode a Git install root');
  assert.equal(content.charCodeAt(0), 0x23, 'init must not start with a UTF-8 BOM (# first)');
});

test('A2: ensureGitInheritInit is idempotent (create once, then exists)', () => {
  withTempHome((home) => {
    const initPath = path.join(home, '.config', 'win-bash', 'git-inherit.sh');
    const first = ensureGitInheritInit();
    assert.equal(first.ensured, true, 'first ensure must create the init');
    assert.equal(first.reason, 'created', 'first ensure reason must be created');
    assert.equal(fs.existsSync(initPath), true, 'init file must exist after first ensure');

    const second = ensureGitInheritInit();
    assert.equal(second.ensured, false, 'second ensure must not rewrite an identical init');
    assert.equal(second.reason, 'exists', 'second ensure reason must be exists');
    assert.equal(fs.readFileSync(initPath, 'utf8'), readGitInheritTemplate().replace(/\r\n/g, '\n'),
      'init content must match the canonical template');
  });
});

test('A3: source line is a single POSIX-safe reference to the shared init', () => {
  const line = getGitInheritSourceLine();
  assert.equal(line, '. "$HOME/.config/win-bash/git-inherit.sh"');
  assert.equal(line.includes('\\'), false, 'source line must not contain Windows backslashes');
  assert.equal(line.startsWith('.'), true, 'source line must be a bash source directive');
});
