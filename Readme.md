<div align="center">

# bini-overlay

**Development overlay for [Bini.js](https://bini.js.org): an animated status badge, route inspector, and full-screen error panel with source-mapped stack traces.**

<p>
  <a href="https://www.npmjs.com/package/bini-overlay"><img src="https://img.shields.io/npm/v/bini-overlay?style=flat-square&color=0077FF&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/bini-overlay"><img src="https://img.shields.io/npm/dm/bini-overlay?style=flat-square&color=00CFFF&label=downloads" alt="npm downloads" /></a>
  <a href="https://github.com/Binidu01/bini-overlay/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/bini-overlay?style=flat-square&color=0077FF" alt="license" /></a>
  <a href="https://vitejs.dev"><img src="https://img.shields.io/badge/vite-8%2B-646cff?style=flat-square&logo=vite&logoColor=white" alt="vite" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js&logoColor=white" alt="node" /></a>
  <img src="https://img.shields.io/badge/dev_only-never_in_prod-22c55e?style=flat-square" alt="dev only" />
</p>

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Options](#options)
- [The Badge](#the-badge)
- [The Error Panel](#the-error-panel)
- [Reporting Errors From Your App](#reporting-errors-from-your-app)
- [Dev Server Endpoints](#dev-server-endpoints)
- [Security](#security)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Related](#related)

---

## Overview

`bini-overlay` is a Vite plugin bundle that gives Bini.js projects a polished development experience:

- A floating **badge** that animates during HMR updates, shows the current route type, and opens a preferences menu.
- A **red issue pill** that replaces the badge when something breaks.
- A full-screen **error panel** with a syntax-highlighted code frame, source-mapped call stack, and one-click "open in editor".
- It replaces Vite's default `vite-error-overlay`, so there is a single, consistent error UI.

Everything is registered with `apply: 'serve'`. **Nothing is injected into production builds.**

---

## Features

### Status badge
- Animated SVG stroke-drawing logo on page load and on every HMR update.
- Renders inside a **Shadow DOM**, so it never collides with your app's CSS.
- Morphs into a red `1 Issue` / `N Issues` pill when errors are present.
- Menu with live **route type** (Static / Dynamic / Not Found), bundler info, and a **Route Info** inspector.
- Persistent **preferences**: theme, corner position, size, and a recordable visibility shortcut.
- Route type updates automatically on client-side navigation (`pushState`, `replaceState`, `popstate`).

### Error panel
- Captures **runtime errors**, **unhandled promise rejections**, **Vite build/transform errors**, and errors reported by your own error boundaries.
- Errors are labelled by type: Runtime Error, Parse Error, Build Error, Type Error, or Unhandled Rejection.
- **Code frame** read from disk around the failing line, highlighted with [Shiki](https://shiki.style) (`dark-plus`).
- **Source-mapped call stack**: frames are resolved back to your original source when a source map is available.
- Stack frames are split into **application frames** and collapsible **framework frames** (Vite, Rolldown, Node internals).
- **Click any frame to open it in your editor** at the exact line.
- **Component stack** section for React error-boundary errors.
- **Multi-error navigation** with prev/next controls and an `n / total` counter.
- **Copy** button that copies the message, file, component stack, and stack trace.
- **Smart de-duplication and prioritisation**: duplicate errors are merged, real compile errors sort first, and misleading cascade errors (for example `Failed to fetch dynamically imported module`) are hidden while a real error exists.
- **Auto-clears** when HMR delivers a fix, with no manual refresh.
- Falls back gracefully to plain, unhighlighted text if Shiki cannot load.

### Developer safety
- All debug endpoints are **same-origin only**.
- File access is **confined to the project root**.

---

## Installation

```bash
npm install bini-overlay --save-dev
# or
pnpm add bini-overlay -D
# or
yarn add bini-overlay -D
```

`vite` (`>= 8`) is a required peer dependency. Vite 7 and earlier are not supported. To enable route type detection and the Route Info inspector, also install the optional peer dependency [`bini-router`](https://www.npmjs.com/package/bini-router) (`>= 2.0.0`); Bini.js projects already include it.

---

## Quick Start

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { biniOverlay } from 'bini-overlay'

export default defineConfig({
  plugins: [
    react(),
    ...biniOverlay(), // note the spread: it returns an array of plugins
  ],
})
```

`biniOverlay()` returns an **array** of plugins, so it must be spread into `plugins`.

---

## Options

```ts
interface BiniOverlayOptions {
  /**
   * App directory scanned for routes. Used to resolve the current page's
   * route type and to power the Route Info inspector.
   * Must match the `appDir` you pass to `biniroute()` if customised.
   * @default 'src/app'
   */
  appDir?: string

  /**
   * Hide the loading badge and its menu while keeping the error overlay.
   * @default false
   */
  disableBadge?: boolean

  /**
   * Editor binary used by "open in editor". When omitted, the first of
   * `code`, `cursor`, `zed`, `subl`, `webstorm` found on PATH is used.
   */
  editor?: string
}
```

**Example**

```ts
biniOverlay({
  appDir: 'src/app',
  editor: 'cursor',
})
```

The Vite `base` config is picked up automatically for route matching, so no separate base-path option is needed. Code-frame highlighting always uses Shiki's `dark-plus` theme and is not configurable.

---

## The Badge

By default the badge sits in the **bottom-left** corner.

| State | Appearance | Behaviour |
|-------|------------|-----------|
| **Loading** | Logo draws itself with a stroke animation | Runs on page load and on each HMR update |
| **Idle** | Filled gradient logo | Default state when there are no errors |
| **Error** | Red pill showing `1 Issue` / `N Issues` | Click the count to open the error panel, or the logo to open the menu |

### Menu

Click the badge to open the menu.

| Item | Description |
|------|-------------|
| **Issues** | Shown only when errors exist. Reopens the error panel. |
| **Route** | Current route type: `Static`, `Dynamic`, or `Not Found`. |
| **Bundler** | Displays the active bundler (Rolldown). |
| **Route Info** | Opens the route inspector (see below). |
| **Preferences** | Opens the preferences popover. |

### Route Info

Shows the matched route path as a tree, including the layout files and page file that render it. Dynamic (`:param`) and catch-all (`*`) segments are tagged with a chip. Unmatched URLs show a "renders your 404 page" message. Requires [`bini-router`](https://www.npmjs.com/package/bini-router) `>= 2.0.0`.

### Preferences

| Setting | Options | Default |
|---------|---------|---------|
| **Theme** | System, Light, Dark | System |
| **Position** | Bottom Left, Bottom Right, Top Left, Top Right | Bottom Left |
| **Size** | Small, Medium, Large | Medium |
| **Hide for this session** | Hides the badge until the tab is closed | Off |
| **Shortcut** | Record any key combination to toggle visibility | `Alt+B` |

Preferences are stored in `localStorage` under `bini-overlay:prefs`. The session-hide flag lives in `sessionStorage` and is cleared when the tab closes.

---

## The Error Panel

When an error occurs, the panel opens automatically.

| Section | Description |
|---------|-------------|
| **Header** | Error type, `file:line` chip, copy button, and close button |
| **Message** | Cleaned error message, with the originating plugin shown for build errors |
| **Code Frame** | Five lines of context read from disk, with the failing line marked by `>>>` and a red row highlight |
| **Call Stack** | Application frames first, framework frames collapsed behind a "N framework frames hidden" toggle |
| **Component Stack** | React component hierarchy, when provided by an error boundary |
| **Navigation** | Prev/Next arrows and counter when multiple errors are queued |

**Code frame example**

```
    10: function Greeting() {
>>> 11:   const name = user.name
    12:   return <h1>Hello, {name}!</h1>
    13: }
```

### Error lifecycle

```
1. Error occurs   -> badge becomes a red pill and the panel opens
2. Multiple errors -> navigate with prev/next; duplicates are merged
3. You fix it      -> HMR update arrives, resolved errors are cleared
4. All clear       -> panel closes and the badge returns to idle
```

### HMR events

| Event | Behaviour |
|-------|-----------|
| `vite:error` | Adds the error, shows the pill, opens the panel |
| `vite:beforeUpdate` | Removes errors belonging to the updated modules and starts the loading animation |
| `vite:afterUpdate` | Clears remaining errors, closes the panel, and returns the badge to idle |

### Unrecoverable errors

If the app has crashed so completely that nothing is rendered, or an error carries a component stack, the close button is hidden. The panel stays up until a successful HMR update recovers the page, so you never end up staring at a blank screen.

---

## Reporting Errors From Your App

Errors thrown at runtime and unhandled rejections are captured automatically. To route errors from a React **error boundary** into the overlay, dispatch a `__bini_error__` event:

```tsx
componentDidCatch(error: Error, info: React.ErrorInfo) {
  window.dispatchEvent(
    new CustomEvent('__bini_error__', {
      detail: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        type: 'runtime',
      },
    }),
  )
}
```

The overlay dispatches a `__bini_clear_errors__` event on `window` after every successful HMR update, so a boundary can listen for it to reset itself:

```tsx
useEffect(() => {
  const reset = () => setHasError(false)
  window.addEventListener('__bini_clear_errors__', reset)
  return () => window.removeEventListener('__bini_clear_errors__', reset)
}, [])
```

**`detail` fields**

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Error message |
| `name` | `string` | Error name (default `Runtime Error`) |
| `stack` | `string` | Stack trace, source-mapped when possible |
| `componentStack` | `string` | Optional React component stack |
| `file` / `line` | `string` / `number` | Optional; inferred from the stack when omitted |
| `type` | `string` | Defaults to `runtime` |

---

## Dev Server Endpoints

The plugins register the following middleware on the Vite dev server. They exist only during `vite dev`.

| Endpoint | Query | Purpose |
|----------|-------|---------|
| `/__bini_code_context` | `file`, `line` | Returns the surrounding lines for a code frame. Files are cached by modification time (up to 64 entries). |
| `/__bini_sourcemap` | `file`, `line`, `column` | Maps a transformed position back to the original source via the module graph. |
| `/__bini_open_editor` | `file`, `line` | Opens a file at a line in your editor. |
| `/__bini_route_match` | `path` | Returns `static`, `dynamic`, or `not_found` for a URL. |
| `/__bini_route_info` | `path` | Returns matched segments, layouts, and page file for the Route Info inspector. |

The route manifest is built lazily from `appDir` and invalidated automatically when files under it are added, changed, or removed.

### Supported editors

`code`, `cursor`, `zed`, `subl`, `webstorm`. Pass the `editor` option to force a specific binary.

---

## Security

The overlay exposes file-reading and process-launching endpoints, so they are locked down:

- **Same-origin only.** Requests are checked via `Sec-Fetch-Site`, falling back to an `Origin`/`Host` comparison. Cross-origin requests receive `403`.
- **Project-root confinement.** Code-context and open-in-editor paths are resolved and rejected if they escape the current working directory.
- **Dev server only.** Every plugin uses `apply: 'serve'`; none run in `vite build`.

---

## Architecture

`biniOverlay()` returns seven cooperating plugins:

| Plugin | Role |
|--------|------|
| `bini-overlay:code-context` | Serves code frames from disk |
| `bini-overlay:sourcemap` | Resolves source-mapped stack positions |
| `bini-overlay:open-editor` | Launches your editor at a file and line |
| `bini-overlay:routes` | Route matching and route info via `bini-router` |
| `bini-overlay:vite-intercept` | Neutralises Vite's built-in `vite-error-overlay` element |
| `bini-overlay:error` | Client-side error capture and the error panel |
| `bini-overlay:loading` | Badge, menu, route info, and preferences |

---

## Requirements

| | Version |
|---|---|
| Node.js | `>= 18.0.0` |
| Vite | `>= 8.0.0` (Rolldown-based) |

**Dependencies**

| Package | Type | Purpose |
|---------|------|---------|
| `vite` (`>= 8.0.0`) | Peer, required | Host build tool and dev server. Vite 7 and earlier are not supported. |
| [`bini-router`](https://www.npmjs.com/package/bini-router) (`>= 2.0.0`) | Peer, **optional** | Route type and Route Info in the badge menu. Without it, everything else still works. |
| `@jridgewell/trace-mapping` | Dependency (installed automatically) | Resolves source-mapped stack frames |

The package ships both ESM (`dist/index.js`) and CommonJS (`dist/index.cjs`) builds, with bundled TypeScript types.

**Network access:** syntax highlighting loads Shiki from `esm.sh`, and the badge UI loads Inter and JetBrains Mono from Google Fonts. Offline, the overlay still works with plain text and system fonts.

---

## Troubleshooting

<details>
<summary><strong>The overlay doesn't appear</strong></summary>

- Make sure you're running the dev server (`npm run dev`), not a production build.
- Confirm `...biniOverlay()` is in the `plugins` array of `vite.config.ts`, and that you spread it.
- Confirm the package is installed as a dev dependency.
</details>

<details>
<summary><strong>Code frames have no colours</strong></summary>

Shiki is loaded at runtime from `esm.sh`. If it can't be reached, frames render as plain text. Reconnect and reload to restore highlighting.
</details>

<details>
<summary><strong>Route type or Route Info shows "Not Found" everywhere</strong></summary>

- Install `bini-router` (`>= 2.0.0`) in your project. It is an optional peer dependency and is not installed with `bini-overlay`.
- Set `appDir` to match the directory you pass to `biniroute()`.
</details>

<details>
<summary><strong>Stack frames point at transformed code, not my source</strong></summary>

Frames are mapped through Vite's module graph, so a frame can only be resolved if that module has been transformed and has a source map. Third-party, pre-bundled, or not-yet-loaded modules fall back to their raw positions. Frames from your own `src/` files should resolve normally.
</details>

<details>
<summary><strong>Clicking a stack frame does nothing</strong></summary>

No supported editor was found on your `PATH`. Install the shell command for your editor (for example, "Install 'code' command" in VS Code), or set the `editor` option.
</details>

<details>
<summary><strong><code>403 Forbidden</code> from <code>/__bini_*</code> endpoints</strong></summary>

The endpoints reject cross-origin requests. If the dev server is behind a proxy on a different origin, open it directly instead.
</details>

<details>
<summary><strong>The badge is missing</strong></summary>

It may be hidden for the session. Press your shortcut (default `Alt+B`) to bring it back, or check that `disableBadge` isn't set.
</details>

<details>
<summary><strong>The overlay stays open after I fix the error</strong></summary>

The panel closes on `vite:afterUpdate`. Update to the latest version, and check the terminal for a build error that is still failing.
</details>

---

## Contributing

Issues and pull requests are welcome. For new features, please open an issue first to discuss the approach.

```bash
git clone https://github.com/Binidu01/bini-overlay
cd bini-overlay
pnpm install
pnpm build
```

---

## License

MIT © [Binidu Ranasinghe](https://bini.js.org)

---

## Related

- [Bini.js](https://bini.js.org): The React framework for cross-platform apps
- [bini-router](https://www.npmjs.com/package/bini-router): File-based routing for Bini.js
- [bini-server](https://www.npmjs.com/package/bini-server): Production server for Bini.js
- [bini-deploy](https://www.npmjs.com/package/bini-deploy): Zero-config deployment for Bini.js