import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { migrateConfig, markPlatform, getPlatformMarker, unmarkPlatform, readConfig, getPaths } from '../src/config.js';
import { withTempHome } from './helpers.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

// Neutral source markers for migration-precedence assertions, plus
// runtime-generated install timestamps. No machine paths, no models, and no
// fixed timestamps.
const sharedShell = 'shared';
const legacyShell = 'legacy';
const intermediateShell = 'intermediate';
const installedAtLegacy = new Date(Date.now() - 60_000).toISOString();
const installedAtIntermediate = new Date().toISOString();

test('migrateConfig merges legacy per-host configs into single ~/.config/win-bash/win-bash.json', () => {
  withTempHome((home) => {
    writeJson(path.join(home, '.codex', 'win-bash.json'), { shell: legacyShell });
    writeJson(path.join(home, '.claude', 'win-bash.json'), { bashPath: legacyShell, installedAt: installedAtLegacy });
    writeJson(path.join(home, '.config', 'opencode', 'win-bash.json'), { bashPath: legacyShell, installedAt: installedAtIntermediate });

    const config = migrateConfig();

    assert.equal(config.shell, legacyShell);
    assert.equal(config.platforms.codex, true);
    assert.equal(config.platforms.claude, true);
    assert.equal(config.platforms.opencode, true);
    assert.equal(config.installedAt, installedAtLegacy);

    const shared = JSON.parse(fs.readFileSync(path.join(home, '.config', 'win-bash', 'win-bash.json'), 'utf8'));
    assert.equal(shared.shell, legacyShell);
    assert.equal(fs.existsSync(path.join(home, '.codex', 'win-bash.json')), false);
    assert.equal(fs.existsSync(path.join(home, '.claude', 'win-bash.json')), false);
    assert.equal(fs.existsSync(path.join(home, '.config', 'opencode', 'win-bash.json')), false);
  });
});

test('markPlatform and unmarkPlatform record per-platform markers in the shared file', () => {
  withTempHome((home) => {
    markPlatform('claude', sharedShell);
    markPlatform('opencode', sharedShell);

    const claudeMarker = getPlatformMarker('claude');
    assert.equal(claudeMarker.installed, true);
    assert.equal(claudeMarker.shell, sharedShell);
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
    writeJson(path.join(home, '.config', 'win-bash', 'win-bash.json'), { shell: sharedShell, platforms: { claude: true } });
    writeJson(path.join(home, '.codex', 'win-bash.json'), { shell: sharedShell });

    const config = migrateConfig();
    assert.equal(config.platforms.codex, true);
    assert.equal(config.platforms.claude, true);
    assert.equal(fs.existsSync(path.join(home, '.codex', 'win-bash.json')), false);
  });
});

test('migrateConfig cleans all sources when legacy and intermediate coexist', () => {
  withTempHome((home) => {
    writeJson(path.join(home, '.claude', 'win-bash.json'), { bashPath: legacyShell, installedAt: installedAtLegacy });
    writeJson(path.join(home, '.config', 'win-bash', 'claude.json'), { bashPath: intermediateShell, installedAt: installedAtIntermediate });

    const config = migrateConfig();
    assert.equal(config.platforms.claude, true);
    assert.equal(config.shell, legacyShell, 'legacy shell should win');
    assert.equal(fs.existsSync(path.join(home, '.claude', 'win-bash.json')), false);
    assert.equal(fs.existsSync(path.join(home, '.config', 'win-bash', 'claude.json')), false);
  });
});

test('readConfig/getPaths round-trip the three *_path fields', () => {
  withTempHome((home) => {
    const cfgPath = path.join(home, '.config', 'win-bash', 'win-bash.json');
    const value = {
      shell: 'C:\\shell\\bash.exe',
      niubash_path: 'C:\\niu\\winuxcmd\\bin\\bash.exe',
      gitbash_path: 'C:\\Git\\bin\\bash.exe',
      pwsh_path: 'C:\\pwsh\\pwsh.exe',
      installedAt: new Date().toISOString(),
      platforms: { codex: true },
    };
    writeJson(cfgPath, value);

    const config = readConfig();
    assert.equal(config.shell, value.shell);
    assert.equal(config.niubash_path, value.niubash_path);
    assert.equal(config.gitbash_path, value.gitbash_path);
    assert.equal(config.pwsh_path, value.pwsh_path);

    const paths = getPaths();
    assert.equal(paths.niubash_path, value.niubash_path);
    assert.equal(paths.gitbash_path, value.gitbash_path);
    assert.equal(paths.pwsh_path, value.pwsh_path);
  });
});

test('readConfig tolerates an old config with no *_path fields', () => {
  withTempHome((home) => {
    const cfgPath = path.join(home, '.config', 'win-bash', 'win-bash.json');
    writeJson(cfgPath, { shell: 'C:\\old\\bash.exe', installedAt: new Date().toISOString(), platforms: { claude: true } });

    const config = readConfig();
    assert.equal(config.shell, 'C:\\old\\bash.exe');
    assert.equal(config.platforms.claude, true);
    const paths = getPaths();
    assert.equal(paths.niubash_path, null);
    assert.equal(paths.gitbash_path, null);
    assert.equal(paths.pwsh_path, null);
  });
});
