import fs from 'node:fs';
import path from 'node:path';
import { getCodexHome } from './paths.js';

const USER_SHELL_START = '<!-- USER:SHELL:START -->';
const USER_SHELL_END = '<!-- USER:SHELL:END -->';

const USER_SHELL_BODY = `## User-level shell policy

On Windows, use the \`win-bash\` skill for shell work. The win-bash SessionStart
hook injects the primary shell path at session start — pass that \`shell\`
explicitly in every \`exec_command\` call. If the hook is unavailable, read
\`~/.config/win-bash/win-bash.json\` → \`shell\` for the current path.

### Git command inheritance in tool-driven sessions

Niubash inherits standard Git Bash commands (\`awk\`/\`gzip\`/\`perl\`/\`tar\`/\`sed\`)
from the shared init \`~/.config/win-bash/git-inherit.sh\`. In a tool-driven
\`bash -lc\` session, load it by prefixing the command:

\`BASH_ENV="$HOME/.config/win-bash/git-inherit.sh" <cmd>\`

The shared init is managed by win-bash (created by \`install\`, self-healed by
\`win-bash doctor\`); do not hand-edit it.`;

function getCodexAgentsMdPath() {
  return path.join(getCodexHome(), 'AGENTS.md');
}

export function ensureAgentsShellPolicy() {
  const filePath = getCodexAgentsMdPath();
  const block = `${USER_SHELL_START}\n${USER_SHELL_BODY}\n${USER_SHELL_END}`;

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const startIdx = content.indexOf(USER_SHELL_START);
    const endIdx = content.indexOf(USER_SHELL_END);
    if (startIdx >= 0 && endIdx > startIdx) {
      const before = content.slice(0, startIdx);
      const after = content.slice(endIdx + USER_SHELL_END.length);
      const updated = `${before}${block}${after}`;
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
