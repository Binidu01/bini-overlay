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
- [SSR Error Page](#ssr-error-page)
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
- An **SSR error page**: when a page request is answered with Vite's HTML error page (for example, when the dev server's `render(url)` call fails), the overlay replaces it with a minimal page and shows the error in the panel.
- Vite's built-in error overlay is **turned off** (`server.hmr.overlay = false`), so there is a single, consistent error UI. Vite's `vite:error` events still fire and are picked up by this overlay.
- **Locally served fonts** (Inter and Geist) for the overlay UI, so it works without network access to a font CDN.

Every plugin is registered with `apply: 'serve'`, so **nothing runs in or is injected into production builds.**

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
- [`bini-router`](https://www.npmjs.com/package/bini-router) `>= 2.0.0`. It is a peer dependency, not bundled into `bini-overlay`. The plugin loads it lazily (it starts importing it when the dev server starts) and uses it for the route type and Route Info. Bini.js projects already include it. npm 7+ installs missing peer dependencies automatically; pnpm and Yarn warn when one is missing.

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
  /** Hide the floating badge. The error overlay and dev endpoints stay active. */
  disableBadge?: boolean
}
```

`disableBadge` is the only option.

```ts
biniOverlay({ disableBadge: true })
```

Notes:

- The route directory is fixed to `src/app`, resolved against the Vite project root (`config.root`). It is not configurable.
- The Vite `base` config is picked up automatically when matching routes and when building asset and font URLs.
- The code-frame theme follows the overlay theme preference: Shiki's `dark-plus` in dark mode and `light-plus` in light mode.
- If you set `server.hmr` to `false` yourself, the plugin leaves your config alone. Otherwise it sets `server.hmr.overlay` to `false`.
- The package exports `biniOverlay` and the `BiniOverlayOptions` type.

---

## The Badge

The badge is a Shadow DOM widget (host element id `bini-loading-root`, so it never collides with your app's CSS) injected as a module script at the end of `<body>`. By default it sits in the **bottom-left** corner, 20px from the edges.

| State | Appearance | Behaviour |
| --- | --- | --- |
| **Loading** | Logo draws itself with a stroke animation | Plays when the badge first appears (until the page has loaded and the animation has finished) and again on each HMR update (`vite:beforeUpdate`) |
| **Idle** | Filled gradient logo | Default state when there are no errors |
| **Error** | Red pill showing `1 Issue` / `N Issues` | Click the count to open the error panel, or the logo to open the menu |

With `disableBadge: true` the badge script is not injected at all. The error panel still works, but the red issue pill is not shown and the `__bini_theme__` event is not dispatched.

### Menu

Click the badge to open the menu.

| Item | Description |
| --- | --- |
| **Issues** | Shown only when errors exist, with a red count. Click to reopen the error panel. |
| **Route** | Current route type: `Static` (green), `Dynamic` (amber), or `Not Found` (red). It reads `Static` until the first lookup returns. |
| **Bundler** | Fixed label: `Rolldown`. |
| **Route Info** | Opens the route inspector. |
| **Preferences** | Opens the preferences popover. |

The route type is fetched from `/__bini_route_match` on page load, on client-side navigation (`pushState`, `replaceState`, `popstate`), and after each HMR update.

### Route Info

Shows the current URL path and the matched route as a tree:

- The first row, `app`, lists the **file names** of the matching layouts as chips. On the root route (`/`) it also lists the page file and any parallel-route slots (shown as `@slot`). The row is omitted when it would have no chips.
- Below it is one row per segment of the matched route pattern, indented by depth. A dynamic route appears as its pattern (for example `:slug`), not the URL value. On non-root routes, the last segment row carries the page file and slot chips.
- Dynamic (`:param`) segments get a `dynamic` chip and catch-all (`*`) segments get a `catch-all` chip.
- **Intercepting routes:** when the route has an intercept whose source is the previous client-side route, the page chip shows the intercept file instead of the page file, labelled from the intercept folder down (for example `(.)view/page.tsx`). Intercepts only apply after a client-side navigation, so they never show on a fresh page load. Parallel slots and intercepts are reported only by `bini-router` versions that provide them.
- URLs with no matching route show: "No matching route for `/path`. This URL renders your 404 page."

### Preferences

| Setting | Options | Default |
| --- | --- | --- |
| **Theme** | System, Light, Dark | System |
| **Position** | Bottom Left, Bottom Right, Top Left, Top Right | Bottom Left |
| **Size** | Small (36px), Medium (48px), Large (56px) | Medium |
| **Hide for this session** | Hides the badge and its menus until the tab is closed | Off |
| **Shortcut** | Record any key combination (modifiers: Alt, Ctrl, Meta, Shift); press `Esc` to cancel recording | `Alt+B` |

- Preferences (`theme`, `position`, `size`, `shortcut`) are stored in `localStorage` under `bini-overlay:prefs`.
- The session-hide flag is stored in `sessionStorage` under `bini-overlay:hide-session`.
- The shortcut **toggles** the badge's visibility. Pressing a modifier on its own while recording is ignored; the recording ends when you press a non-modifier key.
- The theme preference also drives the error panel (which reads the same `localStorage` entry) and is broadcast through the `__bini_theme__` window event.
- Hiding affects only the badge and its menus. The error panel still opens when an error occurs.

---

## The Error Panel

The error script is injected at the start of `<head>` and creates the panel lazily on the first error. It is rendered as regular DOM (container id `__bini_ov__`, panel root id `__bini_root`), not inside the badge's Shadow DOM.

### Layout

| Section | Description |
| --- | --- |
| **Top tab (left)** | Previous / next buttons with an `n / total` counter |
| **Top tab (right)** | Static `Bini.js Rolldown` label |
| **Header** | Error type chip, copy button, and close button |
| **Message** | Cleaned headline in red, with any extra message lines below it |
| **Code Frame** | File icon, `file (line:column)`, open-in-editor button (only when the file is known), and the highlighted source lines |
| **Call Stack** | Application frames, plus a toggle for ignore-listed framework frames |
| **Component Stack** | React component hierarchy, when provided by an error boundary |
| **Footer** | "Was this helpful?" thumbs up / down (kept in memory only, per error, and not sent anywhere) |

### Error types

The header chip is derived from the error. Rules are checked in this order, and the first match wins. Message patterns are case-insensitive.

| # | Label | When |
| --- | --- | --- |
| 1 | `Runtime Error` | The error was reported as a `runtime` type (including via `__bini_error__` and the SSR error page) |
| 2 | `Unhandled Rejection` | The error's name is `Unhandled Rejection` |
| 3 | `Parse Error` | Message matches `SyntaxError`, `PARSE_ERROR`, `Unexpected token`, or `Expected` |
| 4 | `Build Error` | Message matches `Transform failed` or `Build failed` |
| 5 | `Type Error` | Message matches `TypeError`, or the error's name is `TypeError` |
| 6 | `Runtime Error` | Message matches `Element type is invalid`, `Cannot read`, `is not a function`, or `is not defined` |
| 7 | *the error's own name* | Any other `name` except `Plugin Error` and `Vite Error` (for example `ReferenceError`) |
| 8 | `Build Error` | Fallback |

### Code frame

- Read from disk through `/__bini_code_context`: **five lines**, two before and two after the failing line.
- The failing line is marked with `>` in the gutter and a red row highlight. When a column is known, a `^` caret line is drawn beneath it.
- Highlighted with [Shiki](https://shiki.style) loaded from `https://esm.sh/shiki@1`, using `dark-plus` or `light-plus` to match the theme. The language is chosen from the file extension (`tsx`, `typescript`, `jsx`, otherwise `javascript`) and each line is highlighted on its own. If Shiki cannot load, plain unhighlighted text is shown.
- `.tsx` / `.jsx` files show the React icon, `.ts` the TypeScript icon, and `.js` the JavaScript icon. Other extensions (such as `.mjs`) show no icon.

