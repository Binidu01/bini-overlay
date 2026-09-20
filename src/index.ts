import type {
  Plugin,
  PluginOption,
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
  ViteDevServer,
} from 'vite';
import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface BiniOverlayOptions {
  appDir?: string;
  disableBadge?: boolean;
  editor?: string;
}

interface BiniPlugin extends Plugin {
  name: string;
  apply?: 'serve' | 'build' | ((this: void, config: any, env: any) => boolean);
}

// ─────────────────────────────────────────────────────────────
// Shared constants
// ─────────────────────────────────────────────────────────────
const BINI_PATH =
  'M8.04688 29.9219V24.8047C9.1276 25.4948 10.2734 25.8398 11.4844 25.8398C12.5651 25.8398' +
  ' 13.4245 25.5013 14.0625 24.8242C14.7135 24.1341 15.0391 23.1901 15.0391 21.9922C15.0391' +
  ' 20.4818 14.4596 19.2904 13.3008 18.418C12.1419 17.5326 10.5078 17.0573 8.39844 16.9922V12.6758' +
  'C9.84375 12.5716 10.9635 12.1289 11.7578 11.3477C12.5651 10.5664 12.9688 9.53125 12.9688' +
  ' 8.24219C12.9688 7.14844 12.6758 6.28906 12.0898 5.66406C11.5169 5.03906 10.7422 4.72656' +
  ' 9.76562 4.72656C7.36979 4.72656 6.17188 6.32161 6.17188 9.51172V30.0781H0V9.58984C0 6.6862' +
  ' 0.891927 4.36198 2.67578 2.61719C4.45964 0.872396 6.9401 0 10.1172 0C12.9427 0 15.1758' +
  ' 0.716146 16.8164 2.14844C18.457 3.56771 19.2773 5.39714 19.2773 7.63672C19.2773 9.22526' +
  ' 18.8086 10.6185 17.8711 11.8164C16.9466 13.0143 15.7487 13.8346 14.2773 14.2773V14.3555' +
  'C19.0039 15.2539 21.3672 17.8516 21.3672 22.1484C21.3672 24.4922 20.5404 26.4844 18.8867' +
  ' 28.125C17.2461 29.7526 15.0195 30.5664 12.207 30.5664C10.8398 30.5664 9.45312 30.3516 8.04688 29.9219Z';

const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`;
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PREV_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.24996 12.0608L8.71963 11.5304L5.89641 8.70722C5.50588 8.3167 5.50588 7.68353 5.89641 7.29301L8.71963 4.46978L9.24996 3.93945L10.3106 5.00011L9.78029 5.53044L7.31062 8.00011L9.78029 10.4698L10.3106 11.0001L9.24996 12.0608Z" fill="currentColor"/></svg>`;
const NEXT_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.75011 3.93945L7.28044 4.46978L10.1037 7.29301C10.4942 7.68353 10.4942 8.3167 10.1037 8.70722L7.28044 11.5304L6.75011 12.0608L5.68945 11.0001L6.21978 10.4698L8.68945 8.00011L6.21978 5.53044L5.68945 5.00011L6.75011 3.93945Z" fill="currentColor"/></svg>`;
const CHEVRON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="#666" fill-rule="evenodd" clip-rule="evenodd" d="M5.50011 1.93945L6.03044 2.46978L10.8537 7.293C11.2442 7.68353 11.2442 8.31669 10.8537 8.70722L6.03044 13.5304L5.50011 14.0608L4.43945 13.0001L4.96978 12.4698L9.43945 8.00011L4.96978 3.53044L4.43945 3.00011L5.50011 1.93945Z"></path></svg>`;
const CHEVRON_UP = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.93945 10.5001L4.46978 9.96978L8.00011 6.44011L11.5304 9.96978L12.0608 10.5001L13.0001 9.43945L12.4698 8.90912L8.53044 4.96978C8.23756 4.67689 7.76267 4.67689 7.46978 4.96978L3.53044 8.90912L3.00011 9.43945L3.93945 10.5001Z" fill="currentColor"/></svg>`;
const CHEVRON_DOWN = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.0608 5.50011L11.5304 6.03044L8.00011 9.56011L4.46978 6.03044L3.93945 5.50011L3.00011 6.56078L3.53044 7.09111L7.46978 11.0304C7.76267 11.3233 8.23756 11.3233 8.53044 11.0304L12.4698 7.09111L13.0001 6.56078L12.0608 5.50011Z" fill="currentColor"/></svg>`;
const CLOSE_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const GEAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const EYE_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const INDENT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 9 12 3 18"/><line x1="21" y1="6" x2="12" y2="6"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="21" y1="18" x2="12" y2="18"/></svg>`;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function isDev(ctx: IndexHtmlTransformContext): boolean {
  return !!ctx.server;
}

function scriptTag(
  js: string,
  injectTo: HtmlTagDescriptor['injectTo'] = 'head-prepend',
  isModule: boolean = true
): HtmlTagDescriptor {
  return {
    tag: 'script',
    attrs: isModule ? { type: 'module' } : {},
    children: js,
    injectTo
  };
}

