import type {
  Plugin,
  PluginOption,
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
  ViteDevServer,
} from 'vite';
import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface BiniOverlayOptions {
  /** highlight.js theme name from cdnjs (default: 'atom-one-dark') */
  hlTheme?: string;
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

// SVG Icons
const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`;
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PREV_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.24996 12.0608L8.71963 11.5304L5.89641 8.70722C5.50588 8.3167 5.50588 7.68353 5.89641 7.29301L8.71963 4.46978L9.24996 3.93945L10.3106 5.00011L9.78029 5.53044L7.31062 8.00011L9.78029 10.4698L10.3106 11.0001L9.24996 12.0608Z" fill="currentColor"/></svg>`;
const NEXT_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.75011 3.93945L7.28044 4.46978L10.1037 7.29301C10.4942 7.68353 10.4942 8.3167 10.1037 8.70722L7.28044 11.5304L6.75011 12.0608L5.68945 11.0001L6.21978 10.4698L8.68945 8.00011L6.21978 5.53044L5.68945 5.00011L6.75011 3.93945Z" fill="currentColor"/></svg>`;
const CHEVRON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="#666" fill-rule="evenodd" clip-rule="evenodd" d="M5.50011 1.93945L6.03044 2.46978L10.8537 7.293C11.2442 7.68353 11.2442 8.31669 10.8537 8.70722L6.03044 13.5304L5.50011 14.0608L4.43945 13.0001L4.96978 12.4698L9.43945 8.00011L4.96978 3.53044L4.43945 3.00011L5.50011 1.93945Z"></path></svg>`;
const CLOSE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

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
    injectTo,
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 1 — HMR loading badge with menu
// ─────────────────────────────────────────────────────────────
function biniLoadingPlugin(): BiniPlugin {
  return {
    name: 'bini-overlay:loading',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler(html: string, ctx: IndexHtmlTransformContext): string | HtmlTagDescriptor[] {
        if (!isDev(ctx)) return html;

        const js = /* js */`
(function () {
  if (document.getElementById("bini-loading-root")) return;
  var container = document.createElement("div");
  container.id = "bini-loading-root";
  document.body.appendChild(container);
  var sr = container.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host { all: initial; display: block; }",
    "#w {",
    "  position: fixed; bottom: 20px; left: 20px;",
    "  width: 48px; height: 48px;",
    "  display: flex; align-items: center; justify-content: center;",
    "  z-index: 2147483647; border-radius: 50%;",
    "  background: #0a0a0a;",
    "  border: 1px solid rgba(255,255,255,0.1);",
    "  box-shadow: 0 4px 20px rgba(0,0,0,0.5);",
    "  pointer-events: auto; cursor: pointer;",
    "  transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);",
    "  overflow: hidden;",
    "}",
    "#w.has-errors {",
    "  width: auto; border-radius: 999px;",
    "  background: #dc2626;",
    "  border: none;",
    "  box-shadow: 0 4px 20px rgba(220,38,38,0.4), 0 2px 6px rgba(0,0,0,0.3);",
    "  padding: 0; gap: 0; height: 40px;",
    "}",
    ".bf, .bs { position: absolute; width: 20px; height: auto; transition: opacity .25s; }",
    ".bf { opacity: 1; } .bs { opacity: 0; }",
    "#w.loading .bf { opacity: 0; } #w.loading .bs { opacity: 1; }",
    "#w.has-errors .bf { opacity: 0; } #w.has-errors .bs { opacity: 0; }",
    ".ep { display: none; align-items: center; gap: 0; opacity: 0; transition: opacity 0.2s; height: 40px; }",
    "#w.has-errors .ep { display: flex; opacity: 1; }",
    ".ep-icon { width: 40px; height: 40px; background: rgba(0,0,0,0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin: 0; }",
    ".ep-content { display: flex; align-items: baseline; gap: 6px; padding: 0 14px 0 6px; }",
    ".ep-count { font-family: 'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace; font-size: 20px; font-weight: 700; color: #fff; line-height: 1; }",
    ".ep-label { font-family: 'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace; font-size: 17px; font-weight: 700; color: #fff; white-space: nowrap; letter-spacing: -0.01em; line-height: 1; }",
    ".bsp { fill: none; stroke: url(#sg); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 300; stroke-dashoffset: 300; }",
    "#w.loading .bsp { animation: draw 1.3s ease-out .1s forwards; }",
    "@keyframes draw { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }",
    "#bini-menu { position: fixed; bottom: 80px; left: 20px; min-width: 248px; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); z-index: 2147483647; display: none; overflow: hidden; font-family: 'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace; padding: 6px; }",
    "#bini-menu.show { display: block; }",
    ".bm-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 6px; cursor: default; transition: background 0.15s; }",
    ".bm-item:hover { background: rgba(255,255,255,0.06); }",
    ".bm-item-btn { cursor: pointer; }",
    ".bm-label { color: #a1a1aa; font-size: 13px; font-weight: 400; }",
    ".bm-value { color: #e4e4e7; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 4px; }",
    ".bm-route-value { color: #60a5fa; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }"
  ].join("\\n");

  var biniPath = "${BINI_PATH}";

  var menu = document.createElement("div");
  menu.id = "bini-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML =
    '<div class="bm-item"><span class="bm-label">Route</span><span class="bm-value" id="bm-route-type">Static</span></div>' +
    '<div class="bm-item"><span class="bm-label">Bundler</span><span class="bm-value">Rolldown</span></div>' +
    '<div class="bm-item bm-item-btn" id="bm-route-info"><span class="bm-label">Route Info</span><span class="bm-value"><span id="bm-route-name" class="bm-route-value">/</span>${CHEVRON_RIGHT}</span></div>';

  var w = document.createElement("div");
  w.id = "w";
  w.className = "loading";
  w.innerHTML =
    '<svg class="bf" width="20" height="28" viewBox="0 0 22 31" fill="none">' +
    '<defs><linearGradient id="fg" x1="9.96" y1="-12.92" x2="9.96" y2="40.08" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#00CFFF"/><stop offset="1" stop-color="#0077FF"/></linearGradient></defs>' +
    '<path fill="url(#fg)" d="' + biniPath + '"/></svg>' +
    '<svg class="bs" width="20" height="28" viewBox="0 0 22 31" fill="none">' +
    '<defs><linearGradient id="sg" x1="9.96" y1="-12.92" x2="9.96" y2="40.08" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#00CFFF"/><stop offset="1" stop-color="#0077FF"/></linearGradient></defs>' +
    '<path class="bsp" d="' + biniPath + '"/></svg>' +
    '<div class="ep">' +
    '<span class="ep-icon"><svg width="20" height="28" viewBox="0 0 22 31" fill="none"><path fill="#fff" d="' + biniPath + '"/></svg></span>' +
    '<div class="ep-content"><span class="ep-count" id="bm-err-count">0</span><span class="ep-label" id="bm-err-label">Issues</span></div>' +
    '</div>';

  sr.appendChild(style);
  sr.appendChild(menu);
  sr.appendChild(w);

  var el = sr.getElementById("w");
  var sp = el.querySelector(".bsp");
  var countEl = sr.getElementById("bm-err-count");
  var labelEl = sr.getElementById("bm-err-label");
  var menuEl = sr.getElementById("bini-menu");
  var animDone = false, ready = false, timer = null, menuVisible = false;

  window.__bini_set_error_count = function(count) {
    if (countEl) countEl.textContent = count;
    if (labelEl) labelEl.textContent = count === 1 ? "Issue" : "Issues";
    if (count > 0) { el.classList.add("has-errors"); el.classList.remove("loading"); }
    else { el.classList.remove("has-errors"); }
  };
  window.__bini_set_error_count(0);

  function idle() { clearTimeout(timer); timer = null; if (!el.classList.contains("has-errors")) el.classList.remove("loading"); }
  function loop() {
    animDone = false;
    sp.style.animation = "none"; sp.offsetHeight; sp.style.strokeDashoffset = "300";
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        sp.style.animation = "";
        if (!el.classList.contains("has-errors")) el.classList.add("loading");
      });
    });
    timer = setTimeout(function() { if (!ready) loop(); }, 2000);
  }
  function start() { animDone = false; ready = false; loop(); timer = setTimeout(function() { ready = true; if (animDone) idle(); }, 1800); }
  sp.addEventListener("animationend", function(e) {
    if (e.animationName !== "draw") return;
    animDone = true; clearTimeout(timer); timer = null;
    if (ready) idle(); else loop();
  });
  function onReady() { ready = true; clearTimeout(timer); timer = null; if (animDone) idle(); }
  if (document.readyState === "complete") onReady();
  else window.addEventListener("load", onReady, { once: true });

  function toggleMenu(e) {
    e.stopPropagation();
    menuVisible = !menuVisible;
    menuEl.classList.toggle("show", menuVisible);
  }
  document.addEventListener("click", function(e) {
    if (!e.composedPath().some(function(n) { return n === menuEl || n === el; }) && menuVisible) {
      menuEl.classList.remove("show"); menuVisible = false;
    }
  });
  el.addEventListener("click", toggleMenu);

  var routeInfoBtn = sr.getElementById("bm-route-info");
  if (routeInfoBtn) {
    routeInfoBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      menuEl.classList.remove("show"); menuVisible = false;
      console.log("[Bini] Route Info:", window.location.pathname);
    });
  }

  function updateMenuInfo() {
    var routeTypeEl = sr.getElementById("bm-route-type");
    var routeNameEl = sr.getElementById("bm-route-name");
    if (routeNameEl) routeNameEl.textContent = window.location.pathname || '/';
    if (routeTypeEl && window.__bini_get_route_type) {
      try {
        var t = window.__bini_get_route_type();
        if (t === 'dynamic') { routeTypeEl.textContent = 'Dynamic'; routeTypeEl.style.color = '#fbbf24'; }
        else if (t === 'static') { routeTypeEl.textContent = 'Static'; routeTypeEl.style.color = '#10b981'; }
        else { routeTypeEl.textContent = 'Not Found'; routeTypeEl.style.color = '#ef4444'; }
      } catch(e) { routeTypeEl.textContent = 'Static'; routeTypeEl.style.color = '#10b981'; }
    }
  }
  updateMenuInfo();

  if (import.meta.hot) {
    import.meta.hot.on("vite:beforeUpdate", start);
    import.meta.hot.on("vite:afterUpdate", function() { ready = true; if (animDone) idle(); updateMenuInfo(); });
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
// PLUGIN 2 — Error overlay (main)
// ─────────────────────────────────────────────────────────────
function biniErrorOverlay(options: BiniOverlayOptions = {}): BiniPlugin {
  const hlTheme = options.hlTheme || 'atom-one-dark';

  // highlight.js CDN URLs
  const HL_JS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
  const HL_CSS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${hlTheme}.min.css`;

  const theme = {
    bg: '#0a0a0a',
    surface: '#111111',
    surfaceElevated: '#161616',
    border: 'rgba(255,255,255,0.07)',
    borderAccent: 'rgba(255,255,255,0.12)',
    text: '#e4e4e7',
    textMuted: '#71717a',
    textFaint: '#52525b',
    accent: '#f87171',
    accentBg: 'rgba(248,113,113,0.10)',
    accentBorder: 'rgba(248,113,113,0.22)',
    warning: '#fbbf24',
    info: '#60a5fa',
    infoBg: 'rgba(96,165,250,0.10)',
    success: '#10b981',
    chipBg: 'rgba(255,255,255,0.05)',
    errorLineBg: 'rgba(239,68,68,0.08)',
    errorLineGutter: 'rgba(239,68,68,0.18)',
    maxWidth: '860px',
  };

  return {
    name: 'bini-overlay:error',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      async handler(html: string, ctx: IndexHtmlTransformContext): Promise<HtmlTagDescriptor[] | string> {
        if (!isDev(ctx)) return html;

        // ── Overlay HTML shell ──────────────────────────────────────────────
        const overlayHtml = /* html */`
<div id="__bo_root" style="display:none;position:fixed;inset:0;z-index:2147483646;background:${theme.bg};font-family:'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace;overflow:hidden;">
  <!-- Header bar -->
  <div id="__bo_header" style="display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:52px;border-bottom:1px solid ${theme.border};background:${theme.surface};flex-shrink:0;">
    <!-- Left: brand + error type badge -->
    <div style="display:flex;align-items:center;gap:12px;">
      <svg width="16" height="22" viewBox="0 0 22 31" fill="none">
        <defs><linearGradient id="bov-g" x1="9.96" y1="-12.92" x2="9.96" y2="40.08" gradientUnits="userSpaceOnUse"><stop stop-color="#00CFFF"/><stop offset="1" stop-color="#0077FF"/></linearGradient></defs>
        <path fill="url(#bov-g)" d="${BINI_PATH}"/>
      </svg>
      <span style="color:${theme.textMuted};font-size:12px;font-weight:500;letter-spacing:0.3px;">Bini.js</span>
      <div style="width:1px;height:16px;background:${theme.border};"></div>
      <span id="__bo_badge" style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:${theme.accentBg};color:${theme.accent};border:1px solid ${theme.accentBorder};letter-spacing:0.3px;"></span>
    </div>
    <!-- Right: nav + copy + close -->
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="display:flex;align-items:center;gap:4px;background:${theme.chipBg};border:1px solid ${theme.border};border-radius:8px;padding:3px;">
        <button id="__bo_prev" title="Previous error" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:transparent;border:none;border-radius:5px;cursor:pointer;color:${theme.textMuted};transition:all 0.15s;">${PREV_ICON}</button>
        <span style="color:${theme.textFaint};font-size:11px;min-width:36px;text-align:center;"><span id="__bo_cur">1</span><span style="color:${theme.textFaint};opacity:0.5;">/</span><span id="__bo_tot">1</span></span>
        <button id="__bo_next" title="Next error" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:transparent;border:none;border-radius:5px;cursor:pointer;color:${theme.textMuted};transition:all 0.15s;">${NEXT_ICON}</button>
      </div>
      <button id="__bo_copy" title="Copy error" style="display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;background:${theme.chipBg};border:1px solid ${theme.border};border-radius:8px;cursor:pointer;color:${theme.textMuted};font-size:11px;font-family:inherit;transition:all 0.15s;">${COPY_ICON}<span>Copy</span></button>
      <button id="__bo_close" title="Dismiss (Escape)" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${theme.chipBg};border:1px solid ${theme.border};border-radius:8px;cursor:pointer;color:${theme.textMuted};transition:all 0.15s;">${CLOSE_ICON}</button>
    </div>
  </div>

  <!-- Two-panel layout -->
  <div style="display:flex;height:calc(100vh - 52px);overflow:hidden;">
    <!-- Left panel: file + message + code -->
    <div style="flex:1;overflow-y:auto;border-right:1px solid ${theme.border};" id="__bo_left">
      <!-- File path pill -->
      <div id="__bo_filepath_bar" style="display:none;align-items:center;gap:10px;padding:12px 24px;border-bottom:1px solid ${theme.border};background:${theme.surfaceElevated};position:sticky;top:0;z-index:10;">
        <span style="font-size:11px;color:${theme.textFaint};flex-shrink:0;">File</span>
        <span id="__bo_filepath" style="font-size:12px;color:${theme.info};font-weight:500;word-break:break-all;"></span>
        <span id="__bo_fileline" style="font-size:11px;color:${theme.textFaint};flex-shrink:0;"></span>
      </div>
      <!-- Message -->
      <div style="padding:24px 28px 20px;">
        <div id="__bo_message" style="font-size:14px;font-weight:500;color:${theme.text};line-height:1.65;word-break:break-word;white-space:pre-wrap;"></div>
      </div>
      <!-- Code block -->
      <div id="__bo_code_wrap" style="display:none;margin:0 28px 24px;border-radius:10px;overflow:hidden;border:1px solid ${theme.border};">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:${theme.surfaceElevated};border-bottom:1px solid ${theme.border};">
          <span id="__bo_code_lang" style="font-size:10px;font-weight:700;color:${theme.textFaint};text-transform:uppercase;letter-spacing:0.8px;"></span>
          <span id="__bo_code_loc" style="font-size:11px;color:${theme.textFaint};"></span>
        </div>
        <div id="__bo_code_body" style="overflow-x:auto;background:#1e1e1e;"></div>
      </div>
    </div>

    <!-- Right panel: call stack + component stack -->
    <div style="width:340px;flex-shrink:0;overflow-y:auto;background:${theme.surface};" id="__bo_right">
      <div style="padding:16px 20px;border-bottom:1px solid ${theme.border};">
        <span style="font-size:10px;font-weight:700;color:${theme.textFaint};text-transform:uppercase;letter-spacing:0.8px;">Call Stack</span>
      </div>
      <div id="__bo_stack" style="padding:8px 0;"></div>
      <div id="__bo_comp_wrap" style="display:none;border-top:1px solid ${theme.border};">
        <div style="padding:16px 20px;border-bottom:1px solid ${theme.border};">
          <span style="font-size:10px;font-weight:700;color:${theme.textFaint};text-transform:uppercase;letter-spacing:0.8px;">Component Stack</span>
        </div>
        <div id="__bo_comp_stack" style="padding:12px 20px;"></div>
      </div>
    </div>
  </div>
</div>`;

        // ── Client-side JS ─────────────────────────────────────────────────
        const js = /* js */`
(function() {
  'use strict';

  if (window.__bini_ov_init) return;
  window.__bini_ov_init = true;

  // ── State ──────────────────────────────────────────────────────────────
  var errors = [];
  var currentIdx = 0;
  var overlayMounted = false;
  var hlReady = false;
  var hlLoadPromise = null;

  // ── Highlight.js lazy load ─────────────────────────────────────────────
  function loadHL() {
    if (hlLoadPromise) return hlLoadPromise;
    hlLoadPromise = new Promise(function(resolve) {
      if (window.hljs) { hlReady = true; return resolve(window.hljs); }

      // Inject CSS
      if (!document.getElementById('__bini_hl_css')) {
        var link = document.createElement('link');
        link.id = '__bini_hl_css';
        link.rel = 'stylesheet';
        link.href = '${HL_CSS_CDN}';
        document.head.appendChild(link);
      }

      var s = document.createElement('script');
      s.src = '${HL_JS_CDN}';
      s.onload = function() {
        if (window.hljs) {
          window.hljs.configure({ ignoreUnescapedHTML: true });
          hlReady = true;
          resolve(window.hljs);
        } else {
          resolve(null);
        }
      };
      s.onerror = function() { resolve(null); };
      document.head.appendChild(s);
    });
    return hlLoadPromise;
  }

  // ── Utilities ──────────────────────────────────────────────────────────
  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function shortenPath(p) {
    if (!p) return '';
    p = p.replace(/^vite:/,'').replace(/\\x00/g,'').replace(/\\?.*$/,'');
    // Try to extract from src/ or app/
    var m = p.match(/(?:src|app)[/\\\\\\\\].*$/);
    if (m) return m[0].replace(/\\\\/g,'/');
    // Fallback: last 2 segments
    return p.split(/[/\\\\\\\\]/).slice(-2).join('/');
  }

  function langFromFile(f) {
    if (!f) return 'javascript';
    var ext = (f.split('.').pop() || '').toLowerCase();
    return ({ tsx:'tsx', ts:'typescript', jsx:'jsx', js:'javascript', css:'css', json:'json' })[ext] || 'javascript';
  }

  // highlight.js language alias map
  function hlLang(lang) {
    return ({ tsx:'typescript', jsx:'javascript', ts:'typescript', js:'javascript' })[lang] || lang;
  }

  function highlight(code, lang) {
    if (hlReady && window.hljs) {
      try {
        var mapped = hlLang(lang);
        var supported = window.hljs.getLanguage(mapped);
        if (supported) return window.hljs.highlight(code, { language: mapped, ignoreIllegals: true }).value;
        return window.hljs.highlightAuto(code).value;
      } catch(e) { return esc(code); }
    }
    return esc(code);
  }

  function cleanMessage(msg) {
    return (msg || '')
      .replace(/\\s*\\[plugin:vite:[^\\]]*\\]\\s*/g,'')
      .replace(/vite:oxc\\s*/gi,'')
      .replace(/Transform failed[^\\n]*\\n?/g,'')
      .replace(/\\s*at\\s+vite:.*$/gm,'')
      .trim();
  }

  function errorKey(e) {
    return (e.file||'') + ':' + (e.line||'') + ':' + (e.message||'').slice(0,80);
  }

  function classifyError(err) {
    var msg = err.message || '';
    var name = err.name || '';
    if (err._type === 'runtime') return 'Runtime Error';
    if (name === 'SyntaxError' || /SyntaxError|Unexpected token|Expected/i.test(msg)) return 'Syntax Error';
    if (name === 'TypeError' || /TypeError/i.test(msg)) return 'Type Error';
    if (name === 'ReferenceError' || /is not defined/i.test(msg)) return 'Reference Error';
    if (/Transform failed|Build failed/i.test(msg)) return 'Build Error';
    if (/Cannot find module|Failed to resolve/i.test(msg)) return 'Module Error';
    if (err._type === 'hmr' || err._type === 'vite') return 'Build Error';
    if (name && name !== 'Error' && name !== 'Plugin Error' && name !== 'Vite Error') return name;
    return 'Error';
  }

  function parseStack(stack, currentFile) {
    if (!stack) return [];
    var frames = [];
    var lines = (stack || '').split('\\n');
    var SKIP = [
      'node_modules','/@vite/','/@vitejs/','vite/dist','react-dom',
      'chunk-','?v=','node:','<anonymous>','bini-overlay','bini-router',
    ];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line.startsWith('at ')) continue;
      var skip = SKIP.some(function(s) { return line.includes(s); });
      if (skip) continue;
      // Patterns: "at fn (file:line:col)" or "at file:line:col"
      var m = line.match(/^at\\s+(?:(.+?)\\s+\\()?(.+?):(\\d+):(\\d+)\\)?$/);
      if (!m) continue;
      frames.push({ fn: m[1] || null, file: shortenPath(m[2]), line: parseInt(m[3],10) });
      if (frames.length >= 8) break;
    }
    return frames;
  }

  function extractFileInfo(message, stack) {
    // From stack
    var m = (stack||'').match(/([^\\s(]+\\.(?:tsx?|jsx?)):(\\d+):(\\d+)/);
    if (m && !m[1].includes('node_modules') && !m[1].includes('vite/dist')) {
      return { file: m[1], line: parseInt(m[2],10) };
    }
    // From message: "module 'foo'"
    var mm = (message||'').match(/module\\s+['"]([^'"]+)['"]/);
    if (mm) return { file: mm[1], line: 1 };
    return { file: '', line: null };
  }

  // ── Code context fetch ─────────────────────────────────────────────────
  async function fetchCodeContext(filePath, lineNumber) {
    if (!filePath || !lineNumber) return [];
    try {
      var clean = filePath.replace(/^vite:/,'').replace(/\\x00/g,'').replace(/\\?.*$/,'');
      var r = await fetch('/__bini_code_context?file=' + encodeURIComponent(clean) + '&line=' + lineNumber);
      if (r.ok) { var d = await r.json(); return d.lines || []; }
    } catch(e) {}
    return [];
  }

  // ── Overlay DOM setup ──────────────────────────────────────────────────
  function mountOverlay() {
    if (overlayMounted) return;
    overlayMounted = true;
    var wrap = document.createElement('div');
    wrap.id = '__bini_ov_host';
    wrap.innerHTML = \`${overlayHtml}\`;
    document.body.appendChild(wrap);

    document.getElementById('__bo_close').addEventListener('click', dismiss);
    document.getElementById('__bo_prev').addEventListener('click', function() {
      currentIdx = Math.max(0, currentIdx - 1); render();
    });
    document.getElementById('__bo_next').addEventListener('click', function() {
      currentIdx = Math.min(errors.length - 1, currentIdx + 1); render();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') dismiss();
      if (!isVisible()) return;
      if (e.key === 'ArrowLeft') { currentIdx = Math.max(0, currentIdx - 1); render(); }
      if (e.key === 'ArrowRight') { currentIdx = Math.min(errors.length - 1, currentIdx + 1); render(); }
    });

    var copyBtn = document.getElementById('__bo_copy');
    var copySpan = copyBtn.querySelector('span');
    copyBtn.addEventListener('click', function() {
      copyError();
      copyBtn.innerHTML = \`${CHECK_ICON}<span>Copied!</span>\`;
      copyBtn.style.color = '#10b981';
      setTimeout(function() {
        copyBtn.innerHTML = \`${COPY_ICON}<span>Copy</span>\`;
        copyBtn.style.color = '';
      }, 2000);
    });
  }

  function isVisible() {
    var r = document.getElementById('__bo_root');
    return r && r.style.display !== 'none';
  }

  function show() {
    var r = document.getElementById('__bo_root');
    if (r) r.style.display = 'flex';
    r.style.flexDirection = 'column';
  }

  function dismiss() {
    var r = document.getElementById('__bo_root');
    if (r) r.style.display = 'none';
  }

  // ── Render ─────────────────────────────────────────────────────────────
  function render() {
    var err = errors[currentIdx];
    if (!err) return;

    mountOverlay();
    show();

    // Badge
    var badge = document.getElementById('__bo_badge');
    if (badge) badge.textContent = classifyError(err);

    // Counters
    setText('__bo_cur', currentIdx + 1);
    setText('__bo_tot', errors.length);

    // File path bar
    var fpBar = document.getElementById('__bo_filepath_bar');
    var fpEl = document.getElementById('__bo_filepath');
    var flEl = document.getElementById('__bo_fileline');
    if (err.file) {
      fpBar.style.display = 'flex';
      fpEl.textContent = shortenPath(err.file);
      flEl.textContent = err.line ? ':' + err.line : '';
    } else {
      fpBar.style.display = 'none';
    }

    // Message
    var msgEl = document.getElementById('__bo_message');
    if (msgEl) msgEl.textContent = cleanMessage(err.message);

    // Code block
    renderCode(err);

    // Call stack
    renderStack(err);

    // Component stack
    renderCompStack(err);
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderCode(err) {
    var wrap = document.getElementById('__bo_code_wrap');
    var body = document.getElementById('__bo_code_body');
    var langEl = document.getElementById('__bo_code_lang');
    var locEl = document.getElementById('__bo_code_loc');

    if (!err.codeLines || err.codeLines.length === 0) {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = 'block';
    var lang = langFromFile(err.file);
    if (langEl) langEl.textContent = lang.toUpperCase();
    if (locEl) locEl.textContent = err.file ? (shortenPath(err.file) + (err.line ? ':' + err.line : '')) : '';

    // Build table rows for gutter + code
    var rows = '';
    for (var i = 0; i < err.codeLines.length; i++) {
      var cl = err.codeLines[i];
      var isErr = cl.trimStart().startsWith('>>>');
      var numMatch = cl.match(/(\\d+):/);
      var lineNum = numMatch ? numMatch[1] : '';
      var codePart = numMatch ? cl.substring(cl.indexOf(':') + 1) : cl;
      codePart = codePart.replace(/^\\s*>>>\\s*/, '');

      var rowBg = isErr ? '${theme.errorLineBg}' : 'transparent';
      var gutterBg = isErr ? '${theme.errorLineGutter}' : 'transparent';
      var gutterColor = isErr ? '${theme.accent}' : '${theme.textFaint}';
      var dot = isErr ? '<span style="margin-right:4px;color:${theme.accent};">▶</span>' : '';

      rows +=
        '<tr style="background:' + rowBg + ';">' +
        '<td style="min-width:52px;padding:1px 12px 1px 16px;text-align:right;user-select:none;color:' + gutterColor + ';font-size:12px;font-weight:500;background:' + gutterBg + ';border-right:2px solid ' + (isErr ? '${theme.accent}' : 'transparent') + ';white-space:nowrap;">' + dot + lineNum + '</td>' +
        '<td style="padding:1px 16px 1px 12px;white-space:pre;font-size:13px;line-height:1.6;">' + highlight(codePart, lang) + '</td>' +
        '</tr>';
    }

    body.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-family:\\'SF Mono\\',\\'Fira Code\\',\\'Fira Mono\\',\\'Roboto Mono\\',monospace;">' +
      rows +
      '</table>';
  }

  function renderStack(err) {
    var stackEl = document.getElementById('__bo_stack');
    if (!stackEl) return;

    var frames = parseStack(err.stack, err.file);
    if (frames.length === 0) {
      stackEl.innerHTML = '<div style="padding:12px 20px;font-size:12px;color:${theme.textFaint};">No stack frames available.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      var isFirst = i === 0;
      html +=
        '<div style="padding:8px 20px;border-bottom:1px solid rgba(255,255,255,0.03);' + (isFirst ? 'background:rgba(255,255,255,0.03);' : '') + '">' +
        '<div style="font-size:12px;color:' + (isFirst ? '${theme.text}' : '${theme.textMuted}') + ';font-weight:' + (isFirst ? '600' : '400') + ';margin-bottom:3px;word-break:break-all;">' + esc(f.fn || '<anonymous>') + '</div>' +
        '<div style="font-size:11px;color:${theme.info};word-break:break-all;">' + esc(f.file) + '<span style="color:${theme.textFaint};">:' + f.line + '</span></div>' +
        '</div>';
    }
    stackEl.innerHTML = html;
  }

  function renderCompStack(err) {
    var wrap = document.getElementById('__bo_comp_wrap');
    var body = document.getElementById('__bo_comp_stack');
    if (!err.componentStack || !err.componentStack.trim()) {
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (wrap) wrap.style.display = 'block';
    if (body) {
      body.innerHTML =
        '<pre style="margin:0;font-size:11px;color:${theme.textMuted};white-space:pre-wrap;word-break:break-all;line-height:1.6;">' +
        esc(err.componentStack.trim()) + '</pre>';
    }
  }

  // ── Error management ───────────────────────────────────────────────────
  function updateBadge() {
    if (typeof window.__bini_set_error_count === 'function') {
      window.__bini_set_error_count(errors.length);
    }
  }

  function addError(errObj) {
    errObj.message = cleanMessage(errObj.message || 'Unknown error');
    var key = errorKey(errObj);
    if (errors.some(function(e) { return errorKey(e) === key; })) return;
    errors.push(errObj);
    currentIdx = errors.length - 1;
    updateBadge();
    // Load highlight.js first, then render
    loadHL().then(function() { render(); });
  }

  async function addErrorWithCode(errObj) {
    var codeLines = await fetchCodeContext(errObj.file, errObj.line).catch(function() { return []; });
    errObj.codeLines = codeLines;
    addError(errObj);
  }

  function clearMatchingErrors(updates) {
    if (!updates || updates.length === 0) {
      errors = []; currentIdx = 0; updateBadge(); dismiss(); return;
    }
    errors = errors.filter(function(e) {
      var ef = e.file || e.id || '';
      return !updates.some(function(u) {
        var up = u.path || u.acceptedPath || '';
        return ef && up && (ef.includes(up) || up.includes((ef.split('/').pop() || '')));
      });
    });
    currentIdx = Math.max(0, Math.min(currentIdx, errors.length - 1));
    if (errors.length === 0) { dismiss(); }
    else render();
    updateBadge();
  }

  function copyError() {
    var err = errors[currentIdx];
    if (!err) return;
    var parts = [classifyError(err) + ': ' + (err.message || '')];
    if (err.file) parts.push('File: ' + err.file + (err.line ? ':' + err.line : ''));
    if (err.stack) parts.push('\\n' + err.stack);
    if (err.componentStack) parts.push('\\nComponent Stack:\\n' + err.componentStack);
    navigator.clipboard.writeText(parts.join('\\n')).catch(function() {});
  }

  // ── Event handlers ─────────────────────────────────────────────────────

  // 1. Bini internal runtime errors (from ErrorBoundary)
  window.addEventListener('__bini_error__', function(e) {
    var d = e.detail;
    if (!d) return;
    var fi = extractFileInfo(d.message, d.stack);
    var obj = {
      name: d.name || 'Runtime Error',
      message: d.message || '',
      stack: d.stack || '',
      componentStack: d.componentStack || '',
      _type: d._type || 'runtime',
      file: d.file || fi.file || '',
      line: d.line || fi.line || null,
    };
    addErrorWithCode(obj);
  });

  // 2. Uncaught window errors
  window.addEventListener('error', function(e) {
    // Ignore resource load errors (img, script src fails, etc.)
    if (!e.message && e.target && e.target !== window) return;
    e.preventDefault();
    var fi = extractFileInfo(e.message, e.error && e.error.stack);
    var obj = {
      name: (e.error && e.error.name) || 'Runtime Error',
      message: e.message || 'Script error',
      stack: (e.error && e.error.stack) || '',
      _type: 'runtime',
      file: e.filename || fi.file || '',
      line: e.lineno || fi.line || null,
    };
    addErrorWithCode(obj);
  });

  // 3. Unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    e.preventDefault();
    var r = e.reason;
    var msg = (r && r.message) ? r.message : String(r || 'Unhandled rejection');
    var fi = extractFileInfo(msg, r && r.stack);
    var obj = {
      name: (r && r.name) || 'Unhandled Rejection',
      message: msg,
      stack: (r && r.stack) || '',
      _type: 'runtime',
      file: fi.file || '',
      line: fi.line || null,
    };
    addErrorWithCode(obj);
  });

  // 4. Console.error capture (catches React warnings rendered as errors in strict mode)
  var _origConsoleError = console.error;
  console.error = function() {
    _origConsoleError.apply(console, arguments);
    // Only intercept Error objects thrown in component trees
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (a instanceof Error && a.stack) {
        var fi = extractFileInfo(a.message, a.stack);
        var obj = {
          name: a.name || 'Error',
          message: a.message,
          stack: a.stack,
          _type: 'runtime',
          file: fi.file || '',
          line: fi.line || null,
        };
        addErrorWithCode(obj);
        break;
      }
    }
  };

  // 5. Vite HMR events
  if (import.meta && import.meta.hot) {
    import.meta.hot.on('vite:error', function(data) {
      var err = data && data.err;
      if (!err) return;
      var fi = extractFileInfo(err.message, err.stack);
      var fileToUse = (err.loc && err.loc.file) || err.id || err.file || fi.file || '';
      var lineToUse = (err.loc && err.loc.line) || fi.line || null;
      var obj = {
        name: 'Build Error',
        message: err.message || 'Build failed',
        stack: err.stack || '',
        _type: 'vite',
        file: fileToUse,
        line: lineToUse,
        plugin: err.plugin || null,
        id: err.id || '',
      };
      addErrorWithCode(obj);
    });

    import.meta.hot.on('vite:beforeUpdate', function(payload) {
      clearMatchingErrors(payload && payload.updates);
    });

    import.meta.hot.on('vite:afterUpdate', function() {
      errors = []; currentIdx = 0;
      updateBadge();
      dismiss();
      window.dispatchEvent(new CustomEvent('__bini_clear_errors__'));
    });

    import.meta.hot.on('vite:ws:disconnect', function() {
      // Server disconnected — don't clear errors
    });
  }

  // Start loading highlight.js eagerly in the background
  loadHL();
})();
`.trim();

        return [
          scriptTag(js, 'head-prepend', true),
        ];
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 3 — Intercept default vite-error-overlay
// ─────────────────────────────────────────────────────────────
function biniViteErrorInterceptPlugin(): BiniPlugin {
  return {
    name: 'bini-overlay:vite-intercept',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      handler(html: string, ctx: IndexHtmlTransformContext): HtmlTagDescriptor[] | string {
        if (!isDev(ctx)) return html;
        const js = /* js */`
(function () {
  if (customElements.get('vite-error-overlay')) return;
  class BiniViteShim extends HTMLElement {
    constructor() { super(); this.style.display = 'none'; }
  }
  customElements.define('vite-error-overlay', BiniViteShim);
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
  return {
    name: 'bini-overlay:code-context',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__bini_code_context', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const rawFile = url.searchParams.get('file');
          const lineStr = url.searchParams.get('line');

          if (!rawFile || !lineStr) {
            res.statusCode = 400;
            res.end(JSON.stringify({ lines: [] }));
            return;
          }

          const lineNum = parseInt(lineStr, 10);
          if (!isFinite(lineNum) || lineNum < 1) {
            res.statusCode = 400;
            res.end(JSON.stringify({ lines: [] }));
            return;
          }

          let clean = decodeURIComponent(rawFile)
            .replace(/^vite:/, '')
            .replace(/\x00/g, '')
            .replace(/\?.*$/, '');

          // Strip protocol if present
          if (clean.startsWith('http://') || clean.startsWith('https://')) {
            clean = new URL(clean).pathname;
          }

          const cwd = process.cwd();
          const fullPath = path.isAbsolute(clean) ? clean : path.join(cwd, clean);
          const resolved = path.resolve(fullPath);

          // Security: must be inside cwd
          if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ lines: [] }));
            return;
          }

          if (!fs.existsSync(resolved)) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ lines: [] }));
            return;
          }

          const content = await fs.promises.readFile(resolved, 'utf-8');
          const lines = content.split('\n');

          // 3 lines before + error line + 2 lines after
          const BEFORE = 3, AFTER = 2;
          const start = Math.max(0, lineNum - 1 - BEFORE);
          const end = Math.min(lines.length, lineNum + AFTER);

          const contextLines: string[] = [];
          for (let i = start; i < end; i++) {
            const isError = i + 1 === lineNum;
            const prefix = isError ? '>>> ' : '    ';
            contextLines.push(prefix + (i + 1) + ': ' + lines[i]);
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ lines: contextLines }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ lines: [] }));
        }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 5 — Routes info API
// ─────────────────────────────────────────────────────────────
function biniRoutesPlugin(): BiniPlugin {
  return {
    name: 'bini-overlay:routes',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__bini_route_match', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const p = url.searchParams.get('path') || '/';
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ type: 'static', path: p }));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ type: 'not_found' }));
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
    biniRoutesPlugin(),
    biniViteErrorInterceptPlugin(),
    biniErrorOverlay(options),
    biniLoadingPlugin(),
  ];
}