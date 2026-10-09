import type {
  Plugin,
  PluginOption,
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
  ViteDevServer,
} from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';
import { siReact, siTypescript, siJavascript } from 'simple-icons';

export interface BiniOverlayOptions {
  disableBadge?: boolean;
}

interface BiniPlugin extends Plugin {
  name: string;
  apply?: 'serve' | 'build' | ((this: void, config: any, env: any) => boolean);
}

const ICON_REACT = siReact.path;
const ICON_TYPESCRIPT = siTypescript.path;
const ICON_JAVASCRIPT = siJavascript.path;

const FONT_PACKAGES: Record<string, string> = {
  inter: '@fontsource-variable/inter',
  geist: '@fontsource-variable/geist',
};
const FONT_BASE_TOKEN = '__BINI_FONT_BASE__';
const fontCssCache = new Map<string, string>();
const fontDirs = new Map<string, string>();

function findFontsourceCssPath(pkg: string): string | null {
  try {
    const resolved = import.meta.resolve(`${pkg}/index.css`);
    const cssPath = resolved.startsWith('file:') ? fileURLToPath(resolved) : resolved;
    if (fs.existsSync(cssPath)) return cssPath;
  } catch {
  }

  const parts = pkg.split('/');
  const candidates = [
    path.join(process.cwd(), 'node_modules', ...parts, 'index.css'),
    path.join(__dirname, '..', 'node_modules', ...parts, 'index.css'),
    path.join(__dirname, '..', '..', 'node_modules', ...parts, 'index.css'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function loadFontsourceCss(key: string): string {
  const cached = fontCssCache.get(key);
  if (cached !== undefined) return cached;

  let css = '';
  const pkg = FONT_PACKAGES[key];
  const cssPath = pkg ? findFontsourceCssPath(pkg) : null;
  if (cssPath) {
    try {
      const raw = fs.readFileSync(cssPath, 'utf8');
      fontDirs.set(key, path.join(path.dirname(cssPath), 'files'));
      css = raw.replace(
        /url\(\s*(['"]?)\.\/files\/([^'")\s]+)\1\s*\)/g,
        (_m, q: string, file: string) => `url(${q}${FONT_BASE_TOKEN}__bini_font/${key}/${file}${q})`,
      );
    } catch {
      css = '';
    }
  }

  fontCssCache.set(key, css);
  return css;
}

function loadFontCss(base: string = '/'): string {
  const b = base.endsWith('/') ? base : base + '/';
  return Object.keys(FONT_PACKAGES)
    .map((key) => loadFontsourceCss(key))
    .filter(Boolean)
    .join('\n')
    .split(FONT_BASE_TOKEN)
    .join(b);
}

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
const CHEVRON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M5.50011 1.93945L6.03044 2.46978L10.8537 7.293C11.2442 7.68353 11.2442 8.31669 10.8537 8.70722L6.03044 13.5304L5.50011 14.0608L4.43945 13.0001L4.96978 12.4698L9.43945 8.00011L4.96978 3.53044L4.43945 3.00011L5.50011 1.93945Z"></path></svg>`;
const CHEVRON_DOWN = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.0608 5.50011L11.5304 6.03044L8.00011 9.56011L4.46978 6.03044L3.93945 5.50011L3.00011 6.56078L3.53044 7.09111L7.46978 11.0304C7.76267 11.3233 8.23756 11.3233 8.53044 11.0304L12.4698 7.09111L13.0001 6.56078L12.0608 5.50011Z" fill="currentColor"/></svg>`;
const CLOSE_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const GEAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const EYE_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const ROUTE_ARROW_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;

function isDev(ctx: IndexHtmlTransformContext): boolean {
  return !!ctx.server;
}

function scriptTag(
  js: string,
  injectTo: HtmlTagDescriptor['injectTo'] = 'head-prepend',
  isModule: boolean = true,
): HtmlTagDescriptor {
  return {
    tag: 'script',
    attrs: isModule ? { type: 'module' } : {},
    children: js,
    injectTo,
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

function biniFontPlugin(): BiniPlugin {
  return {
    name: 'bini-overlay:font',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      Object.keys(FONT_PACKAGES).forEach((key) => loadFontsourceCss(key));

      server.middlewares.use('/__bini_font', (req: IncomingMessage, res: ServerResponse) => {
        const pathname = (req.url || '').split('?')[0] ?? '';
        const m = /^\/([a-z]+)\/([\w.-]+\.(?:woff2|woff))$/i.exec(pathname);
        const fontKey = m?.[1];
        const fontName = m?.[2];
        const dir = fontKey ? fontDirs.get(fontKey) : undefined;
        if (!fontKey || !fontName || !dir) {
          res.statusCode = 404;
          res.end();
          return;
        }

        const file = path.join(dir, fontName);
        if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) {
          res.statusCode = 404;
          res.end();
          return;
        }

        res.setHeader('Content-Type', fontName.endsWith('.woff2') ? 'font/woff2' : 'font/woff');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        fs.createReadStream(file).pipe(res);
      });
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html: string, ctx: IndexHtmlTransformContext): HtmlTagDescriptor[] | string {
        if (!isDev(ctx)) return html;

        const css = loadFontCss(ctx.server?.config.base || '/');
        if (!css) return html;

        return [
          {
            tag: 'style',
            attrs: { 'data-bini-font': 'inter-geist' },
            children: css,
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

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
      case 'small':  return { pill: 36, logoW: 14, logoH: 19, circle: 28, label: 12, pad: 12 };
      case 'large':  return { pill: 56, logoW: 24, logoH: 33, circle: 46, label: 17, pad: 20 };
      default:       return { pill: 48, logoW: 20, logoH: 28, circle: 40, label: 15, pad: 16 };
    }
  }

  var style = document.createElement("style");
  style.textContent = [
    ":host {",
    "  all: initial;",
    "  display: block;",
    "  font-family: 'Inter Variable', 'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    "}",
    "",
    ":host {",
    "  --bini-bg: #0a0a0a;",
    "  --bini-text: #e4e4e7;",
    "  --bini-text-muted: #71717a;",
    "  --bini-menu-value: #a1a1aa;",
    "  --bini-border: rgba(255,255,255,0.08);",
    "  --bini-border-strong: rgba(255,255,255,0.18);",
    "  --bini-hover: rgba(255,255,255,0.06);",
    "  --bini-chip-bg: rgba(255,255,255,0.05);",
    "  --bini-accent: #3b82f6;",
    "  --bini-dropdown-bg: #111111;",
    "  --bini-dropdown-border: rgba(255,255,255,0.1);",
    "  --bini-dropdown-hover: rgba(255,255,255,0.08);",
    "  --bini-badge-bg: #0a0a0a;",
    "  --bini-badge-border: rgba(255,255,255,0.15);",
    "  --bini-menu-label: #ffffff;",
    "  --bini-font-sans: 'Inter Variable', 'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    "  --bini-font-geist: 'Geist Variable', 'Geist', 'Inter Variable', 'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    "  --bini-font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;",
    "}",
    ":host([data-theme='light']) {",
    "  --bini-bg: #ffffff;",
    "  --bini-text: #18181b;",
    "  --bini-text-muted: #6b7280;",
    "  --bini-menu-value: #6b7280;",
    "  --bini-border: rgba(0,0,0,0.08);",
    "  --bini-border-strong: rgba(0,0,0,0.18);",
    "  --bini-hover: rgba(0,0,0,0.04);",
    "  --bini-chip-bg: rgba(0,0,0,0.04);",
    "  --bini-accent: #2563eb;",
    "  --bini-dropdown-bg: #ffffff;",
    "  --bini-dropdown-border: rgba(0,0,0,0.1);",
    "  --bini-dropdown-hover: rgba(0,0,0,0.04);",
    "  --bini-badge-bg: #0a0a0a;",
    "  --bini-badge-border: rgba(255,255,255,0.15);",
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
    "  pointer-events: auto; cursor: pointer;",
    "  transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);",
    "  overflow: hidden;",
    "}",
    "#w.has-errors {",
    "  box-sizing: border-box;",
    "  width: auto;",
    "  max-width: none;",
    "  border-radius: 999px;",
    "  background: #cf3535;",
    "  border: none;",
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
    "  width: var(--bini-pill-h, 40px);",
    "  height: var(--bini-pill-h, 40px);",
    "  min-width: var(--bini-pill-h, 40px);",
    "  background: rgba(255,255,255,0.14);",
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
    "  background: rgba(255,255,255,0.24);",
    "}",
    ".ep-icon svg {",
    "  width: var(--bini-icon-logo-w, 16px);",
    "  height: var(--bini-icon-logo-h, 22px);",
    "  display: block;",
    "}",
    ".ep-content {",
    "  display: flex; align-items: center; gap: 5px;",
    "  padding: 0 calc(var(--bini-pill-pad, 16px) - 4px) 0 8px;",
    "  margin: 0 4px 0 0;",
    "  cursor: pointer;",
    "  height: calc(100% - 8px);",
    "  position: relative;",
    "  z-index: 1;",
    "  white-space: nowrap;",
    "  flex-shrink: 0;",
    "  border-radius: 999px;",
    "  transition: background 0.15s;",
    "}",
    ".ep-content:hover {",
    "  background: rgba(255,255,255,0.16);",
    "}",
    ".ep-count {",
    "  font-family: var(--bini-font-geist);",
    "  font-size: var(--bini-label-size, 15px);",
    "  font-weight: 600;",
    "  color: #ffffff;",
    "  line-height: 1;",
    "  letter-spacing: -0.01em;",
    "}",
    ".ep-label {",
    "  font-family: var(--bini-font-geist);",
    "  font-size: var(--bini-label-size, 15px);",
    "  font-weight: 600;",
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
    "  z-index: 2147483647;",
    "  display: none;",
    "  overflow: hidden;",
    "  font-family: var(--bini-font-sans);",
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
    "  color: var(--bini-menu-value);",
    "  font-size: 13px;",
    "  font-weight: 400;",
    "  display: flex; align-items: center; gap: 6px;",
    "}",
    ".bini-menu-value-icon { display: inline-flex; align-items: center; color: var(--bini-menu-value); }",
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
    "  z-index: 2147483647;",
    "  display: none;",
    "  font-family: var(--bini-font-sans);",
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
    "  font-family: var(--bini-font-mono);",
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
    "  font-family: var(--bini-font-mono);",
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
    "  font-family: var(--bini-font-mono);",
    "}",
    "",
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
        '<span class="bini-route-path-icon">' + '${ROUTE_ARROW_ICON}' + '</span>' +
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
    try { window.dispatchEvent(new CustomEvent('__bini_theme__', { detail: resolved })); } catch (_e) {}
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

    var iconLogoH = Math.round(d.circle * 0.5);
    var iconLogoW = Math.round(iconLogoH * 22 / 31);

    el.style.setProperty('--bini-badge-size', d.pill + 'px');
    el.style.setProperty('--bini-logo-w', d.logoW + 'px');
    el.style.setProperty('--bini-logo-h', d.logoH + 'px');
    el.style.setProperty('--bini-icon-logo-w', iconLogoW + 'px');
    el.style.setProperty('--bini-icon-logo-h', iconLogoH + 'px');
    el.style.setProperty('--bini-pill-h', d.circle + 'px');
    el.style.setProperty('--bini-pill-pad', d.pad + 'px');
    el.style.setProperty('--bini-label-size', d.label + 'px');

    var offset = (20 + d.pill + 12) + 'px';
    var isTop = prefs.position.indexOf('top') === 0;
    var isRight = prefs.position.slice(-5) === 'right';
    [menuEl, prefsPopover, routePopover].forEach(function (node) {
      node.style.top = isTop ? offset : '';
      node.style.bottom = isTop ? '' : offset;
      node.style.left = isRight ? '' : '20px';
      node.style.right = isRight ? '20px' : '';
    });
  }
  applyPositionAndSize();

  function applyHiddenState() {
    container.style.display = isHiddenSession ? 'none' : 'block';
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

  function setupDropdown(id, initialValue, onChange) {
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

    updateDisplay(initialValue || toggle.getAttribute('data-value'));
  }

  setupDropdown('dd-theme', prefs.theme, function(val) {
    prefs.theme = val;
    savePrefs(prefs);
    applyTheme();
  });
  setupDropdown('dd-position', prefs.position, function(val) {
    prefs.position = val;
    savePrefs(prefs);
    applyPositionAndSize();
  });
  setupDropdown('dd-size', prefs.size, function(val) {
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
      '<code style="font-family:var(--bini-font-mono);color:#f87171;background:rgba(248,113,113,0.1);padding:1px 5px;border-radius:3px;">' +
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

function biniErrorOverlay(): BiniPlugin {
  const theme = {
    panel: 'var(--bini-panel)',
    codeBg: 'var(--bini-code-bg)',
    border: 'var(--bini-border)',
    borderStrong: 'var(--bini-border-strong)',
    text: 'var(--bini-text)',
    textMuted: 'var(--bini-text-muted)',
    textDim: 'var(--bini-text-dim)',
    error: 'var(--bini-error)',
    link: 'var(--bini-link)',
    maxWidth: '860px',
    fontSans: "'Inter Variable', 'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontMono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  };

  const ICON_THUMB_UP = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;
  const ICON_THUMB_DOWN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>`;
  const ICON_EXTERNAL = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;
  const ICON_UPDOWN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>`;

  return {
    name: 'bini-overlay:error',
    apply: 'serve',

    transformIndexHtml: {
      order: 'pre',
      async handler(html: string, ctx: IndexHtmlTransformContext): Promise<HtmlTagDescriptor[] | string> {
        if (!isDev(ctx)) return html;

        const overlayHtml = `
<style>
  #__bini_root, #__bini_root * { box-sizing: border-box; }

  #__bini_root {
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--bini-backdrop);
    scrollbar-width: thin;
    scrollbar-color: var(--bini-root-scroll-thumb) var(--bini-root-scroll-track);
  }
  #__bini_root::-webkit-scrollbar { width: 10px; height: 10px; }
  #__bini_root::-webkit-scrollbar-track { background: var(--bini-root-scroll-track); }
  #__bini_root::-webkit-scrollbar-thumb {
    background: var(--bini-root-scroll-thumb);
    border-radius: 5px;
    border: 2px solid var(--bini-root-scroll-track);
  }
  #__bini_root::-webkit-scrollbar-thumb:hover { background: var(--bini-root-scroll-thumb-hover); }

  #__bini_root {
    --bini-panel: #0a0a0a;
    --bini-code-bg: #000000;
    --bini-code-sep: #b8772a;
    --bini-border: rgba(255,255,255,0.1);
    --bini-border-strong: rgba(255,255,255,0.16);
    --bini-text: #e4e4e7;
    --bini-text-muted: #a1a1aa;
    --bini-text-dim: #71717a;
    --bini-error: #ff7b7b;
    --bini-link: #5b9dff;
    --bini-strong: #ffffff;
    --bini-badge-text: #d4d4d8;
    --bini-hover: rgba(255,255,255,0.08);
    --bini-hover-soft: rgba(255,255,255,0.06);
    --bini-count-bg: #262626;
    --bini-chip-err-bg: rgba(248,113,113,0.14);
    --bini-err-mark: #f87171;
    --bini-err-line: rgba(239,68,68,0.2);
    --bini-backdrop: rgb(26, 26, 26);
    --bini-scroll-track: #050505;
    --bini-scroll-thumb: #3f3f46;
    --bini-scroll-thumb-hover: #52525b;
    --bini-root-scroll-track: rgb(26, 26, 26);
    --bini-root-scroll-thumb: #52525b;
    --bini-root-scroll-thumb-hover: #71717a;
  }
  #__bini_root[data-theme='light'] {
    --bini-panel: #ffffff;
    --bini-code-bg: #fafafa;
    --bini-code-sep: #b45309;
    --bini-border: rgba(0,0,0,0.1);
    --bini-border-strong: rgba(0,0,0,0.16);
    --bini-text: #18181b;
    --bini-text-muted: #52525b;
    --bini-text-dim: #71717a;
    --bini-error: #dc2626;
    --bini-link: #2563eb;
    --bini-strong: #09090b;
    --bini-badge-text: #3f3f46;
    --bini-hover: rgba(0,0,0,0.06);
    --bini-hover-soft: rgba(0,0,0,0.04);
    --bini-count-bg: #f4f4f5;
    --bini-chip-err-bg: rgba(220,38,38,0.1);
    --bini-err-mark: #dc2626;
    --bini-err-line: rgba(220,38,38,0.1);
    --bini-backdrop: rgb(202, 202, 202);
    --bini-scroll-track: #f4f4f5;
    --bini-scroll-thumb: #d4d4d8;
    --bini-scroll-thumb-hover: #a1a1aa;
    --bini-root-scroll-track: rgb(202, 202, 202);
    --bini-root-scroll-thumb: #8f8f95;
    --bini-root-scroll-thumb-hover: #6b6b72;
  }

  /* The error content scrolls inside the fixed-height card. */
  #__bini_error_content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--bini-scroll-thumb) var(--bini-panel);
  }
  #__bini_error_content::-webkit-scrollbar { width: 10px; height: 10px; }
  #__bini_error_content::-webkit-scrollbar-track { background: var(--bini-panel); }
  #__bini_error_content::-webkit-scrollbar-thumb {
    background: var(--bini-scroll-thumb);
    border-radius: 5px;
    border: 2px solid var(--bini-panel);
  }
  #__bini_error_content::-webkit-scrollbar-thumb:hover { background: var(--bini-scroll-thumb-hover); }

  .bini-wrap {
    position: relative;
    z-index: 2;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: ${theme.maxWidth};
    margin: 0 auto 8vh auto;
    /* Total overlay height is capped at 815px (or the viewport, if smaller). */
    max-height: min(815px, calc(100vh - 16vh));
  }
  .bini-topbar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    position: relative;
    z-index: 3;
    flex-shrink: 0;
  }
  .bini-tab {
    position: relative;
    isolation: isolate;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 50px;
    padding: 0 1px 0 16px;
    margin-bottom: -1px;
    background: ${theme.panel};
    border-top: 1px solid ${theme.border};
    border-left: 1px solid ${theme.border};
    border-radius: 14px 0 0 0;
  }
  .bini-wing {
    position: absolute;
    top: -1px;
    left: calc(100% - 1px);
    pointer-events: none;
    overflow: visible;
  }
  .bini-wing-fill { fill: var(--bini-panel); }
  .bini-wing-line { fill: none; stroke: var(--bini-border); stroke-width: 1; }
  .bini-tab-r .bini-wing {
    left: auto;
    right: calc(100% - 1px);
    transform: scaleX(-1);
  }

  .bini-pager { display: flex; align-items: center; gap: 4px; }
  .bini-nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: none;
    border: none;
    border-radius: 50%;
    color: ${theme.textMuted};
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .bini-nav-btn:hover { background: var(--bini-hover); color: var(--bini-strong); }
  .bini-count {
    min-width: 34px;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    color: ${theme.text};
    font-family: ${theme.fontSans};
  }
  .bini-count .bini-sep { margin: 0 2px; color: inherit; }

  .bini-tab-r {
    position: relative;
    isolation: isolate;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50px;
    padding: 0 16px 0 1px;
    margin-bottom: -1px;
    background: ${theme.panel};
    border-top: 1px solid ${theme.border};
    border-right: 1px solid ${theme.border};
    border-radius: 0 14px 0 0;
  }
  .bini-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 13px;
    background: ${theme.panel};
    border: 1px solid ${theme.borderStrong};
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    color: var(--bini-badge-text);
    font-family: ${theme.fontSans};
    white-space: nowrap;
  }
  .bini-badge-dot {
    width: 9px; height: 9px; border-radius: 50%;
    background: #4ade80;
  }
  .bini-badge-grad {
    background: linear-gradient(90deg, #00cfff, #0077ff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }

  .bini-panel {
    position: relative;
    z-index: 2;
    background: ${theme.panel};
    color: ${theme.text};
    border: 1px solid ${theme.border};
    border-radius: 0 0 14px 14px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }
  .bini-head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 24px 0 24px;
  }
  .bini-chip-err {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    background: var(--bini-chip-err-bg);
    color: ${theme.error};
    border-radius: 6px;
    font-family: ${theme.fontMono};
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .bini-actions { display: flex; align-items: center; gap: 8px; }
  .bini-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid ${theme.borderStrong};
    border-radius: 50%;
    color: ${theme.text};
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .bini-icon-btn:hover { background: var(--bini-hover); color: var(--bini-strong); }
  #__bini_close.bini-hidden { display: none !important; }

  .bini-body { padding: 18px 24px 8px 24px; font-family: ${theme.fontSans}; }

  .bini-headline {
    margin: 0 0 14px 0;
    font-size: 16px;
    line-height: 1.45;
    font-weight: 500;
    color: ${theme.error};
    word-break: break-word;
  }
  .bini-details {
    font-size: 13px;
    line-height: 1.65;
    color: ${theme.textMuted};
    word-break: break-word;
  }
  .bini-details div { padding: 2px 0; }

  .bini-code {
    margin: 22px 0 0 0;
    background: ${theme.codeBg};
    border: 1px solid ${theme.borderStrong};
    border-radius: 8px;
    overflow: hidden;
  }
  .bini-code-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid ${theme.border};
    font-family: ${theme.fontSans};
    font-size: 12px;
    color: var(--bini-strong);
  }
  .bini-code-head .bini-code-file { font-weight: 500; }
  .bini-code-open {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 6px;
    color: ${theme.textMuted};
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .bini-code-open:hover { background: var(--bini-hover); color: var(--bini-strong); }
  .bini-code-scroll {
    overflow: auto !important;
    max-height: 400px;
    display: block;
    position: relative;
    padding: 12px 0 14px 0;
  }
  .bini-code-scroll pre {
    background: transparent !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .bini-code-inner { display: inline-block; min-width: 100%; }
  .bini-code-line { display: flex; padding: 1px 0; }
  .bini-code-mark {
    min-width: 30px;
    padding: 0 6px 0 14px;
    text-align: right;
    font-family: ${theme.fontMono};
    font-size: 12px;
    line-height: 1.55;
    font-weight: 700;
    color: transparent;
    user-select: none;
    flex-shrink: 0;
  }
  .bini-code-line.is-err, .bini-code-line.is-err-caret { background: var(--bini-err-line); }
  .bini-code-line.is-err .bini-code-mark { color: var(--bini-err-mark); }
  .bini-code-num {
    min-width: 22px;
    padding: 0 10px 0 0;
    text-align: right;
    font-family: ${theme.fontMono};
    font-size: 12px;
    line-height: 1.55;
    color: ${theme.textDim};
    user-select: none;
    flex-shrink: 0;
  }
  .bini-code-line.is-err .bini-code-num { color: var(--bini-strong); font-weight: 600; }
  .bini-code-sep {
    padding: 0 16px 0 0;
    font-family: ${theme.fontMono};
    font-size: 12px;
    line-height: 1.55;
    color: var(--bini-code-sep);
    user-select: none;
    flex-shrink: 0;
  }
  .bini-code-text {
    flex: 1;
    padding: 0 16px 0 0;
    white-space: pre;
    font-family: ${theme.fontMono};
    font-size: 12px;
    line-height: 1.55;
  }
  .bini-code-caret { color: var(--bini-err-mark); }

  .bini-stack { margin-top: 28px; }
  .bini-stack-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .bini-stack-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 500;
    color: var(--bini-strong);
  }
  .bini-stack-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 7px;
    background: var(--bini-count-bg);
    color: ${theme.text};
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
  }
  .bini-fw-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    padding: 4px 0;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    color: ${theme.textMuted};
    transition: color 0.15s;
  }
  .bini-fw-toggle:hover { color: var(--bini-strong); }

  .bini-frames { margin-top: 14px; }
  .bini-frame {
    display: block;
    width: 100%;
    padding: 9px 0;
    background: none;
    border: none;
    text-align: left;
    font-family: inherit;
    color: inherit;
    cursor: pointer;
  }
  button.bini-frame:hover .bini-frame-fn { text-decoration: underline; text-underline-offset: 3px; }
  .bini-frame-fn {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--bini-strong);
  }
  .bini-frame-loc {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: ${theme.textDim};
    word-break: break-all;
  }
  .bini-frame-fw { cursor: default; }
  .bini-frame-fw .bini-frame-fn { color: ${theme.textMuted}; font-weight: 500; }

  /* Expanded framework frames just grow the panel. No inner scrollbar:
     the overlay's own scrollbar handles the extra height. */
  .bini-fw-frames {
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    transition: max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s;
  }
  .bini-fw-frames.open { max-height: 6000px; opacity: 1; overflow: hidden; }
  .bini-empty { padding: 8px 0; color: ${theme.textDim}; font-size: 13px; }

  .bini-component-scroll {
    max-height: 200px;
    overflow: auto !important;
    margin-top: 12px;
    background: ${theme.codeBg};
    border: 1px solid ${theme.borderStrong};
    border-radius: 8px;
    padding: 12px 14px;
  }

  .bini-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 14px;
    flex-shrink: 0;
    margin-top: 0;
    padding: 14px 24px;
    border-top: 1px solid ${theme.border};
    font-family: ${theme.fontSans};
  }
  .bini-footer-text { font-size: 13px; font-weight: 500; color: ${theme.link}; }
  .bini-thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: ${theme.textMuted};
    cursor: pointer;
    transition: color 0.2s ease, background-color 0.2s ease, transform 0.12s ease;
  }
  .bini-thumb svg { fill: transparent; transition: fill 0.22s ease; }
  .bini-thumb:hover { background: var(--bini-hover-soft); color: var(--bini-strong); }
  .bini-thumb:active { transform: scale(0.94); }
  .bini-thumb.is-up, .bini-thumb.is-up:hover { color: #3b82f6; }
  .bini-thumb.is-up svg { fill: #3b82f6; }
  .bini-thumb.is-down, .bini-thumb.is-down:hover { color: #ef4444; }
  .bini-thumb.is-down svg { fill: #ef4444; }
  @media (prefers-reduced-motion: reduce) {
    .bini-thumb, .bini-thumb svg { transition: none; }
  }

  .bini-code-scroll::-webkit-scrollbar,
  .bini-component-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
  .bini-code-scroll::-webkit-scrollbar-track,
  .bini-component-scroll::-webkit-scrollbar-track { background: var(--bini-scroll-track); }
  .bini-code-scroll::-webkit-scrollbar-thumb,
  .bini-component-scroll::-webkit-scrollbar-thumb { background: var(--bini-scroll-thumb); border-radius: 5px; }
  .bini-code-scroll::-webkit-scrollbar-thumb:hover { background: var(--bini-scroll-thumb-hover); }
  .bini-code-scroll, .bini-component-scroll {
    scrollbar-width: thin;
    scrollbar-color: var(--bini-scroll-thumb) var(--bini-scroll-track);
  }
</style>
<div id="__bini_root" style="position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;padding:8vh 16px 0 16px;font-family:${theme.fontSans};display:none;">
  <div id="__bini_backdrop" style="position:fixed;inset:0;z-index:-1;background:var(--bini-backdrop);"></div>

  <div class="bini-wrap">
    <div class="bini-topbar">
      <div class="bini-tab">
        <div class="bini-pager">
          <button id="__bini_prev" class="bini-nav-btn" title="Previous">${PREV_ICON}</button>
          <span class="bini-count"><span id="__bini_current">1</span><span class="bini-sep">/</span><span id="__bini_total">1</span></span>
          <button id="__bini_next" class="bini-nav-btn" title="Next">${NEXT_ICON}</button>
        </div>
        <svg class="bini-wing" viewBox="0 0 39 50" width="39" height="50" aria-hidden="true"><path class="bini-wing-fill" d="M0 0H4.2C9.1 0 11.9 2.2 13.7 7.5C16.5 16 19.6 33 22.4 42C24.5 48 28.7 50 39 50H0Z"/><path class="bini-wing-line" d="M0 .5H4.2C9.1 .5 12 2.7 13.7 8C16.5 16.4 19.6 33.4 22.4 42.2C24.5 48.2 28.7 49.5 39 49.5"/></svg>
      </div>
      <div class="bini-tab-r">
        <svg class="bini-wing" viewBox="0 0 39 50" width="39" height="50" aria-hidden="true"><path class="bini-wing-fill" d="M0 0H4.2C9.1 0 11.9 2.2 13.7 7.5C16.5 16 19.6 33 22.4 42C24.5 48 28.7 50 39 50H0Z"/><path class="bini-wing-line" d="M0 .5H4.2C9.1 .5 12 2.7 13.7 8C16.5 16.4 19.6 33.4 22.4 42.2C24.5 48.2 28.7 49.5 39 49.5"/></svg>
        <div class="bini-badge">
          <span class="bini-badge-dot"></span>
          <span>Bini.js</span>
          <span class="bini-badge-grad">Rolldown</span>
        </div>
      </div>
    </div>

    <div class="bini-panel">
      <div class="bini-head">
        <span id="__bini_heading" class="bini-chip-err"></span>
        <div class="bini-actions">
          <button id="__bini_copy" class="bini-icon-btn" title="Copy error">${COPY_ICON}</button>
          <button id="__bini_close" class="bini-icon-btn" title="Close overlay">${CLOSE_ICON}</button>
        </div>
      </div>

      <div id="__bini_error_content" class="bini-body"></div>

      <div class="bini-footer">
        <span class="bini-footer-text">Was this helpful?</span>
        <button id="__bini_thumb_up" class="bini-thumb" title="Helpful" aria-label="Helpful" aria-pressed="false">${ICON_THUMB_UP}</button>
        <button id="__bini_thumb_down" class="bini-thumb" title="Not helpful" aria-label="Not helpful" aria-pressed="false">${ICON_THUMB_DOWN}</button>
      </div>
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
  var frameworkFramesOpenState = {};
  var feedbackState = {};

  var PREFS_KEY = 'bini-overlay:prefs';
  function getThemePref() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.theme) return p.theme;
      }
    } catch (_e) {}
    return 'system';
  }
  function resolveOverlayTheme() {
    var t = getThemePref();
    if (t === 'light' || t === 'dark') return t;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  function shikiThemeName() {
    return resolveOverlayTheme() === 'light' ? 'light-plus' : 'dark-plus';
  }
  function applyOverlayTheme() {
    if (overlayRoot) overlayRoot.setAttribute('data-theme', resolveOverlayTheme());
  }
  function onThemeChange() {
    applyOverlayTheme();
    var err = errors[currentIndex];
    if (!err || !overlayRoot) return;
    errors.forEach(function (e) { e.highlightedLines = null; });
    prepareHighlights(err).then(function () {
      if (overlayRoot && overlayRoot.style.display !== 'none') render();
    });
  }
  window.addEventListener('__bini_theme__', onThemeChange);
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', onThemeChange);
    } catch (_e) {}
  }

  var _errorHandler = null;
  var _rejectionHandler = null;
  var _biniErrorHandler = null;

  var UPDOWN_SVG = '${ICON_UPDOWN}';
  var EXTERNAL_SVG = '${ICON_EXTERNAL}';

  var ICON_REACT = ${JSON.stringify(ICON_REACT)};
  var ICON_TYPESCRIPT = ${JSON.stringify(ICON_TYPESCRIPT)};
  var ICON_JAVASCRIPT = ${JSON.stringify(ICON_JAVASCRIPT)};

  function fileIconPathFor(filename) {
    if (!filename) return null;
    var f = String(filename).toLowerCase();
    if (/\\.(tsx|jsx)$/.test(f)) return ICON_REACT;
    if (/\\.ts$/.test(f)) return ICON_TYPESCRIPT;
    if (/\\.js$/.test(f)) return ICON_JAVASCRIPT;
    return null;
  }

  function fileIconSvg(filename, size) {
    var d = fileIconPathFor(filename);
    if (!d) return '';
    return '<svg role="img" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="currentColor" style="flex-shrink:0;color:var(--bini-strong);"><path d="' + d + '"/></svg>';
  }

  function parseCodeLine(cl) {
    var m = /^\\s*(>>>)?\\s*(\\d+): ?([\\s\\S]*)$/.exec(cl || '');
    if (!m) return { isErr: false, num: '', code: String(cl || '') };
    return { isErr: !!m[1], num: m[2], code: m[3].replace(/\\r$/, '') };
  }

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
    return "<pre style='margin:0;font-family:${theme.fontMono};'><code>" + escapeHtml(code) + "</code></pre>";
  }

  function highlightCode(code, lang) {
    if (shikiHighlighter && shikiHighlighter.codeToHtml) {
      return shikiHighlighter.codeToHtml(code, { lang: lang || "javascript", theme: shikiThemeName() }).catch(function () {
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
        return parseCodeLine(cl).code;
      });
      return Promise.all(codes.map(function (code) { return highlightCode(code, lang); })).then(function (results) {
        err.highlightedLines = results;
      });
    }).catch(function () {});
  }

  function renderFrame(f, isFramework) {
    var fn = escapeHtml(f.fn || '<anonymous>');
    var loc = escapeHtml(f.file || 'unknown') + " (" + escapeHtml(f.line || '0') + ":" + escapeHtml(f.originalColumn || f.column || '0') + ")";
    if (isFramework) {
      return "<div class='bini-frame bini-frame-fw'>" +
        "<span class='bini-frame-fn'>" + fn + "</span>" +
        "<span class='bini-frame-loc'>" + loc + "</span>" +
        "</div>";
    }
    return "<button class='bini-frame' " +
           "data-file='" + escapeHtml(f.file) + "' " +
           "data-line='" + escapeHtml(f.line) + "' " +
           "data-column='" + escapeHtml(f.originalColumn || f.column || '1') + "' " +
           "onclick='window.__bini_open_editor(this.getAttribute(\\"data-file\\"), this.getAttribute(\\"data-line\\"), this.getAttribute(\\"data-column\\"))'>" +
           "<span class='bini-frame-fn'>" + fn + "</span>" +
           "<span class='bini-frame-loc'>" + loc + "</span>" +
           "</button>";
  }

  function splitMessage(message) {
    var cleanMsg = cleanErrorMessage(message);
    var rawLines = cleanMsg.split("\\n");
    var headline = '';
    var details = [];

    for (var i = 0; i < rawLines.length; i++) {
      var line = rawLines[i];
      if (!line || !line.trim()) continue;
      if (line.includes('vite:oxc')) continue;
      if (line.includes('NextJs') || line.includes('Turbopack')) continue;
      if (line.includes('╭─[') || line.includes('────╯')) continue;
      if (line.match(/^\\s*[│|]/) || line.match(/^\\s*\\d+\\s*[│|]/)) continue;

      var errorMatch = line.match(/^\\[([^\\]]+)\\]\\s*(.+)$/);
      var text = errorMatch
        ? stripNonAscii(errorMatch[2])
        : stripNonAscii(line);
      if (!text) continue;

      if (!headline) headline = text;
      else details.push(text);
    }
    return { headline: headline, details: details };
  }

  function formatErrorMessage(message, codeLines, fileLang, stack, err, errIndex) {
    var parts = splitMessage(message);
    var headline = parts.headline;
    var details = parts.details;

    var html = "<div>";

    if (headline) {
      html += "<div class='bini-headline'>" + escapeHtml(headline) + "</div>";
    }
    if (details.length) {
      html += "<div class='bini-details'>";
      for (var d = 0; d < details.length; d++) {
        html += "<div>" + escapeHtml(details[d]) + "</div>";
      }
      html += "</div>";
    }

    if (codeLines && codeLines.length > 0) {
      var rawFile = (err && err.file) ? shortenPath(err.file) : '';
      var codeFilename = rawFile || 'source';
      var posText = '';
      if (err && err.line) posText = ' (' + err.line + ':' + (err.column || 0) + ')';

      html += "<div class='bini-code'>";
      html += "<div class='bini-code-head'>";
      html += fileIconSvg(codeFilename, 16);
      html += "<span class='bini-code-file'>" + escapeHtml(codeFilename + posText) + "</span>";
      if (err && err.file) {
        html += "<button class='bini-code-open' title='Open in editor' aria-label='Open in editor' " +
          "data-file='" + escapeHtml(rawFile) + "' " +
          "data-line='" + escapeHtml(err.line || '1') + "' " +
          "data-column='" + escapeHtml(err.column || '1') + "' " +
          "onclick='window.__bini_open_editor(this.getAttribute(\\"data-file\\"), this.getAttribute(\\"data-line\\"), this.getAttribute(\\"data-column\\"))'>" +
          EXTERNAL_SVG + "</button>";
      }
      html += "</div>";

      html += "<div class='bini-code-scroll'>";
      html += "<div class='bini-code-inner'>";
      var numDigits = 1;
      for (var q = 0; q < codeLines.length; q++) {
        var qn = parseCodeLine(codeLines[q]).num;
        if (qn.length > numDigits) numDigits = qn.length;
      }
      var numStyle = " style='min-width:calc(" + numDigits + "ch + 10px);'";
      for (var k = 0; k < codeLines.length; k++) {
        var pl = parseCodeLine(codeLines[k]);
        var clHtml = (err && err.highlightedLines && err.highlightedLines[k]) ? err.highlightedLines[k] : fallbackCodeHtml(pl.code);

        html += "<div class='bini-code-line" + (pl.isErr ? " is-err" : "") + "'>";
        html += "<span class='bini-code-mark'>" + (pl.isErr ? "&gt;" : "") + "</span>";
        html += "<span class='bini-code-num'" + numStyle + ">" + pl.num + "</span>";
        html += "<span class='bini-code-sep'>|</span>";
        html += "<div class='bini-code-text'>" + clHtml + "</div>";
        html += "</div>";

        if (pl.isErr && err && err.column && err.column > 0) {
          html += "<div class='bini-code-line is-err-caret'>" +
            "<span class='bini-code-mark'></span>" +
            "<span class='bini-code-num'" + numStyle + "></span>" +
            "<span class='bini-code-sep'>|</span>" +
            "<div class='bini-code-text bini-code-caret'>" + escapeHtml(new Array(err.column).join(' ') + '^') + "</div>" +
            "</div>";
        }
      }
      html += "</div></div>";
      html += "</div>";
    }

    var parsed = parseStack(stack);
    var userFrames = parsed.user;
    if (!userFrames.length && err && err.file && err.line) {
      userFrames = [{
        fn: errorTypeOf(err),
        file: shortenPath(err.file),
        line: String(err.line),
        column: err.column || 0,
        originalColumn: err.column || 0,
      }];
    }
    var frameworkFrames = parsed.framework;
    var totalFrames = userFrames.length + frameworkFrames.length;

    if (totalFrames > 0) {
      var fwOpen = frameworkFramesOpenState[errIndex] === true;

      html += "<div class='bini-stack'>";
      html += "<div class='bini-stack-head'>";
      html += "<div class='bini-stack-title'><span>Call Stack</span><span class='bini-stack-count'>" + totalFrames + "</span></div>";
      if (frameworkFrames.length > 0) {
        html += "<button class='bini-fw-toggle' onclick='window.__bini_toggle_framework_frames(" + errIndex + ")'>" +
          "<span id='bini-fw-label-" + errIndex + "'>" + (fwOpen ? "Hide " : "Show ") + frameworkFrames.length + " ignore-listed frame(s)</span>" +
          UPDOWN_SVG +
          "</button>";
      }
      html += "</div>";

      html += "<div class='bini-frames'>";
      if (userFrames.length > 0) {
        for (var j = 0; j < userFrames.length; j++) {
          html += renderFrame(userFrames[j], false);
        }
      } else {
        html += "<div class='bini-empty'>No application frames in this stack.</div>";
      }

      if (frameworkFrames.length > 0) {
        html += "<div class='bini-fw-frames" + (fwOpen ? " open" : "") + "' id='bini-fw-frames-" + errIndex + "'>";
        for (var m = 0; m < frameworkFrames.length; m++) {
          html += renderFrame(frameworkFrames[m], true);
        }
        html += "</div>";
      }
      html += "</div>";
      html += "</div>";
    }

    if (err && err.componentStack) {
      html += "<div class='bini-stack'>";
      html += "<div class='bini-stack-head'><div class='bini-stack-title'><span>Component Stack</span></div></div>";
      html += "<div class='bini-component-scroll'>";
      html += "<pre style='margin:0;color:var(--bini-text-muted);font-family:${theme.fontMono};font-size:11px;white-space:pre-wrap;word-break:break-all;'>" + escapeHtml(err.componentStack) + "</pre>";
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

  window.__bini_toggle_framework_frames = function(errIndex) {
    frameworkFramesOpenState[errIndex] = !frameworkFramesOpenState[errIndex];
    var open = frameworkFramesOpenState[errIndex];
    var framesEl = document.getElementById("bini-fw-frames-" + errIndex);
    var labelEl = document.getElementById("bini-fw-label-" + errIndex);
    if (framesEl) {
      if (open) framesEl.classList.add("open");
      else framesEl.classList.remove("open");
    }
    if (labelEl) {
      labelEl.textContent = open
        ? labelEl.textContent.replace("Show", "Hide")
        : labelEl.textContent.replace("Hide", "Show");
    }
  };

  window.__bini_open_editor = function(file, line, column) {
    if (!file) return;
    fetch('/__bini_open_editor?file=' + encodeURIComponent(file) + '&line=' + encodeURIComponent(line || '1') + '&column=' + encodeURIComponent(column || '1'))
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
    applyOverlayTheme();

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

    var thumbUp = document.getElementById("__bini_thumb_up");
    var thumbDown = document.getElementById("__bini_thumb_down");
    if (thumbUp) thumbUp.addEventListener("click", function() { setFeedback("up"); });
    if (thumbDown) thumbDown.addEventListener("click", function() { setFeedback("down"); });

    document.getElementById("__bini_prev").addEventListener("click", function() {
      currentIndex = Math.max(0, currentIndex - 1);
      render();
    });
    document.getElementById("__bini_next").addEventListener("click", function() {
      currentIndex = Math.min(errors.length - 1, currentIndex + 1);
      render();
    });
  }

  function applyFeedback() {
    var err = errors[currentIndex];
    var v = err ? feedbackState[getErrorKey(err)] : null;
    var up = document.getElementById("__bini_thumb_up");
    var down = document.getElementById("__bini_thumb_down");
    if (up) {
      up.classList.toggle("is-up", v === "up");
      up.setAttribute("aria-pressed", v === "up" ? "true" : "false");
    }
    if (down) {
      down.classList.toggle("is-down", v === "down");
      down.setAttribute("aria-pressed", v === "down" ? "true" : "false");
    }
  }

  function setFeedback(val) {
    var err = errors[currentIndex];
    if (!err) return;
    var key = getErrorKey(err);
    feedbackState[key] = feedbackState[key] === val ? null : val;
    applyFeedback();
  }

  function show() {
    if (overlayRoot) overlayRoot.style.display = "flex";
    updateCloseButton();
  }

  function hide() {
    if (overlayRoot) overlayRoot.style.display = "none";
  }

  function errorTypeOf(err) {
    var msg = err.originalMessage || err.message || "";
    if (err._type === 'runtime') return "Runtime Error";
    if (err.name === "Unhandled Rejection") return "Unhandled Rejection";
    if (msg.match(/SyntaxError|PARSE_ERROR|Unexpected token|Expected/i)) return "Parse Error";
    if (msg.match(/Transform failed|Build failed/i)) return "Build Error";
    if (msg.match(/TypeError/i) || err.name === "TypeError") return "Type Error";
    if (msg.match(/Element type is invalid|Cannot read|is not a function|is not defined/i)) return "Runtime Error";
    if (err.name && err.name !== "Plugin Error" && err.name !== "Vite Error") return err.name;
    return "Build Error";
  }

  function render() {
    var err = errors[currentIndex];
    if (!err || !overlayRoot) return;

    var cleanMessage = err.originalMessage || err.message;

    var headingEl = document.getElementById("__bini_heading");
    if (headingEl) {
      headingEl.textContent = errorTypeOf(err);
    }

    var contentEl = document.getElementById("__bini_error_content");
    if (contentEl) {
      contentEl.innerHTML = formatErrorMessage(cleanMessage, err.codeLines || [], err.fileLang || "javascript", err.stack || "", err, currentIndex);
    }

    document.getElementById("__bini_current").textContent = currentIndex + 1;
    document.getElementById("__bini_total").textContent = errors.length;

    applyFeedback();
    show();
  }

  function buildCodeFrame(err) {
    var lines = err.codeLines || [];
    if (!lines.length) return '';
    var parsed = lines.map(parseCodeLine);
    var width = 1;
    parsed.forEach(function (p) { if (p.num.length > width) width = p.num.length; });
    var out = [];
    parsed.forEach(function (p) {
      var num = new Array(width - p.num.length + 1).join(' ') + p.num;
      out.push((p.isErr ? '> ' : '  ') + num + ' | ' + p.code);
      if (p.isErr && err.column > 0) {
        out.push('  ' + new Array(width + 1).join(' ') + ' | ' + new Array(err.column).join(' ') + '^');
      }
    });
    return out.join('\\n');
  }

  function formatLocation(err) {
    if (!err || !err.file) return '';
    var shortFile = shortenPath(err.file);
    var loc = 'at (' + shortFile;
    if (err.line) loc += ':' + err.line + ':' + (err.column || 0);
    loc += ')';
    return loc;
  }

  function copyError() {
    var err = errors[currentIndex];
    if (!err) return;
    var parts = splitMessage(err.originalMessage || err.message);
    var messageLines = [parts.headline].concat(parts.details).filter(Boolean);

    var location = formatLocation(err);
    if (location) {
      if (messageLines.length === 0) {
        messageLines.push(location);
      } else {
        var lastIdx = messageLines.length - 1;
        if (messageLines[lastIdx].trim() === '') {
          messageLines[lastIdx] = location;
        } else {
          messageLines.push('');
          messageLines.push(location);
        }
      }
    }

    var message = messageLines.join('\\n');
    var text = '## Error Type\\n' + errorTypeOf(err) + '\\n\\n## Error Message\\n' + message;

    var frames = parseStack(err.stack || '').user;
    if (frames.length) {
      text += '\\n\\n\\n' + frames.map(function (f) {
        var loc = f.file + ':' + f.line;
        return '    at ' + (f.fn ? f.fn + ' (' + loc + ')' : loc);
      }).join('\\n');
    }
    var frame = buildCodeFrame(err);
    if (frame) text += '\\n\\n## Code Frame\\n' + frame;
    text += '\\n\\nBini.js (Rolldown)\\n';
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

function biniSourcemapPlugin(): BiniPlugin {
  let traceMod: any = null;
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

          const graph: any =
            (server as any).environments?.client?.moduleGraph ?? (server as any).moduleGraph;
          if (!graph || typeof graph.getModuleByUrl !== 'function') {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'module graph unavailable' }));
            return;
          }

          let mod: any = null;
          for (const cand of candidates) {
            mod = await graph.getModuleByUrl(cand);
            if (mod) break;
          }

          if (!mod || !mod.transformResult || !mod.transformResult.map) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'no sourcemap' }));
            return;
          }

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
          if (!trace || typeof trace.originalPositionFor !== 'function' || typeof trace.TraceMap !== 'function') {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'trace-mapping unavailable' }));
            return;
          }

          let pos: { source?: string; line?: number; column?: number } | null = null;
          try {
            const traceMap = new trace.TraceMap(mapRaw);
            pos = trace.originalPositionFor(traceMap, { line, column: Math.max(0, column - 1) });
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
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            file: src,
            line: pos.line || line,
            column: (pos.column ?? column - 1) + 1,
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

function biniOpenEditorPlugin(): BiniPlugin {
  // Editor detection is fully delegated to `launch-editor`.
  type LaunchFn = (
    file: string,
    onError?: (fileName: string, message: string | null) => void,
  ) => void;

  let launchPromise: Promise<LaunchFn> | null = null;
  function loadLauncher(): Promise<LaunchFn> {
    if (!launchPromise) {
      launchPromise = import('launch-editor').then((m: any) => (m.default ?? m) as LaunchFn);
    }
    return launchPromise;
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
          const column = url.searchParams.get('column') || '1';

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

          const lineNum = Math.max(1, parseInt(line, 10) || 1);
          const colNum = Math.max(1, parseInt(column, 10) || 1);

          let launch: LaunchFn;
          try {
            launch = await loadLauncher();
          } catch {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: 'launch-editor is not installed',
              hint: 'Run: npm i launch-editor',
            }));
            return;
          }

          launch(`${resolved}:${lineNum}:${colNum}`, (_fileName, message) => {
            console.warn('[bini-overlay] Could not open your editor' + (message ? ': ' + message : '') + '.');
          });

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

function biniRoutesPlugin(): BiniPlugin {
  const appDir = path.join(process.cwd(), 'src/app');

  return {
    name: 'bini-overlay:routes',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      const base = server.config.base || '/';
      const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base;

      let routerPromise: Promise<any> | null = null;
      function loadRouter(): Promise<any> {
        if (!routerPromise) {
          routerPromise = import('bini-router');
        }
        return routerPromise;
      }

      void loadRouter();

      let manifestCache: any = null;
      let manifestTime = 0;
      const MANIFEST_TTL_MS = 200;

      async function getManifest(mod: any): Promise<any> {
        const now = Date.now();
        if (manifestCache && now - manifestTime < MANIFEST_TTL_MS) {
          return manifestCache;
        }
        manifestCache = mod.generateRouteManifest(appDir);
        manifestTime = now;
        return manifestCache;
      }

      function normalizePath(input: string): string {
        let p = input || '/';
        if (baseNoSlash) {
          if (p === baseNoSlash) p = '/';
          else if (p.startsWith(baseNoSlash + '/')) p = p.slice(baseNoSlash.length) || '/';
        }
        if (p.length > 1) p = p.replace(/\/+$/, '');
        return p || '/';
      }

      server.middlewares.use('/__bini_route_match', async (req: IncomingMessage, res: ServerResponse) => {
        if (!isSameOriginRequest(req)) {
          rejectCrossOrigin(res);
          return;
        }

        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const pathToMatch = normalizePath(url.searchParams.get('path') || '/');

        const mod = await loadRouter();
        const manifest = await getManifest(mod);
        const result = mod.matchManifestRoute(manifest, pathToMatch);

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          type: result.type,
          path: pathToMatch,
          routePath: result.routePath,
        }));
      });

      server.middlewares.use('/__bini_route_info', async (req: IncomingMessage, res: ServerResponse) => {
        if (!isSameOriginRequest(req)) {
          rejectCrossOrigin(res);
          return;
        }

        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const pathToMatch = normalizePath(url.searchParams.get('path') || '/');

        const mod = await loadRouter();
        const manifest = await getManifest(mod);
        const result = mod.matchManifestRoute(manifest, pathToMatch);

        if (result.type === 'not_found') {
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
        const meta = manifest.metadata?.[matchedKey];

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
          layouts: meta?.layouts || [],
          pageFile: meta?.filePath || '',
        }));
      });
    },
  };
}

export function biniOverlay(options: BiniOverlayOptions = {}): PluginOption[] {
  return [
    biniFontPlugin(),
    biniCodeContextPlugin(),
    biniSourcemapPlugin(),
    biniOpenEditorPlugin(),
    biniRoutesPlugin(),
    biniViteErrorInterceptPlugin(),
    biniErrorOverlay(),
    biniLoadingPlugin(options),
  ];
}