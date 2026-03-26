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

## Features

- ✨ **Animated badge** — SVG stroke-drawing animation on page load and every HMR update
- 🚨 **Error panel** — centered overlay with error type, message, code frame, and call stack
- 🔴 **Error pill** — badge morphs into a red `1 Issue` / `3 Issues` pill — click to reopen the panel
- 🔄 **HMR integration** — reacts to `vite:error`, `vite:beforeUpdate`, and `vite:afterUpdate`
- 🧭 **Multi-error navigation** — prev/next arrows when multiple errors are queued
- 🎨 **Bini.js branding** — official gradient logo and `Bini.js` label in the toolbar
- 🎨 **Shiki syntax highlighting** — code frames highlighted via Shiki (loaded from unpkg at runtime)
- 🔒 **Dev only** — never appears in production builds
- 🛡️ **Suppresses default Vite overlay** — replaces the built-in `vite-error-overlay` custom element

---

## Install

```bash
npm install bini-overlay --save-dev
# or
pnpm add bini-overlay -D
```

---

## Usage

```ts
// vite.config.ts
import { defineConfig }  from 'vite'
import { biniOverlay }   from 'bini-overlay'

export default defineConfig({
  plugins: [biniOverlay()]
})
```

---

## How it works

The badge sits in the **bottom-left** corner in three states:

| State | Behaviour |
|---|---|
| **Loading** | Logo draws itself with a stroke animation |
| **Idle** | Logo sits as a filled gradient icon |
| **Error** | Badge morphs into a red pill — click to open the error panel |

When an error occurs, a full-screen overlay opens showing:

- **Error type** — Runtime Error / Parse Error / Build Error / Type Error / Unhandled Rejection
- **File link** — detected file path shown as a clickable button that opens in your editor
- **Code frame** — surrounding lines fetched from disk via a local dev server endpoint, with the error line highlighted
- **Call stack** — collapsible, with internal and `node_modules` frames filtered out
- **Copy button** — copies the full error message, file, code context, and stack to clipboard
- **Navigation arrows** — when multiple errors are queued

When an error is fixed and HMR applies the update, the panel closes automatically and the badge returns to idle.

---

## HMR Events

| Event | Action |
|---|---|
| `vite:error` | Shows error pill + auto-opens panel |
| `vite:beforeUpdate` | Clears resolved errors, shows loading animation |
| `vite:afterUpdate` | Returns to idle |

---

## Options

```ts
biniOverlay({
  /**
   * Shiki theme to use for code frame highlighting.
   * Any valid Shiki theme name accepted.
   * @default 'dark-plus'
   */
  shikiTheme: 'dark-plus',
})
```

---

## Requirements

| | Version |
|---|---|
| Node.js | `>= 18.0.0` |
| Vite | `>= 7.0.0` |

---

## License

MIT © [Binidu Ranasinghe](https://bini.js.org)