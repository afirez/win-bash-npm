import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runPowerShell } from './process.js';
import { getShell, getPaths } from './config.js';
import { getBundledPluginRoot } from './paths.js';

const localAppData = process.env.LOCALAPPDATA || '';

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function configShell() {
  return getShell();
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

// A Niubash Bash must always be *\winuxcmd\bin\bash.exe: never niu.exe, never
// the usr\bin variant, and never anchored to a specific install root.
export function isWinuxBashPath(value) {
  return /winuxcmd[\\/]bin[\\/]bash\.exe$/i.test(value);
}

export function resolveBashPath() {
  // config.shell (manual main shell) wins, then a recorded niubash_path, then
  // dynamic discovery. Both config values are only used when they still exist.
  const candidates = [
    process.env.WIN_BASH_PATH,
    configShell(),
    getPaths().niubash_path,
    'D:\\apps\\Niubash\\winuxcmd\\bin\\bash.exe',
    localAppData ? path.join(localAppData, 'Niubash', 'winuxcmd', 'bin', 'bash.exe') : null,
    ...whereBash().filter(isWinuxBashPath),
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

// Standard Git for Windows install roots, used only as a last-resort fallback
// when no Git Bash is found dynamically (PATH/registry/git.exe).
const GIT_FALLBACK_ROOTS = [
  'C:\\Program Files\\Git',
  'C:\\Program Files (x86)\\Git',
  localAppData ? path.join(localAppData, 'Programs', 'Git') : null,
].filter(Boolean);

function gitRegistryInstallPath() {
  try {
    const out = execFileSync('reg.exe', ['query', 'HKLM\\SOFTWARE\\GitForWindows', '/v', 'InstallPath'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const match = String(out).match(/InstallPath\s+REG_SZ\s+(.+)/i);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function whereGitRoots() {
  try {
    const out = execFileSync('where.exe', ['git.exe'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const roots = [];
    for (const line of String(out).split(/\r?\n/)) {
      const match = line.trim().match(/^(.*)[\\/](?:cmd|bin)[\\/]git\.exe$/i);
      if (match) roots.push(match[1]);
    }
    return roots;
  } catch {
    return [];
  }
}

// Resolve the standard Git Bash, never Niubash. Dynamic sources first (env
// override, bash.exe on PATH under a Git root, Git for Windows registry, then
// git.exe on PATH), with the common install roots as a last-resort fallback.
export function resolveGitBashPath() {
  const configuredGit = getPaths().gitbash_path;
  if (configuredGit && isFile(configuredGit) && !isWinuxBashPath(configuredGit)) return configuredGit;
  const candidates = [];
  if (process.env.OMO_CODEX_GIT_BASH_PATH) candidates.push(process.env.OMO_CODEX_GIT_BASH_PATH);
  candidates.push(...whereBash().filter((value) => /git[\\/]bin[\\/]bash\.exe$/i.test(value)));
  const registryRoot = gitRegistryInstallPath();
  if (registryRoot) candidates.push(path.join(registryRoot, 'bin', 'bash.exe'));
  candidates.push(...whereGitRoots().map((root) => path.join(root, 'bin', 'bash.exe')));
  candidates.push(...GIT_FALLBACK_ROOTS.map((root) => path.join(root, 'bin', 'bash.exe')));
  for (const candidate of candidates) {
    if (candidate && isFile(candidate) && !isWinuxBashPath(candidate)) return candidate;
  }
  return null;
}

// PowerShell 7 (pwsh), the last-resort fallback shell when neither Niubash nor
// Git Bash is available. where.exe returns the runnable Microsoft Store
// app-execution alias (a reparse point isFile() cannot stat), so its
// resolution is trusted directly; falls back to the standard Program Files
// root. Never Windows PowerShell 5.1 (powershell.exe).
export function resolvePwshPath() {
  // Trust an explicit config pwsh_path directly (a Microsoft Store alias is a
  // reparse point isFile() cannot stat, mirroring how where.exe output is used).
  const configuredPwsh = getPaths().pwsh_path;
  if (configuredPwsh) return configuredPwsh;
  try {
    const out = execFileSync('where.exe', ['pwsh.exe'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const fromWhere = String(out).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (fromWhere.length) return fromWhere[0];
  } catch {}
  const fallback = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
  return isFile(fallback) ? fallback : null;
}

// Best available shell for the static, hook-less platforms (Claude Code and
// OpenCode): Niubash, then the standard Git Bash, then PowerShell 7 (pwsh) as
// the last resort. Mirrors the Codex PreToolUse hook fallback chain.
export function resolveShellPath() {
  return resolveBashPath() || resolveGitBashPath() || resolvePwshPath();
}

// Primary for install: try to obtain Niubash (resolving or installing it), and
// only when that fails fall back to the best available shell (Git Bash, then
// pwsh) so Claude Code / OpenCode still get a working shell.
export function resolveShellForInstall() {
  try {
    return installBash();
  } catch (error) {
    const fallback = resolveShellPath();
    if (!fallback) throw error;
    console.warn(`win-bash: Niubash install failed (${error.message}); using fallback shell: ${fallback}`);
    return fallback;
  }
}
