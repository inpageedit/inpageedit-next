# Release Process

## @inpageedit/core

1. Review changes since the last release:
   ```bash
   git log $(git describe --tags --match 'core/*' --abbrev=0)..HEAD --oneline
   ```
2. Update `version` in `packages/core/package.json`
3. Write changelog in `docs/changelogs/`
4. Commit, then create a git tag in the format `core/<version>` (no `v` prefix)
   - Example: `"version": "0.17.2"` → `git tag core/0.17.2`
5. Push commits and tag — GitHub Actions will handle publishing automatically
   - **The git tag must match the version in package.json exactly, otherwise CI validation will fail**

> **@agents:**
> - After step 3, stop and ask the user to review the version number and changelog before proceeding to step 4. Do NOT create tags or push without explicit human approval.
> - Changelog scope: only include changes that affect `@inpageedit/core` behavior. Skip unrelated commits (e.g. docs-only). Changes in core's sub-packages (e.g. `@inpageedit/modal`) that affect core can be briefly mentioned.
