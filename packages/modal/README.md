# @inpageedit/modal

Yet another lightweight, framework-free modal and toast notification utility. It relies only on native DOM APIs, comes with built-in accessibility (ARIA, focus trap, ESC to close), supports stacking, customizable animations and theming, and provides convenient helpers for dialogs, confirmations, and toasts.

## Features

- Pure DOM — no jQuery or framework dependency; works in any website or app
- Built-in A11y: role/aria, focus management, Tab loop, ESC to close
- Stacking manager: multiple modals, z-index control, batch closing
- Toast notifications: corner positioning, auto-dismiss, hover-pause, type icons
- Configurable animations: modal and backdrop separately, or disable entirely
- Keyboard shortcuts: bind hotkeys to buttons (supports ctrl/alt/shift/meta/mod)
- Theming via CSS variables: easy global or scoped styling
- TypeScript-friendly: full type definitions included

## Installation

```bash
pnpm add @inpageedit/modal
# or npm / yarn
```

## Quick Start

<img src="./docs/modal.png" alt="nirmal modal demo" width="150" align="right" />

```ts
// Import IPEModal
import { IPEModal } from '@inpageedit/modal'
// Import the styles as well
import '@inpageedit/modal/style.css'

// The simplest modal
IPEModal.show({
  title: 'Title',
  content: 'This is the content',
  buttons: [
    { label: 'OK', className: 'is-primary', keyPress: 'enter', method: (_, m) => m.close() },
  ],
})
```

### Quick Dialog

```ts
IPEModal.dialog(
  {
    title: 'Notice',
    content: 'This is a dialog',
  },
  (e, m) => {
    // Triggered when “OK” is clicked (auto-closes unless prevented)
    console.log('OK clicked')
  }
)
```

### Quick Confirm

<img src="./docs/confirm.png" alt="IPEModal confirm demo" width="150" align="right" />

```ts
IPEModal.confirm(
  {
    title: 'Confirm',
    content: 'Are you sure you want to continue?',
    okBtn: { label: 'Yes' },
    cancelBtn: { label: 'No' },
  },
  (e, m) => {
    // Chose “Yes”
    console.log('confirmed')
  }
)
```

### Toast Notification

<img src="./docs/toast.png" alt="nirmal modal demo" width="150" align="right"/>

```ts
IPEModal.notify('success', {
  title: 'Success',
  content: 'Saved successfully',
  // Auto close in 3s; pause on hover
  closeAfter: { time: 3000, resetOnHover: true },
  // Position: 'top right' | 'top left' | 'bottom right' | 'bottom left'
  position: 'top right',
  // Optional action button
  okBtn: { label: 'Undo', className: 'is-primary is-ghost' },
})
```

## API Overview

### Class & Static Methods

- `new IPEModal(options).init().show()` — create and display
- `IPEModal.show(options)` — one-shot create + display
- `IPEModal.dialog(options, onOk)`
- `IPEModal.confirm(options, onOk)`
- `IPEModal.notify(type, options, callback?)` — show toast notification
- `IPEModal.close(modalId?)` — close the specified or topmost modal/toast
- `IPEModal.closeAll(group?, except?)` — batch close by group (includes toasts)
- `IPEModal.removeAll()` — remove all modals and toasts

Useful instance methods:

- `setTitle(content)` / `setContent(content, method?)` / `setButtons(buttons)`
- `addButton(button, index?)` / `removeButton(target)`
- `setOptions(key, value)` / `setOptions(partial)`
- `changePreviewState()` — toggle fullscreen style
- `setModalHeight(offset[, option])`
- `destroy()` — force destroy (ignores beforeClose)

### Event Enum: `IPEModalEvent`

- `modal.init` / `modal.beforeShow` / `modal.show` / `modal.beforeClose` / `modal.close` / `modal.destroy`
- `toast.show` / `toast.close`

Listening (either style):

