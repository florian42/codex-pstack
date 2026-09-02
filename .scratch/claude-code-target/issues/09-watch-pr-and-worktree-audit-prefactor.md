# 09 — Make `watch-pr` dependency-free and parameterize the worktree audit

**What to build:** The `watch-pr` utility runs with no runtime dependency installation: its command-line entry uses the standard library argument parser, the dependency installer is dropped, and behavior is unchanged under the existing test suite. The worktree audit script accepts its transcript root as an optional parameter and skips the chat-scan bucket when none is given, still reporting size, age, merge state, and PR state. Both become packageable as a closed set of files with no test files.

**Blocked by:** None — can start immediately (prefactor; parallel to 01–06).

**Status:** done

- [x] `bun test watch-pr` passes with identical assertions; a diff of command help output is reviewed for parity
- [x] The relative-import closure of `watch-pr` contains no third-party module and no test file
- [x] Worktree audit runs on a host with no Cursor transcript directory and exits 0
- [x] Cursor behavior of both utilities is unchanged; recorded in the maintenance contract as an upstream-touching change
