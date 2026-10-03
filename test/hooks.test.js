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
    env: { ...process.env, WIN_BASH_NO_PRIMARY: '1', ...env },
  });
  return JSON.parse(out);
}

function runPreToolUse(input, env = {}) {
  const payload = { hook_event_name: 'PreToolUse', tool_name: 'exec_command', tool_input: input };
  const out = execFileSync(process.execPath, [HOOK, 'pre-tool-use'], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, WIN_BASH_NO_PRIMARY: '1', ...env },
  }).trim();
  return out ? JSON.parse(out) : null;
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
      assert.equal(r.shell, 'bash', cmd);
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
      assert.equal(r.shell, 'bash', cmd);
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
      assert.equal(r.shell, 'bash', cmd);
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
      assert.equal(r.shell, 'bash', cmd);
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
    assert.equal(r.shell, 'bash', 'Niubash stays the routed shell');
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
      assert.equal(r.shell, 'bash', cmd);
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
      assert.equal(r.shell, 'bash', cmd);
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
    assert.equal(r.shell, 'bash');
    assert.ok(r.cmd.startsWith('export PATH="$PATH:'), 'Git dirs must be appended AFTER the existing PATH');
    assert.ok(r.cmd.endsWith('"; bash script.sh'), 'original command must follow the PATH prefix');
    assert.equal(r.cmd.includes('/usr/bin:'), true);
  } finally {
    fs.rmSync(niubash, { force: true });
    fs.rmSync(gitBash, { force: true });
  }
});

test('route: git-only tools route to Niubash via the main shell chain when no Git Bash is available', () => {
  const niubash = fakeBashFile('niu');
  fs.writeFileSync(niubash, '');
  try {
    const gitOnly = [
      "awk '{print $1}'",
      'perl -e "print 1"',
      'gzip -c x > y.gz',
      'bzip2 x',
      'unzip a.zip',
      'dash -c "echo hi"',
      "echo x | awk '{print $1}'",
      'cat a | gzip > b.gz',
    ];
    for (const cmd of gitOnly) {
      // The git-only divert is removed: the main shell chain (Niubash -> Git
      // Bash -> pwsh) routes these to the Niubash Bash. Without a resolvable
      // Git Bash there is no PATH prefix, so the command is left unchanged.
      const r = runRoute({ cmd }, { WIN_BASH_PATH: niubash, WIN_BASH_NO_GIT: '1' });
      assert.equal(r.action, 'niubash', cmd + ' must route to Niubash (main shell chain)');
      assert.equal(r.shell, 'bash', cmd);
      assert.equal(r.cmd, cmd, cmd + ' must be left unchanged when no Git prefix applies');
    }
  } finally {
    fs.rmSync(niubash, { force: true });
  }
});

test('route: coreutils still route to Niubash when no Git Bash is available', () => {
  const niubash = fakeBashFile('niu');
  fs.writeFileSync(niubash, '');
  try {
    const coreutils = ['grep foo', 'sed -n 1p x', 'ls -la', 'find . -name x', 'cat a.txt', 'mkdir -p d'];
    for (const cmd of coreutils) {
      const r = runRoute({ cmd }, { WIN_BASH_PATH: niubash, WIN_BASH_NO_GIT: '1' });
      assert.equal(r.action, 'niubash', cmd);
      assert.equal(r.shell, 'bash', cmd);
      assert.equal(r.cmd, cmd, cmd + ' must be left unchanged when no Git prefix applies');
    }
  } finally {
    fs.rmSync(niubash, { force: true });
  }
});

test('hook has a WIN_BASH_NO_GIT escape hatch for simulating a Git-less host', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes("process.env.WIN_BASH_NO_GIT === '1'"), 'hook must support WIN_BASH_NO_GIT to simulate a Git-less host');
});

test('hook uses PowerShell 7 (pwsh) as the last-resort fallback shell', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes('resolvePwsh'), 'hook must resolve pwsh');
  assert.ok(hook.includes("where.exe', ['pwsh.exe']"), 'hook must resolve pwsh dynamically via where.exe');
  assert.ok(hook.includes(String.raw`C:\Program Files\PowerShell\7\pwsh.exe`), 'hook must fall back to the Program Files pwsh root');
  const gitIdx = hook.indexOf('const gitBash = resolveGitBash();');
  const pwshIdx = hook.indexOf('const pwsh = resolvePwsh();');
  assert.ok(gitIdx !== -1 && pwshIdx !== -1 && gitIdx < pwshIdx, 'pwsh must be the final fallback after Git Bash in decide()');
});