function isSameOriginRequest(req: IncomingMessage): boolean {
  const secFetchSite = req.headers['sec-fetch-site'];
  if (typeof secFetchSite === 'string') {
    return secFetchSite === 'same-origin' || secFetchSite === 'none';
  }
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function rejectCrossOrigin(res: ServerResponse): void {
  res.statusCode = 403;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Forbidden: cross-origin request' }));
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 1 — HMR loading badge with menu
// ─────────────────────────────────────────────────────────────
function biniLoadingPlugin(options: BiniOverlayOptions = {}): BiniPlugin {
  const isDisabled = options.disableBadge === true;

  return {
    name: 'bini-overlay:loading',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler(
        html: string,
        ctx: IndexHtmlTransformContext,
      ): string | HtmlTagDescriptor[] {
        if (!isDev(ctx)) return html;
        if (isDisabled) return html;

        const js = `
(function () {
  if (document.getElementById("bini-loading-root")) return;
  var container = document.createElement("div");
  container.id = "bini-loading-root";
  document.body.appendChild(container);
  var sr = container.attachShadow({ mode: "open" });
  sr.id = "bini-loading-shadow";

  var PREFS_KEY = 'bini-overlay:prefs';
  var HIDE_SESSION_KEY = 'bini-overlay:hide-session';

  function defaultPrefs() {
    return {
      theme: 'system',
      position: 'bottom-left',
      size: 'medium',
      shortcut: 'Alt+B'
    };
  }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return defaultPrefs();
      var parsed = JSON.parse(raw);
      var merged = defaultPrefs();
      if (parsed && typeof parsed === 'object') {
        if (parsed.theme) merged.theme = parsed.theme;
        if (parsed.position) merged.position = parsed.position;
        if (parsed.size) merged.size = parsed.size;
        if (parsed.shortcut) merged.shortcut = parsed.shortcut;
      }
      return merged;
    } catch (_e) { return defaultPrefs(); }
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_e) {}
  }

  var prefs = loadPrefs();
  var isHiddenSession = false;
  try { isHiddenSession = sessionStorage.getItem(HIDE_SESSION_KEY) === '1'; } catch (_e) {}

  function resolveTheme(t) {
    if (t === 'system') {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    return t;
  }

  function positionStyles(pos) {
    switch (pos) {
      case 'top-left':     return { top: '20px', left: '20px' };
      case 'top-right':    return { top: '20px', right: '20px' };
      case 'bottom-right': return { bottom: '20px', right: '20px' };
      default:             return { bottom: '20px', left: '20px' };
    }
  }

  function sizeDims(size) {
    switch (size) {
      case 'small':  return { pill: 36, logoW: 14, logoH: 19, circle: 28, count: 14, label: 12, pad: 12 };
      case 'large':  return { pill: 56, logoW: 24, logoH: 33, circle: 46, count: 20, label: 17, pad: 20 };
      default:       return { pill: 48, logoW: 20, logoH: 28, circle: 40, count: 18, label: 15, pad: 16 };
    }
  }

  var style = document.createElement("style");
  style.textContent = [
    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');",
    ":host { all: initial; display: block; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }",
    "",
    ":host {",
    "  --bini-bg: #0a0a0a;",
    "  --bini-text: #e4e4e7;",
    "  --bini-text-muted: #71717a;",
    "  --bini-border: rgba(255,255,255,0.08);",
    "  --bini-border-strong: rgba(255,255,255,0.18);",
    "  --bini-hover: rgba(255,255,255,0.06);",
    "  --bini-chip-bg: rgba(255,255,255,0.05);",
    "  --bini-menu-shadow: 0 8px 30px rgba(0,0,0,0.6);",
    "  --bini-route: #60a5fa;",
    "  --bini-accent: #3b82f6;",
    "  --bini-dropdown-bg: #111111;",
    "  --bini-dropdown-border: rgba(255,255,255,0.1);",
    "  --bini-dropdown-hover: rgba(255,255,255,0.08);",
    "  --bini-badge-bg: #0a0a0a;",
    "  --bini-badge-border: rgba(255,255,255,0.15);",
    "  --bini-badge-shadow: 0 4px 20px rgba(0,0,0,0.5);",
    "  --bini-menu-label: #ffffff;",
    "}",
    ":host([data-theme='light']) {",
    "  --bini-bg: #ffffff;",
    "  --bini-text: #18181b;",
    "  --bini-text-muted: #6b7280;",
    "  --bini-border: rgba(0,0,0,0.08);",
    "  --bini-border-strong: rgba(0,0,0,0.18);",
    "  --bini-hover: rgba(0,0,0,0.04);",
    "  --bini-chip-bg: rgba(0,0,0,0.04);",
    "  --bini-menu-shadow: 0 8px 30px rgba(0,0,0,0.15);",
    "  --bini-route: #2563eb;",
    "  --bini-accent: #2563eb;",
    "  --bini-dropdown-bg: #ffffff;",
    "  --bini-dropdown-border: rgba(0,0,0,0.1);",
    "  --bini-dropdown-hover: rgba(0,0,0,0.04);",
    "  --bini-badge-bg: #0a0a0a;",
    "  --bini-badge-border: rgba(255,255,255,0.15);",
    "  --bini-badge-shadow: 0 4px 20px rgba(0,0,0,0.5);",
    "  --bini-menu-label: #18181b;",
    "}",
    "",
    "#w {",
    "  position: fixed;",
    "  width: var(--bini-badge-size, 48px);",
    "  height: var(--bini-badge-size, 48px);",
    "  display: flex; align-items: center; justify-content: center;",
    "  z-index: 2147483647; border-radius: 50%;",
    "  background: var(--bini-badge-bg);",
    "  border: 1px solid var(--bini-badge-border);",
    "  box-shadow: var(--bini-badge-shadow);",
    "  pointer-events: auto; cursor: pointer;",
    "  transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);",
    "  overflow: hidden;",
    "}",
    "#w.has-errors {",
    "  width: auto;",
    "  max-width: none;",
    "  border-radius: 999px;",
    "  background: #dc2626;",
    "  border: none;",
    "  box-shadow: 0 4px 20px rgba(220,38,38,0.4), 0 2px 6px rgba(0,0,0,0.3);",
    "  padding: 0;",
    "  gap: 0;",
    "  height: var(--bini-pill-h, 40px);",
    "  overflow: hidden;",
    "  align-items: center;",
    "  justify-content: flex-start;",
    "  display: flex;",
    "}",
    ".bf, .bs {",
    "  position: absolute;",
    "  top: 50%; left: 50%;",
    "  transform: translate(-50%, -50%);",
    "  width: var(--bini-logo-w, 20px);",
    "  height: var(--bini-logo-h, 28px);",
    "  transition: opacity .25s;",
    "}",
    ".bf { opacity: 1; }",
    ".bs { opacity: 0; }",
    "#w.loading .bf { opacity: 0; }",
    "#w.loading .bs { opacity: 1; }",
    "#w.has-errors .bf { opacity: 0; }",
    "#w.has-errors .bs { opacity: 0; }",
    ".ep {",
    "  display: none; align-items: center; gap: 0;",
    "  opacity: 0; transition: opacity 0.2s;",
    "  height: 100%;",
    "  width: 100%;",
    "}",
    "#w.has-errors .ep { display: flex; opacity: 1; }",
    ".ep-icon {",
    "  width: var(--bini-circle-size, 40px);",
    "  height: var(--bini-circle-size, 40px);",
    "  min-width: var(--bini-circle-size, 40px);",
    "  background: rgba(0,0,0,0.28);",
    "  border-radius: 50%;",
    "  display: flex; align-items: center; justify-content: center;",
    "  flex-shrink: 0;",
    "  margin: 0;",
    "  cursor: pointer;",
    "  transition: background 0.15s;",
    "  position: relative;",
    "  z-index: 2;",
    "}",
    ".ep-icon:hover {",
    "  background: rgba(0,0,0,0.42);",
    "}",
    ".ep-icon svg {",
    "  width: var(--bini-logo-w, 20px);",
    "  height: var(--bini-logo-h, 28px);",
    "  display: block;",
    "}",
    ".ep-content {",
    "  display: flex; align-items: center; gap: 6px;",
    "  padding: 0 var(--bini-pill-pad, 16px) 0 8px;",
    "  cursor: pointer;",
    "  height: 100%;",
    "  position: relative;",
    "  z-index: 1;",
    "  white-space: nowrap;",
    "  flex-shrink: 0;",
    "}",
    ".ep-count {",
    "  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    "  font-size: var(--bini-count-size, 18px);",
    "  font-weight: 700;",
    "  color: #ffffff;",
    "  line-height: 1;",
    "  letter-spacing: -0.02em;",
    "}",
    ".ep-label {",
    "  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    "  font-size: var(--bini-label-size, 15px);",
    "  font-weight: 700;",
    "  color: #ffffff;",
    "  white-space: nowrap;",
    "  letter-spacing: -0.01em;",
    "  line-height: 1;",
    "}",
    ".bsp {",
    "  fill: none; stroke: url(#sg); stroke-width: 1.4;",
    "  stroke-linecap: round; stroke-linejoin: round;",
    "  stroke-dasharray: 300; stroke-dashoffset: 300;",
    "}",
    "#w.loading .bsp { animation: draw 1.3s ease-out .1s forwards; }",
    "@keyframes draw { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }",
    "",
    "#bini-menu {",
    "  position: fixed;",
    "  min-width: 280px;",
    "  background: var(--bini-bg);",
    "  border: 1px solid var(--bini-border-strong);",
    "  border-radius: 12px;",
    "  box-shadow: var(--bini-menu-shadow);",
    "  z-index: 2147483647;",
    "  display: none;",
    "  overflow: hidden;",
    "  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    "  padding: 6px;",
    "}",
    "#bini-menu.show { display: block; }",
    "",
    ".bini-menu-header {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  padding: 10px 12px;",
    "  cursor: pointer;",
    "  transition: background 0.15s;",
    "  margin-bottom: 4px;",
    "  border-bottom: 1px solid var(--bini-border);",
    "  border-radius: 6px 6px 0 0;",
    "  padding-bottom: 12px;",
    "}",
    ".bini-menu-header:hover { background: var(--bini-hover); }",
    ".bini-menu-header .bini-menu-label {",
    "  color: var(--bini-text);",
    "  font-size: 15px;",
    "  font-weight: 600;",
    "}",
    ".bini-issue-badge {",
    "  display: inline-flex; align-items: center; gap: 6px;",
    "  background: rgba(220,38,38,0.15);",
    "  border-radius: 999px;",
    "  padding: 3px 10px 3px 6px;",
    "  border: 1px solid rgba(220,38,38,0.3);",
    "}",
    ".bini-issue-dot {",
    "  width: 8px; height: 8px; border-radius: 50%;",
    "  background: #ef4444;",
    "  box-shadow: 0 0 6px rgba(239,68,68,0.6);",
    "}",
    ".bini-issue-count {",
    "  color: var(--bini-text);",
    "  font-size: 13px;",
    "  font-weight: 600;",
    "  line-height: 1;",
    "}",
    "",
    ".bini-menu-item {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  padding: 10px 12px;",
    "  border-radius: 6px;",
    "  cursor: default;",
    "  transition: background 0.15s;",
    "}",
    ".bini-menu-item:hover { background: var(--bini-hover); }",
    ".bini-menu-item-clickable { cursor: pointer; }",
    ".bini-menu-label {",
    "  color: var(--bini-menu-label);",
    "  font-size: 13px;",
    "  font-weight: 400;",
    "}",
    ".bini-menu-value {",
    "  color: var(--bini-text-muted);",
    "  font-size: 13px;",
    "  font-weight: 400;",
    "  display: flex; align-items: center; gap: 6px;",
    "}",
    ".bini-route-value {",
    "  color: var(--bini-text-muted);",
    "  max-width: 120px;",
    "  overflow: hidden;",
    "  text-overflow: ellipsis;",
    "  white-space: nowrap;",
    "  font-family: 'JetBrains Mono', ui-monospace, monospace;",
    "  font-size: 12px;",
    "}",
    ".bini-menu-value-icon { display: inline-flex; align-items: center; color: var(--bini-text-muted); }",
    "",
    ".bini-menu-divider {",
    "  height: 1px; background: var(--bini-border);",
    "  margin: 4px 0;",
    "}",
    "",
    ".bini-popover {",
    "  position: fixed;",
    "  min-width: 280px;",
    "  max-width: 360px;",
    "  background: var(--bini-bg);",
    "  border: 1px solid var(--bini-border-strong);",
    "  border-radius: 12px;",
    "  box-shadow: var(--bini-menu-shadow);",
    "  z-index: 2147483647;",
    "  display: none;",
    "  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    "  padding: 6px;",
    "  max-height: 80vh;",
    "  overflow-y: auto;",
    "}",
    ".bini-popover.show { display: block; }",
    ".bini-popover-header {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  padding: 14px 16px 12px 16px;",
    "  margin-bottom: 6px;",
    "  border-bottom: 1px solid var(--bini-border-strong);",
    "}",
    ".bini-popover-title {",
    "  font-size: 14px;",
    "  font-weight: 600;",
    "  color: var(--bini-text);",
    "}",
    ".bini-popover-close {",
    "  display: inline-flex; align-items: center; justify-content: center;",
    "  width: 24px; height: 24px;",
    "  background: none; border: none; cursor: pointer;",
    "  color: var(--bini-text-muted);",
    "  border-radius: 6px;",
    "  transition: background 0.15s, color 0.15s;",
    "}",
    ".bini-popover-close:hover { background: var(--bini-hover); color: var(--bini-text); }",
    "",
    ".bini-pref-row-popover {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  padding: 10px 12px;",
    "  border-radius: 6px;",
    "  gap: 12px;",
    "}",
    ".bini-pref-row-popover:hover { background: var(--bini-hover); }",
    ".bini-pref-info-popover { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }",
    ".bini-pref-label-popover {",
    "  font-size: 13px;",
    "  font-weight: 500;",
    "  color: var(--bini-text);",
    "}",
    ".bini-pref-desc-popover {",
    "  font-size: 11px;",
    "  color: var(--bini-text-muted);",
    "  line-height: 1.3;",
    "}",
    "",
    ".bini-btn {",
    "  display: inline-flex; align-items: center; gap: 6px;",
    "  background: var(--bini-chip-bg);",
    "  color: var(--bini-text);",
    "  border: 1px solid var(--bini-border-strong);",
    "  border-radius: 8px;",
    "  padding: 8px 14px;",
    "  font-family: inherit;",
    "  font-size: 13px;",
    "  cursor: pointer;",
    "  transition: background 0.15s, border-color 0.15s;",
    "}",
    ".bini-btn:hover { background: var(--bini-hover); }",
    ".bini-btn-recording { border-color: #ef4444; color: #ef4444; }",
    "",
    ".bini-route-path-row {",
    "  display: flex; align-items: center; gap: 10px;",
    "  padding: 12px 20px;",
    "  border-bottom: 1px solid var(--bini-border);",
    "}",
    ".bini-route-path-icon { color: var(--bini-text-muted); display: inline-flex; }",
    ".bini-route-path {",
    "  font-size: 14px;",
    "  color: var(--bini-text);",
    "  font-weight: 500;",
    "}",
    "",
    ".bini-segment-tree { padding: 8px 0; }",
    ".bini-segment-row {",
    "  display: flex; align-items: center; gap: 8px;",
    "  padding: 8px 20px;",
    "  transition: background 0.12s;",
    "}",
    ".bini-segment-name {",
    "  color: var(--bini-text);",
    "  font-size: 13px;",
    "  font-weight: 500;",
    "  flex-shrink: 0;",
    "}",
    ".bini-segment-spacer { flex: 1; }",
    ".bini-chip {",
    "  display: inline-flex; align-items: center;",
    "  padding: 3px 10px;",
    "  background: var(--bini-chip-bg);",
    "  border: 1px solid var(--bini-border);",
    "  border-radius: 6px;",
    "  font-size: 11px;",
    "  color: var(--bini-text);",
    "  font-family: 'JetBrains Mono', ui-monospace, monospace;",
    "}",
    "",
    "/* Custom Dropdown */",
    ".bini-dropdown {",
    "  position: relative;",
    "  display: inline-block;",
    "}",
    ".bini-dropdown-toggle {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  gap: 6px;",
    "  background: var(--bini-dropdown-bg);",
    "  color: var(--bini-text);",
    "  border: 1px solid var(--bini-dropdown-border);",
    "  border-radius: 6px;",
    "  padding: 5px 10px;",
    "  font-family: inherit;",
    "  font-size: 12px;",
    "  cursor: pointer;",
    "  min-width: 90px;",
    "  transition: border-color 0.15s;",
    "}",
    ".bini-dropdown-toggle:hover { border-color: var(--bini-text-muted); }",
    ".bini-dropdown-menu {",
    "  position: absolute;",
    "  top: 100%;",
    "  right: 0;",
    "  margin-top: 4px;",
    "  min-width: 100%;",
    "  background: var(--bini-dropdown-bg);",
    "  border: 1px solid var(--bini-dropdown-border);",
    "  border-radius: 8px;",
    "  box-shadow: 0 8px 30px rgba(0,0,0,0.6);",
    "  z-index: 2147483647;",
    "  display: none;",
    "  overflow: hidden;",
    "  padding: 4px;",
    "}",
    ".bini-dropdown-menu.show { display: block; }",
    ".bini-dropdown-item {",
    "  display: flex; align-items: center;",
    "  padding: 6px 10px;",
    "  font-size: 12px;",
    "  color: var(--bini-text);",
    "  border-radius: 4px;",
    "  cursor: pointer;",
    "  transition: background 0.1s;",
    "  white-space: nowrap;",
    "}",
    ".bini-dropdown-item:hover { background: var(--bini-dropdown-hover); }",
    ".bini-dropdown-item.selected { color: var(--bini-accent); }",
    ""
  ].join("\\n");

  var dims = sizeDims(prefs.size);
  var posStyles = positionStyles(prefs.position);
  var posStyleStr = Object.keys(posStyles).map(function (k) { return k + ':' + posStyles[k]; }).join(';');

  var biniPath = "${BINI_PATH}";

  var menu = document.createElement("div");
  menu.id = "bini-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML =
    '<div class="bini-menu-header" id="bini-menu-issues" style="display:none;">' +
      '<span class="bini-menu-label">Issues</span>' +
      '<span class="bini-issue-badge">' +
        '<span class="bini-issue-dot"></span>' +
        '<span class="bini-issue-count" id="bini-menu-issue-count">0</span>' +
      '</span>' +
    '</div>' +
    '<div class="bini-menu-item"><span class="bini-menu-label">Route</span><span class="bini-menu-value" id="bini-route-type">Static</span></div>' +
    '<div class="bini-menu-item"><span class="bini-menu-label">Bundler</span><span class="bini-menu-value">Rolldown</span></div>' +
    '<div class="bini-menu-item bini-menu-item-clickable" id="bini-route-info"><span class="bini-menu-label">Route Info</span><span class="bini-menu-value"><span class="bini-menu-value-icon">' + '${CHEVRON_RIGHT}' + '</span></span></div>' +
    '<div class="bini-menu-divider"></div>' +
    '<div class="bini-menu-item bini-menu-item-clickable" id="bini-menu-prefs"><span class="bini-menu-label">Preferences</span><span class="bini-menu-value"><span class="bini-menu-value-icon">' + '${GEAR_ICON}' + '</span></span></div>';

  var w = document.createElement("div");
  w.id = "w";
  w.className = "loading";
  w.style.cssText = posStyleStr;
  w.innerHTML =
    '<svg class="bf" viewBox="0 0 22 31" fill="none" preserveAspectRatio="xMidYMid meet">' +
    '<defs><linearGradient id="fg" x1="9.96" y1="-12.92" x2="9.96" y2="40.08" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#00CFFF"/><stop offset="1" stop-color="#0077FF"/>' +
    '</linearGradient></defs>' +
    '<path fill="url(#fg)" d="' + biniPath + '"/></svg>' +
    '<svg class="bs" viewBox="0 0 22 31" fill="none" preserveAspectRatio="xMidYMid meet">' +
    '<defs><linearGradient id="sg" x1="9.96" y1="-12.92" x2="9.96" y2="40.08" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#00CFFF"/><stop offset="1" stop-color="#0077FF"/>' +
    '</linearGradient></defs>' +
    '<path class="bsp" d="' + biniPath + '"/></svg>' +
    '<div class="ep">' +
    '<span class="ep-icon" id="bini-err-icon">' +
    '<svg viewBox="0 0 22 31" fill="none" preserveAspectRatio="xMidYMid meet">' +
    '<path fill="#fff" d="' + biniPath + '"/>' +
    '</svg>' +
    '</span>' +
    '<div class="ep-content" id="bini-err-open">' +
    '<span class="ep-count" id="bini-err-count">0</span>' +
    '<span class="ep-label" id="bini-err-label">Issues</span>' +
    '</div>' +
    '</div>';

  // ── Preferences Popover ──────────────────────────────────────
  var prefsPopover = document.createElement("div");
  prefsPopover.className = "bini-popover";
  prefsPopover.id = "bini-prefs-popover";
  prefsPopover.innerHTML =
    '<div class="bini-popover-header">' +
      '<span class="bini-popover-title">Preferences</span>' +
      '<button class="bini-popover-close" id="bini-prefs-close">' + '${CLOSE_ICON}' + '</button>' +
    '</div>' +
    '<div class="bini-pref-row-popover">' +
      '<div class="bini-pref-info-popover">' +
        '<span class="bini-pref-label-popover">Theme</span>' +
        '<span class="bini-pref-desc-popover">Select your theme preference.</span>' +
      '</div>' +
      '<div class="bini-pref-control">' +
        '<div class="bini-dropdown" id="dd-theme">' +
          '<button class="bini-dropdown-toggle" data-value="system">System <span class="bini-dropdown-chevron">' + '${CHEVRON_DOWN}' + '</span></button>' +
          '<div class="bini-dropdown-menu">' +
            '<div class="bini-dropdown-item" data-value="system">System</div>' +
            '<div class="bini-dropdown-item" data-value="light">Light</div>' +
            '<div class="bini-dropdown-item" data-value="dark">Dark</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="bini-pref-row-popover">' +
      '<div class="bini-pref-info-popover">' +
        '<span class="bini-pref-label-popover">Position</span>' +
        '<span class="bini-pref-desc-popover">Adjust the placement of your dev tools.</span>' +
      '</div>' +
      '<div class="bini-pref-control">' +
        '<div class="bini-dropdown" id="dd-position">' +
          '<button class="bini-dropdown-toggle" data-value="bottom-left">Bottom Left <span class="bini-dropdown-chevron">' + '${CHEVRON_DOWN}' + '</span></button>' +
          '<div class="bini-dropdown-menu">' +
            '<div class="bini-dropdown-item" data-value="bottom-left">Bottom Left</div>' +
            '<div class="bini-dropdown-item" data-value="bottom-right">Bottom Right</div>' +
            '<div class="bini-dropdown-item" data-value="top-left">Top Left</div>' +
            '<div class="bini-dropdown-item" data-value="top-right">Top Right</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="bini-pref-row-popover">' +
      '<div class="bini-pref-info-popover">' +
        '<span class="bini-pref-label-popover">Size</span>' +
        '<span class="bini-pref-desc-popover">Adjust the size of your dev tools.</span>' +
      '</div>' +
      '<div class="bini-pref-control">' +
        '<div class="bini-dropdown" id="dd-size">' +
          '<button class="bini-dropdown-toggle" data-value="medium">Medium <span class="bini-dropdown-chevron">' + '${CHEVRON_DOWN}' + '</span></button>' +
          '<div class="bini-dropdown-menu">' +
            '<div class="bini-dropdown-item" data-value="small">Small</div>' +
            '<div class="bini-dropdown-item" data-value="medium">Medium</div>' +
            '<div class="bini-dropdown-item" data-value="large">Large</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="bini-pref-row-popover">' +
      '<div class="bini-pref-info-popover">' +
        '<span class="bini-pref-label-popover">Hide for this session</span>' +
        '<span class="bini-pref-desc-popover">Hide Dev Tools until you restart or close the tab.</span>' +
      '</div>' +
      '<div class="bini-pref-control">' +
        '<button class="bini-btn" id="bini-pref-hide">' + '${EYE_OFF_ICON}' + ' Hide</button>' +
      '</div>' +
    '</div>' +
    '<div class="bini-pref-row-popover">' +
      '<div class="bini-pref-info-popover">' +
        '<span class="bini-pref-label-popover">Shortcut</span>' +
        '<span class="bini-pref-desc-popover">Toggle visibility.</span>' +
      '</div>' +
      '<div class="bini-pref-control">' +
        '<button class="bini-btn" id="bini-pref-shortcut">' +
          '<span id="bini-pref-shortcut-label">Record Shortcut</span>' +
        '</button>' +
      '</div>' +
    '</div>';

  // ── Route Info Popover ──────────────────────────────────────
  var routePopover = document.createElement("div");
  routePopover.className = "bini-popover";
  routePopover.id = "bini-route-popover";
  routePopover.innerHTML =
    '<div class="bini-popover-header">' +
      '<span class="bini-popover-title">Route Info</span>' +
      '<button class="bini-popover-close" id="bini-route-close">' + '${CLOSE_ICON}' + '</button>' +
    '</div>' +
    '<div class="bini-popover-body" id="bini-route-body">' +
      '<div class="bini-route-path-row">' +
        '<span class="bini-route-path-icon">' + '${INDENT_ICON}' + '</span>' +
        '<span class="bini-route-path" id="bini-route-path">/</span>' +
      '</div>' +
      '<div class="bini-segment-tree" id="bini-segment-tree"></div>' +
    '</div>';

  sr.appendChild(style);
  sr.appendChild(menu);
  sr.appendChild(w);
  sr.appendChild(prefsPopover);
  sr.appendChild(routePopover);

  var el = sr.getElementById("w");
  var sp = el.querySelector(".bsp");
  var countEl = sr.getElementById("bini-err-count");
  var labelEl = sr.getElementById("bini-err-label");
  var animDone = false, ready = false, timer = null;
  var menuEl = sr.getElementById("bini-menu");
  var menuVisible = false;

  function applyTheme() {
    var resolved = resolveTheme(prefs.theme);
    container.setAttribute('data-theme', resolved);
  }
  applyTheme();

  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
        if (prefs.theme === 'system') applyTheme();
      });
    } catch (_e) {}
  }

  function applyPositionAndSize() {
    var p = positionStyles(prefs.position);
    el.style.top = ''; el.style.bottom = ''; el.style.left = ''; el.style.right = '';
    Object.keys(p).forEach(function (k) { el.style[k] = p[k]; });
    var d = sizeDims(prefs.size);

    el.style.setProperty('--bini-badge-size', d.pill + 'px');
    el.style.setProperty('--bini-logo-w', d.logoW + 'px');
    el.style.setProperty('--bini-logo-h', d.logoH + 'px');
    el.style.setProperty('--bini-circle-size', d.circle + 'px');
    el.style.setProperty('--bini-pill-h', d.circle + 'px');
    el.style.setProperty('--bini-pill-pad', d.pad + 'px');
    el.style.setProperty('--bini-count-size', d.count + 'px');
    el.style.setProperty('--bini-label-size', d.label + 'px');

    menuEl.style.top = ''; menuEl.style.bottom = ''; menuEl.style.left = ''; menuEl.style.right = '';
    if (prefs.position === 'top-left') {
      menuEl.style.top = (20 + d.pill + 12) + 'px';
      menuEl.style.left = '20px';
    } else if (prefs.position === 'top-right') {
      menuEl.style.top = (20 + d.pill + 12) + 'px';
      menuEl.style.right = '20px';
    } else if (prefs.position === 'bottom-right') {
      menuEl.style.bottom = (20 + d.pill + 12) + 'px';
      menuEl.style.right = '20px';
    } else {
      menuEl.style.bottom = (20 + d.pill + 12) + 'px';
      menuEl.style.left = '20px';
    }

    var popovers = [prefsPopover, routePopover];
    popovers.forEach(function(popover) {
      popover.style.top = ''; popover.style.bottom = ''; popover.style.left = ''; popover.style.right = '';
      if (prefs.position === 'top-left') {
        popover.style.top = (20 + d.pill + 12) + 'px';
        popover.style.left = '20px';
      } else if (prefs.position === 'top-right') {
        popover.style.top = (20 + d.pill + 12) + 'px';
        popover.style.right = '20px';
      } else if (prefs.position === 'bottom-right') {
        popover.style.bottom = (20 + d.pill + 12) + 'px';
        popover.style.right = '20px';
      } else {
        popover.style.bottom = (20 + d.pill + 12) + 'px';
        popover.style.left = '20px';
      }
    });
  }
  applyPositionAndSize();

  function applyHiddenState() {
    if (isHiddenSession) {
      container.style.display = 'none';
    } else {
      container.style.display = 'block';
    }
  }
  applyHiddenState();

  function parseShortcut(str) {
    if (!str) return null;
    var parts = str.split('+').map(function (p) { return p.trim(); });
    var out = { alt: false, ctrl: false, meta: false, shift: false, key: null };
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].toLowerCase();
      if (p === 'alt') out.alt = true;
      else if (p === 'ctrl' || p === 'control') out.ctrl = true;
      else if (p === 'meta' || p === 'cmd' || p === 'command') out.meta = true;
      else if (p === 'shift') out.shift = true;
      else out.key = parts[i].toUpperCase();
    }
    return out;
  }

  function matchesShortcut(e, shortcut) {
    var s = parseShortcut(shortcut);
    if (!s || !s.key) return false;
    if (e.key.toUpperCase() !== s.key) return false;
    if (e.altKey !== s.alt) return false;
    if (e.ctrlKey !== s.ctrl) return false;
    if (e.metaKey !== s.meta) return false;
    if (e.shiftKey !== s.shift) return false;
    return true;
  }

  document.addEventListener('keydown', function (e) {
    if (matchesShortcut(e, prefs.shortcut)) {
      e.preventDefault();
      isHiddenSession = !isHiddenSession;
      try {
        if (isHiddenSession) sessionStorage.setItem(HIDE_SESSION_KEY, '1');
        else sessionStorage.removeItem(HIDE_SESSION_KEY);
      } catch (_e) {}
      applyHiddenState();
    }
  }, true);

  function normalizePath(path) {
    if (!path) return '/';
    return path.replace(/\\/+$/, '') || '/';
  }

  function apiBase() {
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
        return String(import.meta.env.BASE_URL).replace(/\\/$/, '');
      }
    } catch (_e) {}
    return '';
  }

  window.__bini_set_error_count = function (count) {
    if (countEl) countEl.textContent = count;
    if (labelEl) labelEl.textContent = count === 1 ? "Issue" : "Issues";
    var menuCountEl = sr.getElementById('bini-menu-issue-count');
    if (menuCountEl) menuCountEl.textContent = count;
    var menuIssuesEl = sr.getElementById('bini-menu-issues');
    if (count > 0) {
      el.classList.add("has-errors");
      el.classList.remove("loading");
      if (menuIssuesEl) menuIssuesEl.style.display = 'flex';
    } else {
      el.classList.remove("has-errors");
      if (menuIssuesEl) menuIssuesEl.style.display = 'none';
    }
  };
  window.__bini_set_error_count(0);

  function idle() {
    clearTimeout(timer);
    timer = null;
    if (!el.classList.contains("has-errors")) el.classList.remove("loading");
  }

  function loop() {
    if (ready) return;
    animDone = false;
    sp.style.animation = "none";
    sp.offsetHeight;
    sp.style.strokeDashoffset = "300";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        sp.style.animation = "";
        if (!el.classList.contains("has-errors")) el.classList.add("loading");
      });
    });
    timer = setTimeout(function () { if (!ready) loop(); }, 2000);
  }

  function start() {
    animDone = false;
    ready = false;
    loop();
    timer = setTimeout(function () { ready = true; if (animDone) idle(); }, 1800);
  }

  sp.addEventListener("animationend", function (e) {
    if (e.animationName !== "draw") return;
    animDone = true;
    clearTimeout(timer); timer = null;
    if (ready) idle(); else loop();
  });

  function onReady() { ready = true; clearTimeout(timer); timer = null; if (animDone) idle(); }
  if (document.readyState === "complete") onReady();
  else window.addEventListener("load", onReady, { once: true });

  function closeAllPopovers() {
    menuEl.classList.remove("show");
    prefsPopover.classList.remove("show");
    routePopover.classList.remove("show");
    menuVisible = false;
  }

  function toggleMenu(e) {
    e.stopPropagation();
    var wasVisible = menuVisible;
    closeAllPopovers();
    if (!wasVisible) {
      menuEl.classList.add("show");
      menuVisible = true;
    }
  }

  document.addEventListener("click", function (e) {
    var path = e.composedPath ? e.composedPath() : [];
    var clickedInShadow = path.indexOf(menuEl) !== -1 || path.indexOf(el) !== -1 ||
                          path.indexOf(prefsPopover) !== -1 || path.indexOf(routePopover) !== -1;
    if (!clickedInShadow) {
      closeAllPopovers();
    }
  });

  el.addEventListener("click", function (e) {
    e.stopPropagation();
    if (el.classList.contains("has-errors")) return;
    toggleMenu(e);
  });

  var errIconEl = sr.getElementById("bini-err-icon");
  if (errIconEl) errIconEl.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(e); });

  var errOpenEl = sr.getElementById("bini-err-open");
  if (errOpenEl) errOpenEl.addEventListener("click", function (e) {
    e.stopPropagation();
    if (!el.classList.contains("has-errors")) return;
    closeAllPopovers();
    if (typeof window.__bini_show_overlay === "function") window.__bini_show_overlay();
  });

  var menuIssues = sr.getElementById("bini-menu-issues");
  if (menuIssues) menuIssues.addEventListener("click", function (e) {
    e.stopPropagation();
    closeAllPopovers();
    if (typeof window.__bini_show_overlay === "function") window.__bini_show_overlay();
  });

  var routeInfoBtn = sr.getElementById("bini-route-info");
  if (routeInfoBtn) routeInfoBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var wasVisible = routePopover.classList.contains("show");
    closeAllPopovers();
    if (!wasVisible) {
      routePopover.classList.add("show");
      openRouteInfo();
    }
  });

  var prefsBtn = sr.getElementById("bini-menu-prefs");
  if (prefsBtn) prefsBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var wasVisible = prefsPopover.classList.contains("show");
    closeAllPopovers();
    if (!wasVisible) {
      prefsPopover.classList.add("show");
    }
  });

  // ── Custom Dropdown Logic ────────────────────────────────────
  function setupDropdown(id, onChange) {
    var dropdown = sr.getElementById(id);
    if (!dropdown) return;
    var toggle = dropdown.querySelector('.bini-dropdown-toggle');
    var menu = dropdown.querySelector('.bini-dropdown-menu');
    var items = dropdown.querySelectorAll('.bini-dropdown-item');

    function updateDisplay(value) {
      var item = dropdown.querySelector('.bini-dropdown-item[data-value="' + value + '"]');
      if (item) {
        toggle.innerHTML = item.textContent + ' <span class="bini-dropdown-chevron">' + '${CHEVRON_DOWN}' + '</span>';
        items.forEach(function(it) { it.classList.toggle('selected', it.getAttribute('data-value') === value); });
      }
    }

    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = menu.classList.contains('show');
      sr.querySelectorAll('.bini-dropdown-menu.show').forEach(function(m) { m.classList.remove('show'); });
      if (!isOpen) menu.classList.add('show');
    });

    items.forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        var value = this.getAttribute('data-value');
        updateDisplay(value);
        menu.classList.remove('show');
        if (onChange) onChange(value);
      });
    });

    updateDisplay(toggle.getAttribute('data-value'));
  }

  setupDropdown('dd-theme', function(val) {
    prefs.theme = val;
    savePrefs(prefs);
    applyTheme();
  });
  setupDropdown('dd-position', function(val) {
    prefs.position = val;
    savePrefs(prefs);
    applyPositionAndSize();
  });
  setupDropdown('dd-size', function(val) {
    prefs.size = val;
    savePrefs(prefs);
    applyPositionAndSize();
  });

  var prefsShortcutBtn = sr.getElementById("bini-pref-shortcut");
  var prefsShortcutLabel = sr.getElementById("bini-pref-shortcut-label");
  var prefsHideBtn = sr.getElementById("bini-pref-hide");
  var prefsCloseBtn = sr.getElementById("bini-prefs-close");

  prefsShortcutLabel.textContent = prefs.shortcut || 'Record Shortcut';

  var isRecordingShortcut = false;
  function stopRecording() {
    isRecordingShortcut = false;
    prefsShortcutBtn.classList.remove('bini-btn-recording');
    prefsShortcutLabel.textContent = prefs.shortcut || 'Record Shortcut';
    document.removeEventListener('keydown', recordKeyHandler, true);
  }
  function recordKeyHandler(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { stopRecording(); return; }
    var parts = [];
    if (e.altKey) parts.push('Alt');
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.metaKey) parts.push('Meta');
    if (e.shiftKey) parts.push('Shift');
    var k = e.key;
    if (['Alt','Control','Meta','Shift'].indexOf(k) !== -1) return;
    if (k === ' ') k = 'Space';
    else if (k.length === 1) k = k.toUpperCase();
    parts.push(k);
    prefs.shortcut = parts.join('+');
    savePrefs(prefs);
    stopRecording();
  }
  prefsShortcutBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (isRecordingShortcut) { stopRecording(); return; }
    isRecordingShortcut = true;
    prefsShortcutBtn.classList.add('bini-btn-recording');
    prefsShortcutLabel.textContent = 'Press keys...';
    document.addEventListener('keydown', recordKeyHandler, true);
  });

  prefsHideBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    isHiddenSession = true;
    try { sessionStorage.setItem(HIDE_SESSION_KEY, '1'); } catch (_e) {}
    applyHiddenState();
    closeAllPopovers();
  });

  prefsCloseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    closeAllPopovers();
  });

  var routeCloseBtn = sr.getElementById("bini-route-close");
  if (routeCloseBtn) routeCloseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    closeAllPopovers();
  });

  async function openRouteInfo() {
    var treeEl = sr.getElementById("bini-segment-tree");
    var pathEl = sr.getElementById("bini-route-path");
    if (!treeEl) return;
    treeEl.innerHTML = '<div style="padding:12px 20px;color:var(--bini-text-muted);font-size:12px;">Loading…</div>';

    var currentPath = normalizePath(window.location.pathname || '/');
    if (pathEl) pathEl.textContent = currentPath;

    try {
      var url = apiBase() + '/__bini_route_info?path=' + encodeURIComponent(currentPath);
      var res = await fetch(url);
      if (!res.ok) {
        treeEl.innerHTML = renderNotFoundMessage(currentPath);
        return;
      }
      var text = await res.text();
      if (!text || text.charAt(0) !== '{') {
        treeEl.innerHTML = renderNotFoundMessage(currentPath);
        return;
      }
      var data = JSON.parse(text);
      treeEl.innerHTML = renderSegmentTree(data, currentPath);
    } catch (_e) {
      treeEl.innerHTML = renderNotFoundMessage(currentPath);
    }
  }

  function renderNotFoundMessage(currentPath) {
    return '<div style="padding:12px 20px;color:var(--bini-text-muted);font-size:12px;line-height:1.6;">' +
      'No matching route for ' +
      '<code style="font-family:\\'JetBrains Mono\\', ui-monospace, monospace;color:#f87171;background:rgba(248,113,113,0.1);padding:1px 5px;border-radius:3px;">' +
      escapeHtml(currentPath) +
      '</code>' +
      '<br><span style="color:var(--bini-text-muted);opacity:0.7;margin-top:4px;display:inline-block;">This URL renders your 404 page.</span>' +
      '</div>';
  }

  function renderSegmentTree(data, currentPath) {
    if (!data) {
      return renderNotFoundMessage(currentPath || '/');
    }

    if (data.type === 'not_found') {
      return renderNotFoundMessage(currentPath || data.path || '/');
    }

    var html = '';
    var rootChips = [];

    if (data.layouts && data.layouts.length) {
      for (var i = 0; i < data.layouts.length; i++) {
        rootChips.push('<span class="bini-chip">' + escapeHtml(data.layouts[i].split(/[\\\\/]/).pop()) + '</span>');
      }
    }
    if (data.pageFile) {
      rootChips.push('<span class="bini-chip">' + escapeHtml(data.pageFile.split(/[\\\\/]/).pop()) + '</span>');
    }

    if (rootChips.length) {
      html += '<div class="bini-segment-row">' +
        '<span class="bini-segment-name">app</span>' +
        '<span class="bini-segment-spacer"></span>' +
        rootChips.join('') +
        '</div>';
    }

    if (data.segments && data.segments.length) {
      for (var j = 0; j < data.segments.length; j++) {
        var seg = data.segments[j];
        // Next.js style — only show chip for meaningful (non-static) segments
        var chipHtml = '';
        if (seg.kind === 'dynamic' || seg.kind === 'catch-all') {
          chipHtml = '<span class="bini-chip">' + escapeHtml(seg.kind) + '</span>';
        }
        html += '<div class="bini-segment-row" style="padding-left:' + (20 + seg.depth * 20) + 'px;">' +
          '<span class="bini-segment-name">' + escapeHtml(seg.name) + '</span>' +
          '<span class="bini-segment-spacer"></span>' +
          chipHtml +
          '</div>';
      }
    }

    if (!html) {
      return renderNotFoundMessage(currentPath || data.path || '/');
    }

    return html;
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var routeMatchAbort = null;
  function updateMenuInfo() {
    var routeTypeEl = sr.getElementById("bini-route-type");
    var pathname = window.location.pathname || '/';
    var normalizedPath = normalizePath(pathname);

    if (routeTypeEl) {
      if (routeMatchAbort) { try { routeMatchAbort.abort(); } catch (_e) {} }
      routeMatchAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var url = apiBase() + "/__bini_route_match?path=" + encodeURIComponent(normalizedPath);
      fetch(url, routeMatchAbort ? { signal: routeMatchAbort.signal } : undefined)
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) {
          if (!data || !routeTypeEl) return;
          if (data.type === 'dynamic') { routeTypeEl.textContent = 'Dynamic'; routeTypeEl.style.color = '#fbbf24'; }
          else if (data.type === 'static') { routeTypeEl.textContent = 'Static'; routeTypeEl.style.color = '#10b981'; }
          else { routeTypeEl.textContent = 'Not Found'; routeTypeEl.style.color = '#ef4444'; }
        })
        .catch(function () {});
    }
  }
  updateMenuInfo();

  if (window.history && window.history.pushState) {
    var originalPushState = window.history.pushState;
    var originalReplaceState = window.history.replaceState;
    window.history.pushState = function () { originalPushState.apply(this, arguments); setTimeout(updateMenuInfo, 100); };
    window.history.replaceState = function () { originalReplaceState.apply(this, arguments); setTimeout(updateMenuInfo, 100); };
    window.addEventListener('popstate', function () { setTimeout(updateMenuInfo, 100); });
  }

  if (import.meta.hot) {
    import.meta.hot.on("vite:beforeUpdate", start);
    import.meta.hot.on("vite:afterUpdate", function () {
      ready = true;
      if (animDone) idle();
      setTimeout(updateMenuInfo, 200);
    });
  }
})();
`;

        const tag = '<script type="module">' + js + '<\/script>';
        return html.replace('</body>', tag + '</body>');
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 2 — Error overlay
// ─────────────────────────────────────────────────────────────
function biniErrorOverlay(): BiniPlugin {
  const shikiTheme = 'dark-plus';

  const theme = {
    bg: '#0a0a0a',
    surface: '#0a0a0a',
    surfaceMuted: '#050505',
    border: 'rgba(255,255,255,0.08)',
    text: '#e4e4e7',
    textMuted: '#71717a',
    accent: '#f87171',
    warning: '#fbbf24',
    info: '#3b82f6',
    success: '#10b981',
    chipBg: 'rgba(255,255,255,0.05)',
    maxWidth: '900px',
  };

  return {
    name: 'bini-overlay:error',
    apply: 'serve',

    transformIndexHtml: {
      order: 'pre',
      async handler(html: string, ctx: IndexHtmlTransformContext): Promise<HtmlTagDescriptor[] | string> {
        if (!isDev(ctx)) return html;

        const overlayHtml = `
<style>
  #__bini_error_content {
    overflow: visible !important;
    overflow-x: visible !important;
    overflow-y: visible !important;
    max-height: none !important;
  }

  .bini-code-scroll {
    overflow: auto !important;
    max-height: 400px;
    display: block;
    position: relative;
  }
  .bini-code-scroll::-webkit-scrollbar {
    width: 10px;
    height: 10px;
    display: block;
  }
  .bini-code-scroll::-webkit-scrollbar-track {
    background: ${theme.surfaceMuted};
    border-radius: 5px;
    margin: 2px;
  }
  .bini-code-scroll::-webkit-scrollbar-thumb {
    background: #5a5a5a;
    border-radius: 5px;
    border: 1px solid ${theme.border};
  }
  .bini-code-scroll::-webkit-scrollbar-thumb:hover {
    background: #7a7a7a;
  }
  .bini-code-scroll::-webkit-scrollbar-corner {
    background: ${theme.surfaceMuted};
  }
  .bini-code-scroll {
    scrollbar-width: auto;
    scrollbar-color: #5a5a5a ${theme.surfaceMuted};
  }
  .bini-code-scroll pre {
    background: transparent !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .bini-stack-scroll {
    max-height: 300px;
    overflow: auto !important;
    display: block;
  }
  .bini-stack-scroll::-webkit-scrollbar {
    width: 10px;
    height: 10px;
    display: block;
  }
  .bini-stack-scroll::-webkit-scrollbar-track {
    background: ${theme.surfaceMuted};
    border-radius: 5px;
    margin: 2px;
  }
  .bini-stack-scroll::-webkit-scrollbar-thumb {
    background: #5a5a5a;
    border-radius: 5px;
    border: 1px solid ${theme.border};
  }
  .bini-stack-scroll::-webkit-scrollbar-thumb:hover {
    background: #7a7a7a;
  }
  .bini-stack-scroll::-webkit-scrollbar-corner {
    background: ${theme.surfaceMuted};
  }
  .bini-stack-scroll {
    scrollbar-width: auto;
    scrollbar-color: #5a5a5a ${theme.surfaceMuted};
  }

  .bini-component-scroll {
    max-height: 200px;
    overflow: auto !important;
  }
  .bini-component-scroll::-webkit-scrollbar {
    width: 10px;
    height: 10px;
    display: block;
  }
  .bini-component-scroll::-webkit-scrollbar-track {
    background: ${theme.surfaceMuted};
    border-radius: 5px;
  }
  .bini-component-scroll::-webkit-scrollbar-thumb {
    background: #5a5a5a;
    border-radius: 5px;
  }
  .bini-component-scroll {
    scrollbar-width: auto;
    scrollbar-color: #5a5a5a ${theme.surfaceMuted};
  }

  .bini-stack-body {
    overflow: hidden;
    transition: max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s;
    max-height: 400px;
    opacity: 1;
  }
  .bini-stack-body.collapsed {
    max-height: 0 !important;
    opacity: 0;
  }
  .bini-stack-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
    padding: 0;
    background: none;
    border: none;
    width: 100%;
    color: inherit;
  }
  .bini-stack-toggle:hover .bini-stack-toggle-label {
    color: #e4e4e7;
  }
  .bini-stack-toggle-label {
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: color 0.15s;
  }
  .bini-stack-chevron {
    display: flex;
    align-items: center;
    color: #6b7280;
    transition: color 0.15s, transform 0.2s;
  }
  .bini-stack-toggle:hover .bini-stack-chevron {
    color: #9ca3af;
  }

  #__bini_error_content pre {
    overflow-x: auto !important;
    white-space: pre !important;
    margin: 0;
    padding: 0;
  }

  .bini-stack-frame {
    display: block;
    width: 100%;
    text-align: left;
    padding: 8px 16px;
    border: none;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    background: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    color: inherit;
    transition: background 0.12s;
  }
  .bini-stack-frame:hover {
    background: rgba(255,255,255,0.04);
  }
  .bini-stack-frame:last-child {
    border-bottom: none;
  }

  .bini-fw-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
    padding: 8px 16px;
    background: none;
    border: none;
    border-top: 1px solid rgba(255,255,255,0.06);
    width: 100%;
    text-align: left;
    color: #6b7280;
    font-family: inherit;
    font-size: 11px;
    transition: color 0.15s, background 0.12s;
  }
  .bini-fw-toggle:hover {
    color: #9ca3af;
    background: rgba(255,255,255,0.02);
  }
  .bini-fw-toggle-icon {
    display: inline-flex;
    align-items: center;
    color: inherit;
    transition: transform 0.2s;
  }
  .bini-fw-toggle-icon.open {
    transform: rotate(90deg);
  }

  .bini-fw-frames {
    overflow: hidden;
    transition: max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s;
    max-height: 0;
    opacity: 0;
  }
  .bini-fw-frames.open {
    max-height: 400px;
    opacity: 1;
  }
  .bini-fw-frame {
    padding: 6px 16px 6px 30px;
    font-size: 11px;
    color: #4b5563;
    border-top: 1px solid rgba(255,255,255,0.03);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  #__bini_close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: ${theme.chipBg};
    border: 1px solid ${theme.border};
    border-radius: 8px;
    cursor: pointer;
    color: ${theme.text};
    transition: all 0.2s;
  }
  #__bini_close:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
  }
  #__bini_close.bini-hidden {
    display: none !important;
  }
</style>
<div id="__bini_root" style="position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;padding-top:10vh;padding-left:15px;padding-right:15px;background:${theme.bg};font-family:'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace;display:none;">
  <div id="__bini_backdrop" style="position:fixed;inset:0;z-index:-1;background:${theme.bg};"></div>

  <div style="position:relative;z-index:2;display:flex;width:100%;max-width:${theme.maxWidth};align-items:flex-end;justify-content:space-between;">
    <div style="display:flex;gap:8px;background:${theme.surface};padding:12px 16px;border-radius:16px 16px 0 0;border:1.5px solid ${theme.border};border-bottom:none;box-shadow:0 -2px 10px rgba(0,0,0,0.3);">
      <button id="__bini_prev" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${theme.chipBg};border-radius:8px;border:1px solid ${theme.border};cursor:pointer;color:${theme.text};transition:all 0.2s;">${PREV_ICON}</button>
      <div style="display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:32px;color:${theme.text};font-size:13px;background:${theme.chipBg};border-radius:8px;padding:0 12px;border:1px solid ${theme.border};">
        <span id="__bini_current">1</span>
        <span style="margin:0 4px;">/</span>
        <span id="__bini_total">1</span>
      </div>
      <button id="__bini_next" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${theme.chipBg};border-radius:8px;border:1px solid ${theme.border};cursor:pointer;color:${theme.text};transition:all 0.2s;">${NEXT_ICON}</button>
    </div>
    <div style="display:flex;align-items:center;background:${theme.surface};padding:12px 24px;border-radius:16px 16px 0 0;border:1.5px solid ${theme.border};border-bottom:none;box-shadow:0 -2px 10px rgba(0,0,0,0.3);">
      <span style="font-size:15px;font-weight:600;letter-spacing:0.5px;">
        <span style="color:#e4e4e7;">Bini.js</span>
        <span style="color:${theme.textMuted};margin:0 6px;font-weight:400;">·</span>
        <span style="color:#e4e4e7;font-weight:700;">Rolldown</span>
      </span>
    </div>
  </div>

  <div style="position:relative;z-index:10;display:flex;width:100%;max-width:${theme.maxWidth};flex-direction:column;overflow:visible;border-radius:0 0 16px 16px;background:${theme.surface};color:${theme.text};box-shadow:0 8px 30px rgba(0,0,0,0.6);border:1.5px solid ${theme.border};border-top:none;">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1.5px solid ${theme.border};background:${theme.surface};padding:14px 20px;">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        <span id="__bini_heading" style="color:${theme.accent};font-family:'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace;font-size:12px;background:rgba(248,113,113,0.12);padding:4px 12px;border-radius:20px;border:1px solid rgba(248,113,113,0.25);white-space:nowrap;"></span>
        <span id="__bini_file_info" style="font-size:11px;font-family:'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace;color:${theme.info};background:rgba(59,130,246,0.1);padding:4px 8px;border-radius:6px;border:1px solid rgba(59,130,246,0.2);"></span>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="__bini_copy" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${theme.chipBg};border:1px solid ${theme.border};border-radius:8px;cursor:pointer;color:${theme.text};transition:all 0.2s;">${COPY_ICON}</button>
        <button id="__bini_close" title="Close overlay">${CLOSE_ICON}</button>
      </div>
    </div>
    <div id="__bini_error_content" style="padding:24px;font-family:'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace;">
    </div>
  </div>
</div>`;

        const js = `
(function() {
  if (window.__bini_initialized) return;
  window.__bini_initialized = true;

  var errors = [];
  var currentIndex = 0;
  var overlayRoot = null;
  var shikiHighlighter = null;
  var shikiLoadPromise = null;
  var filteredCount = 0;
  var stackCollapsedState = {};
  var frameworkFramesOpenState = {};

  var _errorHandler = null;
  var _rejectionHandler = null;
  var _biniErrorHandler = null;

  function isSourcemappableUrl(url) {
    if (!url) return false;
    if (url.startsWith('http://') || url.startsWith('https://')) return false;
    if (url.startsWith('data:')) return false;
    if (url === '<anonymous>') return false;
    if (url.startsWith('vite:') || url.startsWith('/@')) return false;
    if (url.startsWith('/node_modules/')) return false;
    if (url.startsWith('chunks/')) return false;
    if (/^\\/[^/]*\\.(js|mjs|cjs)$/.test(url) && !url.startsWith('/src/')) return false;
    return /\\.(tsx?|jsx?|mjs|cjs|vue|svelte)$/.test(url) || url.startsWith('/src/');
  }

  function normalizeFrameUrl(rawUrl) {
    if (!rawUrl) return '';
    var u = rawUrl.trim();
    u = u.replace(/^file:\\/\\//, '');
    u = u.replace(/^https?:\\/\\/[^/]+/, '');
    u = u.replace(/\\?[^#]*$/, '');
    return u;
  }

  function isFrameworkFrame(url, fn) {
    if (!url) return false;
    if (url.indexOf('chunks/node.js') !== -1) return true;
    if (url.indexOf('/node_modules/vite/') !== -1) return true;
    if (url.indexOf('/node_modules/.pnpm/vite@') !== -1) return true;
    if (url.indexOf('/@vite/client') !== -1) return true;
    if (url.indexOf('rolldown') !== -1) return true;
    if (url.indexOf('node:internal') === 0) return true;
    if (fn) {
      if (fn.indexOf('transformWithOxc') !== -1) return true;
      if (fn.indexOf('viteTransformMiddleware') !== -1) return true;
      if (fn.indexOf('EnvironmentPluginContainer') !== -1) return true;
      if (fn.indexOf('loadAndTransform') !== -1) return true;
      if (fn.indexOf('TransformPluginContext') !== -1) return true;
    }
    return false;
  }

  async function resolveSourcePosition(url, line, column) {
    if (!isSourcemappableUrl(url)) return null;
    try {
      var qs = '?file=' + encodeURIComponent(url) +
               '&line=' + encodeURIComponent(line) +
               '&column=' + encodeURIComponent(column || 0);
      var res = await fetch('/__bini_sourcemap' + qs);
      if (!res.ok) return null;
      var data = await res.json();
      if (!data || !data.file) return null;
      return data;
    } catch (_e) {
      return null;
    }
  }

  function shortenPath(filePath) {
    if (!filePath) return '';
    var path = filePath || '';
    path = path.replace(/^vite:/, '').replace(/^vite\\\\x00/, '').replace(/\\x00/g, '');
    var match = path.match(/(?:src|app)[\\/\\\\].*$/);
    return match ? match[0] : path.split(/[\\/\\\\]/).slice(-2).join('/');
  }

  function stripNonAscii(str) {
    return (str || '').replace(/[^\\x20-\\x7E]/g, '').trim();
  }

  function cleanErrorMessage(msg) {
    return (msg || '')
      .replace(/vite:oxc\\s*/gi, '')
      .replace(/vite:\\s*/gi, '')
      .replace(/\\s*at\\s+vite:oxc.*$/gm, '')
      .trim();
  }

  function parseStack(stack) {
    if (!stack) return { user: [], framework: [] };
    var user = [];
    var framework = [];
    var lines = stack.split("\\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.includes('vite:oxc')) continue;
      var match = line.match(/^at\\s+(?:(.+?)\\s+\\()?(.+?):(\\d+):(\\d+)\\)?$/);
      if (match) {
        var fnName = match[1] || null;
        var rawUrl = match[2];
        var ln = match[3];
        var col = match[4];
        var cleanUrl = normalizeFrameUrl(rawUrl);
        var shortFile = shortenPath(cleanUrl);
        var frameObj = {
          fn: fnName,
          file: shortFile,
          rawUrl: cleanUrl,
          line: ln,
          column: col,
          originalFile: null,
          originalLine: null,
          originalColumn: null,
        };
        if (isFrameworkFrame(cleanUrl, fnName)) {
          framework.push(frameObj);
        } else {
          user.push(frameObj);
        }
      }
    }
    return { user: user.slice(0, 10), framework: framework.slice(0, 20) };
  }

  async function resolveStackFrames(frames) {
    if (!frames || !frames.length) return frames;
    var results = await Promise.all(frames.map(function (f) {
      return resolveSourcePosition(f.rawUrl, f.line, f.column).then(function (mapped) {
        if (!mapped) return f;
        return Object.assign({}, f, {
          originalFile: mapped.file,
          originalLine: mapped.line,
          originalColumn: mapped.column,
          file: shortenPath(mapped.file) || f.file,
          line: String(mapped.line),
        });
      }).catch(function () { return f; });
    }));
    return results;
  }

  function langFromFile(filePath) {
    if (!filePath) return "javascript";
    var ext = filePath.split('.').pop().toLowerCase();
    if (ext === "tsx") return "tsx";
    if (ext === "ts") return "typescript";
    if (ext === "jsx") return "jsx";
    return "javascript";
  }

  async function fetchCodeLines(filePath, lineNumber) {
    try {
      var cleanPath = filePath.replace(/^vite:/, '').replace(/\\x00/g, '');
      var response = await fetch('/__bini_code_context?file=' + encodeURIComponent(cleanPath) + '&line=' + lineNumber);
      if (response.ok) {
        var data = await response.json();
        return data.lines || [];
      }
    } catch(e) {}
    return [];
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadShiki() {
    if (shikiLoadPromise) return shikiLoadPromise;
    shikiLoadPromise = import("https://esm.sh/shiki@1").then(function (mod) {
      if (mod && typeof mod.codeToHtml === "function") {
        shikiHighlighter = mod;
        return mod;
      }
      return null;
    }).catch(function () {
      return null;
    });
    return shikiLoadPromise;
  }

  function fallbackCodeHtml(code) {
    return "<pre style='margin:0;font-family:\\"SF Mono\\",\\"Fira Code\\",\\"Fira Mono\\",\\"Roboto Mono\\",monospace;'><code>" + escapeHtml(code) + "</code></pre>";
  }

  function highlightCode(code, lang) {
    if (shikiHighlighter && shikiHighlighter.codeToHtml) {
      return shikiHighlighter.codeToHtml(code, { lang: lang || "javascript", theme: "${shikiTheme}" }).catch(function () {
        return null;
      });
    }
    return Promise.resolve(null);
  }

  function prepareHighlights(err) {
    if (!err || !err.codeLines || !err.codeLines.length) return Promise.resolve();
    var lang = err.fileLang || "javascript";
    return loadShiki().then(function () {
      if (!shikiHighlighter) return;
      var codes = err.codeLines.map(function (cl) {
        var clNumMatch = cl.match(/(\\d+):/);
        var clCode = clNumMatch ? cl.substring(cl.indexOf(':') + 1).trim() : cl;
        return clCode.replace(/^>>>\\s*/, "");
      });
      return Promise.all(codes.map(function (code) { return highlightCode(code, lang); })).then(function (results) {
        err.highlightedLines = results;
      });
    }).catch(function () {});
  }

  var CHEVRON_UP_SVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.93945 10.5001L4.46978 9.96978L8.00011 6.44011L11.5304 9.96978L12.0608 10.5001L13.0001 9.43945L12.4698 8.90912L8.53044 4.96978C8.23756 4.67689 7.76267 4.67689 7.46978 4.96978L3.53044 8.90912L3.00011 9.43945L3.93945 10.5001Z" fill="currentColor"/></svg>';
  var CHEVRON_DOWN_SVG = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.0608 5.50011L11.5304 6.03044L8.00011 9.56011L4.46978 6.03044L3.93945 5.50011L3.00011 6.56078L3.53044 7.09111L7.46978 11.0304C7.76267 11.3233 8.23756 11.3233 8.53044 11.0304L12.4698 7.09111L13.0001 6.56078L12.0608 5.50011Z" fill="currentColor"/></svg>';
  var CHEVRON_RIGHT_SMALL = '<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.75011 3.93945L7.28044 4.46978L10.1037 7.29301C10.4942 7.68353 10.4942 8.3167 10.1037 8.70722L7.28044 11.5304L6.75011 12.0608L5.68945 11.0001L6.21978 10.4698L8.68945 8.00011L6.21978 5.53044L5.68945 5.00011L6.75011 3.93945Z" fill="currentColor"/></svg>';

  function renderFrameButton(f, opts) {
    var isFramework = opts && opts.framework;
    var attrs = '';
    if (isFramework) {
      attrs = 'class="bini-fw-frame"';
      return "<div " + attrs + ">" +
        escapeHtml(f.fn || '<anonymous>') + " " +
        escapeHtml(f.file) + ":" + escapeHtml(f.line) +
        "</div>";
    }
    return "<button class='bini-stack-frame' " +
           "data-file='" + escapeHtml(f.file) + "' " +
           "data-line='" + escapeHtml(f.line) + "' " +
           "onclick='window.__bini_open_editor(this.getAttribute(\\"data-file\\"), this.getAttribute(\\"data-line\\"))'>" +
           "<span style='color:#60a5fa;'>" + escapeHtml(f.fn || '<anonymous>') + "</span>" +
           "<span style='color:#6b7280;'> </span>" +
           "<span style='color:#10b981;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;'>" + escapeHtml(f.file) + "</span>" +
           "<span style='color:#6b7280;'>:</span><span style='color:#fbbf24;'>" + f.line + "</span>" +
           "</button>";
  }

  function formatErrorMessage(message, codeLines, fileLang, stack, err, errIndex) {
    var lang = fileLang || "javascript";
    var cleanMsg = cleanErrorMessage(message);
    var lines = cleanMsg.split("\\n");
    var html = "<div style='font-family:\\"SF Mono\\",\\"Fira Code\\",\\"Fira Mono\\",\\"Roboto Mono\\",monospace;font-size:13px;line-height:1.6;'>";

    if (err && err.plugin) {
      var pluginName = err.plugin;
      pluginName = pluginName.replace(/^vite:/, '').replace(/^vite\\\\x00/, '').replace(/\\x00/g, '');
      if (pluginName && pluginName !== 'oxc') {
        html += "<div style='display:flex;align-items:center;gap:8px;margin-bottom:16px;'>";
        html += "<span style='color:#6b7280;font-size:11px;'>" + escapeHtml(pluginName) + "</span>";
        html += "</div>";
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line || line === 'vite:oxc' || line.includes('vite:oxc')) continue;
      if (line.includes('NextJs') || line.includes('Turbopack')) continue;
      if (line.includes('╭─[') || line.includes('────╯')) continue;

      var errorMatch = line.match(/^\\[([^\\]]+)\\]\\s*(.+)$/);
      if (errorMatch) {
        var cleanErrorMsg = stripNonAscii(errorMatch[2]);
        html += "<div style='background:rgba(248,113,113,0.08);padding:16px;border-radius:8px;margin:8px 0;'>";
        html += "<div style='color:#f87171;font-weight:600;margin-bottom:8px;'>" + escapeHtml(errorMatch[1]) + "</div>";
        html += "<div style='color:#e4e4e7;font-size:14px;'>" + escapeHtml(cleanErrorMsg) + "</div>";
        html += "</div>";
        continue;
      }
      if (line.match(/Transform failed/)) {
        html += "<div style='color:#f97316;font-weight:500;padding:8px 0;'>" + escapeHtml(line) + "</div>";
        continue;
      }
      if (line.trim() && !line.match(/^\\s*[│|]/) && !line.match(/^\\s*\\d+\\s*[│|]/)) {
        html += "<div style='color:#9ca3af;padding:2px 0;'>" + escapeHtml(stripNonAscii(line)) + "</div>";
      }
    }

    if (codeLines && codeLines.length > 0) {
      html += "<div style='margin:16px 0;border:1.5px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;background:#050505;'>";
      html += "<div style='background:#0a0a0a;padding:8px 16px;border-bottom:1.5px solid rgba(255,255,255,0.08);font-size:11px;color:#9ca3af;font-weight:500;display:flex;align-items:center;justify-content:space-between;'>";
      html += "<span style='background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:4px;'>" + lang.toUpperCase() + "</span>";
      if (err && err.file && err.line) {
        html += "<span style='color:#6b7280;'>" + escapeHtml(shortenPath(err.file)) + ":" + err.line + "</span>";
      }
      html += "</div>";
      html += "<div class='bini-code-scroll'>";
      html += "<div style='display:inline-block;min-width:100%;padding:12px 0;'>";
      for (var k = 0; k < codeLines.length; k++) {
        var cl = codeLines[k];
        var isErr = cl.includes('>>>');
        var clNumMatch = cl.match(/(\\d+):/);
        var clNum = clNumMatch ? clNumMatch[1] : "";
        var clCode = clNumMatch ? cl.substring(cl.indexOf(':') + 1).trim() : cl;
        clCode = clCode.replace(/^>>>\\s*/, "");
        var clHtml = (err && err.highlightedLines && err.highlightedLines[k]) ? err.highlightedLines[k] : fallbackCodeHtml(clCode);
        html += "<div style='display:flex;padding:2px 0;" + (isErr ? "background:rgba(239,68,68,0.08);" : "") + "'>";
        html += "<span style='min-width:55px;padding:0 12px;text-align:right;color:" + (isErr ? "#f87171" : "#6b7280") + ";user-select:none;font-size:11px;font-weight:500;flex-shrink:0;'>" + clNum + "</span>";
        html += "<div style='flex:1;padding:0 12px 0 0;white-space:pre;font-family:\\"SF Mono\\",\\"Fira Code\\",\\"Fira Mono\\",\\"Roboto Mono\\",monospace;font-size:13px;line-height:1.5;'>" + clHtml + "</div>";
        html += "</div>";
      }
      html += "</div></div>";
      html += "</div>";
    }

    var parsed = parseStack(stack);
    var userFrames = parsed.user;
    var frameworkFrames = parsed.framework;
    var totalFrames = userFrames.length + frameworkFrames.length;

    if (totalFrames > 0) {
      var isCollapsed = stackCollapsedState[errIndex] === true;
      var bodyClass = isCollapsed ? "bini-stack-body collapsed" : "bini-stack-body";
      var chevronIcon = isCollapsed ? CHEVRON_DOWN_SVG : CHEVRON_UP_SVG;

      html += "<div style='margin-top:20px;' id='bini-stack-section-" + errIndex + "'>";
      html += "<button class='bini-stack-toggle' id='bini-stack-toggle-" + errIndex + "' style='margin-bottom:12px;' onclick='window.__bini_toggle_stack(" + errIndex + ")'>";
      html += "<span class='bini-stack-toggle-label'>Call Stack</span>";
      html += "<span class='bini-stack-chevron' id='bini-stack-chevron-" + errIndex + "'>" + chevronIcon + "</span>";
      html += "</button>";
      html += "<div class='" + bodyClass + "' id='bini-stack-body-" + errIndex + "'>";
      html += "<div class='bini-stack-scroll' style='background:#0a0a0a;border:1.5px solid rgba(255,255,255,0.08);border-radius:8px;'>";

      if (userFrames.length > 0) {
        for (var j = 0; j < userFrames.length; j++) {
          html += renderFrameButton(userFrames[j], { framework: false });
        }
      } else {
        html += "<div style='padding:12px 16px;color:#6b7280;font-size:11px;'>No application frames in this stack.</div>";
      }

      if (frameworkFrames.length > 0) {
        var fwOpen = frameworkFramesOpenState[errIndex] === true;
        var fwIconOpenClass = fwOpen ? 'bini-fw-toggle-icon open' : 'bini-fw-toggle-icon';
        var fwFramesClass = fwOpen ? 'bini-fw-frames open' : 'bini-fw-frames';

        html += "<button class='bini-fw-toggle' onclick='window.__bini_toggle_framework_frames(" + errIndex + ")'>";
        html += "<span class='" + fwIconOpenClass + "' id='bini-fw-icon-" + errIndex + "'>" + CHEVRON_RIGHT_SMALL + "</span>";
        html += "<span id='bini-fw-label-" + errIndex + "'>" + frameworkFrames.length + " framework frame" + (frameworkFrames.length === 1 ? "" : "s") + " hidden</span>";
        html += "</button>";
        html += "<div class='" + fwFramesClass + "' id='bini-fw-frames-" + errIndex + "'>";
        for (var m = 0; m < frameworkFrames.length; m++) {
          html += renderFrameButton(frameworkFrames[m], { framework: true });
        }
        html += "</div>";
      }

      html += "</div>";
      html += "</div>";
      html += "</div>";
    }

    if (err && err.componentStack) {
      html += "<div style='margin-top:20px;'>";
      html += "<div style='font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;'>Component Stack</div>";
      html += "<div class='bini-component-scroll' style='background:#0a0a0a;border:1.5px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;'>";
      html += "<pre style='margin:0;color:#9ca3af;font-size:11px;white-space:pre-wrap;word-break:break-all;'>" + escapeHtml(err.componentStack) + "</pre>";
      html += "</div></div>";
    }

    html += "</div>";
    return html;
  }

  function updateBadge() {
    var count = errors.length;
    if (typeof window.__bini_set_error_count === 'function') {
      window.__bini_set_error_count(count);
    }
  }

  window.__bini_toggle_stack = function(errIndex) {
    stackCollapsedState[errIndex] = !stackCollapsedState[errIndex];
    var body = document.getElementById("bini-stack-body-" + errIndex);
    var chevron = document.getElementById("bini-stack-chevron-" + errIndex);
    if (body) {
      if (stackCollapsedState[errIndex]) {
        body.classList.add("collapsed");
        if (chevron) chevron.innerHTML = '${CHEVRON_DOWN.replace(/'/g, "\\'")}';
      } else {
        body.classList.remove("collapsed");
        if (chevron) chevron.innerHTML = '${CHEVRON_UP.replace(/'/g, "\\'")}';
      }
    }
  };

  window.__bini_toggle_framework_frames = function(errIndex) {
    frameworkFramesOpenState[errIndex] = !frameworkFramesOpenState[errIndex];
    var framesEl = document.getElementById("bini-fw-frames-" + errIndex);
    var iconEl = document.getElementById("bini-fw-icon-" + errIndex);
    var labelEl = document.getElementById("bini-fw-label-" + errIndex);
    if (framesEl) {
      if (frameworkFramesOpenState[errIndex]) {
        framesEl.classList.add("open");
        if (iconEl) iconEl.classList.add("open");
        if (labelEl) labelEl.textContent = labelEl.textContent.replace("hidden", "shown");
      } else {
        framesEl.classList.remove("open");
        if (iconEl) iconEl.classList.remove("open");
        if (labelEl) labelEl.textContent = labelEl.textContent.replace("shown", "hidden");
      }
    }
  };

  window.__bini_open_editor = function(file, line) {
    if (!file) return;
    fetch('/__bini_open_editor?file=' + encodeURIComponent(file) + '&line=' + encodeURIComponent(line || '1'))
      .catch(function () {});
  };

  window.__bini_show_overlay = function() { show(); };

  function isPageDestroyed() {
    try {
      var err = errors[currentIndex];
      if (err && err._type === 'runtime' && err.componentStack) return true;

      var body = document.body;
      if (!body) return false;

      var ownIds = { __bini_ov__: 1, 'bini-loading-root': 1 };
      for (var i = 0; i < body.children.length; i++) {
        var child = body.children[i];
        if (!child || !child.id) continue;
        if (ownIds[child.id]) continue;
        if (child.offsetWidth > 0 || child.offsetHeight > 0) return false;
      }
      var root = document.getElementById('root') || document.getElementById('app');
      if (root && root.children.length > 0) return false;
      return true;
    } catch (_e) {
      return false;
    }
  }

  function updateCloseButton() {
    var closeBtn = document.getElementById('__bini_close');
    if (!closeBtn) return;
    if (isPageDestroyed()) {
      closeBtn.classList.add('bini-hidden');
    } else {
      closeBtn.classList.remove('bini-hidden');
    }
  }

  function ensureOverlay() {
    if (overlayRoot) return;
    var container = document.createElement("div");
    container.id = "__bini_ov__";
    container.innerHTML = \`${overlayHtml}\`;
    document.body.appendChild(container);
    overlayRoot = container.querySelector("#__bini_root");

    var copyBtn = document.getElementById("__bini_copy");
    var originalIcon = copyBtn.innerHTML;

    copyBtn.addEventListener("click", function() {
      copyError();
      copyBtn.innerHTML = \`${CHECK_ICON}\`;
      copyBtn.style.color = "#10b981";
      setTimeout(function() {
        copyBtn.innerHTML = originalIcon;
        copyBtn.style.color = "";
      }, 2000);
    });

    var closeBtn = document.getElementById("__bini_close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function() {
        if (isPageDestroyed()) return;
        hide();
      });
    }

    document.getElementById("__bini_prev").addEventListener("click", function() {
      currentIndex = Math.max(0, currentIndex - 1);
      render();
    });
    document.getElementById("__bini_next").addEventListener("click", function() {
      currentIndex = Math.min(errors.length - 1, currentIndex + 1);
      render();
    });
  }

  function show() {
    if (overlayRoot) overlayRoot.style.display = "flex";
    updateCloseButton();
  }

  function hide() {
    if (overlayRoot) overlayRoot.style.display = "none";
  }

  function render() {
    var err = errors[currentIndex];
    if (!err || !overlayRoot) return;

    var cleanMessage = err.originalMessage || err.message;

    var headingEl = document.getElementById("__bini_heading");
    if (headingEl) {
      var errorType;
      var msg = cleanMessage || "";
      if (err._type === 'runtime') {
        errorType = "Runtime Error";
      } else if (err.name === "Unhandled Rejection") {
        errorType = "Unhandled Rejection";
      } else if (msg.match(/SyntaxError|PARSE_ERROR|Unexpected token|Expected/i)) {
        errorType = "Parse Error";
      } else if (msg.match(/Transform failed|Build failed/i)) {
        errorType = "Build Error";
      } else if (msg.match(/TypeError/i) || (err.name === "TypeError")) {
        errorType = "Type Error";
      } else if (msg.match(/Element type is invalid|Cannot read|is not a function|is not defined/i)) {
        errorType = "Runtime Error";
      } else if (err.name && err.name !== "Plugin Error" && err.name !== "Vite Error") {
        errorType = err.name;
      } else {
        errorType = "Build Error";
      }
      headingEl.textContent = errorType;
    }

    var fileInfoEl = document.getElementById("__bini_file_info");
    if (fileInfoEl && err.file) {
      fileInfoEl.textContent = shortenPath(err.file) + (err.line ? ":" + err.line : "");
    } else if (fileInfoEl) {
      fileInfoEl.textContent = '';
    }

    var contentEl = document.getElementById("__bini_error_content");
    if (contentEl) {
      contentEl.innerHTML = formatErrorMessage(cleanMessage, err.codeLines || [], err.fileLang || "javascript", err.stack || "", err, currentIndex);
    }

    document.getElementById("__bini_current").textContent = currentIndex + 1;
    document.getElementById("__bini_total").textContent = errors.length;

    show();
  }

  function copyError() {
    var err = errors[currentIndex];
    if (!err) return;
    var text = (err.name || "Error") + ": " + (err.originalMessage || err.message);
    if (err.file) {
      text += "\\n\\nFile: " + err.file;
      if (err.line) text += ":" + err.line;
    }
    if (err.plugin) text += "\\nPlugin: " + err.plugin;
    if (err.componentStack) text += "\\n\\nComponent Stack:\\n" + err.componentStack;
    text += "\\n\\n" + (err.stack || "");
    navigator.clipboard.writeText(text).catch(function() {});
  }

  function getErrorKey(err) {
    var file = err.file || err.id || "";
    var line = err.line || "";
    var msg = (err.originalMessage || err.message || "").slice(0, 100);
    return file + ":" + line + ":" + msg;
  }

  function isRealError(err) {
    var msg = (err.originalMessage || err.message || '');
    if (msg.includes('PARSE_ERROR')) return true;
    if (msg.includes('Expected')) return true;
    if (msg.includes('Unexpected token')) return true;
    if (msg.includes('Transform failed')) return true;
    if (msg.includes('SyntaxError')) return true;
    if (msg.includes('TypeError')) return true;
    if (msg.includes('ReferenceError')) return true;
    if (err.plugin === 'vite:oxc') return true;
    if (err._type === 'runtime') return true;
    return false;
  }

  function isCascadeError(err) {
    var msg = (err.originalMessage || err.message || '');
    if (msg.includes('Failed to fetch dynamically imported module')) return true;
    if (msg.includes('Failed to resolve import')) return true;
    if (msg.includes('Failed to load module')) return true;
    if (msg.includes('Loading chunk')) return true;
    if (msg.includes('ChunkLoadError')) return true;
    return false;
  }

  function prioritizeErrors() {
    errors.sort(function(a, b) {
      var aReal = isRealError(a);
      var bReal = isRealError(b);
      if (aReal && !bReal) return -1;
      if (!aReal && bReal) return 1;
      var aMsg = a.message || '';
      var bMsg = b.message || '';
      if (aMsg.includes('PARSE_ERROR') || aMsg.includes('Expected')) return -1;
      if (bMsg.includes('PARSE_ERROR') || bMsg.includes('Expected')) return 1;
      if (aMsg.includes('Transform failed')) return -1;
      if (bMsg.includes('Transform failed')) return 1;
      return 0;
    });
    var seen = new Set();
    errors = errors.filter(function(e) {
      var key = getErrorKey(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function addError(err) {
    err.originalMessage = err.message;
    var errorMessage = err.originalMessage || err.message || '';
    var hasRealErrors = errors.some(isRealError);

    if (isCascadeError(err) && hasRealErrors) {
      filteredCount++;
      console.warn('[Bini] Filtered cascade error #' + filteredCount + ': ' + errorMessage.substring(0, 100));
      return;
    }
    if (isRealError(err)) {
      var beforeCount = errors.length;
      errors = errors.filter(function(e) {
        if (isCascadeError(e)) { filteredCount++; return false; }
        return true;
      });
      if (beforeCount !== errors.length) {
        console.warn('[Bini] Cleared ' + (beforeCount - errors.length) + ' cascade errors due to real compilation error');
      }
    }
    var key = getErrorKey(err);
    var existing = errors.some(function(e) { return getErrorKey(e) === key; });
    if (!existing) {
      errors.push(err);
      prioritizeErrors();
      currentIndex = 0;
      stackCollapsedState = {};
      frameworkFramesOpenState = {};
      ensureOverlay();
      prepareHighlights(err).then(function() { render(); });
      updateBadge();
      if (filteredCount > 0) {
        console.log('[Bini] Filtered ' + filteredCount + ' misleading errors total');
      }
    }
  }

  function cleanup() {
    if (_errorHandler) { window.removeEventListener("error", _errorHandler); _errorHandler = null; }
    if (_rejectionHandler) { window.removeEventListener("unhandledrejection", _rejectionHandler); _rejectionHandler = null; }
    if (_biniErrorHandler) { window.removeEventListener("__bini_error__", _biniErrorHandler); _biniErrorHandler = null; }
  }

  function extractFileFromError(message, stack) {
    var moduleMatch = (message || '').match(/module ['"]([^'"]+)['"]/);
    if (moduleMatch) return { file: moduleMatch[1], line: 1 };
    var fileMatch = (stack || '').match(/([^\\s(]+\\.(?:tsx?|jsx?|js|ts)):(\\d+):(\\d+)/);
    if (fileMatch) return { file: fileMatch[1], line: parseInt(fileMatch[2], 10) };
    return { file: '', line: null };
  }

  function addErrorWithSourcemap(errObj, stackForMapping) {
    var parsed = parseStack(stackForMapping || "");
    var allFrames = parsed.user.concat(parsed.framework);
    if (!allFrames.length) { addError(errObj); return; }
    resolveStackFrames(parsed.user).then(function (resolvedUser) {
      resolveStackFrames(parsed.framework).then(function (resolvedFw) {
        var rebuilt = resolvedUser.concat(resolvedFw).map(function (f) {
          var name = f.fn ? f.fn + ' ' : '';
          return '    at ' + name + '(' + f.file + ':' + f.line + ':' + (f.originalColumn || f.column) + ')';
        }).join('\\n');
        errObj.stack = rebuilt || errObj.stack;
        addError(errObj);
      }).catch(function () { addError(errObj); });
    }).catch(function () { addError(errObj); });
  }

  _biniErrorHandler = function(e) {
    var detail = e.detail;
    if (detail) {
      var fileInfo = extractFileFromError(detail.message, detail.stack);
      var errorObj = {
        name: detail.name || "Runtime Error",
        message: cleanErrorMessage(detail.message || "Unknown error"),
        stack: detail.stack || "",
        componentStack: detail.componentStack || "",
        _type: detail._type || detail.type || "runtime",
        file: detail.file || fileInfo.file || "",
        line: detail.line || fileInfo.line || null,
      };
      var stackMatch = (detail.stack || "").match(/([^\\s(]+\\.(?:tsx?|jsx?)):(\\d+):(\\d+)/);
      if (stackMatch && !errorObj.file) {
        errorObj.fileLang = langFromFile(stackMatch[1]);
        errorObj.file = errorObj.file || stackMatch[1];
        errorObj.line = errorObj.line || parseInt(stackMatch[2], 10);
        fetchCodeLines(stackMatch[1], parseInt(stackMatch[2], 10)).then(function(lines) {
          errorObj.codeLines = lines;
          addErrorWithSourcemap(errorObj, detail.stack || "");
        }).catch(function() { addErrorWithSourcemap(errorObj, detail.stack || ""); });
      } else if (errorObj.file && errorObj.line) {
        fetchCodeLines(errorObj.file, errorObj.line).then(function(lines) {
          errorObj.codeLines = lines;
          addErrorWithSourcemap(errorObj, detail.stack || "");
        }).catch(function() { addErrorWithSourcemap(errorObj, detail.stack || ""); });
      } else {
        addErrorWithSourcemap(errorObj, detail.stack || "");
      }
    }
  };
  window.addEventListener("__bini_error__", _biniErrorHandler);

  _errorHandler = function(e) {
    e.preventDefault();
    var stack = (e.error && e.error.stack) || '';
    var fileInfo = extractFileFromError(e.message, stack);
    var errorObj = {
      name: (e.error && e.error.name) || "Runtime Error",
      message: cleanErrorMessage(e.message),
      stack: stack,
      file: e.filename || fileInfo.file || "",
      line: e.lineno || fileInfo.line || null,
    };
    var stackMatch = stack.match(/([^\\s(]+\\.(?:tsx?|jsx?)):(\\d+):(\\d+)/);
    if (stackMatch) {
      errorObj.fileLang = langFromFile(stackMatch[1]);
      errorObj.file = errorObj.file || stackMatch[1];
      errorObj.line = errorObj.line || parseInt(stackMatch[2], 10);
      fetchCodeLines(stackMatch[1], parseInt(stackMatch[2], 10)).then(function(lines) {
        errorObj.codeLines = lines;
        addErrorWithSourcemap(errorObj, stack);
      }).catch(function() { addErrorWithSourcemap(errorObj, stack); });
    } else if (errorObj.file && errorObj.line) {
      fetchCodeLines(errorObj.file, errorObj.line).then(function(lines) {
        errorObj.codeLines = lines;
        addErrorWithSourcemap(errorObj, stack);
      }).catch(function() { addErrorWithSourcemap(errorObj, stack); });
    } else {
      addErrorWithSourcemap(errorObj, stack);
    }
  };
  window.addEventListener("error", _errorHandler);

  _rejectionHandler = function(e) {
    e.preventDefault();
    var r = e.reason;
    var stack = (r && r.stack) || '';
    var fileInfo = extractFileFromError((r && r.message) || String(r), stack);
    var errorObj = {
      name: (r && r.name) || "Unhandled Rejection",
      message: cleanErrorMessage((r && r.message) || String(r)),
      stack: stack,
      file: fileInfo.file || "",
      line: fileInfo.line || null,
    };
    var stackMatch = stack.match(/([^\\s(]+\\.(?:tsx?|jsx?)):(\\d+):(\\d+)/);
    if (stackMatch) {
      errorObj.fileLang = langFromFile(stackMatch[1]);
      errorObj.file = stackMatch[1];
      errorObj.line = parseInt(stackMatch[2], 10);
      fetchCodeLines(stackMatch[1], parseInt(stackMatch[2], 10)).then(function(lines) {
        errorObj.codeLines = lines;
        addErrorWithSourcemap(errorObj, stack);
      }).catch(function() { addErrorWithSourcemap(errorObj, stack); });
    } else if (errorObj.file && errorObj.line) {
      fetchCodeLines(errorObj.file, errorObj.line).then(function(lines) {
        errorObj.codeLines = lines;
        addErrorWithSourcemap(errorObj, stack);
      }).catch(function() { addErrorWithSourcemap(errorObj, stack); });
    } else {
      addErrorWithSourcemap(errorObj, stack);
    }
  };
  window.addEventListener("unhandledrejection", _rejectionHandler);

  if (import.meta && import.meta.hot) {
    import.meta.hot.on("vite:error", function(data) {
      var err = data && data.err;
      var errorObj;
      if (err) {
        errorObj = {
          name: err.id ? "Build Error" : "Vite Error",
          message: cleanErrorMessage(err.message || "Unknown build error"),
          stack: err.stack || "",
          id: err.id || err.file || "",
          file: (err.loc && err.loc.file) || err.id || err.file || "",
          line: (err.loc && err.loc.line) || null,
          column: (err.loc && err.loc.column) || null,
          plugin: err.plugin || null,
        };
        var isRealErr = errorObj.message.includes('PARSE_ERROR') ||
                        errorObj.message.includes('Expected') ||
                        errorObj.message.includes('Transform failed');
        if (isRealErr) {
          var beforeCount = errors.length;
          errors = errors.filter(function(e) {
            return !e.message.includes('Failed to fetch dynamically imported module') &&
                   !e.message.includes('Failed to resolve import');
          });
          if (beforeCount !== errors.length) {
            filteredCount += (beforeCount - errors.length);
            console.warn('[Bini] Cleared cascade errors due to parse error');
          }
        }
        var fileForContext = errorObj.file || "";
        var lineForContext = errorObj.line;
        if (!lineForContext) {
          var fileMatch = (err.message || "").match(/([^\\s(]+\\.(?:tsx?|jsx?)):(\\d+):(\\d+)/);
          if (!fileMatch && err.id) fileMatch = (err.id + ":1:1").match(/([^\\s(]+\\.(?:tsx?|jsx?)):(\\d+):(\\d+)/);
          if (fileMatch) {
            fileForContext = fileForContext || fileMatch[1];
            lineForContext = parseInt(fileMatch[2], 10);
            errorObj.file = errorObj.file || fileMatch[1];
            errorObj.line = errorObj.line || lineForContext;
          }
        }
        if (fileForContext) errorObj.fileLang = langFromFile(fileForContext);
        if (fileForContext && lineForContext) {
          fetchCodeLines(fileForContext, lineForContext).then(function(lines) {
            errorObj.codeLines = lines;
            addErrorWithSourcemap(errorObj, err.stack || "");
          }).catch(function() { addErrorWithSourcemap(errorObj, err.stack || ""); });
        } else {
          addErrorWithSourcemap(errorObj, err.stack || "");
        }
      } else if (data && data.message) {
        errorObj = {
          name: "Build Error",
          message: cleanErrorMessage(data.message),
          stack: data.stack || "",
          file: "",
          line: null,
        };
        addErrorWithSourcemap(errorObj, data.stack || "");
      }
    });

    import.meta.hot.on("vite:beforeUpdate", function(payload) {
      var updates = (payload && payload.updates) ? payload.updates : [];
      if (updates.length > 0) {
        errors = errors.filter(function(e) {
          var errFile = e.file || e.id || "";
          return !updates.some(function(u) {
            var updatePath = u.path || u.acceptedPath || "";
            return errFile && updatePath && (
              errFile.includes(updatePath) || updatePath.includes(errFile.split('/').pop())
            );
          });
        });
      } else {
        errors = [];
      }
      currentIndex = Math.max(0, Math.min(currentIndex, errors.length - 1));
      stackCollapsedState = {};
      frameworkFramesOpenState = {};
      if (errors.length === 0) {
        filteredCount = 0;
        updateBadge();
        hide();
      } else {
        render();
        updateBadge();
      }
    });

    import.meta.hot.on("vite:afterUpdate", function() {
      errors = [];
      filteredCount = 0;
      currentIndex = 0;
      stackCollapsedState = {};
      frameworkFramesOpenState = {};
      updateBadge();
      hide();
      window.dispatchEvent(new CustomEvent('__bini_clear_errors__'));
    });

    import.meta.hot.dispose(function() {
      cleanup();
    });
  }
})();
`.trim();

        return [scriptTag(js, 'head-prepend', true)];
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 3 — Intercept vite-error-overlay
// ─────────────────────────────────────────────────────────────
function biniViteErrorInterceptPlugin(): BiniPlugin {
  return {
    name: 'bini-overlay:vite-intercept',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      handler(html: string, ctx: IndexHtmlTransformContext): HtmlTagDescriptor[] | string {
        if (!isDev(ctx)) return html;

        const js = `
(function () {
  if (customElements.get("vite-error-overlay")) return;
  class BiniViteErrorOverlay extends HTMLElement {
    constructor() {
      super();
      this.style.display = "none";
    }
  }
  customElements.define("vite-error-overlay", BiniViteErrorOverlay);
})();
`.trim();

        return [scriptTag(js, 'head-prepend', true)];
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 4 — Code context API
// ─────────────────────────────────────────────────────────────
function biniCodeContextPlugin(): BiniPlugin {
  const fileCache = new Map<string, { mtimeMs: number; lines: string[] }>();
  const MAX_CACHE_ENTRIES = 64;

  function readCachedLines(filePath: string): string[] {
    let stats: fs.Stats;
    try {
      stats = fs.statSync(filePath);
    } catch {
      return [];
    }
    const cached = fileCache.get(filePath);
    if (cached && cached.mtimeMs === stats.mtimeMs) return cached.lines;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    if (fileCache.size >= MAX_CACHE_ENTRIES && !fileCache.has(filePath)) {
      const firstKey = fileCache.keys().next().value;
      if (firstKey !== undefined) fileCache.delete(firstKey);
    }
    fileCache.delete(filePath);
    fileCache.set(filePath, { mtimeMs: stats.mtimeMs, lines });
    return lines;
  }

  return {
    name: 'bini-overlay:code-context',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__bini_code_context', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          if (!isSameOriginRequest(req)) {
            rejectCrossOrigin(res);
            return;
          }

          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const filePath = url.searchParams.get('file');
          const lineStr = url.searchParams.get('line');

          if (!filePath || !lineStr) {
            res.statusCode = 400;
            res.end('Missing file or line parameter');
            return;
          }

          const line = parseInt(lineStr, 10);
          if (!Number.isFinite(line) || line < 1) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ lines: [] }));
            return;
          }

          let cleanPath = decodeURIComponent(filePath)
            .replace(/^vite:/, '')
            .replace(/\x00/g, '')
            .replace(/\?.*$/, '');

          if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
            cleanPath = new URL(cleanPath).pathname;
          }

          const fullPath = path.isAbsolute(cleanPath) ? cleanPath : path.join(process.cwd(), cleanPath);

          const cwd = process.cwd();
          const resolved = path.resolve(fullPath);
          if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Access denied' }));
            return;
          }

          if (!fs.existsSync(resolved)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ lines: [] }));
            return;
          }

          const lines = readCachedLines(resolved);

          const startLine = Math.max(0, line - 3);
          const endLine = Math.min(lines.length, line + 2);

          const contextLines: string[] = [];
          for (let i = startLine; i < endLine; i++) {
            const prefix = i + 1 === line ? '>>> ' : '    ';
            contextLines.push(prefix + (i + 1) + ': ' + lines[i]);
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ lines: contextLines }));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ lines: [] }));
        }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 5 — Sourcemap resolution API
