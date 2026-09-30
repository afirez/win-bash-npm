import { removeCodexPlugin } from './codex.js';
import { unmarkPlatform } from './config.js';
import { getNiubashRcPath, getWinBashConfigPath } from './paths.js';

export function uninstall() {
  if (process.platform !== 'win32') throw new Error('win-bash only supports Windows');
  removeCodexPlugin();
  unmarkPlatform('codex');
  console.log('win-bash Codex plugin removed.');
  console.log(`Preserved: ${getWinBashConfigPath()}`);
  console.log(`Preserved: ${getNiubashRcPath()}`);
}
