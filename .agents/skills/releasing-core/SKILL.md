---
name: releasing-core
description: Use when asked to release, publish, bump the version of, or cut a new version of @inpageedit/core (e.g. "发个版", "准备发版", "publish core to npm"), or when a core/x.y.z tag or its CI run needs attention.
---

# Releasing @inpageedit/core

Publishing is fully done by CI: pushing a `core/x.y.z` tag triggers
`.github/workflows/core-npm-publish.yml` (npm publish + jsDelivr purge) and
`core-release-notes.yml` (GitHub Release). Your job is everything before the tag:
the version in `packages/core/package.json` must equal the tag, and the changelog
must be written.

Everything you need is below — no need to explore the repo for formats.

## Steps

### 1. Preflight

```bash
git fetch origin --tags
git switch master
git status -sb    # must be "## master...origin/master" with no ahead/behind
```

Release from `master` only. Behind → `git pull`. Unrelated uncommitted changes:
leave them alone and never stage them into the release commit.

### 2. Collect changes

```bash
LAST=$(git describe --tags --match 'core/*' --abbrev=0)
git log $LAST..HEAD --no-merges --format='%h %s (%an)'
```

- Keep only changes that affect core behavior. Skip docs/website/CI/repo chores.
- Changes to `packages/modal` or `packages/schemastery-form` ship inside core — include them briefly.
- PR number is in the squash subject `(#NN)`. Get the author handle with
  `gh pr view NN --json author -q .author.login`.
- When a subject is too vague to write a user-facing note, read that commit's diff (`git show --stat <sha>`, then the relevant file).

### 3. Pick the version (0.x semver)

| Change set | Bump |
|---|---|
| Fixes, small tweaks | patch `0.18.0 → 0.18.1` |
| New user-facing features, new/changed public API | minor `0.18.0 → 0.19.0` |
| Breaking changes | minor + rainbow badge in changelog |

This is a proposal — the user confirms it in step 6.

### 4. Bump the version

Edit only the top-level `"version"` field (near the top) of `packages/core/package.json` — no `v` prefix. It is the only `"version"` key in that file.

### 5. Write the changelog

File: `website/changelogs/index.md` (long — read only the first ~60 lines).
Insert the new entry directly **below** `<!-- LATEST_CHANGELOG_HERE -->`, keeping the marker.

```md
<!-- LATEST_CHANGELOG_HERE -->

<ChangeLog version='0.18.0'>

- feat(quick-upload): open file url / open file page (#45 by @t7ru)
  - 上传完成后可直接打开文件 URL 或文件页
- fix(WikiPage): ensure only one of title or pageid is sent on delete
  - 修复了 `WikiPage.delete` 同时发送 `title` 和 `pageid` 可能导致的冲突

</ChangeLog>

<ChangeLog version='...previous...'>
```

(Example copied from a past release — write your own from step 2.)

- First line: English, conventional-commit style. Sub-bullets: Chinese, what users notice (not implementation).
- `(#NN by @handle)` for contributors; just `(#NN)` or nothing for the maintainer (dragon-fish).
- Merge multiple commits of one feature/fix into one entry.
- Headline or breaking release: `<template #title>0.19.0 <Badge type='rainbow'>重量级</Badge></template>` right after the opening tag; a single highlighted line: prefix it with `<Badge type='rainbow'>新功能</Badge>` (or `破坏性变更`).

### 6. Verify, then STOP for approval

CI does **not** run tests, so this is the only gate:

```bash
pnpm --filter core typecheck && pnpm --filter core test
pnpm --filter modal build && pnpm --filter schemastery-form build && pnpm --filter core build
```

Then show the user: the version + reason, the changelog entry, verification results.
**Do not commit, tag, or push until the user explicitly approves.** Adjust and re-show if asked.

### 7. Commit, tag, push

```bash
git add packages/core/package.json website/changelogs/index.md
git commit -m "chore(core): release 0.19.0"
git tag core/0.19.0            # lightweight tag, no "v"
git push origin master
git push origin core/0.19.0    # this triggers the release
```

Push the commit before the tag.

### 8. Watch CI and report

```bash
gh run list --workflow core-npm-publish.yml -L 1
gh run watch <run-id> --exit-status
npm view @inpageedit/core version    # expect the new version
gh release view core/0.19.0
```

Report the npm version and Release link. If CI fails, show the log
(`gh run view <run-id> --log-failed`) and ask before deleting or re-pushing any tag —
a published npm version can never be republished.

## Common Mistakes

| Mistake | Consequence |
|---|---|
| Tag ≠ `package.json` version | CI "Version mismatch", nothing published |
| Tag with `v` prefix, or without `core/` | Workflow not triggered (`core/*.*.*` only) |
| Committing before approval | Needs amend/extra commits; approval is before commit |
| Releasing from a feature branch | Tag points at unmerged code |
| Pushing tag before the commit | Tag references a commit the remote doesn't have yet |
| Skipping local tests/build | CI publishes a broken build — its test step is disabled |

## Other channels

Prerelease to a non-`latest` dist-tag (version already bumped on master):
`gh workflow run core-npm-publish.yml -f version=0.19.0-beta.1 -f npm_tag=next`
