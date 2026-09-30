import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runPowerShell } from './process.js';
import { getBundledPluginRoot, getLegacyWinBashConfigPath, getWinBashConfigPath, migrateConfigFile } from './paths.js';

const localAppData = process.env.LOCALAPPDATA || '';

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function configShell() {
  migrateConfigFile(getLegacyWinBashConfigPath(), getWinBashConfigPath());
  try {
    return JSON.parse(fs.readFileSync(getWinBashConfigPath(), 'utf8')).shell;
  } catch {
    return null;
  }
}

function whereBash() {
  try {
    return execFileSync('where.exe', ['bash.exe'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function resolveBashPath() {
  const candidates = [
    process.env.WIN_BASH_PATH,
    configShell(),
    'D:\\apps\\Niubash\\winuxcmd\\bin\\bash.exe',
    'D:\\apps\\Niubash\\niu.exe',
    'F:\\studio\\apps\\Niubash\\winuxcmd\\bin\\bash.exe',
    'F:\\studio\\apps\\Niubash\\niu.exe',
    localAppData ? path.join(localAppData, 'Niubash', 'winuxcmd', 'bin', 'bash.exe') : null,
    localAppData ? path.join(localAppData, 'Niubash', 'niu.exe') : null,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    ...whereBash(),
  ].filter(Boolean);
  return candidates.find(isFile) || null;
}

export function installBash() {
  const found = resolveBashPath();
  if (found) return found;
  const installer = path.join(getBundledPluginRoot(), 'scripts', 'install.ps1');
  runPowerShell(installer);
  const installed = resolveBashPath();
  if (!installed) throw new Error('Niubash installation did not produce a Bash executable');
  return installed;
}
