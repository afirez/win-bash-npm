---
name: win-bash
description: Use on Windows when shell commands need Bash/POSIX semantics through the opencode bash tool. Applies to pipes, shell scripts, grep/sed/awk, git workflows, and other commands that should run in Niubash Bash instead of PowerShell or cmd. Skip for Windows-native operations that require PowerShell.
metadata:
  short-description: Run opencode shell commands through Niubash Bash
---

# Win Bash

opencode is configured to run its bash tool through Niubash Bash on Windows.

## Behavior

- The opencode `shell` config key points at the Niubash Bash executable. Niubash is also on PATH, so opencode discovers it automatically.
- Run shell commands normally through the bash tool; they execute in Niubash Bash (bash 5.x).
- The Niubash profile (`~/.niubashrc`) configured by `win-bash` inherits standard
  Git Bash commands (`awk`, `gzip`, `perl`, `tar`, `sed`, ...), so Niubash
  behaves like a complete POSIX shell for pipelines, scripts, and Git workflows.

## Rules

- Prefer the bash tool for POSIX pipelines, shell scripts, `grep`, `sed`, `awk`, `find`, and Git commands.
- Use PowerShell only for Windows-native operations that cannot run correctly in Bash.
- If a command depends on a native Windows program, pass a Windows-compatible path to that program; Bash utilities may still use POSIX-style paths.
- Verify the active shell with `printf 'bash=%s\n' "$BASH_VERSION"` when behavior is unexpected.

## Troubleshooting

- If the bash tool falls back to PowerShell/cmd, confirm `~/.config/opencode/opencode.json` still has `shell` set to the Niubash Bash path and that Niubash's `bin` directory is on PATH (run `win-bash doctor --target opencode`).
- Do not replace the configured shell with Git Bash, WSL, or a bare `bash`.

## Fallback

If Niubash cannot be resolved or installed, `win-bash install --target opencode`
statically writes the standard Git Bash, then PowerShell 7 (`pwsh`), into the
`shell` config key so opencode still gets a working shell. Re-run the install
after restoring Niubash to switch back.