test('hook configure reports Niubash, Git Bash and pwsh resolution', () => {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-cfg-'));
  const fakeBash = path.join(fakeHome, 'bash.exe');
  fs.writeFileSync(fakeBash, '');
  try {
    const out = execFileSync(process.execPath, [HOOK, 'configure'], {
      encoding: 'utf8',
      env: { ...process.env, USERPROFILE: fakeHome, WIN_BASH_PATH: fakeBash },
    });
    const result = JSON.parse(out);
    assert.ok('git_bash' in result, 'configure must report git_bash');
    assert.ok('pwsh' in result, 'configure must report pwsh');
  } finally {
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }
});

test('hook session-start carries install prompts for missing Git Bash / pwsh', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes('https://git-scm.com/downloads'), 'session-start must point to the Git for Windows install');
  assert.ok(hook.includes('winget install Microsoft.PowerShell'), 'session-start must point to the PowerShell 7 install');
  assert.ok(hook.includes('the last-resort fallback shell'), 'session-start must describe pwsh as the last-resort fallback');
  assert.ok(hook.includes("emitContext('SessionStart', parts.join"), 'session-start must emit install warnings only via SessionStart');
});

test('hook DEFAULT_RC lets Niubash inherit standard Git Bash commands', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes('__wb_git_root'), 'rc must self-detect a Git for Windows install');
  assert.ok(hook.includes('usr/bin/awk.exe'), 'rc must probe for a Git command (awk)');
  assert.ok(hook.includes('export PATH="$PATH:$__wb_git_root/usr/bin'), 'rc must append the Git dirs AFTER the existing PATH');
  assert.ok(hook.includes('win-bash-git-inherit-v3'), 'rc must carry the v3 dynamic-discovery marker');
  assert.ok(hook.includes('command -v git.exe'), 'rc must discover Git dynamically from PATH');
  assert.equal(hook.includes('PROGRAMFILES/Git'), false, 'rc must not hardcode a Git install root');
});

