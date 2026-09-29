import fs from 'node:fs';
import path from 'node:path';
import { commandExists, run, runJson } from './process.js';
import {
  getBundledPluginRoot,
  getInstalledPluginRoot,
  getMarketplaceManifestPath,
  getMarketplaceRoot,
  getPluginVersion,
} from './paths.js';

export function assertCodexAvailable() {
  if (!commandExists('codex')) throw new Error('codex CLI not found in PATH');
}

export function syncPluginFiles() {
  const source = getBundledPluginRoot();
  const destination = getInstalledPluginRoot();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });

  const marketplace = {
    name: 'local-win-bash',
    plugins: [{
      name: 'win-bash',
      source: { source: 'local', path: `./win-bash/${getPluginVersion()}` },
    }],
  };
  fs.mkdirSync(path.dirname(getMarketplaceManifestPath()), { recursive: true });
  fs.writeFileSync(getMarketplaceManifestPath(), `${JSON.stringify(marketplace, null, 2)}
`);
}

export function installCodexPlugin() {
  run('codex', ['plugin', 'marketplace', 'add', getMarketplaceRoot(), '--json'], { shell: true });
  run('codex', ['plugin', 'add', 'win-bash@local-win-bash', '--json'], { shell: true });
}

export function getPluginState() {
  const data = runJson('codex', ['plugin', 'list', '--json'], { shell: true });
  return (data.installed || []).find((plugin) => plugin.pluginId === 'win-bash@local-win-bash') || null;
}

export function removeCodexPlugin() {
  run('codex', ['plugin', 'remove', 'win-bash@local-win-bash', '--json'], { capture: true, allowFailure: true, shell: true });
  run('codex', ['plugin', 'marketplace', 'remove', 'local-win-bash', '--json'], { capture: true, allowFailure: true, shell: true });
}
