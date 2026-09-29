import path from 'node:path';
import { runPowerShell } from './process.js';
import { assertCodexAvailable, installCodexPlugin, syncPluginFiles } from './codex.js';
import { getInstalledPluginRoot, getNiubashRcPath, getWinBashConfigPath } from './paths.js';

export function install() {
  if (process.platform !== 'win32') throw new Error('win-bash only supports Windows');
  assertCodexAvailable();
  syncPluginFiles();
  installCodexPlugin();

  const installer = path.join(getInstalledPluginRoot(), 'scripts', 'install.ps1');
  runPowerShell(installer);

  console.log(`win-bash plugin installed: ${getInstalledPluginRoot()}`);
  console.log(`Bash config: ${getWinBashConfigPath()}`);
  console.log(`Niubash rc: ${getNiubashRcPath()}`);
}
