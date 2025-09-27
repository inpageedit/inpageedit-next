# InPageEdit NEXT Documentation

This is the documentation for InPageEdit NEXT.

## Before dev & build

Build @inpageedit/core first (for `twoslash`):

```bash
pnpm core:build
```

## Cloudflare Pages

build command (for `GitChangelog`):

```bash
(git fetch --depth=100 || git fetch --unshallow || true) && pnpm docs:build
```
