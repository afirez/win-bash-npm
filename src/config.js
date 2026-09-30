import fs from 'node:fs';
import path from 'node:path';
import {
  getWinBashConfigPath,
  getLegacyWinBashConfigPath,
  getLegacyClaudeWinBashConfigPath,
  getClaudeWinBashIntermediateConfigPath,
  getLegacyOpencodeWinBashConfigPath,
  getOpencodeWinBashIntermediateConfigPath,
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
