import fs from 'node:fs';
import path from 'node:path';
import { commandExists, run } from './process.js';
import { installBash } from './niubash.js';
import { markPlatform, getPlatformMarker, unmarkPlatform } from './config.js';
import {
  getBundledClaudeSkillRoot,
  getClaudeSettingsPath,
  getClaudeSkillRoot,
  getLegacyClaudeWinBashConfigPath,
} from './paths.js';

export function applyClaudeEnv(settings, bashPath) {
  return {
    ...settings,
    env: {
      ...(settings.env || {}),
      CLAUDE_CODE_GIT_BASH_PATH: bashPath,
      CLAUDE_CODE_SHELL: bashPath,
    },
  };
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeSettings(settings) {
  const settingsPath = getClaudeSettingsPath();
  if (fs.existsSync(settingsPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(settingsPath, `${settingsPath}.bak-win-bash-${stamp}`);
  }
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

function installSkill() {
  const source = getBundledClaudeSkillRoot();
  const destination = getClaudeSkillRoot();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

export function installClaude() {
  if (process.platform !== 'win32') throw new Error('win-bash Claude support only supports Windows');
  if (!commandExists('claude')) throw new Error('claude CLI not found in PATH');

  const bashPath = installBash();
  writeSettings(applyClaudeEnv(readJson(getClaudeSettingsPath(), {}), bashPath));
  installSkill();
  markPlatform('claude', bashPath);

  console.log(`Claude Code configured for: ${bashPath}`);
  console.log(`Skill installed: ${getClaudeSkillRoot()}`);
}

export function doctorClaude() {
  if (process.platform !== 'win32') throw new Error('win-bash Claude support only supports Windows');
  if (!commandExists('claude')) throw new Error('claude CLI not found in PATH');

  const settings = readJson(getClaudeSettingsPath(), {});
  const env = settings.env || {};
  console.log(`claude: ${run('claude', ['--version'], { capture: true }).stdout.trim()}`);
  console.log(`CLAUDE_CODE_GIT_BASH_PATH: ${env.CLAUDE_CODE_GIT_BASH_PATH || 'not set'}`);
  console.log(`CLAUDE_CODE_SHELL: ${env.CLAUDE_CODE_SHELL || 'not set'}`);
  console.log(`win-bash skill: ${fs.existsSync(path.join(getClaudeSkillRoot(), 'SKILL.md')) ? 'installed' : 'missing'}`);
}

export function uninstallClaude() {
  const marker = getPlatformMarker('claude');
  const settings = readJson(getClaudeSettingsPath(), {});
  const env = { ...(settings.env || {}) };
  if (marker && env.CLAUDE_CODE_GIT_BASH_PATH === marker.shell) delete env.CLAUDE_CODE_GIT_BASH_PATH;
  if (marker && env.CLAUDE_CODE_SHELL === marker.shell) delete env.CLAUDE_CODE_SHELL;
  writeSettings({ ...settings, env });

  unmarkPlatform('claude');
  if (fs.existsSync(getLegacyClaudeWinBashConfigPath())) fs.rmSync(getLegacyClaudeWinBashConfigPath(), { force: true });
  const skillRoot = path.resolve(getClaudeSkillRoot());
  const skillsRoot = path.resolve(path.join(path.dirname(getClaudeSkillRoot()), '..', 'skills'));
  if (skillRoot.startsWith(skillsRoot) && fs.existsSync(skillRoot)) fs.rmSync(skillRoot, { recursive: true, force: true });
  console.log('win-bash Claude settings and skill removed; unrelated Claude settings preserved.');
}
