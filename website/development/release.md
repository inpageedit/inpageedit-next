# Release Process

## @inpageedit/core

1. Review changes since the last release:
   ```bash
   git log $(git describe --tags --match 'core/*' --abbrev=0)..HEAD --oneline
   ```
2. Update `version` in `packages/core/package.json`
3. Write changelog in `website/changelogs/`
4. Commit, then create a git tag in the format `core/<version>` (no `v` prefix)
   - Example: `"version": "0.17.2"` → `git tag core/0.17.2`
5. Push commits and tag — GitHub Actions will handle publishing automatically
   - **The git tag must match the version in package.json exactly, otherwise CI validation will fail**

> AI agents: follow the `releasing-core` skill in `skills/releasing-core/SKILL.md`.
