import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveBashPath } from '../src/niubash.js';

// getBashPath() lazily resolves the host Niubash Bash through the same
// production chain as a real install (config shell -> fixed install dirs ->
// where.exe PATH probe filtered to winuxcmd\bin\bash.exe), never a hardcoded
// machine path. It is a function, not a module constant, so importing helpers
// has no side effect on the real ~/.config/win-bash; call it inside
// withTempHome so config migration during resolution stays isolated. The
// clearly-fake fallback only keeps the pure-equality assertions deterministic
// on hosts without Niubash.
export function getBashPath() {
  return resolveBashPath() || 'no-niubash-found';
}

// Run fn with the per-host HOME/CODEX_HOME/etc. env pointed at a throwaway
// directory, then restore the environment and delete the directory.
export function withTempHome(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'win-bash-config-'));
  const prev = {
    USERPROFILE: process.env.USERPROFILE,
    HOME: process.env.HOME,
    CODEX_HOME: process.env.CODEX_HOME,
    CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
    OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
  };
  process.env.USERPROFILE = dir;
  process.env.HOME = dir;
  delete process.env.CODEX_HOME;
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.OPENCODE_CONFIG_DIR;
  try {
    fn(dir);
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
