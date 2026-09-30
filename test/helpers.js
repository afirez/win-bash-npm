import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Neutral Windows paths and identifiers shared by the test suite.
// These do NOT reference any real machine's Niubash install; tests must not
// depend on a specific host path. Windows-style separators keep the fixtures
// representative of real win-bash configs.

// A representative absolute Bash executable path (host-independent).
export const BASH_PATH = 'C:\\Niubash\\winuxcmd\\bin\\bash.exe';

// Migration fixture paths: shared config shell, legacy per-host shell, and the
// v0.3.1 intermediate-file shell. Distinct values so tests can assert which
// source wins.
export const SHARED_BASH_PATH = 'C:\\shared\\bash.exe';
export const LEGACY_BASH_PATH = 'C:\\legacy\\bash.exe';
export const INTERMEDIATE_BASH_PATH = 'C:\\intermediate\\bash.exe';

// Arbitrary installedAt timestamps for migration fixtures.
export const INSTALLED_AT_LEGACY = '2026-01-01T00:00:00.000Z';
export const INSTALLED_AT_INTERMEDIATE = '2026-01-02T00:00:00.000Z';

// Neutral model identifiers for host-config merge tests.
export const MODEL_CLAUDE = 'claude-model-test';
export const MODEL_OPENCODE = 'opencode-model-test';
export const MODEL_ARCHITECT = 'architect-model-test';

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
