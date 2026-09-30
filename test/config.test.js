import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { migrateConfig, markPlatform, getPlatformMarker, unmarkPlatform } from '../src/config.js';
import {
  SHARED_BASH_PATH,
  LEGACY_BASH_PATH,
  INTERMEDIATE_BASH_PATH,
  INSTALLED_AT_LEGACY,
  INSTALLED_AT_INTERMEDIATE,
  withTempHome,
} from './helpers.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test('migrateConfig merges legacy per-host configs into single ~/.config/win-bash/win-bash.json', () => {
  withTempHome((home) => {
    writeJson(path.join(home, '.codex', 'win-bash.json'), { shell: LEGACY_BASH_PATH });
    writeJson(path.join(home, '.claude', 'win-bash.json'), { bashPath: LEGACY_BASH_PATH, installedAt: INSTALLED_AT_LEGACY });
    writeJson(path.join(home, '.config', 'opencode', 'win-bash.json'), { bashPath: LEGACY_BASH_PATH, installedAt: INSTALLED_AT_INTERMEDIATE });

    const config = migrateConfig();

    assert.equal(config.shell, LEGACY_BASH_PATH);
    assert.equal(config.platforms.codex, true);
    assert.equal(config.platforms.claude, true);
    assert.equal(config.platforms.opencode, true);
    assert.equal(config.installedAt, INSTALLED_AT_LEGACY);

    const shared = JSON.parse(fs.readFileSync(path.join(home, '.config', 'win-bash', 'win-bash.json'), 'utf8'));
    assert.equal(shared.shell, LEGACY_BASH_PATH);
    assert.equal(fs.existsSync(path.join(home, '.codex', 'win-bash.json')), false);
    assert.equal(fs.existsSync(path.join(home, '.claude', 'win-bash.json')), false);
    assert.equal(fs.existsSync(path.join(home, '.config', 'opencode', 'win-bash.json')), false);
  });
});

test('markPlatform and unmarkPlatform record per-platform markers in the shared file', () => {
  withTempHome((home) => {
    markPlatform('claude', SHARED_BASH_PATH);
    markPlatform('opencode', SHARED_BASH_PATH);

    const claudeMarker = getPlatformMarker('claude');
    assert.equal(claudeMarker.installed, true);
    assert.equal(claudeMarker.shell, SHARED_BASH_PATH);
    assert.equal(getPlatformMarker('codex'), null);

    unmarkPlatform('claude');
    assert.equal(getPlatformMarker('claude'), null);
    assert.equal(getPlatformMarker('opencode').installed, true);

    const shared = JSON.parse(fs.readFileSync(path.join(home, '.config', 'win-bash', 'win-bash.json'), 'utf8'));
    assert.equal(shared.platforms.claude, undefined);
    assert.equal(shared.platforms.opencode, true);
  });
});

test('migrateConfig absorbs codex legacy even when shared shell already exists', () => {
  withTempHome((home) => {
    writeJson(path.join(home, '.config', 'win-bash', 'win-bash.json'), { shell: SHARED_BASH_PATH, platforms: { claude: true } });
    writeJson(path.join(home, '.codex', 'win-bash.json'), { shell: SHARED_BASH_PATH });

    const config = migrateConfig();
    assert.equal(config.platforms.codex, true);
    assert.equal(config.platforms.claude, true);
    assert.equal(fs.existsSync(path.join(home, '.codex', 'win-bash.json')), false);
  });
});

test('migrateConfig cleans all sources when legacy and intermediate coexist', () => {
  withTempHome((home) => {
    writeJson(path.join(home, '.claude', 'win-bash.json'), { bashPath: LEGACY_BASH_PATH, installedAt: INSTALLED_AT_LEGACY });
    writeJson(path.join(home, '.config', 'win-bash', 'claude.json'), { bashPath: INTERMEDIATE_BASH_PATH, installedAt: INSTALLED_AT_INTERMEDIATE });

    const config = migrateConfig();
    assert.equal(config.platforms.claude, true);
    assert.equal(config.shell, LEGACY_BASH_PATH, 'legacy shell should win');
    assert.equal(fs.existsSync(path.join(home, '.claude', 'win-bash.json')), false);
    assert.equal(fs.existsSync(path.join(home, '.config', 'win-bash', 'claude.json')), false);
  });
});
