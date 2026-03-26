import type {
  Plugin,
  PluginOption,
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
} from 'vite';
import { createHighlighter, type Highlighter } from 'shiki';
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface BiniOverlayOptions {
  typescript?: boolean;
  eslint?: boolean | { lintCommand: string };
  customStyles?: boolean;
  disableAnimation?: boolean;
  shikiTheme?: string; // 'dark-plus', 'github-dark', etc.
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

// Icons
const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`;
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CLOSE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
const PREV_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.24996 12.0608L8.71963 11.5304L5.89641 8.70722C5.50588 8.3167 5.50588 7.68353 5.89641 7.29301L8.71963 4.46978L9.24996 3.93945L10.3106 5.00011L9.78029 5.53044L7.31062 8.00011L9.78029 10.4698L10.3106 11.0001L9.24996 12.0608Z" fill="currentColor"/></svg>`;
const NEXT_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.75011 3.93945L7.28044 4.46978L10.1037 7.29301C10.4942 7.68353 10.4942 8.3167 10.1037 8.70722L7.28044 11.5304L6.75011 12.0608L5.68945 11.0001L6.21978 10.4698L8.68945 8.00011L6.21978 5.53044L5.68945 5.00011L6.75011 3.93945Z" fill="currentColor"/></svg>`;

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

// ─────────────────────────────────────────────────────────────
// PLUGIN 1 — HMR loading badge (idle, loading, error states)
// ─────────────────────────────────────────────────────────────
function biniLoadingPlugin(): Plugin {
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

        const js = [
          '(function () {',
          '  if (document.getElementById("bini-loading-root")) return;',
          '  var container = document.createElement("div");',
          '  container.id = "bini-loading-root";',
          '  document.body.appendChild(container);',
          '  var sr = container.attachShadow({ mode: "open" });',
          '  sr.id = "bini-loading-shadow";',
          '',
          '  var style = document.createElement("style");',
          '  style.textContent = [',
          '    ":host { all: initial; display: block; }",',
          // ── idle circle ──────────────────────────────────────
          '    "#w {",',
          '    "  position: fixed; bottom: 20px; left: 20px;",',
          '    "  width: 48px; height: 48px;",',
          '    "  display: flex; align-items: center; justify-content: center;",',
          '    "  z-index: 99999; border-radius: 50%;",',
          '    "  background: #0a0a0a;",',
          '    "  backdrop-filter: blur(10px);",',
          '    "  border: 1px solid rgba(255,255,255,0.1);",',
          '    "  box-shadow: 0 4px 20px rgba(0,0,0,0.5);",',
          '    "  pointer-events: none;",',
          '    "  transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);",',
          '    "  overflow: hidden;",',
          '    "}",',
          // ── error pill state (smaller version) ──
          '    "#w.has-errors {",',
          '    "  width: auto; border-radius: 999px;",',
          '    "  background: #dc2626;",',
          '    "  border: none;",',
          '    "  box-shadow: 0 4px 20px rgba(220,38,38,0.4), 0 2px 6px rgba(0,0,0,0.3);",',
          '    "  pointer-events: auto; cursor: pointer;",',
          '    "  padding: 0;",',
          '    "  gap: 0;",',
          '    "  height: 40px;",',
          '    "}",',
          // ── bini logos ───────────────────────────────────────
          '    ".bf, .bs { position: absolute; width: 20px; height: auto; transition: opacity .25s; }",',
          '    ".bf { opacity: 1; }",',
          '    ".bs { opacity: 0; }",',
          '    "#w.loading .bf { opacity: 0; }",',
          '    "#w.loading .bs { opacity: 1; }",',
          '    "#w.has-errors .bf { opacity: 0; }",',
          '    "#w.has-errors .bs { opacity: 0; }",',
          // ── error pill inner content (smaller) ──
          '    ".ep {",',
          '    "  display: none; align-items: center; gap: 0;",',
          '    "  opacity: 0; transition: opacity 0.2s;",',
          '    "  height: 40px;",',
          '    "}",',
          '    "#w.has-errors .ep { display: flex; opacity: 1; }",',
          '    ".ep-icon {",',
          '    "  width: 40px; height: 40px;",',
          '    "  background: rgba(0,0,0,0.4);",',
          '    "  border-radius: 50%;",',
          '    "  display: flex; align-items: center; justify-content: center;",',
          '    "  flex-shrink: 0;",',
          '    "  margin: 0;",',
          '    "}",',
          '    ".ep-content {",',
          '    "  display: flex; align-items: baseline; gap: 6px;",',
          '    "  padding: 0 14px 0 6px;",',
          '    "}",',
          '    ".ep-count {",',
          '    "  font-family: system-ui, -apple-system, sans-serif;",',
          '    "  font-size: 20px;",',
          '    "  font-weight: 700;",',
          '    "  color: #fff;",',
          '    "  line-height: 1;",',
          '    "}",',
          '    ".ep-label {",',
          '    "  font-family: system-ui, -apple-system, sans-serif;",',
          '    "  font-size: 17px;",',
          '    "  font-weight: 700;",',
          '    "  color: #fff;",',
          '    "  white-space: nowrap;",',
          '    "  letter-spacing: -0.01em;",',
          '    "  line-height: 1;",',
          '    "}",',
          // ── stroke animation ─────────────────────────────────
          '    ".bsp {",',
          '    "  fill: none; stroke: url(#sg); stroke-width: 1.4;",',
          '    "  stroke-linecap: round; stroke-linejoin: round;",',
          '    "  stroke-dasharray: 300; stroke-dashoffset: 300;",',
          '    "}",',
          '    "#w.loading .bsp { animation: draw 1.3s ease-out .1s forwards; }",',
          '    "@keyframes draw { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }"',
          '  ].join("\\n");',
          '',
          '  var biniPath = "' + BINI_PATH + '";',
          '  var w = document.createElement("div");',
          '  w.id = "w";',
          '  w.className = "loading";',
          '  w.innerHTML =',
          // idle filled logo
          '    "<svg class=\\"bf\\" width=\\"20\\" height=\\"28\\" viewBox=\\"0 0 22 31\\" fill=\\"none\\">"',
          '    + "<defs><linearGradient id=\\"fg\\" x1=\\"9.96\\" y1=\\"-12.92\\" x2=\\"9.96\\" y2=\\"40.08\\" gradientUnits=\\"userSpaceOnUse\\">"',
          '    + "<stop stop-color=\\"#00CFFF\\"/><stop offset=\\"1\\" stop-color=\\"#0077FF\\"/>"',
          '    + "</linearGradient></defs>"',
          '    + "<path fill=\\"url(#fg)\\" d=\\"" + biniPath + "\\"/></svg>"',
          // stroke animation logo
          '    + "<svg class=\\"bs\\" width=\\"20\\" height=\\"28\\" viewBox=\\"0 0 22 31\\" fill=\\"none\\">"',
          '    + "<defs><linearGradient id=\\"sg\\" x1=\\"9.96\\" y1=\\"-12.92\\" x2=\\"9.96\\" y2=\\"40.08\\" gradientUnits=\\"userSpaceOnUse\\">"',
          '    + "<stop stop-color=\\"#00CFFF\\"/><stop offset=\\"1\\" stop-color=\\"#0077FF\\"/>"',
          '    + "</linearGradient></defs>"',
          '    + "<path class=\\"bsp\\" d=\\"" + biniPath + "\\"/></svg>"',
          // error pill content with separate icon background
          '    + "<div class=\\"ep\\">"',
          '    + "<span class=\\"ep-icon\\">"',
          '    + "<svg width=\\"20\\" height=\\"28\\" viewBox=\\"0 0 22 31\\" fill=\\"none\\">"',
          '    + "<path fill=\\"#fff\\" d=\\"" + biniPath + "\\"/>"',
          '    + "</svg>"',
          '    + "</span>"',
          '    + "<div class=\\"ep-content\\">"',
          '    + "<span class=\\"ep-count\\" id=\\"bini-err-count\\">1</span>"',
          '    + "<span class=\\"ep-label\\" id=\\"bini-err-label\\">Issue</span>"',
          '    + "</div>"',
          '    + "</div>";',
          '',
          '  sr.appendChild(style);',
          '  sr.appendChild(w);',
          '',
          '  var el = sr.getElementById("w");',
          '  var sp = el.querySelector(".bsp");',
          '  var countEl = sr.getElementById("bini-err-count");',
          '  var labelEl = sr.getElementById("bini-err-label");',
          '  var animDone = false, ready = false, timer = null;',
          '',
          '  // ── expose error count API to error plugin ──',
          '  window.__bini_set_error_count = function(count) {',
          '    if (countEl) countEl.textContent = count;',
          '    if (labelEl) labelEl.textContent = count === 1 ? "Issue" : "Issues";',
          '    if (count > 0) {',
          '      el.classList.add("has-errors");',
          '      el.classList.remove("loading");',
          '    } else {',
          '      el.classList.remove("has-errors");',
          '    }',
          '  };',
          '',
          '  function idle() { clearTimeout(timer); timer = null; if (!el.classList.contains("has-errors")) el.classList.remove("loading"); }',
          '  function loop() {',
          '    if (ready) return;',
          '    animDone = false;',
          '    sp.style.animation = "none";',
          '    sp.offsetHeight;',
          '    sp.style.strokeDashoffset = "300";',
          '    requestAnimationFrame(function () {',
          '      requestAnimationFrame(function () {',
          '        sp.style.animation = "";',
          '        if (!el.classList.contains("has-errors")) el.classList.add("loading");',
          '      });',
          '    });',
          '    timer = setTimeout(function () { if (!ready) loop(); }, 2000);',
          '  }',
          '  function start() {',
          '    animDone = false; ready = false;',
          '    loop();',
          '    timer = setTimeout(function () { ready = true; if (animDone) idle(); }, 1800);',
          '  }',
          '  sp.addEventListener("animationend", function (e) {',
          '    if (e.animationName !== "draw") return;',
          '    animDone = true;',
          '    clearTimeout(timer); timer = null;',
          '    if (ready) idle(); else loop();',
          '  });',
          '  function onReady() { ready = true; clearTimeout(timer); timer = null; if (animDone) idle(); }',
          '  if (document.readyState === "complete") { onReady(); }',
          '  else { window.addEventListener("load", onReady, { once: true }); }',
          '',
          '  // ── click pill to re-open overlay ──',
          '  el.addEventListener("click", function() {',
          '    if (el.classList.contains("has-errors") && window.__bini_show_overlay) {',
          '      window.__bini_show_overlay();',
          '    }',
          '  });',
          '',
          '  if (import.meta.hot) {',
          '    import.meta.hot.on("vite:beforeUpdate", start);',
          '    import.meta.hot.on("vite:afterUpdate", function () { ready = true; if (animDone) idle(); });',
          '  }',
          '})();',
        ].join('\n');

        const tag = '<script type="module">' + js + '<\/script>';
        return html.replace('</body>', tag + '</body>');
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 2 — Error overlay with Shiki syntax highlighting
// ─────────────────────────────────────────────────────────────
function biniErrorOverlay(options: BiniOverlayOptions = {}): Plugin {
  let highlighter: Highlighter | null = null;
  const shikiTheme = options.shikiTheme || 'dark-plus';

  const theme = {
    bg: 'rgba(0,0,0,0.45)',
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
    elevation1: '0 4px 20px rgba(0,0,0,0.5)',
    elevation2: '0 8px 30px rgba(0,0,0,0.6)',
    maxWidth: '900px',
  };

  return {
    name: 'bini-overlay:error',
    apply: 'serve',
    
    async buildStart() {
      // Lazy-loaded on first error
    },

    transformIndexHtml: {
      order: 'pre',
      async handler(html: string, ctx: IndexHtmlTransformContext): Promise<HtmlTagDescriptor[] | string> {
        if (!isDev(ctx)) return html;
        // in the loading badge pill (bottom-left) via window.__bini_set_error_count()
        const overlayHtml = `
<div id="__bini_root" style="position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;padding-top:10vh;padding-left:15px;padding-right:15px;background:${theme.bg};backdrop-filter:blur(12px);font-family:system-ui,-apple-system,monospace;display:none;">
  <div id="__bini_backdrop" style="position:fixed;inset:0;z-index:-1;background:${theme.bg};"></div>
  <div style="position:relative;z-index:2;display:flex;width:100%;max-width:${theme.maxWidth};align-items:flex-end;justify-content:space-between;">
    <div style="display:flex;gap:8px;background:${theme.surface};padding:12px;border-radius:16px 16px 0 0;border:1px solid ${theme.border};border-bottom:none;">
      <button id="__bini_prev" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${theme.chipBg};border-radius:8px;border:1px solid ${theme.border};cursor:pointer;color:${theme.text};transition:all 0.2s;">${PREV_ICON}</button>
      <div style="display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:32px;color:${theme.text};font-size:13px;background:${theme.chipBg};border-radius:8px;padding:0 12px;border:1px solid ${theme.border};">
        <span id="__bini_current">1</span>
        <span>/</span>
        <span id="__bini_total">1</span>
      </div>
      <button id="__bini_next" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${theme.chipBg};border-radius:8px;border:1px solid ${theme.border};cursor:pointer;color:${theme.text};transition:all 0.2s;">${NEXT_ICON}</button>
    </div>
    <div style="display:flex;align-items:center;background:${theme.surface};padding:8px 24px;border-radius:16px 16px 0 0;border:1px solid ${theme.border};border-bottom:none;">
      <span style="font-size:14px;font-weight:500;background:linear-gradient(135deg,#00CFFF,#0077FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Bini.js</span>
    </div>
  </div>
  <div style="position:relative;z-index:10;display:flex;width:100%;max-width:${theme.maxWidth};flex-direction:column;overflow:hidden;border-radius:0 0 16px 16px;background:${theme.surface};backdrop-filter:blur(10px);color:${theme.text};box-shadow:${theme.elevation2};border:1px solid ${theme.border};border-top:none;">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${theme.border};background:${theme.surface};padding:12px 20px;">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        <span id="__bini_heading" style="color:${theme.accent};font-family:monospace;font-size:12px;background:rgba(248,113,113,0.12);padding:4px 12px;border-radius:20px;border:1px solid rgba(248,113,113,0.25);white-space:nowrap;"></span>
        <button id="__bini_filelink" style="font-size:11px;font-family:monospace;color:${theme.info};background:rgba(59,130,246,0.1);padding:4px 8px;border-radius:6px;cursor:pointer;display:none;border:none;"></button>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="__bini_copy" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${theme.chipBg};border:1px solid ${theme.border};border-radius:8px;cursor:pointer;color:${theme.text};transition:all 0.2s;">${COPY_ICON}</button>
        <button id="__bini_close" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${theme.chipBg};border:1px solid ${theme.border};border-radius:8px;cursor:pointer;color:${theme.text};transition:all 0.2s;">${CLOSE_ICON}</button>
      </div>
    </div>
    <div id="__bini_error_content" style="padding:24px;"></div>
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

  var _errorHandler = null;
  var _rejectionHandler = null;
  var _keydownHandler = null;
  
  function stripNonAscii(str) {
    return str.replace(/[^\\x20-\\x7E]/g, '').trim();
  }

  function parseStack(stack) {
    if (!stack) return [];
    var frames = [];
    var lines = stack.split("\\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var match = line.match(/^at\\s+(?:(.+?)\\s+\\()?(.+?):(\\d+):(\\d+)\\)?$/);
      if (match) {
        var fnName = match[1] || null;
        var file = match[2];
        var ln = match[3];
        if (file.includes('node_modules') || file.startsWith('node:') ||
            file.includes('/@vite/') || file.includes('/@vitejs/') ||
            file.includes('/vite/dist/') || file.includes('react-dom') ||
            file.includes('chunk-') || file.includes('?v=')) continue;
        var shortFile = file.replace(/^.*?(src[\\/]|app[\\/])/, '$1');
        if (shortFile === file) shortFile = file.split('/').slice(-2).join('/');
        frames.push({ fn: fnName, file: shortFile, line: ln });
      }
    }
    return frames.slice(0, 6);
  }

  var _stackIdCounter = 0;

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-bini-stack-toggle]');
    if (!btn) return;
    var listId = btn.getAttribute('data-bini-stack-toggle');
    var chevronId = btn.getAttribute('data-bini-stack-chevron');
    var list = document.getElementById(listId);
    var chevron = document.getElementById(chevronId);
    if (!list || !chevron) return;
    var open = list.style.display !== 'none';
    list.style.display = open ? 'none' : 'block';
    chevron.style.transform = open ? 'rotate(-90deg)' : 'rotate(0deg)';
  });

  function renderCallStack(stack) {
    var frames = parseStack(stack);
    if (!frames.length) return "";
    var uid = "bcs" + (++_stackIdCounter);
    var listId = uid + "_list";
    var chevronId = uid + "_chev";

    var html = "<div style='margin-top:20px;border-top:1px solid rgba(255,255,255,0.06);padding-top:4px;'>";

    html += "<button"
          + " data-bini-stack-toggle='" + listId + "'"
          + " data-bini-stack-chevron='" + chevronId + "'"
          + " style='display:flex;align-items:center;gap:8px;width:100%;background:none;"
          + "border:none;cursor:pointer;padding:10px 0;text-align:left;'>";

    html += "<span id='" + chevronId + "' style='display:inline-flex;align-items:center;color:#6b7280;transition:transform 0.2s;transform:rotate(0deg);'>"
          + "<svg width='12' height='12' viewBox='0 0 16 16' fill='none'>"
          + "<path fill-rule='evenodd' clip-rule='evenodd' d='M3.47 5.47a.75.75 0 0 1 1.06 0L8 8.94l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 0-1.06z' fill='currentColor'/>"
          + "</svg></span>";

    html += "<span style='font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:0.06em;text-transform:uppercase;'>Call Stack</span>";
    html += "<span style='font-size:10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:1px 7px;color:#6b7280;'>" + frames.length + "</span>";
    html += "</button>";

    html += "<div id='" + listId + "' style='display:block;'>";
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      var isFirst = i === 0;
      html += "<div style='display:flex;flex-direction:column;padding:7px 0 7px 20px;"
            + "border-bottom:1px solid rgba(255,255,255,0.04);"
            + (isFirst ? "border-top:1px solid rgba(255,255,255,0.04);" : "")
            + "'>";
      html += "<span style='font-size:12px;font-weight:500;color:" + (isFirst ? "#e4e4e7" : "#9ca3af") + ";font-family:monospace;'>"
            + escapeHtml(f.fn || "(anonymous)") + "</span>";
      html += "<span style='font-size:11px;color:#4b5563;font-family:monospace;margin-top:2px;'>"
            + escapeHtml(f.file) + " (" + escapeHtml(f.line) + ")</span>";
      html += "</div>";
    }
    html += "</div>";
    html += "</div>";
    return html;
  }

  function hasAnsi(str) {
    return /\\x1b\\[|\\u001b\\[/.test(str);
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
      var response = await fetch('/__bini_code_context?file=' + encodeURIComponent(filePath) + '&line=' + lineNumber);
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
    shikiLoadPromise = new Promise(function(resolve) {
      if (window.shiki && window.shiki.createHighlighter) {
        window.shiki.createHighlighter({
          themes: ["${shikiTheme}"],
          langs: ["javascript", "typescript", "jsx", "tsx", "json", "html", "css"]
        }).then(function(h) {
          shikiHighlighter = h;
          resolve(h);
        }).catch(function() { resolve(null); });
        return;
      }
      var shikiScript = document.createElement("script");
      shikiScript.src = "https://unpkg.com/shiki@4.0.2/dist/index.js";
      shikiScript.onload = function() {
        if (window.shiki && window.shiki.createHighlighter) {
          window.shiki.createHighlighter({
            themes: ["${shikiTheme}"],
            langs: ["javascript", "typescript", "jsx", "tsx", "json", "html", "css"]
          }).then(function(h) {
            shikiHighlighter = h;
            resolve(h);
          }).catch(function() { resolve(null); });
        } else {
          resolve(null);
        }
      };
      shikiScript.onerror = function() { resolve(null); };
      document.head.appendChild(shikiScript);
    });
    return shikiLoadPromise;
  }
  
  function highlightCode(code, lang) {
    if (shikiHighlighter) {
      try {
        return shikiHighlighter.codeToHtml(code, { lang: lang || "javascript", theme: "${shikiTheme}" });
      } catch(e) {
        return "<pre style='margin:0;'><code>" + escapeHtml(code) + "</code></pre>";
      }
    }
    return "<pre style='margin:0;'><code>" + escapeHtml(code) + "</code></pre>";
  }
  
  function getErrorColor(errorType) {
    if (errorType.includes('PARSE') || errorType.includes('Syntax')) return '#f87171';
    if (errorType.includes('TYPE')) return '#fbbf24';
    if (errorType.includes('REF')) return '#60a5fa';
    if (errorType.includes('RUNTIME')) return '#f97316';
    if (errorType.includes('BUILD')) return '#a855f7';
    return '#f87171';
  }
  
  function formatErrorMessage(message, codeLines, fileLang, stack) {
    var lang = fileLang || "javascript";
    var lines = message.split("\\n");
    var html = "<div style='font-family:monospace;font-size:13px;line-height:1.6;'>";
    
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      
      if (line.includes('NextJs') || line.includes('Turbopack')) continue;
      if (line.match(/^\\s*[│|]/)) continue;
      if (line.includes('╭─[') || line.includes('────╯')) continue;
      if (line.match(/^\\s*\\d+\\s*[│|]/)) continue;

      var errorMatch = line.match(/^\\[([^\\]]+)\\]\\s*Error:\\s*(.*)$/);
      if (errorMatch) {
        var errorColor = getErrorColor(errorMatch[1]);
        var cleanMsg = stripNonAscii(errorMatch[2]);
        html += "<div style='background:rgba(248,113,113,0.08);padding:12px 16px;margin:8px 0;border-radius:8px;'>";
        html += "<span style='color:" + errorColor + ";font-weight:600;'>[" + escapeHtml(errorMatch[1]) + "] Error:</span> ";
        html += "<span style='color:${theme.text};'>" + escapeHtml(cleanMsg) + "</span>";
        html += "</div>";
        continue;
      }
      
      var helpMatch = line.match(/^\\s*(?:│\\s*)?Help:\\s*(.*)$/);
      if (helpMatch) {
        html += "<div style='background:rgba(59,130,246,0.08);padding:10px 16px;margin:12px 0;border-radius:8px;'>";
        html += "<span style='color:#3b82f6;font-weight:600;'>Help:</span> ";
        html += "<span style='color:#9ca3af;'>" + escapeHtml(helpMatch[1]) + "</span>";
        html += "</div>";
        continue;
      }
      
      if (line.match(/Transform failed/)) {
        html += "<div style='color:#f97316;font-weight:500;padding:8px 0;border-bottom:1px solid ${theme.border};margin-bottom:12px;'>" + escapeHtml(line) + "</div>";
        continue;
      }
      
      if (line.trim() && !line.match(/^\\s*$/)) {
        html += "<div style='color:#9ca3af;padding:2px 0;'>" + escapeHtml(stripNonAscii(line)) + "</div>";
      }
    }
    
    if (codeLines && codeLines.length > 0) {
      html += "<div style='margin:16px 0;border:1px solid ${theme.border};border-radius:12px;overflow:hidden;background:${theme.surfaceMuted};'>";
      html += "<div style='background:${theme.surface};padding:8px 16px;border-bottom:1px solid ${theme.border};font-size:11px;color:#9ca3af;font-weight:500;'>";
      html += "<span style='background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:4px;'>" + lang.toUpperCase() + "</span>";
      html += "</div><div style='padding:12px 0;'>";
      for (var k = 0; k < codeLines.length; k++) {
        var cl = codeLines[k];
        var isErr = cl.includes('>>>');
        var clBg = isErr ? "background:rgba(239,68,68,0.08);border-left:3px solid #f87171;" : "";
        var clNumMatch = cl.match(/(\\d+):/);
        var clNum = clNumMatch ? clNumMatch[1] : "";
        var clCode = clNumMatch ? cl.substring(cl.indexOf(':') + 1).trim() : cl;
        clCode = clCode.replace(/^>>>\\s*/, "");
        html += "<div style='display:flex;padding:4px 0;" + clBg + "'>";
        html += "<span style='min-width:55px;padding:0 12px;text-align:right;color:#6b7280;user-select:none;font-size:11px;font-weight:500;'>" + clNum + "</span>";
        html += "<div style='flex:1;padding:0 12px;color:${theme.text};white-space:pre;overflow-x:auto;'>" + highlightCode(clCode, lang) + "</div>";
        html += "</div>";
      }
      html += "</div></div>";
    }

    html += renderCallStack(stack);
    html += "</div>";
    return html;
  }
  
  function updateBadge() {
    var count = errors.length;
    if (typeof window.__bini_set_error_count === 'function') {
      window.__bini_set_error_count(count);
    }
  }

  window.__bini_show_overlay = function() { show(); };

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
    
    document.getElementById("__bini_close").addEventListener("click", hide);
    document.getElementById("__bini_prev").addEventListener("click", function() { currentIndex = Math.max(0, currentIndex - 1); render(); });
    document.getElementById("__bini_next").addEventListener("click", function() { currentIndex = Math.min(errors.length - 1, currentIndex + 1); render(); });

    _keydownHandler = function(e) { if (e.key === "Escape") hide(); };
    document.addEventListener("keydown", _keydownHandler);
  }
  
  function hide() {
    if (overlayRoot) overlayRoot.style.display = "none";
    updateBadge();
  }

  function show() {
    if (overlayRoot) overlayRoot.style.display = "flex";
  }
  
  function render() {
    var err = errors[currentIndex];
    if (!err || !overlayRoot) {
      if (overlayRoot && errors.length === 0) hide();
      return;
    }
    
    var cleanMessage = err.originalMessage || err.message;
    
    var headingEl = document.getElementById("__bini_heading");
    if (headingEl) {
      var errorType;
      var msg = cleanMessage || "";
      if (err.name === "Unhandled Rejection") {
        errorType = "Unhandled Rejection";
      } else if (msg.match(/Element type is invalid|Cannot read prop|is not a function|is not defined|Cannot find module/i)) {
        errorType = "Runtime Error";
      } else if (msg.match(/SyntaxError|PARSE_ERROR|Unexpected token|Expected.*but found/i)) {
        errorType = "Parse Error";
      } else if (msg.match(/Transform failed|Build failed/i)) {
        errorType = "Build Error";
      } else if (msg.match(/TypeError/i) || (err.name === "TypeError")) {
        errorType = "Type Error";
      } else if (err.name && err.name !== "Plugin Error" && err.name !== "Vite Error") {
        errorType = err.name;
      } else if (err.id) {
        errorType = "Build Error";
      } else {
        errorType = "Runtime Error";
      }
      headingEl.textContent = errorType;
    }
    
    var filelinkEl = document.getElementById("__bini_filelink");
    var locationMatch = cleanMessage.match(/(?:src|app)[\\/\\\\][^\\n]+?\\.(?:tsx?|jsx?):(\\d+):(\\d+)/);
    if (locationMatch) {
      var fullMatch = cleanMessage.match(/(?:src|app)[\\/\\\\][^\\n]+?\\.(?:tsx?|jsx?)/);
      if (fullMatch) {
        filelinkEl.textContent = fullMatch[0] + ":" + locationMatch[1];
        filelinkEl.style.display = "flex";
        filelinkEl.onclick = function() {
          fetch("/__open-in-editor?file=" + encodeURIComponent(fullMatch[0] + ":" + locationMatch[1] + ":" + locationMatch[2]));
        };
      }
    } else {
      filelinkEl.style.display = "none";
    }
    
    var contentEl = document.getElementById("__bini_error_content");
    if (contentEl) {
      contentEl.innerHTML = formatErrorMessage(cleanMessage, err.codeLines || [], err.fileLang || "javascript", err.stack || "");
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
    if (err.codeLines && err.codeLines.length > 0) {
      text += "\\n\\nCode Context:\\n" + err.codeLines.join("\\n");
    }
    text += "\\n\\n" + (err.stack || "");
    navigator.clipboard.writeText(text).catch(function() {});
  }
  
  function getErrorKey(err) {
    var file = err.file || err.id || "";
    var line = err.line || "";
    var msg = (err.originalMessage || err.message || "").slice(0, 100);
    return file + ":" + line + ":" + msg;
  }

  function addError(err) {
    if (hasAnsi(err.message || "")) return;
    err.originalMessage = err.message;

    var key = getErrorKey(err);
    var existing = errors.some(function(e) { return getErrorKey(e) === key; });
    if (!existing) {
      errors.push(err);
      currentIndex = errors.length - 1;
      ensureOverlay();
      loadShiki().then(function() { render(); });
      updateBadge();
    }
  }

  function cleanup() {
    if (_errorHandler) { window.removeEventListener("error", _errorHandler); _errorHandler = null; }
    if (_rejectionHandler) { window.removeEventListener("unhandledrejection", _rejectionHandler); _rejectionHandler = null; }
    if (_keydownHandler) { document.removeEventListener("keydown", _keydownHandler); _keydownHandler = null; }
  }
  
  _errorHandler = function(e) {
    e.preventDefault();
    var errorObj = {
      name: (e.error && e.error.name) || "Runtime Error",
      message: e.message,
      stack: e.error && e.error.stack,
      file: e.filename || "",
      line: e.lineno || null,
    };
    var stackMatch = (e.error && e.error.stack || "").match(/([^\\s(]+\\.(?:tsx?|jsx?)):(\\d+):(\\d+)/);
    if (stackMatch) {
      errorObj.fileLang = langFromFile(stackMatch[1]);
      errorObj.file = errorObj.file || stackMatch[1];
      errorObj.line = errorObj.line || parseInt(stackMatch[2], 10);
      fetchCodeLines(stackMatch[1], parseInt(stackMatch[2], 10)).then(function(lines) {
        errorObj.codeLines = lines;
        addError(errorObj);
      }).catch(function() { addError(errorObj); });
    } else {
      addError(errorObj);
    }
  };
  window.addEventListener("error", _errorHandler);

  _rejectionHandler = function(e) {
    e.preventDefault();
    var r = e.reason;
    var errorObj = {
      name: (r && r.name) || "Unhandled Rejection",
      message: (r && r.message) || String(r),
      stack: r && r.stack,
      file: "",
      line: null,
    };
    var stackMatch = (r && r.stack || "").match(/([^\\s(]+\\.(?:tsx?|jsx?)):(\\d+):(\\d+)/);
    if (stackMatch) {
      errorObj.fileLang = langFromFile(stackMatch[1]);
      errorObj.file = stackMatch[1];
      errorObj.line = parseInt(stackMatch[2], 10);
      fetchCodeLines(stackMatch[1], parseInt(stackMatch[2], 10)).then(function(lines) {
        errorObj.codeLines = lines;
        addError(errorObj);
      }).catch(function() { addError(errorObj); });
    } else {
      addError(errorObj);
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
          message: err.message || "Unknown build error",
          stack: err.stack || "",
          id: err.id || err.file || "",
          file: (err.loc && err.loc.file) || err.id || err.file || "",
          line: (err.loc && err.loc.line) || null,
          column: (err.loc && err.loc.column) || null,
          plugin: err.plugin || null,
        };
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
        if (fileForContext) {
          errorObj.fileLang = langFromFile(fileForContext);
        }
        if (fileForContext && lineForContext) {
          fetchCodeLines(fileForContext, lineForContext).then(function(lines) {
            errorObj.codeLines = lines;
            addError(errorObj);
          }).catch(function() { addError(errorObj); });
        } else {
          addError(errorObj);
        }
      } else if (data && data.message) {
        errorObj = {
          name: "Build Error",
          message: data.message,
          stack: data.stack || "",
          file: "",
          line: null,
        };
        addError(errorObj);
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
      if (errors.length === 0) {
        if (overlayRoot) hide();
        updateBadge();
      } else {
        render();
        updateBadge();
      }
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
// PLUGIN 3 — Intercept vite-error-overlay custom element
// ─────────────────────────────────────────────────────────────
function biniViteErrorInterceptPlugin(): Plugin {
  return {
    name: 'bini-overlay:vite-intercept',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      handler(html: string, ctx: IndexHtmlTransformContext): HtmlTagDescriptor[] | string {
        if (!isDev(ctx)) return html;

        const js = [
          '(function () {',
          '  if (customElements.get("vite-error-overlay")) return;',
          '  class BiniViteErrorOverlay extends HTMLElement {',
          '    constructor() {',
          '      super();',
          '      this.style.display = "none";',
          '    }',
          '  }',
          '  customElements.define("vite-error-overlay", BiniViteErrorOverlay);',
          '})();',
        ].join('\n');

        return [scriptTag(js, 'head-prepend', true)];
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 4 — Server-side error interceptor with code context API
// ─────────────────────────────────────────────────────────────
function biniServerErrorPlugin(): Plugin {
  return {
    name: 'bini-overlay:server-error',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use('/__bini_code_context', async (req, res, next) => {
        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const filePath = url.searchParams.get('file');
          const lineStr = url.searchParams.get('line');
          
          if (!filePath || !lineStr) {
            res.statusCode = 400;
            res.end('Missing file or line parameter');
            return;
          }
          
          const line = parseInt(lineStr, 10);
          const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

          const cwd = process.cwd();
          const resolved = path.resolve(fullPath);
          if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Access denied' }));
            return;
          }
          
          const content = await fs.promises.readFile(resolved, 'utf-8');
          const lines = content.split('\n');
          
          const startLine = Math.max(0, line - 3);
          const endLine = Math.min(lines.length, line + 2);
          
          const contextLines: string[] = [];
          for (let i = startLine; i < endLine; i++) {
            const prefix = i + 1 === line ? '>>> ' : '    ';
            contextLines.push(`${prefix}${i + 1}: ${lines[i]}`);
          }
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ lines: contextLines }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to read file' }));
        }
      });
      
      function broadcastViteError(ws: any, e: any, urlHint: string = ''): void {
        const message: string = e?.message ?? String(e);
        const stack: string = e?.stack ?? '';
        const rawFile: string = e?.id ?? e?.file ?? e?.filename ?? urlHint.split('?')[0];
        const file = rawFile.replace(/^\//, '');
        
        if (/\x1b\[|\u001b\[/.test(message)) return;

        let lineNumber: number | null = null;
        let columnNumber: number | null = null;
        if (e?.loc?.line) {
          lineNumber = e.loc.line;
          columnNumber = e.loc.column ?? null;
        } else {
          const lineMatch = message.match(/:(\d+):(\d+)/);
          if (lineMatch) {
            lineNumber = parseInt(lineMatch[1], 10);
            columnNumber = parseInt(lineMatch[2], 10);
          }
        }

        try {
          ws.send({
            type: 'error',
            err: {
              message,
              stack,
              id: file,
              loc: {
                file: e?.loc?.file || file,
                line: lineNumber,
                column: columnNumber,
              },
              plugin: e?.plugin || 'bini-overlay',
            },
          });
        } catch (err) {}
      }

      function patchEnvironment(env: any): void {
        if (!env?.transformRequest || env.__biniPatched) return;
        env.__biniPatched = true;
        const orig = env.transformRequest.bind(env);
        env.transformRequest = async function (url: string, options?: any) {
          try {
            return await orig(url, options);
          } catch (e: any) {
            broadcastViteError(server.ws, e, url);
            throw e;
          }
        };
      }

      function patchAllEnvironments(): void {
        const envs = (server as any).environments ?? {};
        for (const env of Object.values(envs)) {
          patchEnvironment(env);
        }
        patchEnvironment(server);
      }

      patchAllEnvironments();
      server.httpServer?.once('listening', patchAllEnvironments);

      server.middlewares.use((err: any, _req: any, _res: any, next: any) => {
        if (err) {
          try {
            broadcastViteError(server.ws, err);
          } catch { /* ignore */ }
        }
        next(err);
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────
export function biniOverlay(options: BiniOverlayOptions = {}): PluginOption[] {
  return [
    biniServerErrorPlugin(),
    biniViteErrorInterceptPlugin(),
    biniErrorOverlay(options),
    biniLoadingPlugin(),
  ];
}