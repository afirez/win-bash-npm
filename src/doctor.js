import fs from 'node:fs';
import path from 'node:path';
import { commandExists, run } from './process.js';
import { getPluginState } from './codex.js';
import { ensureAgentsShellPolicy } from './agents-policy.js';
import { ensureGitInheritInit } from './git-inherit.js';
import { getInstalledPluginRoot, getNiubashRcPath, getWinBashConfigPath, getWinBashGitInheritInitPath } from './paths.js';

export function doctor() {
  if (process.platform !== 'win32') throw new Error('win-bash only supports Windows');
  if (!commandExists('codex')) throw new Error('codex CLI not found in PATH');

  const plugin = getPluginState();
  console.log(`codex plugin: ${plugin ? `${plugin.version} enabled=${plugin.enabled}` : 'not installed'}`);

  // Self-heal: ensure the shared Git-inherit init BEFORE the hook rewrites
  // the rc, so every reference to the init exists at write time (F3 order).
  const init = ensureGitInheritInit();
  ensureAgentsShellPolicy();
  if (init.ensured) console.log(`Git-inherit init restored: ${init.path} (${init.reason})`);

  const hook = path.join(getInstalledPluginRoot(), 'scripts', 'win-bash-hook.js');
  if (fs.existsSync(hook)) {
    run('node', [hook, 'doctor']);
  } else {
    console.log('win-bash hook not installed; run win-bash install');
  }

  console.log(`win-bash.json exists: ${fs.existsSync(getWinBashConfigPath())}`);
  console.log(`.niubashrc exists: ${fs.existsSync(getNiubashRcPath())}`);
  console.log(`git-inherit init: ${getWinBashGitInheritInitPath()} ${init.ensured ? `(${init.reason})` : 'exists'}`);
  console.log('AGENTS.md policy: ensured');
}
