import fs from 'node:fs';
import path from 'node:path';
import { commandExists, run } from './process.js';
import { resolveShellForInstall } from './niubash.js';
import { markPlatform, getPlatformMarker, unmarkPlatform } from './config.js';
import { ensureGitInheritInit } from './git-inherit.js';
import { ensureClaudeUserShellPolicy, removeClaudeUserShellPolicy } from './user-shell-policy.js';
import {
  getBundledClaudeSkillRoot,
  getClaudeSettingsPath,
  getClaudeSkillRoot,
  getLegacyClaudeWinBashConfigPath,
  getWinBashGitInheritInitPath,
  toPosixPath,
} from './paths.js';

export function applyClaudeEnv(settings, bashPath) {
  return {
    ...settings,
    env: {
      ...(settings.env || {}),
      CLAUDE_CODE_GIT_BASH_PATH: bashPath,
      CLAUDE_CODE_SHELL: bashPath,
      // BASH_ENV must be a POSIX path: bash decodes backslashes as escapes, so
      // C:\\\\Users\\\\... would break. Points at the single shared Git-inherit
      // init, the same file .niubashrc sources one line from (R4/single source).
      BASH_ENV: toPosixPath(getWinBashGitInheritInitPath()),
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

  const bashPath = resolveShellForInstall();
  // Ensure the shared Git-inherit init BEFORE writing the env that points at it
  // (F3 order: init first, then env/rc writers reference it).
  const init = ensureGitInheritInit();
  writeSettings(applyClaudeEnv(readJson(getClaudeSettingsPath(), {}), bashPath));
  installSkill();
  ensureClaudeUserShellPolicy();
  markPlatform('claude', bashPath);

  console.log(`Claude Code configured for: ${bashPath}`);
  console.log(`Git-inherit init: ${getWinBashGitInheritInitPath()} (${init.reason})`);
  console.log(`Skill installed: ${getClaudeSkillRoot()}`);
}

export function doctorClaude() {
  if (process.platform !== 'win32') throw new Error('win-bash Claude support only supports Windows');
  if (!commandExists('claude')) throw new Error('claude CLI not found in PATH');

  // Self-heal: ensure the shared init exists, then repair BASH_ENV in the
  // Claude env when missing/stale. Init is created before the env write (F3).
  const init = ensureGitInheritInit();
  if (init.ensured) console.log(`Git-inherit init restored: ${init.path} (${init.reason})`);

  let settings = readJson(getClaudeSettingsPath(), {});
  const expectedBashEnv = toPosixPath(getWinBashGitInheritInitPath());
  if ((settings.env || {}).BASH_ENV !== expectedBashEnv) {
    const bashPath = settings.env && settings.env.CLAUDE_CODE_SHELL ? settings.env.CLAUDE_CODE_SHELL : resolveShellForInstall();
    settings = applyClaudeEnv(settings, bashPath);
    writeSettings(settings);
  }

  const env = settings.env || {};
  ensureClaudeUserShellPolicy();

  console.log(`claude: ${run('claude', ['--version'], { capture: true }).stdout.trim()}`);
  console.log(`CLAUDE_CODE_GIT_BASH_PATH: ${env.CLAUDE_CODE_GIT_BASH_PATH || 'not set'}`);
  console.log(`CLAUDE_CODE_SHELL: ${env.CLAUDE_CODE_SHELL || 'not set'}`);
  console.log(`BASH_ENV: ${env.BASH_ENV || 'not set'}`);
  console.log(`win-bash skill: ${fs.existsSync(path.join(getClaudeSkillRoot(), 'SKILL.md')) ? 'installed' : 'missing'}`);
}

export function uninstallClaude() {
  const marker = getPlatformMarker('claude');
  const settings = readJson(getClaudeSettingsPath(), {});
  const env = { ...(settings.env || {}) };
  if (marker && env.CLAUDE_CODE_GIT_BASH_PATH === marker.shell) delete env.CLAUDE_CODE_GIT_BASH_PATH;
  if (marker && env.CLAUDE_CODE_SHELL === marker.shell) delete env.CLAUDE_CODE_SHELL;
  // Remove the BASH_ENV injection pointing at the shared Git-inherit init. The
  // init file itself is left as an isolated orphan (harmless); uninstall only
  // cleans the per-platform env injection (spec acceptance 6).
  if (env.BASH_ENV === toPosixPath(getWinBashGitInheritInitPath())) delete env.BASH_ENV;
  writeSettings({ ...settings, env });

  removeClaudeUserShellPolicy();
  unmarkPlatform('claude');
  if (fs.existsSync(getLegacyClaudeWinBashConfigPath())) fs.rmSync(getLegacyClaudeWinBashConfigPath(), { force: true });
  const skillRoot = path.resolve(getClaudeSkillRoot());
  const skillsRoot = path.resolve(path.join(path.dirname(getClaudeSkillRoot()), '..', 'skills'));
  if (skillRoot.startsWith(skillsRoot) && fs.existsSync(skillRoot)) fs.rmSync(skillRoot, { recursive: true, force: true });
  console.log('win-bash Claude settings and skill removed; unrelated Claude settings preserved.');
}
