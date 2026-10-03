import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureGitInheritInit } from '../src/git-inherit.js';
import { getWinBashGitInheritInitPath } from '../src/paths.js';
import { withTempHome } from './helpers.js';

test('D1: deleting the shared init then ensuring it again self-heals (doctor restores)', () => {
  withTempHome((home) => {
    const initPath = path.join(home, '.config', 'win-bash', 'git-inherit.sh');
    const first = ensureGitInheritInit();
    assert.equal(first.ensured, true, 'first ensure creates init');
    fs.rmSync(initPath, { force: true });
    assert.equal(fs.existsSync(initPath), false, 'init deleted for the test');
    const healed = ensureGitInheritInit();
    assert.equal(healed.ensured, true, 'doctor self-heal must recreate the init');
    assert.equal(healed.reason, 'created', 'recreated reason must be created');
    assert.equal(fs.existsSync(getWinBashGitInheritInitPath()), true, 'init must exist after self-heal');
  });
});

test('D2: doctor self-heal is idempotent (re-running after heal reports exists)', () => {
  withTempHome(() => {
    ensureGitInheritInit();
    const again = ensureGitInheritInit();
    assert.equal(again.ensured, false, 'second ensure after heal must be exists');
    assert.equal(again.reason, 'exists');
  });
});
