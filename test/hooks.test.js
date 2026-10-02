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

// Mirror of the hook's toPosixPath so tests can assert the exact Git PATH
// prefix that lets Niubash inherit Git Bash commands.
function toPosixPath(value) {
  const drive = String(value).match(/^([A-Za-z]):[\\/](.*)$/);
  if (!drive) return String(value).replace(/\\/g, '/');
  return `/${drive[1].toLowerCase()}/${drive[2].replace(/\\/g, '/')}`;
}

function gitPathPrefix(gitBash) {
  const root = toPosixPath(path.dirname(path.dirname(gitBash)));
  const dirs = [`${root}/usr/bin`, `${root}/bin`, `${root}/cmd`];
  return `export PATH="$PATH:${dirs.join(':')}"; `;
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

test('route: POSIX text tools, git and chained commands route to Niubash with a Git PATH prefix', () => {
  const niubash = fakeBashFile('niu');
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(niubash, '');
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
      const r = runRoute({ cmd }, { WIN_BASH_PATH: niubash, OMO_CODEX_GIT_BASH_PATH: gitBash });
      assert.equal(r.action, 'niubash', cmd);
      assert.equal(r.shell, niubash, cmd);
      assert.equal(r.cmd, gitPathPrefix(gitBash) + cmd, cmd);
    }
  } finally {
    fs.rmSync(niubash, { force: true });
    fs.rmSync(gitBash, { force: true });
  }
});

test('route: shell scripts route to Niubash with a Git PATH prefix', () => {
  const niubash = fakeBashFile('niu');
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(niubash, '');
  fs.writeFileSync(gitBash, '');
  try {
    const cmds = ['bash script.sh', 'sh deploy.sh', './tools/sync.sh', 'source env.sh && npm test'];
    for (const cmd of cmds) {
      const r = runRoute({ cmd }, { WIN_BASH_PATH: niubash, OMO_CODEX_GIT_BASH_PATH: gitBash });
      assert.equal(r.action, 'niubash', cmd);
      assert.equal(r.shell, niubash, cmd);
      assert.equal(r.cmd, gitPathPrefix(gitBash) + cmd, cmd);
    }
  } finally {
    fs.rmSync(niubash, { force: true });
    fs.rmSync(gitBash, { force: true });
  }
});

