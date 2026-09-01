#!/usr/bin/env bash
# Hermetic install-resolution smoke test for the Claude Code pstack package.
#
# Under a scratch CLAUDE_CONFIG_DIR it adds this repository as a marketplace,
# installs pstack from it, and checks the installed component inventory: the
# skill count equals the generated tree's SKILL.md count, exactly the expected
# agents are present, required skills are present, and the four skills with no
# Claude Code route are absent. It never calls a model and needs no credentials.
#
# Usage: scripts/smoke/claude-install-smoke.sh [repo-root]
set -euo pipefail

repo="${1:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}"
tree="$repo/plugins/claude-code/pstack"
marketplace="pstack-claude"
required_skills="poteto-mode no-comments how swarm"
omitted_skills="automate-me make-bot-ui recall setup-pstack"
expected_agents="comment-sicko, poteto-agent"

if ! command -v claude >/dev/null 2>&1; then
	echo "skip: claude CLI not installed; install-resolution smoke did not run" >&2
	exit 0
fi
[ -d "$tree" ] || { echo "fail: generated tree $tree is missing" >&2; exit 1; }

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
export CLAUDE_CONFIG_DIR="$scratch/config"
mkdir -p "$CLAUDE_CONFIG_DIR"

echo "marketplace add $repo"
claude plugin marketplace add "$repo" >"$scratch/add.log" 2>&1 || { cat "$scratch/add.log" >&2; echo "fail: marketplace add" >&2; exit 1; }
echo "install pstack@$marketplace"
claude plugin install "pstack@$marketplace" -s user >"$scratch/install.log" 2>&1 || { cat "$scratch/install.log" >&2; echo "fail: plugin install" >&2; exit 1; }

claude plugin details pstack >"$scratch/details.txt" 2>&1 || { cat "$scratch/details.txt" >&2; echo "fail: plugin details" >&2; exit 1; }

expected_count="$(find "$tree/skills" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')"
skills_line="$(grep -E '^\s*Skills \(' "$scratch/details.txt" || true)"
agents_line="$(grep -E '^\s*Agents \(' "$scratch/details.txt" || true)"
[ -n "$skills_line" ] || { cat "$scratch/details.txt" >&2; echo "fail: no Skills line in details" >&2; exit 1; }
actual_count="$(printf '%s' "$skills_line" | sed -E 's/^[^(]*\(([0-9]+)\).*/\1/')"
status=0
if [ "$actual_count" != "$expected_count" ]; then
	echo "fail: installed skill count $actual_count != generated tree count $expected_count" >&2; status=1
fi
if ! printf '%s' "$agents_line" | grep -qF "Agents (2)  $expected_agents"; then
	echo "fail: agents line was '$agents_line', expected 'Agents (2)  $expected_agents'" >&2; status=1
fi
for skill in $required_skills; do
	printf '%s' "$skills_line" | grep -qE "(\(|, )$skill(,|$)" || { echo "fail: required skill $skill missing" >&2; status=1; }
done
for skill in $omitted_skills; do
	if printf '%s' "$skills_line" | grep -qE "(\(|, )$skill(,|$)"; then echo "fail: omitted skill $skill is installed" >&2; status=1; fi
done
[ "$status" -eq 0 ] && echo "ok: pstack@$marketplace resolves with $actual_count skills and agents $expected_agents"
exit "$status"
