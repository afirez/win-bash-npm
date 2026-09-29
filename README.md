# win-bash-ai

Windows installer for the `win-bash` integration.

- npm package version: `0.3.0`
- Codex support: `exec_command.shell` injection through the bundled plugin
- Claude Code support: official `CLAUDE_CODE_GIT_BASH_PATH` / `CLAUDE_CODE_SHELL` settings plus a `win-bash` skill
- OpenCode support: `shell` config key plus a `win-bash` skill

## Install

```bash
npx win-bash-ai install --target codex
npx win-bash-ai install --target claude
npx win-bash-ai install --target opencode
npx win-bash-ai install --target all
```

Diagnostics:

```bash
npx win-bash-ai doctor --target codex
npx win-bash-ai doctor --target claude
npx win-bash-ai doctor --target opencode
```

Uninstall:

```bash
npx win-bash-ai uninstall --target codex
npx win-bash-ai uninstall --target claude
npx win-bash-ai uninstall --target opencode
```

## Niubash Bash management

Manage the underlying Niubash Bash install directly:

```bash
npx win-bash-ai bash status        # report shell path, version, install root
npx win-bash-ai bash install       # download + activate Niubash if missing
npx win-bash-ai bash uninstall     # remove Niubash
```

Niubash is installed under `D:\apps\Niubash` when the `D:` drive exists, otherwise `%LOCALAPPDATA%\Niubash`. Existing machines keep their current install root (e.g. `F:\studio\apps\Niubash`).

## Codex

The CLI copies the bundled Codex plugin into a local marketplace, registers it with `codex plugin add`, and runs the plugin installer to resolve or install Niubash Bash.

The PreToolUse hook is intentionally silent: it only writes `updatedInput.shell`. It must never add `additionalContext`, because that can corrupt parallel tool-call message chains.

## Claude Code

For Claude Code, the CLI:

1. Resolves or installs Niubash Bash.
2. Merges `CLAUDE_CODE_GIT_BASH_PATH` and `CLAUDE_CODE_SHELL` into `~/.claude/settings.json`.
3. Installs the `win-bash` skill under `~/.claude/skills/win-bash`.

Unrelated Claude Code settings are preserved. `uninstall --target claude` removes only values recorded by this installer.

## OpenCode

For OpenCode, the CLI:

1. Resolves or installs Niubash Bash.
2. Merges the `shell` key into `~/.config/opencode/opencode.json` (backing up the original first).
3. Installs the `win-bash` skill under `~/.config/opencode/skills/win-bash`.

OpenCode discovers Niubash Bash automatically because Niubash's `bin` directories are on PATH. The `shell` config key makes the choice explicit for the terminal and shell tools. No hook or environment-variable override is injected — unlike Codex, OpenCode does not need a PreToolUse hook, and its bash tool resolves Bash from PATH on Windows.

Unrelated OpenCode settings are preserved. `uninstall --target opencode` removes only values recorded by this installer.
