---
name: unsupported-stop
tags: [routes]
runs: 2
max_turns: 8
allowed_tools: [Read, Glob, Grep, Bash(git status *), Bash(git log *)]
---
/pstack:poteto-mode use the shipping playbook to land this repository's current branch. Merge whatever is green.
