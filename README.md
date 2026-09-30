# win-bash-ai

Windows installer for the `win-bash` integration.

- npm package version: `0.3.1`
- Codex support: `exec_command.shell` injection through the bundled plugin
- Claude Code support: official `CLAUDE_CODE_GIT_BASH_PATH` / `CLAUDE_CODE_SHELL` settings plus a `win-bash` skill
- OpenCode support: `shell` config key plus a `win-bash` skill

## Source

This package is distributed from the public GitHub repository
[`afirez/win-bash-npm`](https://github.com/afirez/win-bash-npm). It is not
published to the npm registry yet, so install and run it directly from GitHub
with `npx github:afirez/win-bash-npm`.


## Configuration

All win-bash platforms (Codex, Claude Code, OpenCode) share a single config file:

`~/.config/win-bash/win-bash.json`  (i.e. `C:\Users\<you>\.config\win-bash\win-bash.json`)

Legacy per-host config files are automatically merged into this one shared file on
first install, then removed:

| Legacy location | Contents migrated into |
| --- | --- |
| `~/.codex/win-bash.json` | `shell` + `platforms.codex` |
| `~/.claude/win-bash.json` | `shell` + `platforms.claude` |
| `~/.config/opencode/win-bash.json` | `shell` + `platforms.opencode` |
| `~/.config/win-bash/claude.json` (v0.3.1) | `shell` + `platforms.claude` |
| `~/.config/win-bash/opencode.json` (v0.3.1) | `shell` + `platforms.opencode` |

The shared file keeps a `platforms` marker so `uninstall --target <platform>` removes
only the settings that this installer recorded, preserving unrelated host settings.

## Install

Run any command directly without a local install:

```bash
npx github:afirez/win-bash-npm install --target codex
npx github:afirez/win-bash-npm install --target claude
npx github:afirez/win-bash-npm install --target opencode
npx github:afirez/win-bash-npm install --target all
```

Or install it once as a dev dependency, then use the `win-bash` binary:

```bash
npm install --save-dev github:afirez/win-bash-npm
npx win-bash install --target all
```

Diagnostics:

```bash
npx github:afirez/win-bash-npm doctor --target codex
npx github:afirez/win-bash-npm doctor --target claude
npx github:afirez/win-bash-npm doctor --target opencode
npx github:afirez/win-bash-npm doctor --target all
```

Uninstall:

```bash
npx github:afirez/win-bash-npm uninstall --target codex
npx github:afirez/win-bash-npm uninstall --target claude
npx github:afirez/win-bash-npm uninstall --target opencode
```

> Once the package is published to the npm registry, the equivalent commands
> are `npx win-bash-ai ...`.

## Niubash Bash management

Manage the underlying Niubash Bash install directly:

```bash
npx github:afirez/win-bash-npm bash status        # report shell path, version, install root
npx github:afirez/win-bash-npm bash install       # download + activate Niubash if missing
npx github:afirez/win-bash-npm bash uninstall     # remove Niubash
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
