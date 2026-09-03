#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
remote_url="$(git -C "$repo_root" remote get-url origin)"

case "$remote_url" in
  git@github.com:*) repository="${remote_url#git@github.com:}" ;;
  https://github.com/*) repository="${remote_url#https://github.com/}" ;;
  *)
    echo "The origin remote must point to GitHub." >&2
    exit 1
    ;;
esac

repository="${repository%.git}"
revision="$(git -C "$repo_root" rev-parse HEAD)"

if [[ -n "$(git -C "$repo_root" status --porcelain --untracked-files=no)" ]]; then
  echo "Commit local changes before deploying NixOS." >&2
  exit 1
fi

git -C "$repo_root" fetch origin --quiet
if ! git -C "$repo_root" branch -r --contains "$revision" | /usr/bin/grep -q .; then
  echo "Push revision $revision before deploying NixOS." >&2
  exit 1
fi

export HOMELAB_GIT_REPOSITORY="$repository"
export HOMELAB_GIT_REVISION="$revision"

cd "$repo_root/homelab/ansible"
exec ansible-playbook playbooks/deploy-asus.yml "$@"

