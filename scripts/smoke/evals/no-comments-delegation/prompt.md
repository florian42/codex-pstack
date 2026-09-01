---
name: no-comments-delegation
tags: [delegation]
runs: 2
max_turns: 16
allowed_tools: [Read, Glob, Grep, Agent, Edit]
---
/pstack:no-comments src/greeter.mjs
