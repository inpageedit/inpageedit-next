# Release Process

## @inpageedit/core

1. Update `version` in `packages/core/package.json`
2. Write changelog in `docs/changelogs/`
3. Commit, then create a git tag in the format `core/<version>` (no `v` prefix)
   - Example: `"version": "0.17.2"` → `git tag core/0.17.2`
4. Push commits and tag — GitHub Actions will handle publishing automatically
   - **The git tag must match the version in package.json exactly, otherwise CI validation will fail**
