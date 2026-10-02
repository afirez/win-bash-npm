import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { getBundledPluginRoot, getPluginVersion } from '../src/paths.js';

const HOOK = path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js');

function runRoute(input, env = {}) {
  const out = execFileSync(process.execPath, [HOOK, 'route'], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return JSON.parse(out);
}

function fakeBashFile(label) {
  return path.join(os.tmpdir(), `win-bash-${label}-${process.pid}-bash.exe`);
}

test('bundled Codex plugin version is fixed', () => {
  assert.match(getPluginVersion(), /^\d+\.\d+\.\d+$/);
});

test('PreToolUse hook never injects additionalContext', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.equal(hook.includes("emitContext('PreToolUse'"), false);
  assert.equal(hook.includes('additionalContext: `win-bash set exec_command.shell'), false);
});

test('hook resolves config under ~/.config/win-bash/', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes("'.config', 'win-bash', 'win-bash.json'"), 'hook CONFIG_PATH must point into ~/.config/win-bash');
  assert.ok(hook.includes('LEGACY_CONFIG_PATH'), 'hook must keep legacy fallback path');
});

test('hook resolves only winuxcmd/bin/bash.exe entries and never niu.exe', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes(String.raw`/winuxcmd[\\/]bin[\\/]bash\.exe$/i`), 'hook filter must target winuxcmd\\bin\\bash.exe');
  assert.equal(hook.includes('/niubash/i'), false, 'hook must not use the broad /niubash/i filter');
  assert.equal(hook.includes('niu.exe'), false, 'hook must not reference niu.exe');
  assert.equal(hook.includes(String.raw`F:\studio\apps\Niubash`), false, 'hook must not hardcode the F: install path');
});

test('route: POSIX text tools, git and chained commands route to Git Bash, never Niubash', () => {
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(gitBash, '');
  try {
    const cmds = [
      'grep foo',
      'sed -n 1p x',
      "awk '{print $1}'",
      'git log --oneline | head',
      'ls -la',
      'cd /c/foo && make',
    ];
    for (const cmd of cmds) {
      const r = runRoute({ cmd }, { OMO_CODEX_GIT_BASH_PATH: gitBash });
      assert.equal(r.action, 'bash', cmd);
      assert.equal(r.shell, gitBash, cmd);
    }
  } finally {
    fs.rmSync(gitBash, { force: true });
  }
});

test('route: shell scripts route to Git Bash', () => {
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(gitBash, '');
  try {
    const cmds = ['bash script.sh', 'sh deploy.sh', './tools/sync.sh', 'source env.sh && npm test'];
    for (const cmd of cmds) {
      const r = runRoute({ cmd }, { OMO_CODEX_GIT_BASH_PATH: gitBash });
      assert.equal(r.action, 'bash', cmd);
      assert.equal(r.shell, gitBash, cmd);
    }
  } finally {
    fs.rmSync(gitBash, { force: true });
  }
});

test('route: Windows-native, psmux/tmux and PowerShell commands are left un-injected', () => {
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(gitBash, '');
  try {
    const cmds = [
      'psmux list-sessions',
      'tmux ls',
      'pmux -S F:/studio/apps/psmux ls',
      'powershell -Command Get-Process',
      'pwsh -NoProfile -Command "Get-Date"',
      'Get-Content C:/tmp/a.txt | Select-String foo',
      'where.exe bash.exe',
      'dir *.log',
      'netstat -ano',
      'node --version',
    ];
    for (const cmd of cmds) {
      const r = runRoute({ cmd }, { OMO_CODEX_GIT_BASH_PATH: gitBash });
      assert.equal(r.action, 'none', cmd);
      assert.equal(r.shell, null, cmd);
    }
  } finally {
    fs.rmSync(gitBash, { force: true });
  }
});