The plain-text form of a frame (as written by the copy button) looks like this:

```text
   9 | function Greeting() {
  10 |   const user = getUser()
> 11 |   const name = user.name
     |                ^
  12 |   return <h1>Hello, {name}!</h1>
  13 | }
```

### Call stack

- Frames are parsed from `at fn (url:line:column)` lines. Lines that mention `vite:oxc` are skipped. If a stack has no application frames but the error carries a file and line, a single frame is synthesized from that location.
- **Application frames** (up to 10) are clickable and open your editor at that line.
- **Framework frames** (up to 20) are collapsed behind a "Show N ignore-listed frame(s)" toggle and are not clickable. A frame counts as framework code when its URL involves `chunks/node.js`, Vite internals (`/node_modules/vite/`, `/node_modules/.pnpm/vite@`, `/@vite/client`), `rolldown`, or `node:internal`, or when the function name contains `transformWithOxc`, `viteTransformMiddleware`, `EnvironmentPluginContainer`, `loadAndTransform`, or `TransformPluginContext`.
- Each frame's URL is first reduced to a path (a `file://` prefix, the `http(s)://host` origin, and any query string are removed). Frames are then resolved to original source through `/__bini_sourcemap` when the path looks like a source file (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.vue`, `.svelte`, or under `/src/`). Paths starting with `data:`, `vite:`, `/@`, `/node_modules/`, or `chunks/` are never mapped, nor are `<anonymous>` frames or top-level script files such as `/entry.js` that are not under `/src/`.

