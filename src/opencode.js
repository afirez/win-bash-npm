import fs from 'node:fs';
import path from 'node:path';
import { commandExists, run } from './process.js';
import { installBash } from './niubash.js';
import {
  getBundledOpencodeSkillRoot,
  getOpencodeConfigPath,
  getOpencodeSkillRoot,
  getOpencodeWinBashConfigPath,
} from './paths.js';

export function applyOpencodeConfig(config, bashPath) {
  return { ...config, shell: bashPath };
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeConfig(config) {
  const configPath = getOpencodeConfigPath();
  if (fs.existsSync(configPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(configPath, `${configPath}.bak-win-bash-${stamp}`);
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function installSkill() {
  const source = getBundledOpencodeSkillRoot();
  const destination = getOpencodeSkillRoot();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

export function installOpencode() {
  if (process.platform !== 'win32') throw new Error('win-bash opencode support only supports Windows');
  if (!commandExists('opencode')) throw new Error('opencode CLI not found in PATH');

  const bashPath = installBash();
  writeConfig(applyOpencodeConfig(readJson(getOpencodeConfigPath(), {}), bashPath));
  installSkill();
  fs.mkdirSync(path.dirname(getOpencodeWinBashConfigPath()), { recursive: true });
  fs.writeFileSync(getOpencodeWinBashConfigPath(), `${JSON.stringify({ bashPath, installedAt: new Date().toISOString() }, null, 2)}\n`);

  console.log(`opencode configured for: ${bashPath}`);
  console.log(`Skill installed: ${getOpencodeSkillRoot()}`);
}

export function doctorOpencode() {
  if (process.platform !== 'win32') throw new Error('win-bash opencode support only supports Windows');
  if (!commandExists('opencode')) throw new Error('opencode CLI not found in PATH');

  const config = readJson(getOpencodeConfigPath(), {});
  console.log(`opencode: ${run('opencode', ['--version'], { capture: true, shell: true }).stdout.trim()}`);
  console.log(`shell config: ${config.shell || 'not set'}`);
  console.log(`OPENCODE_GIT_BASH_PATH: ${process.env.OPENCODE_GIT_BASH_PATH || 'not set'}`);
  console.log(`win-bash skill: ${fs.existsSync(path.join(getOpencodeSkillRoot(), 'SKILL.md')) ? 'installed' : 'missing'}`);
}

export function uninstallOpencode() {
  const marker = readJson(getOpencodeWinBashConfigPath(), null);
  const config = readJson(getOpencodeConfigPath(), {});
  if (marker && config.shell === marker.bashPath) {
    const { shell, ...rest } = config;
    writeConfig(rest);
  }

  if (fs.existsSync(getOpencodeWinBashConfigPath())) fs.rmSync(getOpencodeWinBashConfigPath(), { force: true });
  const skillRoot = path.resolve(getOpencodeSkillRoot());
  const skillsRoot = path.resolve(path.join(path.dirname(getOpencodeSkillRoot()), '..', 'skills'));
  if (skillRoot.startsWith(skillsRoot) && fs.existsSync(skillRoot)) fs.rmSync(skillRoot, { recursive: true, force: true });
  console.log('win-bash opencode settings and skill removed; unrelated opencode settings preserved.');
}