test('route: WIN_BASH_SKIP=1 skips injection and strips the marker', () => {
  const r = runRoute({ cmd: 'WIN_BASH_SKIP=1 psmux ls' });
  assert.equal(r.action, 'skip');
  assert.equal(r.shell, null);
  assert.equal(r.cmd, 'psmux ls');
});

test('route: WIN_BASH_SHELL forces a shell and strips the marker', () => {
  const shell = fakeBashFile('force');
  fs.writeFileSync(shell, '');
  try {
    const r = runRoute({ cmd: `WIN_BASH_SHELL=${shell} grep foo` });
    assert.equal(r.action, 'force');
    assert.equal(r.shell, shell);
    assert.equal(r.cmd, 'grep foo');
  } finally {
    fs.rmSync(shell, { force: true });
  }
});

test('route: WIN_BASH_SHELL with a quoted spacey path forces the shell', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'win-bash-space-'));
  const shell = path.join(dir, 'my git', 'bash.exe');
  fs.mkdirSync(path.dirname(shell), { recursive: true });
  fs.writeFileSync(shell, '');
  try {
    const r = runRoute({ cmd: `WIN_BASH_SHELL="${shell}" pwd` });
    assert.equal(r.action, 'force');
    assert.equal(r.shell, shell);
    assert.equal(r.cmd, 'pwd');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('route: WIN_BASH_SHELL with a missing path forces nothing but strips the marker', () => {
  const r = runRoute({ cmd: 'WIN_BASH_SHELL=C:/nope/not-here.exe pwd' });
  assert.equal(r.action, 'force');
  assert.equal(r.shell, null);
  assert.equal(r.cmd, 'pwd');
});

test('route: an explicitly passed shell is respected and never rewritten', () => {
  const r = runRoute({ cmd: 'git status', shell: 'C:\\custom\\shell.exe' });
  assert.equal(r.action, 'respect');
  assert.equal(r.shell, null);
  assert.equal(r.cmd, 'git status');
});

test('route: a Niubash-valued OMO_CODEX_GIT_BASH_PATH override is rejected (Git Bash only)', () => {
  const fakeWinux = path.join(os.tmpdir(), 'winuxcmd', 'bin', 'bash.exe');
  fs.mkdirSync(path.dirname(fakeWinux), { recursive: true });
  fs.writeFileSync(fakeWinux, '');
  try {
    const r = runRoute({ cmd: 'grep foo' }, { OMO_CODEX_GIT_BASH_PATH: fakeWinux });
    assert.notEqual(r.shell, fakeWinux, 'Niubash-valued override must never be used as Git Bash');
    assert.equal(r.action, 'bash', 'POSIX command still routes to a (real) Git Bash or none');
  } finally {
    fs.rmSync(path.dirname(path.dirname(fakeWinux)), { recursive: true, force: true });
  }
});

test('route: bash command execution routes to Niubash', () => {
  const niubash = fakeBashFile('niu');
  fs.writeFileSync(niubash, '');
  try {
    const cmds = ['bash -c "echo hi"', 'bash mycmd', 'bash'];
    for (const cmd of cmds) {
      const r = runRoute({ cmd }, { WIN_BASH_PATH: niubash });
      assert.equal(r.action, 'niubash', cmd);
      assert.equal(r.shell, niubash, cmd);
    }
  } finally {
    fs.rmSync(niubash, { force: true });
  }
});

test('route: bash running a .sh script or using awk routes to Git Bash, not Niubash', () => {
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(gitBash, '');
  try {
    const cmds = ['bash script.sh', 'bash deploy.sh', 'bash -c \'echo x | awk "{print $1}"\''];
    for (const cmd of cmds) {
      const r = runRoute({ cmd }, { OMO_CODEX_GIT_BASH_PATH: gitBash });
      assert.equal(r.action, 'bash', cmd);
      assert.equal(r.shell, gitBash, cmd);
    }
  } finally {
    fs.rmSync(gitBash, { force: true });
  }
});
