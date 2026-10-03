import fs from 'node:fs';
import path from 'node:path';
import { getBundledPluginRoot, getWinBashGitInheritInitPath } from './paths.js';

// Canonical shared Git-inherit init shipped with the plugin. This single file
// is the one source of truth for "Niubash inherits standard Git Bash commands"
// across every consumer: ~/.niubashrc (interactive REPL) sources it via one
// line, and tool-driven non-interactive bash reads it via BASH_ENV. Never
// duplicate this content anywhere else.
export function getGitInheritTemplatePath() {
  return path.join(getBundledPluginRoot(), 'scripts', 'git-inherit.sh');
}

export function readGitInheritTemplate() {
  return fs.readFileSync(getGitInheritTemplatePath(), 'utf8');
}

// Ensure the shared init exists at ~/.config/win-bash/git-inherit.sh with the
// bundled canonical content. Idempotent: an existing identical file is left
// untouched (returns { ensured: false, reason: 'exists' }); a missing or
// outdated file is (re)written (returns { ensured: true, reason: 'created' |
// 'updated' }). This is the ONLY writer, called from install and doctor;
// SessionStart never writes it.
export function ensureGitInheritInit() {
  const initPath = getWinBashGitInheritInitPath();
  const content = readGitInheritTemplate().replace(/\r\n/g, '\n');
  if (fs.existsSync(initPath)) {
    const existing = fs.readFileSync(initPath, 'utf8').replace(/\r\n/g, '\n');
    if (existing === content) return { ensured: false, reason: 'exists', path: initPath };
    fs.writeFileSync(initPath, content, 'utf8');
    return { ensured: true, reason: 'updated', path: initPath };
  }
  fs.mkdirSync(path.dirname(initPath), { recursive: true });
  fs.writeFileSync(initPath, content, 'utf8');
  return { ensured: true, reason: 'created', path: initPath };
}

// The single rc line that makes interactive Niubash REPL source the shared
// init. Uses $HOME so it survives the HOME re-derivation Niubash does at
// startup (the bundled template already relies on $HOME being set).
export function getGitInheritSourceLine() {
  return '. "$HOME/.config/win-bash/git-inherit.sh"';
}
