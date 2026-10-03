# win-bash: inherit standard Git Bash commands (awk/gzip/perl/tar/sed/...)
# win-bash-git-inherit-v3: discover Git dynamically from git on PATH (no hardcoded roots).
# This file is managed by win-bash. Do not hand-edit; run `win-bash doctor` to restore it.
__wb_git_root=""
__wb_git="$(command -v git.exe 2>/dev/null || command -v git 2>/dev/null || true)"
if [ -n "$__wb_git" ]; then
  __wb_root="$(dirname "$(dirname "$__wb_git")")"
  case "$__wb_root" in
    [A-Za-z]:*) __wb_root="/$(printf %s "${__wb_root:0:1}" | tr 'A-Z' 'a-z')/${__wb_root#*:}" ;;
  esac
  case "$__wb_root" in
    *\\*) __wb_root="$(printf '%s' "$__wb_root" | tr '\\' '/')" ;;
  esac
  if [ -f "$__wb_root/usr/bin/awk.exe" ]; then
    __wb_git_root="$__wb_root"
  fi
fi
if [ -n "$__wb_git_root" ]; then
  case ":$PATH:" in
    *":$__wb_git_root/usr/bin:"*) ;;
    *) export PATH="$PATH:$__wb_git_root/usr/bin:$__wb_git_root/bin:$__wb_git_root/cmd" ;;
  esac
fi
unset __wb_git_root __wb_root __wb_git