```ts
const m = new IPEModal().init()
m.on(m.Event.BeforeShow, (ev) => {
  /* return false to cancel */
})
// or DOM event
m.get$modal().addEventListener('modal.show', (ev) => {
  /* ... */
})
```

### Options: `IPEModalOptions` (common)

- Appearance
  - `className`: extra class for the window element
  - `sizeClass`: 'dialog' | 'small' | 'smallToMedium' | 'medium' | 'mediumToLarge' | 'large' | 'full' | 'auto'
  - `center`: center the modal (default true)
  - `fixedHeight`: true or number; lock height
  - `fitScreen`: fullscreen-like layout
  - `iconButtons`: header icon-style buttons
  - `closeIcon`: show × in the corner

- Content
  - `title`, `content`
  - `buttons`: IPEModalButtonOptions[]

- Behavior
  - `backdrop`: true | false | 'shared' | 'byKindShared'
  - `outSideClose`: close on backdrop click (default true)
  - `bodyScroll`: allow page scroll while open (default false; unlocked if no backdrop)
  - `draggable`: draggable when no backdrop

- Animations & Timing
  - `modalAnimation` / `backdropAnimation` / `animation`
  - `animationSpeed`: ms fallback for CSS timing
  - `closeAfter`: number | { time; displayTime?; resetOnHover? }

- Callbacks
  - `beforeShow` / `onShow` / `beforeClose` / `onClose`
  - `onClickClose`: boolean | (m) => boolean | void

### Button: `IPEModalButtonOptions` (common)

- `label`: text or node
- `type`: 'button' | 'link' (with href for link)
- `className`, `id`, `side: 'left' | 'right'`
- `method(event, modal)`
- `keyPress`: bind shortcut key(s), e.g.:
  - `'Enter' | 'Escape' | 'y' | 'n'`
  - `'ctrl+s'`, `'mod+Enter'`, `'alt+shift+x'`
  - multiple separated by `,` or `|`

- `enableAfter`: auto-enable after N ms (aria-disabled meanwhile)
- `closeAfter`: auto-close after N ms post click

### Animation

The library writes the animation name into the CSS variable `--ipe-modal-anim`. You can define matching keyframes in your CSS or rely on built-in transitions. Set `animation: false` to disable.

```ts
new IPEModal({
  modalAnimation: { show: 'fadeIn', hide: 'fadeOut' },
  backdropAnimation: { show: 'fadeIn', hide: 'fadeOut' },
})
  .init()
  .show()
```

### Sizing

Control max width via `sizeClass`: dialog, small, smallToMedium, medium, mediumToLarge, large, full, auto.

### Dragging

When `backdrop === false` and `draggable === true`, users can drag the window by its title bar.

## Styling & Theming

Everything is exposed via CSS variables. Common ones include:

- `--ipe-modal-backdrop-bg`, `--ipe-modal-bg`, `--ipe-modal-text`, `--ipe-modal-accent`
- `--ipe-modal-success / info / warning / danger`
- `--ipe-modal-radius`, `--ipe-modal-button-radius`, `--ipe-modal-shadow`
- `--ipe-modal-window-max-w`, `--ipe-modal-viewport-gap-y`

Toast containers appear in one of four corners with class `ipe-modal-toast-container`. Individual toasts have `plugin--toast` and a `type-*` class (e.g. `type-success`).

## Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` for title
- Automatically focuses first focusable item; Tab is trapped inside
- ESC closes the topmost modal

## Advanced: Grouping & Batch Close

Each instance has a `pluginName` (`normalModal` by default; `toast` for toasts):

```ts
// Close all (modals + toasts)
IPEModal.closeAll()
// Close only a specific group
IPEModal.closeAll('toast')
// Close all except one
IPEModal.closeAll(undefined, someModalId)
```

## CommonJS Usage

```js
const { IPEModal } = require('@inpageedit/modal')
require('@inpageedit/modal/style.css')
```

---

> MIT License
>
> Copyright (c) 2025 dragon-fish
