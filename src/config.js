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

// Merge a legacy/intermediate per-platform config file into the unified file,
// then delete the source file. Each platform migrates at most once.
function absorb(filePath, platform, config, changed) {
  if (!filePath || config.platforms[platform]) return changed;
  const source = readJson(filePath);
  if (!source || !source.bashPath) return changed;
  if (!config.shell) config.shell = source.bashPath;
  if (!config.installedAt) config.installedAt = source.installedAt;
  config.platforms[platform] = true;
  fs.rmSync(filePath, { force: true });
  return true;
}

// Migrate all legacy per-host configs plus the v0.3.1 intermediate files into
// the single shared config at ~/.config/win-bash/win-bash.json.
export function migrateConfig() {
  let config = readJson(getWinBashConfigPath()) || {};
  config.platforms = config.platforms || {};
  let changed = false;

  // Codex legacy: ~/.codex/win-bash.json holds { shell }.
  const legacyCodex = readJson(getLegacyWinBashConfigPath());
  if (legacyCodex && legacyCodex.shell && !config.shell) {
    config.shell = legacyCodex.shell;
    config.platforms.codex = true;
    fs.rmSync(getLegacyWinBashConfigPath(), { force: true });
    changed = true;
  }

  changed = absorb(getLegacyClaudeWinBashConfigPath(), 'claude', config, changed) || changed;
  changed = absorb(getClaudeWinBashIntermediateConfigPath(), 'claude', config, changed) || changed;
  changed = absorb(getLegacyOpencodeWinBashConfigPath(), 'opencode', config, changed) || changed;
  changed = absorb(getOpencodeWinBashIntermediateConfigPath(), 'opencode', config, changed) || changed;

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