test('hook ensureDefaultRc upgrades an old v2 prepend block to the v3 append form', () => {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-rc-upgrade-'));
  const fakeBash = path.join(fakeHome, 'bash.exe');
  fs.writeFileSync(fakeBash, '');
  const rcPath = path.join(fakeHome, '.niubashrc');
  // Simulate a pre-upgrade rc with the v2 dynamic-discovery block (prepend).
  const oldBlock = [
    '# win-bash: inherit standard Git Bash commands (awk/gzip/perl/tar/sed/...)',
    '# win-bash-git-inherit-v2: discover Git dynamically from git on PATH (no hardcoded roots).',
    '__wb_git_root=""',
    '__wb_git="$(command -v git.exe 2>/dev/null || command -v git 2>/dev/null || true)"',
    'if [ -n "$__wb_git" ]; then',
    '  __wb_root="$(dirname "$(dirname "$__wb_git")")"',
    'fi',
    'if [ -n "$__wb_git_root" ]; then',
    '  case ":$PATH:" in',
    '    *":$__wb_git_root/usr/bin:"*) ;;',
    '    *) export PATH="$__wb_git_root/usr/bin:$__wb_git_root/bin:$__wb_git_root/cmd:$PATH" ;;',
    '  esac',
    'fi',
    'unset __wb_git_root __wb_root __wb_git',
  ].join('\n');
  const userContent = "# user content preserved\nalias ll='ls -la'\n\n" + oldBlock + "\n";
  fs.writeFileSync(rcPath, userContent, 'utf8');
  try {
    const out = execFileSync(process.execPath, [HOOK, 'configure'], {
      encoding: 'utf8',
      env: { ...process.env, USERPROFILE: fakeHome, WIN_BASH_PATH: fakeBash },
    });
    const result = JSON.parse(out);
    assert.ok(result.ok, 'configure must succeed with a Niubash bash');
    assert.equal(result.rc_result.reason, 'git-inherit-upgraded', 'old v2 block must be upgraded, not duplicated');
    const upgraded = fs.readFileSync(rcPath, 'utf8');
    assert.ok(upgraded.includes('win-bash-git-inherit-v3'), 'rc must carry the v3 marker after upgrade');
    assert.equal(upgraded.includes('win-bash-git-inherit-v2'), false, 'rc must not retain the v2 marker');
    assert.ok(upgraded.includes('export PATH="$PATH:$__wb_git_root/usr/bin'), 'rc must append the Git dirs after the existing PATH');
    assert.equal(upgraded.includes('export PATH="$__wb_git_root/usr/bin:$__wb_git_root/bin:$__wb_git_root/cmd:$PATH"'), false, 'old prepend form must be gone');
    assert.ok(upgraded.includes("alias ll='ls -la'"), 'user content outside the block must be preserved');
    // Idempotency: running again must not duplicate the block.
    const out2 = execFileSync(process.execPath, [HOOK, 'configure'], {
      encoding: 'utf8',
      env: { ...process.env, USERPROFILE: fakeHome, WIN_BASH_PATH: fakeBash },
    });
    const result2 = JSON.parse(out2);
    assert.equal(result2.rc_result.reason, 'exists', 'second configure must report exists (idempotent)');
    const rcAgain = fs.readFileSync(rcPath, 'utf8');
    assert.equal((rcAgain.match(/win-bash-git-inherit-v3/g) || []).length, 1, 'v3 block must not be duplicated');
  } finally {
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }
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


test('route: bare bash not on PATH falls back to the absolute Niubash path', () => {
  const niubash = fakeBashFile('niu');
  fs.writeFileSync(niubash, '');
  try {
    const r = runRoute({ cmd: 'grep foo' }, { WIN_BASH_PATH: niubash, PATH: 'C:\\Windows\\System32' });
    assert.equal(r.action, 'niubash');
    assert.equal(r.shell, niubash, 'absolute Niubash path must be injected when bare bash is not Niubash');
  } finally {
    fs.rmSync(niubash, { force: true });
  }
});

test('hook injects shell via updatedInput.shell (no command-wrap, no additionalContext)', () => {
  const hook = fs.readFileSync(path.join(getBundledPluginRoot(), 'scripts', 'win-bash-hook.js'), 'utf8');
  assert.ok(hook.includes('bareBashIsNiubash'), 'hook must detect when bare bash resolves to Niubash');
  assert.ok(hook.includes("const shell = bareBashIsNiubash() ? 'bash' : niubash;"), 'hook must use bare bash when resolvable, else the absolute path');
  assert.equal(hook.includes('wrapInBashInvocation'), false, 'command-wrap helper must be removed');
  assert.equal(hook.includes('& ${token} -lc'), false, 'no PowerShell &-call wrapping');
  assert.ok(hook.includes('newInput.shell = decision.shell'), 'hook must inject via updatedInput.shell');
});

test('PreToolUse rewrites updatedInput.shell only (POSIX -> Bash, native -> none, hatches honored)', () => {
  const niubash = fakeBashFile('niu');
  const gitBash = fakeBashFile('git');
  fs.writeFileSync(niubash, '');
  fs.writeFileSync(gitBash, '');
  try {
    const env = { WIN_BASH_PATH: niubash, OMO_CODEX_GIT_BASH_PATH: gitBash, PATH: 'C:\\Windows\\System32' };

    // POSIX command -> updatedInput.shell set, command unchanged, no & wrap, no additionalContext
    const r = runPreToolUse({ command: 'git status' }, env);
    assert.ok(r, 'POSIX command must produce a rewrite');
    const out = r.hookSpecificOutput;
    assert.equal(out.hookEventName, 'PreToolUse');
    assert.equal(out.permissionDecision, 'allow');
    assert.equal(out.updatedInput.shell, niubash, 'updatedInput.shell must carry the resolved Bash');
    assert.equal(out.updatedInput.command, 'git status', 'command must stay unchanged; only updatedInput.shell is injected');
    assert.ok(!out.updatedInput.command.startsWith('& '), 'command must NOT be wrapped in a PowerShell & call');
    assert.ok(!('additionalContext' in out), 'PreToolUse must not inject additionalContext');

    // native command -> no rewrite
    assert.equal(runPreToolUse({ command: 'tmux ls' }, env), null, 'native command must not be rewritten');

    // explicit shell -> respected, no rewrite
    assert.equal(runPreToolUse({ command: 'echo hi', shell: 'C:/x/pwsh.exe' }, env), null, 'explicit shell must be respected');

    // WIN_BASH_SKIP=1 -> marker stripped, no shell injected
    const skip = runPreToolUse({ command: 'WIN_BASH_SKIP=1 psmux attach main' }, env);
    assert.equal(skip.hookSpecificOutput.updatedInput.command, 'psmux attach main');
    assert.ok(!('shell' in skip.hookSpecificOutput.updatedInput), 'skip must not inject shell');

    // WIN_BASH_SHELL=<path> -> forced shell, marker stripped
    const force = runPreToolUse({ command: 'WIN_BASH_SHELL="C:/Program Files/Git/bin/bash.exe" ./a.sh' }, env);
    assert.equal(force.hookSpecificOutput.updatedInput.shell, 'C:/Program Files/Git/bin/bash.exe');
    assert.equal(force.hookSpecificOutput.updatedInput.command, './a.sh');
    assert.ok(!('additionalContext' in force.hookSpecificOutput), 'force must not inject additionalContext');
  } finally {
    fs.rmSync(niubash, { force: true });
    fs.rmSync(gitBash, { force: true });
  }
});

test('route: a manual config.shell override wins as the main shell', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-chain-'));
  const manualShell = path.join(home, 'manual-bash.exe');
  fs.writeFileSync(manualShell, '');
  const cfgDir = path.join(home, '.config', 'win-bash');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'win-bash.json'), JSON.stringify({ shell: manualShell, platforms: { codex: true } }));
  try {
    const r = runRoute({ cmd: 'grep foo' }, {
      USERPROFILE: home,
      HOME: home,
      WIN_BASH_PATH: '',
      PATH: 'C:\\Windows\\System32',
    });
    assert.equal(r.action, 'niubash');
    assert.equal(r.shell, manualShell, 'manual config.shell must be injected as the main shell');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('route: a recorded config.niubash_path is preferred for Niubash routing', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-niu-'));
  const niubash = fakeBashFile('niu-cfg');
  fs.writeFileSync(niubash, '');
  const cfgDir = path.join(home, '.config', 'win-bash');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'win-bash.json'), JSON.stringify({ niubash_path: niubash, platforms: { codex: true } }));
  try {
    const r = runRoute({ cmd: 'grep foo' }, {
      USERPROFILE: home,
      HOME: home,
      WIN_BASH_PATH: '',
      PATH: 'C:\\Windows\\System32',
    });
    assert.equal(r.action, 'niubash');
    assert.equal(r.shell, niubash, 'config.niubash_path must be injected');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(niubash, { force: true });
  }
});

