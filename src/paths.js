import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function getPackageRoot() {
  return packageRoot;
}

export function getCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

export function getClaudeHome() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

export function getWinBashConfigDir() {
  return path.join(os.homedir(), '.config', 'win-bash');
}

export function getBundledPluginRoot() {
  return path.join(packageRoot, 'plugin', 'codex');
}

export function getBundledPluginManifest() {
  return JSON.parse(fs.readFileSync(path.join(getBundledPluginRoot(), '.codex-plugin', 'plugin.json'), 'utf8'));
}

export function getPluginVersion() {
  return getBundledPluginManifest().version;
}

export function getMarketplaceRoot() {
  return path.join(getCodexHome(), 'plugins', 'sources', 'win-bash-marketplace');
}

export function getMarketplaceManifestPath() {
  return path.join(getMarketplaceRoot(), '.agents', 'plugins', 'marketplace.json');
}

export function getInstalledPluginRoot() {
  return path.join(getMarketplaceRoot(), 'win-bash', getPluginVersion());
}

export function getWinBashConfigPath() {
  return path.join(getWinBashConfigDir(), 'win-bash.json');
}

export function getLegacyWinBashConfigPath() {
  return path.join(getCodexHome(), 'win-bash.json');
}

export function getNiubashRcPath() {
  return path.join(os.homedir(), '.niubashrc');
}

export function getClaudeSettingsPath() {
  return path.join(getClaudeHome(), 'settings.json');
}

export function getClaudeWinBashIntermediateConfigPath() {
  return path.join(getWinBashConfigDir(), 'claude.json');
}

export function getLegacyClaudeWinBashConfigPath() {
  return path.join(getClaudeHome(), 'win-bash.json');
}

export function getClaudeSkillRoot() {
  return path.join(getClaudeHome(), 'skills', 'win-bash');
}

export function getBundledClaudeSkillRoot() {
  return path.join(packageRoot, 'plugin', 'claude', 'skills', 'win-bash');
}

export function getOpencodeHome() {
  return process.env.OPENCODE_CONFIG_DIR || path.join(os.homedir(), '.config', 'opencode');
}

export function getOpencodeConfigPath() {
  return path.join(getOpencodeHome(), 'opencode.json');
}

export function getOpencodeSkillRoot() {
  return path.join(getOpencodeHome(), 'skills', 'win-bash');
}

export function getOpencodeWinBashIntermediateConfigPath() {
  return path.join(getWinBashConfigDir(), 'opencode.json');
}

export function getLegacyOpencodeWinBashConfigPath() {
  return path.join(getOpencodeHome(), 'win-bash.json');
}

export function getBundledOpencodeSkillRoot() {
  return path.join(packageRoot, 'plugin', 'opencode', 'skills', 'win-bash');
}

export function migrateConfigFile(legacyPath, currentPath) {
  if (!legacyPath || !currentPath) return { migrated: false, reason: 'invalid-path' };
  if (fs.existsSync(currentPath)) return { migrated: false, reason: 'target-exists' };
  if (!fs.existsSync(legacyPath)) return { migrated: false, reason: 'legacy-missing' };
  fs.mkdirSync(path.dirname(currentPath), { recursive: true });
  fs.renameSync(legacyPath, currentPath);
  return { migrated: true, reason: 'migrated' };
}
