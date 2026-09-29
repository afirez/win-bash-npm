import fs from 'node:fs';
import path from 'node:path';
import { commandExists, run } from './process.js';
import { getPluginState } from './codex.js';
import { getInstalledPluginRoot, getNiubashRcPath, getWinBashConfigPath } from './paths.js';

export function doctor() {
  if (process.platform !== 'win32') throw new Error('win-bash only supports Windows');
  if (!commandExists('codex')) throw new Error('codex CLI not found in PATH');

  const plugin = getPluginState();
  console.log(`codex plugin: ${plugin ? `${plugin.version} enabled=${plugin.enabled}` : 'not installed'}`);

  const hook = path.join(getInstalledPluginRoot(), 'scripts', 'win-bash-hook.js');
  if (fs.existsSync(hook)) {
    run('node', [hook, 'doctor']);
  } else {
    console.log('win-bash hook not installed; run win-bash install');
  }

  console.log(`win-bash.json exists: ${fs.existsSync(getWinBashConfigPath())}`);
  console.log(`.niubashrc exists: ${fs.existsSync(getNiubashRcPath())}`);
}
