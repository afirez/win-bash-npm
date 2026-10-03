import fs from 'node:fs';
import path from 'node:path';
import {
  getWinBashConfigPath,
  getLegacyWinBashConfigPath,
  getLegacyClaudeWinBashConfigPath,
  getClaudeWinBashIntermediateConfigPath,
  getLegacyOpencodeWinBashConfigPath,
  getOpencodeWinBashIntermediateConfigPath,
  getClaudeSettingsPath,
  getOpencodeConfigPath,
} from './paths.js';

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(getWinBashConfigPath()), { recursive: true });
  fs.writeFileSync(getWinBashConfigPath(), `${JSON.stringify(config, null, 2)}\n`);
  if (config.shell) syncShellToPlatforms(config.shell);
}

// All per-platform legacy/intermediate locations that must be absorbed into the
// single shared file. Order matters: earlier files win when shell is absent.
const PLATFORM_SOURCES = {
  codex: [getLegacyWinBashConfigPath],
  claude: [getLegacyClaudeWinBashConfigPath, getClaudeWinBashIntermediateConfigPath],
  opencode: [getLegacyOpencodeWinBashConfigPath, getOpencodeWinBashIntermediateConfigPath],
};

// Migrate every legacy per-host config plus the v0.3.1 intermediate files into
// the single shared config at ~/.config/win-bash/win-bash.json, then remove the
// source files. Idempotent and safe on repeated runs.
export function migrateConfig() {
  let config = readJson(getWinBashConfigPath()) || {};
  config.platforms = config.platforms || {};
  let changed = false;

  for (const [platform, sourceGetters] of Object.entries(PLATFORM_SOURCES)) {
    const sources = sourceGetters.map((getter) => getter());
    if (!config.platforms[platform]) {
      for (const source of sources) {
        const file = readJson(source);
        if (!file) continue;
        if (!config.shell) config.shell = file.shell || file.bashPath || null;
        if (!config.installedAt) config.installedAt = file.installedAt || null;
        if (config.shell || config.installedAt) {
          config.platforms[platform] = true;
          break;
        }
      }
    }
    for (const source of sources) {
      if (fs.existsSync(source)) {
        fs.rmSync(source, { force: true });
        changed = true;
      }
    }
  }

  if (changed) writeConfig(config);
  return config;
}

export function readConfig() {
  return migrateConfig();
}

export function getShell() {
  return readConfig().shell || null;
}

// Read the three explicit shell-candidate paths recorded by the hook configure
// step (strategy X): niubash_path / gitbash_path / pwsh_path. Each is null when
// absent. readConfig() already round-trips them (writeConfig persists the whole
// config object), so this is just a typed accessor.
export function getPaths() {
  const config = readConfig();
  return {
    niubash_path: typeof config.niubash_path === "string" ? config.niubash_path : null,
    gitbash_path: typeof config.gitbash_path === "string" ? config.gitbash_path : null,
    pwsh_path: typeof config.pwsh_path === "string" ? config.pwsh_path : null,
  };
}

export function markPlatform(platform, bashPath) {
  const config = readConfig();
  config.shell = bashPath;
  config.installedAt = new Date().toISOString();
  config.platforms[platform] = true;
  writeConfig(config);
}

export function unmarkPlatform(platform) {
  const config = readConfig();
  delete config.platforms[platform];
  writeConfig(config);
}

// Returns { shell, installedAt, installed } for a platform, or null when the
// platform has never been recorded by this installer.
export function getPlatformMarker(platform) {
  const config = readConfig();
  if (!config.platforms[platform]) return null;
  return { shell: config.shell, installedAt: config.installedAt, installed: true };
}

/** Sync the primary shell to Claude (CLAUDE_CODE_SHELL) and OpenCode (shell) configs. */
export function syncShellToPlatforms(bashPath) {
  const results = [];
  // Claude
  try {
    const settingsPath = getClaudeSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings.env && settings.env.CLAUDE_CODE_SHELL && settings.env.CLAUDE_CODE_SHELL !== bashPath) {
        settings.env.CLAUDE_CODE_SHELL = bashPath;
        settings.env.CLAUDE_CODE_GIT_BASH_PATH = bashPath;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + String.fromCharCode(10));
        results.push({ platform: 'claude', updated: true });
      }
    }
  } catch {}
  // OpenCode
  try {
    const configPath = getOpencodeConfigPath();
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.shell && config.shell !== bashPath) {
        config.shell = bashPath;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + String.fromCharCode(10));
        results.push({ platform: 'opencode', updated: true });
      }
    }
  } catch {}
  return results;
}
