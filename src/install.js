import path from 'node:path';
import { runPowerShell } from './process.js';
import { assertCodexAvailable, installCodexPlugin, syncPluginFiles } from './codex.js';
import { ensureAgentsShellPolicy } from './agents-policy.js';
import { ensureGitInheritInit } from './git-inherit.js';
import { getInstalledPluginRoot, getNiubashRcPath, getWinBashConfigPath, getWinBashGitInheritInitPath } from './paths.js';

export function install() {
  if (process.platform !== 'win32') throw new Error('win-bash only supports Windows');
  assertCodexAvailable();
  syncPluginFiles();
  installCodexPlugin();

  // Ensure the shared Git-inherit init BEFORE install.ps1 writes the rc, so
  // every reference to the init exists at write time (F3 order).
  const init = ensureGitInheritInit();
  ensureAgentsShellPolicy();

  const installer = path.join(getInstalledPluginRoot(), 'scripts', 'install.ps1');
  runPowerShell(installer);

  console.log(`win-bash plugin installed: ${getInstalledPluginRoot()}`);
  console.log(`Git-inherit init: ${getWinBashGitInheritInitPath()} (${init.reason})`);
  console.log(`Bash config: ${getWinBashConfigPath()}`);
  console.log(`Niubash rc: ${getNiubashRcPath()}`);
  console.log(`AGENTS.md policy: ensured`);
}