### Copy button

Copies a Markdown summary to the clipboard:

```text
## Error Type
<type>

## Error Message
<headline>
<detail lines>

at (<file>:<line>:<column>)


    at fn (file:line)      <- application frames only

## Code Frame
<plain-text code frame, see above>

Bini.js (Rolldown)
```

The `at (...)` line is included only when the error has a file, and the Code Frame section only when a code frame was loaded.

### Error handling

Errors are captured from:

- `window` `error` events (the overlay calls `preventDefault()`)
- `unhandledrejection` events (the overlay calls `preventDefault()`)
- `__bini_error__` custom events from your own error boundaries, from routes generated by `bini-router`, and from the [SSR error page](#ssr-error-page)
- Vite's `vite:error` HMR event (named `Build Error` when the error has an id, otherwise `Vite Error`; a payload with only a `message` is also accepted and named `Build Error`)

Processing rules:

- **De-duplication:** two errors with the same file (or id), line, and first 100 characters of message count as one. A duplicate is ignored and does not move the panel selection.
- **Prioritisation:** errors are sorted by rank. Rank 0: messages containing `PARSE_ERROR` or `Expected`. Rank 1: `Transform failed`. Rank 2: other "real" errors, meaning messages containing `Unexpected token`, `SyntaxError`, `TypeError`, or `ReferenceError`, errors from the `vite:oxc` plugin, and runtime-type errors. Rank 3: everything else. A newly added error resets the panel to the first error.
- **Cascade filtering:** `Failed to fetch dynamically imported module`, `Failed to resolve import`, `Failed to load module`, `Loading chunk`, and `ChunkLoadError` are dropped while a real error exists, and are removed when a real error arrives.
- **Message cleaning:** `vite:oxc` / `vite:` prefixes, non-ASCII characters, a leading `[plugin]` tag, box-drawing / gutter lines, and lines mentioning `NextJs` or `Turbopack` are stripped. The first remaining line becomes the headline and the rest become detail lines.

### Error lifecycle

```text
1. Error occurs    -> badge becomes a red pill and the panel opens
2. Multiple errors -> navigate with prev/next; duplicates are merged
3. You fix it      -> HMR update arrives, resolved errors are cleared
4. All clear       -> panel closes and the badge returns to idle
```

| HMR event | Behaviour |
| --- | --- |
| `vite:error` | Adds the error, shows the pill, and opens the panel |
| `vite:beforeUpdate` | Removes errors belonging to the updated modules (all errors when the update lists none) and starts the badge loading animation. Closes the panel if nothing remains. |
| `vite:afterUpdate` | Clears every remaining error, closes the panel, returns the badge to idle, and dispatches `__bini_clear_errors__` |

### Unrecoverable errors

The close button is hidden when the page looks unrecoverable:

- the current error is a runtime error that carries a component stack, or
- no element that is a direct child of `<body>` and has an `id` (other than the overlay and the badge) is visible, **and** `#root` (or, failing that, `#app`) is missing or has no child elements.

The panel then stays up until a successful HMR update recovers the page, so you never end up staring at a blank screen.

---

## SSR Error Page

In development, `bini-router` renders every page request on the server through your `render(url)` export. If that fails, Vite answers with its own HTML error page. The `bini-overlay:ssr` plugin intercepts those responses so the error shows up in the same panel as every other error.

**What it intercepts.** An HTML navigation: a `GET` or `HEAD` request that accepts `text/html`, whose path does not start with `/@`, `/src/`, `/node_modules/`, `/api/`, or `/__`, and has no file extension. If the response body passed to `res.end()` is an HTML document containing `vite-error-overlay`, `__vite_error__`, `vite:error`, or `data-vite-dev-id="__vite_error`, it is replaced.

**What it does.**

1. Extracts the message, stack, file, line, and column from Vite's page (the `<title>`, the `window.__vite_error__` data, a `<pre>` block, or the first `file.ext:line:column` it finds).
2. Reads your project's `index.html` (cached after the first read; a minimal template is used if it cannot be read) and runs it through Vite's HTML transforms, so the overlay and badge scripts are included. If the transform fails, the untransformed template is used.
3. Inserts an inline script and a hidden `<pre data-bini-ssr-error>` marker before `</head>`, and replaces `<div id="root">...</div>` with a short "Server render error" placeholder.
4. Responds with status `500` and `Content-Type: text/html; charset=utf-8`.

The inline script stores the error on `window.__bini_ssr_error__` and dispatches a `__bini_error__` event with it (name `SSR Error`, runtime type). It waits for the overlay's `__bini_ready__` event, fires immediately when the overlay is already initialized, and fires anyway after 300 ms if the overlay never reports ready.

Because the placeholder is a visible element with child elements inside `#root`, this panel can be closed. Fix the error and reload the page.

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

The `detail` object accepts these fields:

| Field | Type | Description |
| --- | --- | --- |
| `message` | `string` | Error message |
| `name` | `string` | Error name (default `Runtime Error`) |
| `stack` | `string` | Stack trace, source-mapped when possible |
| `componentStack` | `string` | Optional React component stack |
| `file` / `line` | `string` / `number` | Optional. Inferred from the message (`module '…'`) or the stack when omitted. |
| `type` or `_type` | `string` | Defaults to `runtime`. Any `runtime` error is labelled `Runtime Error`. |

---

## Events

| Event (on `window`) | Direction | Description |
| --- | --- | --- |
| `__bini_error__` | You → overlay | Report an error (see above) |
| `__bini_clear_errors__` | Overlay → you | Fired after every HMR update, once errors are cleared. Use it to reset an error boundary. |
| `__bini_theme__` | Overlay → you | Fired when the resolved theme is applied or changes. `detail` is `'light'` or `'dark'`. Only dispatched when the badge is enabled. |
| `__bini_ready__` | Overlay → you | Fired once, after the overlay's listeners are attached. The [SSR error page](#ssr-error-page) waits for it before reporting. |

```tsx
useEffect(() => {
  const reset = () => setHasError(false)
  window.addEventListener('__bini_clear_errors__', reset)
  return () => window.removeEventListener('__bini_clear_errors__', reset)
}, [])
```

The scripts also set a few internal globals (`__bini_initialized`, `__bini_show_overlay`, `__bini_set_error_count`, and `__bini_ssr_error__` on the SSR error page) so the badge and the error panel can talk to each other. They are not a public API.

---

## Dev Server Endpoints

The plugins register the following middleware on the Vite dev server. They exist only during `vite dev`.

| Endpoint | Query | Purpose |
| --- | --- | --- |
| `/__bini_code_context` | `file`, `line` | Returns `{ lines }`: the failing line plus two lines either side, formatted `<marker><number>: <text>`, with the failing line's marker being `>>>`. Files are cached by modification time (up to 64 entries). Responds `400` for a missing file or invalid line and `404` when the file does not exist or is not inside the project root (both with `{ lines: [] }`). |
| `/__bini_sourcemap` | `file`, `line`, `column` | Maps a transformed position back to the original source using the client module graph's source map. Returns `{ file, line, column }`. Responds `400` for a missing file or invalid line, and `404` / `503` when it cannot map (no source map, no mapping, or `@jridgewell/trace-mapping` unavailable). |
| `/__bini_open_editor` | `file`, `line`, `column` | Opens a file in your editor via `launch-editor`. Responds `204` on success, `400` for a missing `file`, `404` if the file is missing or outside the project root, and `503` if `launch-editor` is not installed. |
| `/__bini_route_match` | `path` | Returns `{ type, path, routePath }`, where `type` is `static`, `dynamic`, or `not_found`. |
| `/__bini_route_info` | `path` | Returns `{ path, type, segments, layouts, pageFile, parallel, intercepts }` for Route Info. For a match, `path` is the matched route pattern; for `not_found` it is the request path. `parallel` and `intercepts` are empty unless your `bini-router` version provides them. |
| `/__bini_overlay/overlay.js`, `/__bini_overlay/badge.js` | n/a | The error panel and badge scripts (`badge.js` is not registered when `disableBadge` is set). Served with `Cache-Control: no-cache`. |
| `/__bini_overlay/fonts.css` | n/a | The combined Inter / Geist `@font-face` CSS. Served with `Cache-Control: no-cache`. |
| `/__bini_font/<font>/<file>` | n/a | Serves the Inter / Geist `.woff2` / `.woff` files from the Fontsource packages. |

The two route endpoints build a manifest from `src/app` with `bini-router`'s `generateRouteManifest()`, match with `matchManifestRoute()`, and cache the manifest for 200 ms, so a route you just added or removed shows up on the next lookup after that. The Vite `base` is stripped from the incoming path before matching. The code context, source map, open-editor, and route endpoints respond with `500` and `{ "error": "Internal error" }` if the handler throws (for example, when `bini-router` is not installed).

### Editor detection

Editor detection is fully delegated to [`launch-editor`](https://www.npmjs.com/package/launch-editor), which finds a running or configured editor for you. The file is opened at `file:line:column`. You can force an editor with the `LAUNCH_EDITOR` environment variable. If no editor can be launched, a `[bini-overlay] Could not open your editor` warning is printed to the dev server console.

### Fonts

The overlay UI uses **Inter** and **Geist** variable fonts. `@fontsource-variable/inter` and `@fontsource-variable/geist` are regular dependencies, so they are installed automatically. When the dev server config resolves, the plugin locates each package's `index.css` (first from your project, then from `bini-overlay` itself, then directly in `node_modules`) and rewrites its font URLs to `<base>/__bini_font/...`. It then adds a `<link rel="stylesheet">` for `/__bini_overlay/fonts.css` at the start of `<head>`. If neither package can be resolved (for example, a broken install), no stylesheet is added and the overlay falls back to system fonts. Font files are served with a long-lived immutable cache header.

---

## Security

The overlay exposes file-reading and process-launching endpoints, so they are locked down:

- **Same-origin only.** `/__bini_code_context`, `/__bini_sourcemap`, `/__bini_open_editor`, `/__bini_route_match`, `/__bini_route_info`, and the `/__bini_overlay/*` scripts and stylesheet check `Sec-Fetch-Site` (allowing `same-origin` and `none`), falling back to an `Origin` / `Host` comparison. Cross-origin requests receive `403`. The font files under `/__bini_font` are public static assets and are not origin-checked.
- **Project-root confinement.** `/__bini_code_context` and `/__bini_open_editor` accept a file system path, a URL, or a root-relative path, resolve it, and respond `404` if it falls outside the Vite project root or does not exist.
- **Fonts are confined too.** `/__bini_font` only serves `.woff2` / `.woff` files that sit inside the matching Fontsource package's `files` directory.
- **Dev server only.** Every plugin uses `apply: 'serve'`; none run in `vite build`.

---

## Architecture

`biniOverlay()` returns five cooperating plugins, in this order:

| Plugin | Role |
| --- | --- |
| `bini-overlay:font` | Serves Inter / Geist from Fontsource at `/__bini_font` and `/__bini_overlay/fonts.css`, and links that stylesheet at the start of `<head>` |
| `bini-overlay:api` | Registers the dev endpoints: code context, source maps, open-in-editor, and route match / info (via `bini-router`) |
| `bini-overlay:error` | Disables Vite's built-in error overlay, serves the error panel script, and injects it as a module script at the start of `<head>` |
| `bini-overlay:ssr` | Runs after other plugins (`enforce: 'post'`). Replaces Vite's HTML error page for page requests with a fallback page that reports the error to the panel (see [SSR Error Page](#ssr-error-page)) |
| `bini-overlay:badge` | Badge, menu, Route Info, and preferences, injected as a module script at the end of `<body>` (neither served nor injected when `disableBadge` is set) |

The badge and error scripts are served by the dev server rather than bundled through Vite, so Vite does not transform them and `import.meta.hot` is unavailable inside them. Each script starts with a small header that creates its own HMR context from `<base>/@vite/client`.

---

## Requirements

| Requirement | Version |
| --- | --- |
| Node.js | `>= 18.0.0` |
| Vite | `>= 8.0.0` (Rolldown-based, peer dependency) |
| bini-router | `>= 2.0.0` (peer dependency) |

### Dependencies (installed automatically)

| Package | Version | Purpose |
| --- | --- | --- |
| `@jridgewell/trace-mapping` | `^0.3.25` | Resolves source-mapped stack frames (loaded on first lookup) |
| `launch-editor` | `^2.14.2` | Opens files in your editor (loaded on first use) |
| `simple-icons` | `^16.34.0` | React / TypeScript / JavaScript file icons in the code frame |
| `@fontsource-variable/inter` | `^5.3.0` | Overlay font, served locally |
| `@fontsource-variable/geist` | `^5.3.0` | Overlay font, served locally |

### Peer dependencies (not bundled)

| Package | Version | Purpose |
| --- | --- | --- |
| `vite` | `>=8.0.0` | Host build tool and dev server |
| [`bini-router`](https://www.npmjs.com/package/bini-router) | `>=2.0.0` | Loaded lazily for route type and Route Info. Must export `generateRouteManifest` and `matchManifestRoute`. |

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
<summary><strong>Route type or Route Info doesn't work, or the terminal shows a <code>bini-router</code> error</strong></summary>

`bini-router` is a peer dependency that `bini-overlay` loads lazily. A missing or too-old install does not stop the dev server from starting, but the route endpoints respond with `500` and the badge keeps its default route label. Make sure `bini-router` is installed in your project (your package manager may have warned about a missing peer), and that the version is `>= 2.0.0` and exports `generateRouteManifest` and `matchManifestRoute`.

</details>

<details>
<summary><strong>Route type or Route Info shows "Not Found" everywhere</strong></summary>

- Check that your routes live in `src/app` (relative to the Vite project root), which is the directory `bini-overlay` scans.
- Check the terminal for a `bini-router` error such as a route conflict. The manifest can't be built until it is fixed.

</details>

<details>
<summary><strong>A page request shows "Server render error"</strong></summary>

That is the [SSR error page](#ssr-error-page): the dev server failed while rendering the page, and the full message, stack, and code frame are in the error panel. Fix the error and reload. If you change `index.html` while debugging, restart the dev server; the SSR error page reads that file once and keeps it.

</details>

<details>
<summary><strong>Stack frames point at transformed code, not my source</strong></summary>

Frames are mapped through Vite's module graph, so a frame can only be resolved if that module has been transformed and has a source map. Third-party, pre-bundled, or not-yet-loaded modules fall back to their raw positions. Frames from your own `src/` files should resolve normally.

</details>

<details>
<summary><strong>Clicking a stack frame does nothing</strong></summary>

Only application frames are clickable. Check the dev server terminal. `launch-editor` could not find an editor (or, if it failed to install, the endpoint returns `503`; run `npm i launch-editor`). Set the `LAUNCH_EDITOR` environment variable, or install your editor's shell command (for example, "Install 'code' command" in VS Code).

</details>

<details>
<summary><strong><code>403 Forbidden</code> from <code>/__bini_*</code> endpoints</strong></summary>

The endpoints reject cross-origin requests. If the dev server is behind a proxy on a different origin, open it directly instead. Paths outside the project root are rejected with `404`.

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