test('hook configure strategy X: keeps manual shell and valid *_path, no repeated overwrite', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-strategy-'));
  const manualShell = path.join(home, 'manual-bash.exe');
  const niubash = fakeBashFile('niu-x');
  const gitBash = fakeBashFile('git-x');
  fs.writeFileSync(manualShell, '');
  fs.writeFileSync(niubash, '');
  fs.writeFileSync(gitBash, '');
  const cfgDir = path.join(home, '.config', 'win-bash');
  fs.mkdirSync(cfgDir, { recursive: true });
  const cfgPath = path.join(cfgDir, 'win-bash.json');
  const initial = {
    shell: manualShell,
    niubash_path: niubash,
    gitbash_path: gitBash,
    pwsh_path: 'C:\\any\\pwsh.exe',
    platforms: { codex: true },
  };
  fs.writeFileSync(cfgPath, JSON.stringify(initial, null, 2) + '\n');
  const env = { ...process.env, USERPROFILE: home, HOME: home, WIN_BASH_PATH: '', OMO_CODEX_GIT_BASH_PATH: '' };
  try {
    const out1 = execFileSync(process.execPath, [HOOK, 'configure'], { encoding: 'utf8', env });
    const r1 = JSON.parse(out1);
    assert.ok(r1.ok);
    assert.equal(r1.shell, manualShell, 'manual shell must be preserved');
    assert.equal(r1.rc_result.reason, 'created', 'first run creates the rc');

    const before2 = fs.readFileSync(cfgPath, 'utf8');
    const out2 = execFileSync(process.execPath, [HOOK, 'configure'], { encoding: 'utf8', env });
    const r2 = JSON.parse(out2);
    assert.equal(r2.rc_result.reason, 'exists', 'second run reports exists (idempotent)');
    assert.equal(r2.shell, manualShell, 'manual shell must survive a second run');
    const after2 = fs.readFileSync(cfgPath, 'utf8');
    assert.equal(after2, before2, 'config must not be rewritten when everything is already valid');
    const parsed = JSON.parse(after2);
    assert.equal(parsed.shell, manualShell);
    assert.equal(parsed.niubash_path, niubash, 'valid niubash_path must not be overwritten');
    assert.equal(parsed.gitbash_path, gitBash, 'valid gitbash_path must not be overwritten');
    assert.equal(parsed.pwsh_path, 'C:\\any\\pwsh.exe', 'valid pwsh_path must not be overwritten');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(niubash, { force: true });
    fs.rmSync(gitBash, { force: true });
  }
});
