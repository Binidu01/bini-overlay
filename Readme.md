# bini-overlay

<p>
  <a href="https://www.npmjs.com/package/bini-overlay"><img src="https://img.shields.io/npm/v/bini-overlay?style=flat-square&color=0077FF&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/bini-overlay"><img src="https://img.shields.io/npm/dm/bini-overlay?style=flat-square&color=00CFFF&label=downloads" alt="npm downloads" /></a>
  <a href="https://github.com/Binidu01/bini-overlay/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/bini-overlay?style=flat-square&color=0077FF" alt="license" /></a>
  <a href="https://vitejs.dev"><img src="https://img.shields.io/badge/vite-7%2B%20%7C%208%2B-646cff?style=flat-square&logo=vite&logoColor=white" alt="vite" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js&logoColor=white" alt="node" /></a>
  <img src="https://img.shields.io/badge/dev_only-never_in_prod-22c55e?style=flat-square" alt="dev only" />
</p>

A Next.js-style error overlay and animated loading badge for **Bini.js** projects. Shows your Bini.js logo during development — animates on load and HMR updates, morphs into a clickable error pill when something goes wrong, and opens a full error panel with stack trace and code frame.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [States](#states)
- [HMR Events](#hmr-events)
- [Error Panel](#error-panel)
- [Options](#options)
- [Requirements](#requirements)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Related](#related)

---

## Features

- ✨ **Animated badge** — SVG stroke-drawing animation on page load and every HMR update
- 🚨 **Error panel** — centered overlay with error type, message, code frame, and call stack
- 🔴 **Error pill** — badge morphs into a red `1 Issue` / `3 Issues` pill — click to reopen the panel
- 🔄 **HMR integration** — reacts to `vite:error`, `vite:beforeUpdate`, and `vite:afterUpdate`
- 🧭 **Multi-error navigation** — prev/next arrows when multiple errors are queued
- 🎨 **Bini.js branding** — official gradient logo and `Bini.js` label in the toolbar
- 🎨 **Shiki syntax highlighting** — code frames highlighted via Shiki (loaded from CDN at runtime)
- 🔒 **Dev only** — never appears in production builds
- 🛡️ **Suppresses default Vite overlay** — replaces the built-in `vite-error-overlay` custom element
- 🧹 **Auto-clears** — overlay automatically hides when errors are fixed (no manual refresh needed)

---

## Installation

```bash
npm install bini-overlay --save-dev
# or
pnpm add bini-overlay -D
# or
yarn add bini-overlay -D
```

---

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { biniOverlay } from 'bini-overlay'

export default defineConfig({
  plugins: [
    react(),
    ...biniOverlay()
  ]
})
```

### With Options

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { biniOverlay } from 'bini-overlay'

export default defineConfig({
  plugins: [
    react(),
    ...biniOverlay({
      shikiTheme: 'dark-plus' // optional — any valid Shiki theme
    })
  ]
})
```

---

## How It Works

The badge sits in the **bottom-left** corner and responds to your development workflow:

### States

| State | Visual | Behavior |
|-------|--------|----------|
| **Loading** | 🌀 Logo draws itself with a stroke animation | Triggers on page load and HMR updates |
| **Idle** | 🎨 Logo sits as a filled gradient icon | Default state when no errors are present |
| **Error** | 🔴 Red pill with `1 Issue` / `3 Issues` | Click to open the error panel |

### Error Flow

```
1. Error occurs → badge morphs into red pill → overlay opens automatically
2. Navigate errors → use prev/next arrows to cycle through multiple errors
3. Fix the error → HMR updates → badge animates → overlay auto-closes
4. Back to idle → logo returns to normal state
```

---

## HMR Events

| Event | Action |
|-------|--------|
| `vite:error` | Shows error pill + auto-opens panel |
| `vite:beforeUpdate` | Clears resolved errors, shows loading animation |
| `vite:afterUpdate` | Returns to idle, auto-closes panel if no errors remain |

---

## Error Panel

When an error occurs, a full-screen overlay opens showing:

| Section | Description |
|---------|-------------|
| **Error Type** | Runtime Error / Parse Error / Build Error / Type Error / Unhandled Rejection |
| **File Info** | Detected file path with line number |
| **Code Frame** | Surrounding lines fetched from disk with highlighted error line |
| **Call Stack** | Collapsible stack trace with internal and `node_modules` frames filtered |
| **Copy Button** | Copies full error message, file, code context, and stack to clipboard |
| **Navigation** | Prev/Next arrows when multiple errors are queued |

### Code Frame Example

```
>>> 12: const name = user.name
    11: function Greeting() {
    13:   return <h1>Hello, {name}!</h1>
```

The error line is highlighted with `>>>` prefix and a red background.

---

## Options

```ts
interface BiniOverlayOptions {
  /**
   * Shiki theme to use for code frame highlighting.
   * Any valid Shiki theme name accepted.
   * 
   * @see https://shiki.matsu.io/themes
   * @default 'dark-plus'
   */
  shikiTheme?: string;
}
```

### Example Themes

- `'dark-plus'` — default, dark background with vibrant syntax
- `'github-dark'` — matches GitHub's dark mode
- `'one-dark-pro'` — popular Atom-inspired theme
- `'material-theme'` — clean Material Design colors
- `'dracula'` — dark purple-based theme
- `'solarized-dark'` — warm, muted dark theme

---

## Requirements

| | Version |
|---|---|
| Node.js | `>= 18.0.0` |
| Vite | `>= 7.0.0` |

---

## Troubleshooting

### Overlay doesn't appear
- Ensure you're in **development mode** (`npm run dev`)
- Check that `biniOverlay()` is added to the plugins array in `vite.config.ts`
- Verify the plugin is installed as a dev dependency

### Shiki highlighting not working
- The overlay loads Shiki from CDN at runtime
- An internet connection is required for first load
- Syntax highlighting falls back to plain text if Shiki fails to load

### Badge stays in loading state
- This indicates an HMR update is in progress
- The badge should resolve to idle or error state automatically

### Overlay stays visible after fixing errors
- The overlay auto-closes on `vite:afterUpdate` (fixed in v1.0.16+)
- If you're on an older version, update to the latest

---

## Contributing

Issues and pull requests are welcome. If you're adding a new feature, please open an issue first to discuss it.

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

- [Bini.js](https://bini.js.org) — The React Framework for Cross-Platform
- [bini-router](https://www.npmjs.com/package/bini-router) — File-based routing for Bini.js
- [bini-server](https://www.npmjs.com/package/bini-server) — Production server for Bini.js
- [bini-deploy](https://www.npmjs.com/package/bini-deploy) — Zero-config deployment for Bini.js
