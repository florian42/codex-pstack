# 04 — JSON schemas for manifests and build config, N-way version parity, set-version command

**What to build:** A maintainer runs `node scripts/set-version.mjs 0.15.0` and every plugin manifest is rewritten with its own indentation preserved; validation then passes. A manifest whose version drifts from the Cursor reference fails validation naming the file. The Codex manifest's hand-rolled key checks are replaced by a JSON schema in the style of the existing Cursor schemas, and the Cursor-side validator iterates a table of targets. A schema for the per-target build config replaces the hand-rolled copied-resource validation.

**Blocked by:** 01 — Extract a shared multi-target build core.

**Status:** done

- [x] Ten deliberate mutations of the Codex manifest (unknown key, bad semver, forbidden `agents` key, missing `interface.capabilities`, four-item `defaultPrompt`, non-https homepage, and so on) each fail validation
- [x] N-way parity reports every mismatched manifest with its line; passes on the current tree
- [x] `set-version` leaves the tab-indented Cursor manifest tab-indented and the two-space manifests two-space
- [x] Build config schema rejects a copied-resource entry with an extra key or a destination outside a skill's `references/` directory
- [x] CI installs the schema validator dependencies once and runs the target table
