# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InPageEdit NEXT — a modular, extensible MediaWiki plugin that enables in-page editing and wiki maintenance without opening new tabs. Built on the Cordis IoC/DI framework.

## Monorepo Structure

pnpm workspace with ESM throughout (`"type": "module"`). Node >= 22.14.0.

| Package | Dir | Build | Purpose |
|---------|-----|-------|---------|
| `@inpageedit/core` | `packages/core` | Vite + Rolldown (dts) | Main plugin |
| `@inpageedit/modal` | `packages/modal` | Vite | Framework-free modal/toast |
| `@inpageedit/logger` | `packages/logger` | Vite | Console logger |
| `idb-plus` | `packages/idb-plus` | unbuild | IndexedDB wrapper |
| `schemastery-form` | `packages/schemastery-form` | Vite | Schema-based form WebComponent |
| docs | `docs` | VitePress | Documentation site |

## Common Commands

```bash
# Install dependencies
pnpm install

# Dev (core package, port 1005)
pnpm dev

# Build core (produces dist/ for ESM and lib/ for UMD)
pnpm build

# Test (core, vitest)
pnpm --filter core test          # run all tests once
pnpm --filter core test:watch    # watch mode

# Type checking (core)
pnpm --filter core typecheck

# Format (core)
pnpm --filter core format

# Docs dev/build
pnpm docs:dev
pnpm docs:build

# Run a specific package script
pnpm --filter <package-name> <script>
```

## Build System Details

Core has two build formats controlled by `VITE_BUILD_FORMAT` env var:
- `import` → ES modules to `dist/` (target ES2022, multiple entry points)
- `bundle` → UMD to `lib/` (target ES2020, single entry)

`console.log` is stripped in production builds. Type declarations generated via Rolldown + `rolldown-plugin-dts`.

Path alias: `@` → `packages/core/src`

## Architecture

### Cordis-based IoC/DI

`InPageEdit` class extends Cordis `Context`. All services and plugins are registered via `ctx.plugin()`:

```
InPageEdit (Context)
├── Services (registered in #initCoreServices)
│   ├── ApiService (api) — MediaWiki API via wiki-saikou
│   ├── I18nService (i18n, $, $$) — i18n with tagged template literals
│   ├── CurrentPageService — current page info
│   ├── ModalService — dialog/modal management
│   ├── PreferencesService — user prefs with Schemastery validation
│   ├── StorageService — IndexedDB persistence via idb-plus
│   ├── WikiMetadataService (wiki, getUrl) — site metadata
│   ├── WikiPageService, WikiTitleService, WikiFileService
│   ├── ResourceLoaderService, ThemeService
│   └── ...
└── Plugins (lazy-loaded in #initCorePlugins)
    ├── quick-edit, quick-diff, quick-move, quick-preview, ...
    ├── toolbox — floating toolbar
    ├── plugin-store — marketplace
    ├── preferences-ui — settings panel
    └── analytics, in-article-links
```

### Plugin Pattern

Plugins extend `BasePlugin` with lifecycle hooks `start()` and `stop()`. Key decorators:
- `@Inject(['service1', 'service2'])` — declare service dependencies
- `@RegisterPreferences(schema)` — register preferences schema

Type augmentation via `declare module '@/InPageEdit'` extends `InPageEdit`, `Events`, `PreferencesMap` interfaces.

### UI Technology

- **jsx-dom** for most components (TSX files returning real DOM HTMLElements, NOT React)
- **Vue 3** with Pug templates for complex UIs (plugin-store, preferences-ui)
- **SCSS** with CSS custom properties for theming
- `@inpageedit/modal` for modals/toasts
- `schemastery-form` for auto-generated forms from Schemastery schemas

### Auto-imports

`unplugin-auto-import` is configured — utilities from `components/`, `constants/`, `utils/`, `polyfills/`, `decorators/` are auto-imported. Check `auto-imports.d.ts` when something seems to come from nowhere.

## Code Conventions

- **Formatting**: Prettier — no semicolons, single quotes, trailing commas (es5), 100 char width, 2-space indent
- **Comments**: English for new code comments; preserve existing language when updating
- **Commit messages**: Conventional commits (`fix(scope):`, `feat:`, `refactor:`, `docs:`, etc.)
- **Branches**: Main development on `dev`, releases from `master`
- **MediaWiki globals**: `mw`, `$` (jQuery) exist in the runtime environment (not in tests)
- **Test naming**: Both `.test.ts` and `.spec.ts` are used; test descriptions in Chinese
- **ESLint**: Currently disabled (`eslint.config.disabled.mjs`), Prettier is the active linter
