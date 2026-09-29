import fs from 'node:fs';
import path from 'node:path';
import { bashInstall, bashStatus, bashUninstall } from './bash.js';
import { doctorClaude, installClaude, uninstallClaude } from './claude.js';
import { doctor as doctorCodex } from './doctor.js';
import { install as installCodex } from './install.js';
import { doctorOpencode, installOpencode, uninstallOpencode } from './opencode.js';
import { getPackageRoot } from './paths.js';
import { uninstall as uninstallCodex } from './uninstall.js';

const packageJson = JSON.parse(fs.readFileSync(path.join(getPackageRoot(), 'package.json'), 'utf8'));

function usage() {
  console.log(`win-bash-ai ${packageJson.version}

Usage:
  win-bash install [--target codex|claude|opencode|all]
  win-bash doctor [--target codex|claude|opencode|all]
  win-bash uninstall [--target codex|claude|opencode|all]
  win-bash bash install
  win-bash bash status
  win-bash bash uninstall
  win-bash version`);
}

function parseTarget(args) {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--target') return args[index + 1] || 'codex';
    if (args[index].startsWith('--target=')) return args[index].split('=', 2)[1];
  }
  return 'codex';
}

function runForTarget(target, codexAction, claudeAction, opencodeAction) {
  if (target === 'codex') return codexAction();
  if (target === 'claude') return claudeAction();
  if (target === 'opencode') return opencodeAction();
  if (target === 'all') {
    codexAction();
    claudeAction();
    opencodeAction();
    return;
  }
  throw new Error(`unknown target: ${target}`);
}

export async function runCli(argv) {
  const [command = 'install', ...args] = argv;
  if (command === '--help' || command === '-h' || command === 'help') {
    usage();
    return;
  }
  if (command === '--version' || command === 'version') {
    console.log(packageJson.version);
    return;
  }
  if (command === 'bash') {
    const subcommand = args[0] || 'status';
    if (subcommand === 'install') return bashInstall();
    if (subcommand === 'status') return bashStatus();
    if (subcommand === 'uninstall') return bashUninstall();
    throw new Error(`unknown bash command: ${subcommand}`);
  }

  const target = parseTarget(args);
  if (command === 'install') return runForTarget(target, installCodex, installClaude, installOpencode);
  if (command === 'doctor') return runForTarget(target, doctorCodex, doctorClaude, doctorOpencode);
  if (command === 'uninstall') return runForTarget(target, uninstallCodex, uninstallClaude, uninstallOpencode);
  throw new Error(`unknown command: ${command}`);
}
