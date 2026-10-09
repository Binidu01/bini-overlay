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
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Options](#options)
- [The Badge](#the-badge)
- [The Error Panel](#the-error-panel)
- [Reporting Errors From Your App](#reporting-errors-from-your-app)
- [Events](#events)
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

- A floating **badge** that animates during HMR updates, shows the current route type, and opens a menu with a route inspector and preferences.
- A **red issue pill** that replaces the idle badge when something breaks.
- A full-screen **error panel** with a syntax-highlighted code frame, a source-mapped call stack, and one-click "open in editor".
- A hidden replacement for Vite's `vite-error-overlay` element, so there is a single, consistent error UI.
- **Locally served fonts** (Inter and Geist) for the overlay UI, so it works without network access to a font CDN.

Every plugin is registered with `apply: 'serve'`, and every HTML transform also checks that a dev server is running. **Nothing is injected into production builds.**

---

## Installation

```bash
npm install bini-overlay --save-dev
# or
pnpm add bini-overlay -D
# or
yarn add bini-overlay -D
```

You also need:

- `vite` `>= 8` (Rolldown-based). Vite 7 and earlier are not supported.
- [`bini-router`](https://www.npmjs.com/package/bini-router) `>= 2.0.0`. It is a peer dependency, not bundled into `bini-overlay`. The plugin imports it when the dev server starts and uses it for the route type and Route Info. Bini.js projects already include it. npm 7+ installs missing peer dependencies automatically; pnpm and Yarn warn when one is missing.

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
    biniOverlay(), // returns an array of plugins
  ],
})
```

`biniOverlay()` returns a `PluginOption[]`. Vite flattens nested plugin arrays, so add it to `plugins` as-is, with no spread.

---

## Options

```ts
export interface BiniOverlayOptions {
  /**
   * Skip the loading badge and its menu while keeping the error overlay.
   * @default false
   */
  disableBadge?: boolean
}
```

`disableBadge` is the only option.

```ts
biniOverlay({ disableBadge: true })
```

Notes:

- The route directory is fixed to `src/app` (relative to the working directory) and is not configurable.
- The Vite `base` config is picked up automatically when matching routes and when building font URLs.
- The code-frame theme follows the overlay theme preference: Shiki's `dark-plus` in dark mode and `light-plus` in light mode.
- The package exports `biniOverlay` and the `BiniOverlayOptions` type.

---

## The Badge

The badge is a Shadow DOM widget (so it never collides with your app's CSS) injected as a module script just before `</body>`. By default it sits in the **bottom-left** corner, 20px from the edges.

| State | Appearance | Behaviour |
|-------|------------|-----------|
| **Loading** | Logo draws itself with a stroke animation | Runs on page load and on each HMR update (`vite:beforeUpdate`) |
| **Idle** | Filled gradient logo | Default state when there are no errors |
| **Error** | Red pill showing `1 Issue` / `N Issues` | Click the count to open the error panel, or the logo to open the menu |

With `disableBadge: true` the badge is not injected at all. The error panel still works, but the red issue pill is not shown.

### Menu

Click the badge to open the menu.

| Item | Description |
|------|-------------|
| **Issues** | Shown only when errors exist, with a red count. Click to reopen the error panel. |
| **Route** | Current route type: `Static` (green), `Dynamic` (amber), or `Not Found` (red). |
| **Bundler** | Fixed label: `Rolldown`. |
| **Route Info** | Opens the route inspector. |
| **Preferences** | Opens the preferences popover. |

The route type is fetched from `/__bini_route_match` on page load, on client-side navigation (`pushState`, `replaceState`, `popstate`), and after each HMR update.

### Route Info

Shows the current URL path and the matched route as a tree:

- The first row, `app`, lists the **file names** of the matching layouts and the page file as chips.
- Below it is one row per segment of the matched route pattern, indented by depth. A dynamic route appears as its pattern (for example `:slug`), not the URL value.
- Dynamic (`:param`) segments get a `dynamic` chip and catch-all (`*`) segments get a `catch-all` chip.
- URLs with no matching route show: "No matching route for `/path`. This URL renders your 404 page."

### Preferences

| Setting | Options | Default |
|---------|---------|---------|
| **Theme** | System, Light, Dark | System |
| **Position** | Bottom Left, Bottom Right, Top Left, Top Right | Bottom Left |
| **Size** | Small (36px), Medium (48px), Large (56px) | Medium |
| **Hide for this session** | Hides the badge and its menus until the tab is closed | Off |
| **Shortcut** | Record any key combination (modifiers: Alt, Ctrl, Meta, Shift); press `Esc` to cancel recording | `Alt+B` |

- Preferences (`theme`, `position`, `size`, `shortcut`) are stored in `localStorage` under `bini-overlay:prefs`.
- The session-hide flag is stored in `sessionStorage` under `bini-overlay:hide-session`.
- The shortcut **toggles** the badge's visibility.
- The theme preference also drives the error panel and is broadcast through the `__bini_theme__` window event.
- Hiding affects only the badge and its menus. The error panel still opens when an error occurs.

---

## The Error Panel

The error script is injected at the start of `<head>` and creates the panel lazily on the first error. It is rendered as regular DOM (element id `__bini_ov__`), not inside the badge's Shadow DOM.

### Layout

| Section | Description |
|---------|-------------|
| **Top tab (left)** | Previous / next buttons with an `n / total` counter |
| **Top tab (right)** | Static `Bini.js Rolldown` label |
| **Header** | Error type chip, copy button, and close button |
| **Message** | Cleaned headline in red, with any extra message lines below it |
| **Code Frame** | File icon, `file (line:column)`, open-in-editor button, and the highlighted source lines |
| **Call Stack** | Application frames, plus a toggle for ignore-listed framework frames |
| **Component Stack** | React component hierarchy, when provided by an error boundary |
| **Footer** | "Was this helpful?" thumbs up / down (kept in memory only, not sent anywhere) |

### Error types

The header chip is derived from the error:

| Label | When |
|-------|------|
| `Runtime Error` | Errors reported as `runtime` (including via `__bini_error__`), or messages such as `Cannot read`, `is not a function`, `is not defined`, `Element type is invalid` |
| `Unhandled Rejection` | `unhandledrejection` events |
| `Parse Error` | `SyntaxError`, `PARSE_ERROR`, `Unexpected token`, `Expected` |
| `Build Error` | `Transform failed`, `Build failed`, and the fallback |
| `Type Error` | `TypeError` |
| *the error's own name* | Any other `name` except `Plugin Error` and `Vite Error` (for example `ReferenceError`) |

### Code frame

- Read from disk through `/__bini_code_context`: **five lines**, two before and two after the failing line.
- The failing line is marked with `>` and a red row highlight. When a column is known, a `^` caret line is drawn beneath it.
- Highlighted with [Shiki](https://shiki.style) loaded from `https://esm.sh/shiki@1`, using `dark-plus` or `light-plus` to match the theme. If Shiki cannot load, plain unhighlighted text is shown.
- `.tsx` / `.jsx` files show the React icon, `.ts` the TypeScript icon, and `.js` the JavaScript icon.

```
     9: function Greeting() {
    10:   const user = getUser()
>   11:   const name = user.name
    12:   return <h1>Hello, {name}!</h1>
    13: }
```

### Call stack

- Frames are parsed from `at fn (url:line:column)` lines.
- **Application frames** (up to 10) are clickable and open your editor at that line.
- **Framework frames** (up to 20) are collapsed behind a "Show N ignore-listed frame(s)" toggle and are not clickable. A frame counts as framework code when it involves `chunks/node.js`, Vite internals (`/node_modules/vite/`, `.pnpm/vite@`, `/@vite/client`), `rolldown`, `node:internal`, or functions such as `transformWithOxc`, `viteTransformMiddleware`, `EnvironmentPluginContainer`, `loadAndTransform`, and `TransformPluginContext`.
- Frames are resolved to original source through `/__bini_sourcemap` when the URL looks like a source file (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.vue`, `.svelte`, or under `/src/`).

### Copy button

Copies a Markdown summary to the clipboard:

```
## Error Type
<type>

## Error Message
<headline, details, and `at (file:line:column)`>

    at fn (file:line)      <- application frames

## Code Frame
<plain-text code frame>

Bini.js (Rolldown)
```

### Error handling

Errors are captured from:

- `window` `error` events (the overlay calls `preventDefault()`)
- `unhandledrejection` events (the overlay calls `preventDefault()`)
- `__bini_error__` custom events from your own error boundaries
- Vite's `vite:error` HMR event (named `Build Error` when the error has an id, otherwise `Vite Error`)

Processing rules:

- **De-duplication:** two errors with the same file, line, and first 100 characters of message count as one.
- **Prioritisation:** "real" errors sort first. These are messages containing `PARSE_ERROR`, `Expected`, `Unexpected token`, `Transform failed`, `SyntaxError`, `TypeError`, or `ReferenceError`, errors from the `vite:oxc` plugin, and runtime errors.
- **Cascade filtering:** `Failed to fetch dynamically imported module`, `Failed to resolve import`, `Failed to load module`, `Loading chunk`, and `ChunkLoadError` are dropped while a real error exists, and are removed when a real error arrives.
- **Message cleaning:** `vite:oxc` / `vite:` prefixes, non-ASCII characters, and box-drawing lines are stripped. The first remaining line becomes the headline and the rest become detail lines.

### Error lifecycle

```
1. Error occurs    -> badge becomes a red pill and the panel opens
2. Multiple errors -> navigate with prev/next; duplicates are merged
3. You fix it      -> HMR update arrives, resolved errors are cleared
4. All clear       -> panel closes and the badge returns to idle
```

| HMR event | Behaviour |
|-----------|-----------|
| `vite:error` | Adds the error, shows the pill, and opens the panel |
| `vite:beforeUpdate` | Removes errors belonging to the updated modules (all errors when the update lists none) and starts the badge loading animation. Closes the panel if nothing remains. |
| `vite:afterUpdate` | Clears every remaining error, closes the panel, returns the badge to idle, and dispatches `__bini_clear_errors__` |

### Unrecoverable errors

The close button is hidden when the current error is a runtime error that carries a component stack, or when the page appears to have rendered nothing at all. The panel stays up until a successful HMR update recovers the page, so you never end up staring at a blank screen.

---

## Reporting Errors From Your App

Uncaught errors and unhandled rejections are captured automatically. To route errors from a React **error boundary** into the overlay, dispatch a `__bini_error__` event:

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

Routes generated by `bini-router` already dispatch `__bini_error__` for you in development.

**`detail` fields**

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Error message |
| `name` | `string` | Error name (default `Runtime Error`) |
| `stack` | `string` | Stack trace, source-mapped when possible |
| `componentStack` | `string` | Optional React component stack |
| `file` / `line` | `string` / `number` | Optional. Inferred from the stack or message when omitted. |
| `type` or `_type` | `string` | Defaults to `runtime` |

---

## Events

| Event (on `window`) | Direction | Description |
|---------------------|-----------|-------------|
| `__bini_error__` | You → overlay | Report an error (see above) |
| `__bini_clear_errors__` | Overlay → you | Fired after every HMR update, once errors are cleared. Use it to reset an error boundary. |
| `__bini_theme__` | Overlay → you | Fired when the resolved theme changes. `detail` is `'light'` or `'dark'`. |

```tsx
useEffect(() => {
  const reset = () => setHasError(false)
  window.addEventListener('__bini_clear_errors__', reset)
  return () => window.removeEventListener('__bini_clear_errors__', reset)
}, [])
```

---

## Dev Server Endpoints

The plugins register the following middleware on the Vite dev server. They exist only during `vite dev`.

| Endpoint | Query | Purpose |
|----------|-------|---------|
| `/__bini_code_context` | `file`, `line` | Returns `{ lines }`: the failing line plus two lines either side, with the failing line prefixed `>>>`. Files are cached by modification time (up to 64 entries). |
| `/__bini_sourcemap` | `file`, `line`, `column` | Maps a transformed position back to the original source using the client module graph's source map. Returns `{ file, line, column }`, or `404` / `503` when it cannot. |
| `/__bini_open_editor` | `file`, `line`, `column` | Opens a file in your editor via `launch-editor`. Responds `204` on success, `404` if the file is missing, and `503` if `launch-editor` is not installed. |
| `/__bini_route_match` | `path` | Returns `{ type, path, routePath }`, where `type` is `static`, `dynamic`, or `not_found`. |
| `/__bini_route_info` | `path` | Returns `{ path, type, segments, layouts, pageFile }` for Route Info. |
| `/__bini_font/<font>/<file>` | n/a | Serves the Inter / Geist `.woff2` / `.woff` files from the Fontsource packages. |

The two route endpoints build a manifest from `src/app` with `bini-router`'s `generateRouteManifest()`, match with `matchManifestRoute()`, and cache the manifest for 200 ms, so a route you just added or removed shows up on the next lookup after that. The Vite `base` is stripped from the incoming path before matching.

### Editor detection

Editor detection is fully delegated to [`launch-editor`](https://www.npmjs.com/package/launch-editor), which finds a running or configured editor for you. You can force one with the `LAUNCH_EDITOR` environment variable. If no editor can be launched, a warning is printed to the dev server console.

### Fonts

The overlay UI uses **Inter** and **Geist** variable fonts. `@fontsource-variable/inter` and `@fontsource-variable/geist` are regular dependencies, so they are installed automatically. On dev server start the plugin resolves them, rewrites their font URLs to `/__bini_font/...`, and injects the CSS into `<head>`. If a package still cannot be resolved (for example, a broken install), the overlay falls back to system fonts. Font files are served with a long-lived immutable cache header.

---

## Security

The overlay exposes file-reading and process-launching endpoints, so they are locked down:

- **Same-origin only.** `/__bini_code_context`, `/__bini_sourcemap`, `/__bini_open_editor`, `/__bini_route_match`, and `/__bini_route_info` check `Sec-Fetch-Site` (allowing `same-origin` and `none`), falling back to an `Origin` / `Host` comparison. Cross-origin requests receive `403`.
- **Working-directory confinement.** `/__bini_code_context` and `/__bini_open_editor` resolve the requested path and reject it with `403` if it escapes the current working directory.
- **Fonts are confined too.** `/__bini_font` only serves `.woff2` / `.woff` files that sit inside the matching Fontsource package's `files` directory.
- **Dev server only.** Every plugin uses `apply: 'serve'`; none run in `vite build`.

---

## Architecture

`biniOverlay()` returns eight cooperating plugins, in this order:

| Plugin | Role |
|--------|------|
| `bini-overlay:font` | Serves Inter / Geist from Fontsource and injects their CSS into `<head>` |
| `bini-overlay:code-context` | Serves code frames from disk |
| `bini-overlay:sourcemap` | Resolves source-mapped stack positions |
| `bini-overlay:open-editor` | Launches your editor at a file and line |
| `bini-overlay:routes` | Route matching and route info via `bini-router` |
| `bini-overlay:vite-intercept` | Registers a hidden `vite-error-overlay` element so Vite's built-in overlay never shows |
| `bini-overlay:error` | Client-side error capture and the error panel, injected as a module script at the start of `<head>` |
| `bini-overlay:loading` | Badge, menu, Route Info, and preferences, injected as a module script before `</body>` (omitted when `disableBadge` is set) |

---

## Requirements

| | Version |
|---|---|
| Node.js | `>= 18.0.0` |
| Vite | `>= 8.0.0` (Rolldown-based, peer dependency) |
| bini-router | `>= 2.0.0` (peer dependency) |

**Dependencies (installed automatically)**

| Package | Version | Purpose |
|---------|---------|---------|
| `@jridgewell/trace-mapping` | `^0.3.25` | Resolves source-mapped stack frames (loaded on first lookup) |
| `launch-editor` | `^2.14.2` | Opens files in your editor (loaded on first use) |
| `simple-icons` | `^16.34.0` | React / TypeScript / JavaScript file icons in the code frame |
| `@fontsource-variable/inter` | `^5.3.0` | Overlay font, served locally |
| `@fontsource-variable/geist` | `^5.3.0` | Overlay font, served locally |

**Peer dependencies (not bundled)**

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | `>=8.0.0` | Host build tool and dev server |
| [`bini-router`](https://www.npmjs.com/package/bini-router) | `>=2.0.0` | Imported at dev-server start for route type and Route Info. Must export `generateRouteManifest` and `matchManifestRoute`. |

Peer dependencies and dependencies are kept external in the build, so none of the packages above are inlined into `dist`.

The package is `"type": "module"` and ships ESM (`dist/index.js`) and CommonJS (`dist/index.cjs`) builds with bundled TypeScript types (`dist/index.d.ts`). It is marked `sideEffects: false`.

**Network access:** syntax highlighting loads Shiki from `esm.sh`. Fonts are served locally and do not need network access. Offline, the overlay still works with plain-text code frames.

---

## Troubleshooting

<details>
<summary><strong>The overlay doesn't appear</strong></summary>

- Make sure you're running the dev server (`npm run dev`), not a production build.
- Confirm `biniOverlay()` is in the `plugins` array of `vite.config.ts`.
- Confirm the package is installed as a dev dependency.
</details>

<details>
<summary><strong>Code frames have no colours</strong></summary>

Shiki is loaded at runtime from `esm.sh`. If it can't be reached, frames render as plain text. Reconnect and reload to restore highlighting.
</details>

<details>
<summary><strong>The dev server errors about <code>bini-router</code> on startup</strong></summary>

`bini-router` is a peer dependency that `bini-overlay` imports when the dev server starts. Make sure it is installed in your project (your package manager may have warned about a missing peer), and that the version is `>= 2.0.0` and exports `generateRouteManifest` and `matchManifestRoute`.
</details>

<details>
<summary><strong>Route type or Route Info shows "Not Found" everywhere</strong></summary>

- Check that your routes live in `src/app`, which is the directory `bini-overlay` scans.
- Check the terminal for a `bini-router` error such as a route conflict. The manifest can't be built until it is fixed.
</details>

<details>
<summary><strong>Stack frames point at transformed code, not my source</strong></summary>

Frames are mapped through Vite's module graph, so a frame can only be resolved if that module has been transformed and has a source map. Third-party, pre-bundled, or not-yet-loaded modules fall back to their raw positions. Frames from your own `src/` files should resolve normally.
</details>

<details>
<summary><strong>Clicking a stack frame does nothing</strong></summary>

Check the dev server terminal. `launch-editor` could not find an editor (or, if it failed to install, the endpoint returns `503`; run `npm i launch-editor`). Set the `LAUNCH_EDITOR` environment variable, or install your editor's shell command (for example, "Install 'code' command" in VS Code).
</details>

<details>
<summary><strong><code>403 Forbidden</code> from <code>/__bini_*</code> endpoints</strong></summary>

The endpoints reject cross-origin requests. If the dev server is behind a proxy on a different origin, open it directly instead. Paths outside the working directory are also rejected.
</details>

<details>
<summary><strong>The badge is missing</strong></summary>

It may be hidden for the session. Press your shortcut (default `Alt+B`) to bring it back, or check that `disableBadge` isn't set.
</details>

<details>
<summary><strong>The overlay stays open after I fix the error</strong></summary>

The panel closes on `vite:afterUpdate`. If the page crashed so hard that nothing renders, the close button is hidden until an update recovers it. Also check the terminal for a build error that is still failing.
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
- [bini-ssg](https://www.npmjs.com/package/bini-ssg): Static site generation for Bini.js
- [bini-server](https://www.npmjs.com/package/bini-server): Production server for Bini.js
- [bini-deploy](https://www.npmjs.com/package/bini-deploy): Zero-config deployment for Bini.js