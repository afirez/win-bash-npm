import fs from 'node:fs';
import path from 'node:path';
import { getClaudeMdPath, getOpencodeAgentsMdPath } from './paths.js';

const START = '<!-- USER:SHELL:START -->';
const END = '<!-- USER:SHELL:END -->';

function buildBlock() {
  const body = [
    '## User-level shell policy',
    '',
    'On Windows, use the `win-bash` skill for shell work. The configured shell',
    '(from `~/.config/win-bash/win-bash.json`) is the primary shell for POSIX',
    'commands, shell scripts, and pipelines. Windows-native operations',
    '(tmux/psmux/pmux/powershell/pwsh, cmd builtins, .ps1/.bat/.cmd) stay on',
    'PowerShell.',
    '',
    '### Git command inheritance in tool-driven sessions',
    '',
    'Niubash inherits standard Git Bash commands (`awk`/`gzip`/`perl`/`tar`/`sed`)',
    'from the shared init `~/.config/win-bash/git-inherit.sh`. In a tool-driven',
    '`bash -lc` session, load it by prefixing the command:',
    '',
    '`BASH_ENV="$HOME/.config/win-bash/git-inherit.sh" <cmd>`',
    '',
    'The shared init is managed by win-bash (created by `install`, self-healed by',
    '`win-bash doctor`); do not hand-edit it.',
  ].join('\n');
  return `${START}\n${body}\n${END}`;
}

/** Insert or self-heal the USER:SHELL block inside a marker file. */
function ensureBlock(filePath) {
  const block = buildBlock();
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const startIdx = content.indexOf(START);
    const endIdx = content.indexOf(END);
    if (startIdx >= 0 && endIdx > startIdx) {
      const updated = content.slice(0, startIdx) + block + content.slice(endIdx + END.length);
      if (updated !== content) {
        fs.writeFileSync(filePath, updated, 'utf8');
        return { ensured: true, reason: 'updated', path: filePath };
      }
      return { ensured: false, reason: 'current', path: filePath };
    }
    const updated = `${content.trimEnd()}\n\n${block}\n`;
    fs.writeFileSync(filePath, updated, 'utf8');
    return { ensured: true, reason: 'appended', path: filePath };
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${block}\n`, 'utf8');
  return { ensured: true, reason: 'created', path: filePath };
}

export function ensureClaudeUserShellPolicy() {
  return ensureBlock(getClaudeMdPath());
}

export function ensureOpencodeUserShellPolicy() {
  return ensureBlock(getOpencodeAgentsMdPath());
}

/** Remove the USER:SHELL block from a marker file (for uninstall). */
function removeBlock(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);
  if (startIdx >= 0 && endIdx > startIdx) {
    const updated = (content.slice(0, startIdx) + content.slice(endIdx + END.length)).replace(/\n{3,}/g, '\n\n').trimEnd();
    fs.writeFileSync(filePath, `${updated}\n`, 'utf8');
  }
}

export function removeClaudeUserShellPolicy() {
  removeBlock(getClaudeMdPath());
}

export function removeOpencodeUserShellPolicy() {
  removeBlock(getOpencodeAgentsMdPath());
}