// ─────────────────────────────────────────────────────────────
function biniSourcemapPlugin(): BiniPlugin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let traceMod: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let traceModPromise: Promise<any | null> | null = null;

  function loadTraceModule(): Promise<any | null> {
    if (traceMod) return Promise.resolve(traceMod);
    if (traceModPromise) return traceModPromise;
    traceModPromise = import('@jridgewell/trace-mapping')
      .then((mod) => {
        traceMod = mod;
        return mod;
      })
      .catch(() => null);
    return traceModPromise;
  }

  return {
    name: 'bini-overlay:sourcemap',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__bini_sourcemap', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          if (!isSameOriginRequest(req)) {
            rejectCrossOrigin(res);
            return;
          }

          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const file = url.searchParams.get('file');
          const lineStr = url.searchParams.get('line');
          const colStr = url.searchParams.get('column') || '0';

          if (!file || !lineStr) {
            res.statusCode = 400;
            res.end('Missing file or line parameter');
            return;
          }

          const line = parseInt(lineStr, 10);
          const column = parseInt(colStr, 10) || 0;
          if (!Number.isFinite(line) || line < 1) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'invalid line' }));
            return;
          }

          const candidates: string[] = [];
          if (file.startsWith('/')) candidates.push(file);
          else candidates.push('/' + file);

          const base = server.config.base || '/';
          if (base !== '/' && !file.startsWith(base)) {
            const baseStripped = base.endsWith('/') ? base.slice(0, -1) : base;
            candidates.push(baseStripped + file);
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const graph: any = (server as any).moduleGraph;
          if (!graph || typeof graph.getModuleByUrl !== 'function') {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'module graph unavailable' }));
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let mod: any = null;
          for (const cand of candidates) {
            mod = graph.getModuleByUrl(cand, server);
            if (mod) break;
          }

          if (!mod || !mod.transformResult || !mod.transformResult.map) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'no sourcemap' }));
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let mapRaw: any = mod.transformResult.map;
          if (typeof mapRaw === 'string') {
            try {
              mapRaw = JSON.parse(mapRaw);
            } catch {
              mapRaw = null;
            }
          }
          if (!mapRaw || !mapRaw.mappings) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'empty sourcemap' }));
            return;
          }

          const trace = await loadTraceModule();
          if (!trace || typeof trace.originalPositionFor !== 'function') {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'trace-mapping unavailable' }));
            return;
          }

          let pos: { source?: string; line?: number; column?: number } | null = null;
          try {
            pos = trace.originalPositionFor(mapRaw, { line, column });
          } catch {
            pos = null;
          }

          if (!pos || !pos.source) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'no mapping' }));
            return;
          }

          let src: string = pos.source;
          while (src.startsWith('/')) src = src.slice(1);
          while (src.startsWith('../')) src = src.slice(3);

          if (src.startsWith('src/') || src.startsWith('app/')) {
            src = '/' + src;
          } else {
            try {
              const modFile: string = mod.file || '';
              const modDir: string = modFile ? path.dirname(modFile) : server.config.root;
              const abs = path.resolve(modDir, src);
              const rel = path.relative(server.config.root, abs).split(path.sep).join('/');
              if (rel.startsWith('src/') || rel.startsWith('app/')) {
                src = '/' + rel;
              } else {
                src = rel;
              }
            } catch {
              // leave src as-is
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            file: src,
            line: pos.line || line,
            column: pos.column || column,
          }));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'sourcemap lookup failed' }));
        }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 6 — Open in editor API