test('route: psmux/tmux, PowerShell cmdlets and cmd.exe builtins stay on the host shell', () => {
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
      'dir *.log',
      'cls',
      'copy a.txt b.txt',
      'del x.tmp',
      'ren a b',
      'move a b',
      'md newdir',
      'rd olddir',
      'type x.txt',
      'start notepad',
      'deploy.ps1',
      'setup.bat',
      'build.cmd',
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

test('route: node/npm/npx, Windows exes and cmd /c route to Niubash by default with a Git PATH prefix', () => {
  const niubash = fakeBashFile('niu');
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(niubash, '');
  fs.writeFileSync(gitBash, '');
  try {
    const cmds = [
      'node --version',
      'npm test',
      'npx tsc --version',
      'where.exe bash.exe',
      'reg query HKLM\\SOFTWARE /v x',
      'ping -n 1 127.0.0.1',
      'netstat -ano',
      'cmd /c echo from-cmd',
    ];
    for (const cmd of cmds) {
      const r = runRoute({ cmd }, { WIN_BASH_PATH: niubash, OMO_CODEX_GIT_BASH_PATH: gitBash });
      assert.equal(r.action, 'niubash', cmd);
      assert.equal(r.shell, niubash, cmd);
      assert.equal(r.cmd, gitPathPrefix(gitBash) + cmd, cmd);
    }
  } finally {
    fs.rmSync(niubash, { force: true });
    fs.rmSync(gitBash, { force: true });
  }
});

test('route: tmux or powershell mentioned as an argument still routes to Niubash', () => {
  const niubash = fakeBashFile('niu');
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(niubash, '');
  fs.writeFileSync(gitBash, '');
  try {
    const cmds = [
      'grep tmux notes.md',
      'cat /etc/hosts | grep -i tmux',
      'ls -la C:/tmux',
      'git log --oneline | grep pwsh',
    ];
    for (const cmd of cmds) {
      const r = runRoute({ cmd }, { WIN_BASH_PATH: niubash, OMO_CODEX_GIT_BASH_PATH: gitBash });
      assert.equal(r.action, 'niubash', cmd);
      assert.equal(r.shell, niubash, cmd);
    }
  } finally {
    fs.rmSync(niubash, { force: true });
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

test('route: a Niubash-valued OMO_CODEX_GIT_BASH_PATH override never leaks into the injected Git PATH', () => {
  const niubash = fakeBashFile('niu');
  const fakeWinux = path.join(os.tmpdir(), 'winuxcmd', 'bin', 'bash.exe');
  fs.writeFileSync(niubash, '');
  fs.mkdirSync(path.dirname(fakeWinux), { recursive: true });
  fs.writeFileSync(fakeWinux, '');
  try {
    const r = runRoute({ cmd: 'grep foo' }, { WIN_BASH_PATH: niubash, OMO_CODEX_GIT_BASH_PATH: fakeWinux });
    assert.equal(r.action, 'niubash');
    assert.equal(r.shell, niubash, 'Niubash stays the routed shell');
    assert.equal(r.cmd.toLowerCase().includes('winuxcmd'), false, 'injected Git PATH must never contain the Niubash winuxcmd dir');
    if (r.cmd.startsWith('export PATH="')) {
      assert.equal(r.cmd.includes(toPosixPath(path.dirname(path.dirname(fakeWinux)))), false);
    }
  } finally {
    fs.rmSync(niubash, { force: true });
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

test('route: bash running a .sh script or using awk routes to Niubash, inheriting Git commands', () => {
  const niubash = fakeBashFile('niu');
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(niubash, '');
  fs.writeFileSync(gitBash, '');
  try {
    const cmds = ['bash script.sh', 'bash deploy.sh', 'bash -c \'echo x | awk "{print $1}"\''];
    for (const cmd of cmds) {
      const r = runRoute({ cmd }, { WIN_BASH_PATH: niubash, OMO_CODEX_GIT_BASH_PATH: gitBash });
      assert.equal(r.action, 'niubash', cmd);
      assert.equal(r.shell, niubash, cmd);
      assert.equal(r.cmd, gitPathPrefix(gitBash) + cmd, cmd);
    }
  } finally {
    fs.rmSync(niubash, { force: true });
    fs.rmSync(gitBash, { force: true });
  }
});

test('route: Niubash PATH prefix appends Git dirs so inner bash stays Niubash', () => {
  const niubash = fakeBashFile('niu');
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(niubash, '');
  fs.writeFileSync(gitBash, '');
  try {
    const r = runRoute({ cmd: 'bash script.sh' }, { WIN_BASH_PATH: niubash, OMO_CODEX_GIT_BASH_PATH: gitBash });
    assert.equal(r.action, 'niubash');
    assert.equal(r.shell, niubash);
    assert.ok(r.cmd.startsWith('export PATH="$PATH:'), 'Git dirs must be appended AFTER the existing PATH');
    assert.ok(r.cmd.endsWith('"; bash script.sh'), 'original command must follow the PATH prefix');
    assert.equal(r.cmd.includes('/usr/bin:'), true);
  } finally {
    fs.rmSync(niubash, { force: true });
    fs.rmSync(gitBash, { force: true });
  }
});

test('hook DEFAULT_RC lets Niubash inherit standard Git Bash commands', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes('__wb_git_root'), 'rc must self-detect a Git for Windows install');
  assert.ok(hook.includes('usr/bin/awk.exe'), 'rc must probe for a Git command (awk)');
  assert.ok(hook.includes('export PATH="'), 'rc must prepend the Git dirs onto PATH');
  assert.ok(hook.includes('win-bash-git-inherit-v2'), 'rc must carry the v2 dynamic-discovery marker');
  assert.ok(hook.includes('command -v git.exe'), 'rc must discover Git dynamically from PATH');
  assert.equal(hook.includes('PROGRAMFILES/Git'), false, 'rc must not hardcode a Git install root');
});

test('hook resolves Git Bash dynamically with common install roots as a last-resort fallback', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes('gitRegistryInstallPath'), 'hook must read the GitForWindows registry install path');
  assert.ok(hook.includes('whereGitRoots'), 'hook must derive Git roots from git.exe on PATH');
  assert.ok(hook.includes("whereBash().filter((value) => /git"), 'hook must find Git bash.exe on PATH dynamically');
  assert.ok(hook.includes('GIT_FALLBACK_ROOTS'), 'hook must carry a common-roots fallback list');
  assert.ok(hook.includes(String.raw`C:\Program Files\Git`), 'hook must fall back to the default Git root');
  assert.ok(hook.includes('Program Files (x86)'), 'hook must fall back to the 32-bit Git root');
  assert.ok(hook.includes("'Programs', 'Git'"), 'hook must fall back to the LOCALAPPDATA Git root');
  const dyn = hook.indexOf('whereGitRoots');
  const fallback = hook.indexOf('GIT_FALLBACK_ROOTS');
  assert.ok(dyn !== -1 && fallback !== -1 && dyn < fallback, 'dynamic discovery must run before the fallback roots');
});
