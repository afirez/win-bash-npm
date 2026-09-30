import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { migrateConfig, markPlatform, getPlatformMarker, unmarkPlatform } from '../src/config.js';

function withTempHome(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'win-bash-config-'));
  const prev = {
    USERPROFILE: process.env.USERPROFILE,
    HOME: process.env.HOME,
    CODEX_HOME: process.env.CODEX_HOME,
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
    OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
  };
  process.env.USERPROFILE = dir;
  process.env.HOME = dir;
  delete process.env.CODEX_HOME;
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.OPENCODE_CONFIG_DIR;
  try {
    fn(dir);
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('migrateConfig merges legacy per-host configs into single ~/.config/win-bash/win-bash.json', () => {
  withTempHome((home) => {
    // legacy codex config under ~/.codex
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(home, '.codex', 'win-bash.json'), JSON.stringify({ shell: 'C:\\legacy\\bash.exe' }));

    // legacy claude + opencode per-host configs
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'win-bash.json'), JSON.stringify({ bashPath: 'C:\\legacy\\bash.exe', installedAt: '2026-01-01' }));
    fs.mkdirSync(path.join(home, '.config', 'opencode'), { recursive: true });
    fs.writeFileSync(path.join(home, '.config', 'opencode', 'win-bash.json'), JSON.stringify({ bashPath: 'C:\\legacy\\bash.exe', installedAt: '2026-01-02' }));

    const config = migrateConfig();

    assert.equal(config.shell, 'C:\\legacy\\bash.exe');
    assert.equal(config.platforms.codex, true);
    assert.equal(config.platforms.claude, true);
    assert.equal(config.platforms.opencode, true);
    assert.equal(config.installedAt, '2026-01-01');

    // single shared file exists; legacy files removed
    const shared = JSON.parse(fs.readFileSync(path.join(home, '.config', 'win-bash', 'win-bash.json'), 'utf8'));
    assert.equal(shared.shell, 'C:\\legacy\\bash.exe');
    assert.equal(fs.existsSync(path.join(home, '.codex', 'win-bash.json')), false);
    assert.equal(fs.existsSync(path.join(home, '.claude', 'win-bash.json')), false);
    assert.equal(fs.existsSync(path.join(home, '.config', 'opencode', 'win-bash.json')), false);
  });
});

test('markPlatform and unmarkPlatform record per-platform markers in the shared file', () => {
  withTempHome((home) => {
    markPlatform('claude', 'C:\\shared\\bash.exe');
    markPlatform('opencode', 'C:\\shared\\bash.exe');

    const claudeMarker = getPlatformMarker('claude');
    assert.equal(claudeMarker.installed, true);
    assert.equal(claudeMarker.shell, 'C:\\shared\\bash.exe');
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
    // shared file exists with shell (e.g. claude installed first) + stale codex legacy
    fs.mkdirSync(path.join(home, '.config', 'win-bash'), { recursive: true });
    fs.writeFileSync(path.join(home, '.config', 'win-bash', 'win-bash.json'), JSON.stringify({ shell: 'C:\\shared\\bash.exe', platforms: { claude: true } }));
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(home, '.codex', 'win-bash.json'), JSON.stringify({ shell: 'C:\\shared\\bash.exe' }));

    const config = migrateConfig();
    assert.equal(config.platforms.codex, true);
    assert.equal(config.platforms.claude, true);
    assert.equal(fs.existsSync(path.join(home, '.codex', 'win-bash.json')), false);
  });
});

test('migrateConfig cleans all sources when legacy and intermediate coexist', () => {
  withTempHome((home) => {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'win-bash.json'), JSON.stringify({ bashPath: 'C:\\legacy\\bash.exe', installedAt: '2026-01-01' }));
    fs.mkdirSync(path.join(home, '.config', 'win-bash'), { recursive: true });
    fs.writeFileSync(path.join(home, '.config', 'win-bash', 'claude.json'), JSON.stringify({ bashPath: 'C:\\intermediate\\bash.exe', installedAt: '2026-01-02' }));

    const config = migrateConfig();
    assert.equal(config.platforms.claude, true);
    assert.equal(config.shell, 'C:\\legacy\\bash.exe', 'legacy shell should win');
    assert.equal(fs.existsSync(path.join(home, '.claude', 'win-bash.json')), false);
    assert.equal(fs.existsSync(path.join(home, '.config', 'win-bash', 'claude.json')), false);
  });
});