// ─────────────────────────────────────────────────────────────
function biniOpenEditorPlugin(options: BiniOverlayOptions = {}): BiniPlugin {
  const isWin = process.platform === 'win32';
  const probe = isWin ? 'where' : 'which';
  const candidates = options.editor
    ? [options.editor]
    : ['code', 'cursor', 'zed', 'subl', 'webstorm'];

  let resolvedEditor: string | null = null;
  let probed = false;

  function resolveEditor(): string | null {
    if (probed) return resolvedEditor;
    probed = true;
    for (const bin of candidates) {
      try {
        execSync(`${probe} ${bin}`, { stdio: 'ignore' });
        resolvedEditor = bin;
        return resolvedEditor;
      } catch {
        continue;
      }
    }
    return null;
  }

  function buildArgs(bin: string, file: string, line: string): string[] {
    switch (bin) {
      case 'code':
      case 'cursor':
        return ['-g', `${file}:${line}`];
      case 'zed':
        return [`${file}:${line}`];
      case 'subl':
        return [`${file}:${line}`];
      case 'webstorm':
      case 'idea':
        return ['--line', line, file];
      default:
        return ['-g', `${file}:${line}`];
    }
  }

  return {
    name: 'bini-overlay:open-editor',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__bini_open_editor', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          if (!isSameOriginRequest(req)) {
            rejectCrossOrigin(res);
            return;
          }

          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const file = url.searchParams.get('file');
          const line = url.searchParams.get('line') || '1';

          if (!file) {
            res.statusCode = 400;
            res.end('Missing file parameter');
            return;
          }

          const cwd = process.cwd();
          const resolved = path.resolve(
            path.isAbsolute(file) ? file : path.join(cwd, file),
          );
          if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
            res.statusCode = 403;
            res.end('Access denied');
            return;
          }

          if (!fs.existsSync(resolved)) {
            res.statusCode = 404;
            res.end('File not found');
            return;
          }

          const editor = resolveEditor();
          if (!editor) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'No supported editor found on PATH',
              hint: 'Install code, cursor, zed, subl, or webstorm, or pass options.editor to biniOverlay().',
            }));
            return;
          }

          const args = buildArgs(editor, resolved, line);
          try {
            const child = spawn(editor, args, { stdio: 'ignore', detached: true });
            child.unref();
          } catch {
            res.statusCode = 500;
            res.end('Failed to launch editor');
            return;
          }

          res.statusCode = 204;
          res.end();
        } catch {
          res.statusCode = 500;
          res.end('Failed to open editor');
        }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 7 — Routes API for Bini Router
