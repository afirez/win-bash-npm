import fs from 'node:fs';
import path from 'node:path';
import { run } from './process.js';
import { installBash, resolveBashPath } from './niubash.js';
import { getNiubashRcPath, getWinBashConfigPath } from './paths.js';

export function findInstallRoot(shellPath) {
  let current = path.dirname(shellPath);
  while (true) {
    if (fs.existsSync(path.join(current, 'niu.exe'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function managedRoots() {
  const local = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Niubash') : null;
  return ['D:\\apps\\Niubash', local].filter(Boolean).map((value) => path.resolve(value));
}

export function bashStatus() {
  const shell = resolveBashPath();
  if (!shell) throw new Error('Bash executable not found');
  const version = run(shell, ['-c', 'printf "%s" "$BASH_VERSION"'], { capture: true }).stdout.trim();
  console.log(JSON.stringify({
    shell,
    version,
    installRoot: findInstallRoot(shell),
    config: getWinBashConfigPath(),
    rc: getNiubashRcPath(),
  }, null, 2));
}

export function bashInstall() {
  const shell = installBash();
  console.log(`Bash ready: ${shell}`);
}

export function bashUninstall() {
  const shell = resolveBashPath();
  if (!shell) throw new Error('Bash executable not found');
  const installRoot = findInstallRoot(shell);
  if (!installRoot || !managedRoots().includes(path.resolve(installRoot))) {
    throw new Error(`Refusing to remove user-managed Bash at ${installRoot || shell}. Use the Niubash uninstaller if you installed it yourself.`);
  }
  fs.rmSync(installRoot, { recursive: true, force: true });
  const configPath = getWinBashConfigPath();
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (String(config.shell || '').startsWith(installRoot)) fs.rmSync(configPath, { force: true });
  } catch {
    // Preserve unrelated or malformed config.
  }
  console.log(`Removed win-bash managed Niubash: ${installRoot}`);
  console.log(`Preserved: ${getNiubashRcPath()}`);
}
