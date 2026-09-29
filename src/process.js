import { spawnSync } from 'node:child_process';

function quoteCmdArg(value) {
  const arg = String(value);
  if (!/[ \t"&|<>^]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

function spawnWindowsShell(command, args, options) {
  const line = [command, ...args].map(quoteCmdArg).join(' ');
  return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', line], {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: false,
  });
}

export function run(command, args = [], options = {}) {
  const capture = options.capture === true;
  const result = options.shell === true && process.platform === 'win32'
    ? spawnWindowsShell(command, args, { capture, cwd: options.cwd })
    : spawnSync(command, args, {
      cwd: options.cwd || process.cwd(),
      encoding: 'utf8',
      stdio: capture ? 'pipe' : 'inherit',
      shell: false,
    });
  if (result.error) throw result.error;
  if (result.status !== 0 && options.allowFailure !== true) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
  }
  return result;
}

export function runCapture(command, args = [], options = {}) {
  return run(command, args, { ...options, capture: true });
}

export function runJson(command, args = [], options = {}) {
  const result = runCapture(command, args, options);
  if (!result.stdout.trim()) throw new Error(`${command} returned no JSON`);
  return JSON.parse(result.stdout);
}

export function commandExists(name) {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = run(finder, [name], { capture: true, allowFailure: true });
  return result.status === 0 && result.stdout.trim().length > 0;
}

export function runPowerShell(scriptPath, args = []) {
  const shell = commandExists('pwsh') ? 'pwsh' : 'powershell';
  return run(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args]);
}