// ─────────────────────────────────────────────────────────────
function biniRoutesPlugin(options: BiniOverlayOptions = {}): BiniPlugin {
  const appDir = path.join(process.cwd(), options.appDir ?? 'src/app');

  let routerModPromise: Promise<any | null> | null = null;
  function loadRouterModule(): Promise<any | null> {
    if (!routerModPromise) {
      routerModPromise = import('bini-router').catch(() => null);
    }
    return routerModPromise;
  }

  return {
    name: 'bini-overlay:routes',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      const base = server.config.base || '/';
      const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base;

      let manifestCache: any = null;
      let manifestPromise: Promise<any | null> | null = null;

      async function getManifest(): Promise<any | null> {
        if (manifestCache) return manifestCache;
        if (manifestPromise) return manifestPromise;
        manifestPromise = (async () => {
          const mod = await loadRouterModule();
          if (!mod || typeof mod.generateRouteManifest !== 'function') {
            manifestPromise = null;
            return null;
          }
          manifestCache = mod.generateRouteManifest(appDir);
          manifestPromise = null;
          return manifestCache;
        })();
        return manifestPromise;
      }

      let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
      function scheduleInvalidate() {
        if (invalidateTimer) clearTimeout(invalidateTimer);
        invalidateTimer = setTimeout(() => {
          invalidateTimer = null;
          manifestCache = null;
          manifestPromise = null;
        }, 100);
      }

      const onFsEvent = (file: string) => {
        const nf = file.replace(/\\/g, '/');
        const nd = appDir.replace(/\\/g, '/').replace(/\/$/, '');
        if (nf === nd || nf.startsWith(nd + '/')) scheduleInvalidate();
      };
      try {
        server.watcher.on('add', onFsEvent);
        server.watcher.on('unlink', onFsEvent);
        server.watcher.on('change', onFsEvent);
      } catch {
        // watcher not available — fall back to always-fresh manifest
      }

      server.middlewares.use('/__bini_route_match', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          if (!isSameOriginRequest(req)) {
            rejectCrossOrigin(res);
            return;
          }

          const url = new URL(req.url || '', `http://${req.headers.host}`);
          let pathToMatch = url.searchParams.get('path') || '/';

          if (baseNoSlash) {
            if (pathToMatch === baseNoSlash) {
              pathToMatch = '/';
            } else if (pathToMatch.startsWith(baseNoSlash + '/')) {
              pathToMatch = pathToMatch.slice(baseNoSlash.length) || '/';
            }
          }

          if (pathToMatch.length > 1) {
            pathToMatch = pathToMatch.replace(/\/+$/, '');
          }

          const mod = await loadRouterModule();
          if (!mod || typeof mod.generateRouteManifest !== 'function') {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              type: 'not_found',
              error: 'bini-router is not installed. Add it as a peer dependency to enable route introspection.',
            }));
            return;
          }

          const manifest = await getManifest();
          if (!manifest) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ type: 'not_found' }));
            return;
          }

          const result = mod.matchManifestRoute(manifest, pathToMatch);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            type: result.type,
            path: pathToMatch,
            routePath: result.routePath,
          }));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ type: 'not_found' }));
        }
      });

      server.middlewares.use('/__bini_route_info', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          if (!isSameOriginRequest(req)) {
            rejectCrossOrigin(res);
            return;
          }

          const url = new URL(req.url || '', `http://${req.headers.host}`);
          let pathToMatch = url.searchParams.get('path') || '/';

          if (baseNoSlash) {
            if (pathToMatch === baseNoSlash) {
              pathToMatch = '/';
            } else if (pathToMatch.startsWith(baseNoSlash + '/')) {
              pathToMatch = pathToMatch.slice(baseNoSlash.length) || '/';
            }
          }

          if (pathToMatch.length > 1) {
            pathToMatch = pathToMatch.replace(/\/+$/, '');
          }

          const mod = await loadRouterModule();
          if (!mod || typeof mod.generateRouteManifest !== 'function') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              path: pathToMatch,
              type: 'not_found',
              segments: [],
              layouts: [],
              pageFile: '',
              error: 'bini-router not installed',
            }));
            return;
          }

          const manifest = await getManifest();
          if (!manifest) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              path: pathToMatch,
              type: 'not_found',
              segments: [],
              layouts: [],
              pageFile: '',
              error: 'manifest unavailable',
            }));
            return;
          }

          const result = mod.matchManifestRoute(manifest, pathToMatch);

          // ── Critical fix ─────────────────────────────────────
          // If the current path does NOT match any route, return
          // empty segments. Otherwise the client would split the
          // raw URL into fake "segments" and label them all static.
          if (result.type === 'not_found') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              path: pathToMatch,
              type: 'not_found',
              segments: [],
              layouts: [],
              pageFile: '',
            }));
            return;
          }

          const matchedKey = result.routePath;
          const meta = manifest.metadata && manifest.metadata[matchedKey];

          const segments: Array<{ name: string; kind: string; depth: number }> = [];
          if (matchedKey && matchedKey !== '/') {
            const parts = matchedKey.split('/').filter(Boolean);
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              let kind = 'static';
              if (part.startsWith(':')) kind = 'dynamic';
              else if (part === '*') kind = 'catch-all';
              segments.push({ name: part, kind, depth: i });
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            path: matchedKey,
            type: result.type,
            segments,
            layouts: (meta && meta.layouts) || [],
            pageFile: (meta && meta.filePath) || '',
          }));
        } catch {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            path: '/',
            type: 'not_found',
            segments: [],
            layouts: [],
            pageFile: '',
            error: 'route info failed',
          }));
        }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────
export function biniOverlay(options: BiniOverlayOptions = {}): PluginOption[] {
  return [
    biniCodeContextPlugin(),
    biniSourcemapPlugin(),
    biniOpenEditorPlugin(options),
    biniRoutesPlugin(options),
    biniViteErrorInterceptPlugin(),
    biniErrorOverlay(),
    biniLoadingPlugin(options),
  ];
}