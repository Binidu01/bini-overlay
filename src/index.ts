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
  shikiTheme?: string;
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

// Icons
const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`;
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PREV_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.24996 12.0608L8.71963 11.5304L5.89641 8.70722C5.50588 8.3167 5.50588 7.68353 5.89641 7.29301L8.71963 4.46978L9.24996 3.93945L10.3106 5.00011L9.78029 5.53044L7.31062 8.00011L9.78029 10.4698L10.3106 11.0001L9.24996 12.0608Z" fill="currentColor"/></svg>`;
const NEXT_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.75011 3.93945L7.28044 4.46978L10.1037 7.29301C10.4942 7.68353 10.4942 8.3167 10.1037 8.70722L7.28044 11.5304L6.75011 12.0608L5.68945 11.0001L6.21978 10.4698L8.68945 8.00011L6.21978 5.53044L5.68945 5.00011L6.75011 3.93945Z" fill="currentColor"/></svg>`;
const CHEVRON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="#666" fill-rule="evenodd" clip-rule="evenodd" d="M5.50011 1.93945L6.03044 2.46978L10.8537 7.293C11.2442 7.68353 11.2442 8.31669 10.8537 8.70722L6.03044 13.5304L5.50011 14.0608L4.43945 13.0001L4.96978 12.4698L9.43945 8.00011L4.96978 3.53044L4.43945 3.00011L5.50011 1.93945Z"></path></svg>`;

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
// PLUGIN 1 — HMR loading badge with menu
// ─────────────────────────────────────────────────────────────
function biniLoadingPlugin(): BiniPlugin {
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

        const js = `
(function () {
  if (document.getElementById("bini-loading-root")) return;
  var container = document.createElement("div");
  container.id = "bini-loading-root";
  document.body.appendChild(container);
  var sr = container.attachShadow({ mode: "open" });
  sr.id = "bini-loading-shadow";

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
    "  padding: 0;",
    "  gap: 0;",
    "  height: 40px;",
    "}",
    ".bf, .bs { position: absolute; width: 20px; height: auto; transition: opacity .25s; }",
    ".bf { opacity: 1; }",
    ".bs { opacity: 0; }",
    "#w.loading .bf { opacity: 0; }",
    "#w.loading .bs { opacity: 1; }",
    "#w.has-errors .bf { opacity: 0; }",
    "#w.has-errors .bs { opacity: 0; }",
    ".ep {",
    "  display: none; align-items: center; gap: 0;",
    "  opacity: 0; transition: opacity 0.2s;",
    "  height: 40px;",
    "}",
    "#w.has-errors .ep { display: flex; opacity: 1; }",
    ".ep-icon {",
    "  width: 40px; height: 40px;",
    "  background: rgba(0,0,0,0.4);",
    "  border-radius: 50%;",
    "  display: flex; align-items: center; justify-content: center;",
    "  flex-shrink: 0;",
    "  margin: 0;",
    "}",
    ".ep-content {",
    "  display: flex; align-items: baseline; gap: 6px;",
    "  padding: 0 14px 0 6px;",
    "}",
    ".ep-count {",
    "  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;",
    "  font-size: 20px;",
    "  font-weight: 700;",
    "  color: #fff;",
    "  line-height: 1;",
    "}",
    ".ep-label {",
    "  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;",
    "  font-size: 17px;",
    "  font-weight: 700;",
    "  color: #fff;",
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
    "  position: fixed; bottom: 80px; left: 20px;",
    "  min-width: 248px;",
    "  background: #0a0a0a;",
    "  border: 1px solid rgba(255,255,255,0.15);",
    "  border-radius: 12px;",
    "  box-shadow: 0 8px 30px rgba(0,0,0,0.6);",
    "  z-index: 2147483647;",
    "  display: none;",
    "  overflow: hidden;",
    "  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;",
    "  padding: 6px;",
    "}",
    "#bini-menu.show { display: block; }",
    ".bini-menu-item {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  padding: 8px 12px;",
    "  border-radius: 6px;",
    "  cursor: default;",
    "  transition: background 0.15s;",
    "}",
    ".bini-menu-item:hover { background: rgba(255,255,255,0.06); }",
    ".bini-menu-item-clickable { cursor: pointer; }",
    ".bini-menu-label {",
    "  color: #a1a1aa;",
    "  font-size: 13px;",
    "  font-weight: 400;",
    "}",
    ".bini-menu-value {",
    "  color: #e4e4e7;",
    "  font-size: 13px;",
    "  font-weight: 500;",
    "  display: flex; align-items: center; gap: 4px;",
    "}",
    ".bini-route-value {",
    "  color: #60a5fa;",
    "  max-width: 120px;",
    "  overflow: hidden;",
    "  text-overflow: ellipsis;",
    "  white-space: nowrap;",
    "}"
  ].join("\\n");

  var biniPath = "${BINI_PATH}";
  
  var menu = document.createElement("div");
  menu.id = "bini-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = '<div class="bini-menu-item"><span class="bini-menu-label">Route</span><span class="bini-menu-value" id="bini-route-type">Static</span></div><div class="bini-menu-item"><span class="bini-menu-label">Bundler</span><span class="bini-menu-value">Rolldown</span></div><div class="bini-menu-item bini-menu-item-clickable" id="bini-route-info"><span class="bini-menu-label">Route Info</span><span class="bini-menu-value"><span id="bini-route-name" class="bini-route-value">/</span>${CHEVRON_RIGHT}</span></div>';
  
  var w = document.createElement("div");
  w.id = "w";
  w.className = "loading";
  w.innerHTML =
    '<svg class="bf" width="20" height="28" viewBox="0 0 22 31" fill="none">' +
    '<defs><linearGradient id="fg" x1="9.96" y1="-12.92" x2="9.96" y2="40.08" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#00CFFF"/><stop offset="1" stop-color="#0077FF"/>' +
    '</linearGradient></defs>' +
    '<path fill="url(#fg)" d="' + biniPath + '"/></svg>' +
    '<svg class="bs" width="20" height="28" viewBox="0 0 22 31" fill="none">' +
    '<defs><linearGradient id="sg" x1="9.96" y1="-12.92" x2="9.96" y2="40.08" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#00CFFF"/><stop offset="1" stop-color="#0077FF"/>' +
    '</linearGradient></defs>' +
    '<path class="bsp" d="' + biniPath + '"/></svg>' +
    '<div class="ep">' +
    '<span class="ep-icon">' +
    '<svg width="20" height="28" viewBox="0 0 22 31" fill="none">' +
    '<path fill="#fff" d="' + biniPath + '"/>' +
    '</svg>' +
    '</span>' +
    '<div class="ep-content">' +
    '<span class="ep-count" id="bini-err-count">0</span>' +
    '<span class="ep-label" id="bini-err-label">Issues</span>' +
    '</div>' +
    '</div>';

  sr.appendChild(style);
  sr.appendChild(menu);
  sr.appendChild(w);

  var el = sr.getElementById("w");
  var sp = el.querySelector(".bsp");
  var countEl = sr.getElementById("bini-err-count");
  var labelEl = sr.getElementById("bini-err-label");
  var animDone = false, ready = false, timer = null;
  var menuEl = sr.getElementById("bini-menu");
  var menuVisible = false;

  window.__bini_set_error_count = function(count) {
    if (countEl) countEl.textContent = count;
    if (labelEl) labelEl.textContent = count === 1 ? "Issue" : "Issues";
    if (count > 0) {
      el.classList.add("has-errors");
      el.classList.remove("loading");
    } else {
      el.classList.remove("has-errors");
    }
  };
  
  window.__bini_set_error_count(0);

  function idle() { 
    clearTimeout(timer); 
    timer = null; 
    if (!el.classList.contains("has-errors")) {
      el.classList.remove("loading");
    }
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
    timer = setTimeout(function () { 
      ready = true; 
      if (animDone) idle(); 
    }, 1800);
  }
  
  sp.addEventListener("animationend", function (e) {
    if (e.animationName !== "draw") return;
    animDone = true;
    clearTimeout(timer); 
    timer = null;
    if (ready) idle(); 
    else loop();
  });
  
  function onReady() { 
    ready = true; 
    clearTimeout(timer); 
    timer = null; 
    if (animDone) idle(); 
  }
  
  if (document.readyState === "complete") { onReady(); }
  else { window.addEventListener("load", onReady, { once: true }); }

  function toggleMenu(e) {
    e.stopPropagation();
    menuVisible = !menuVisible;
    if (menuVisible) {
      menuEl.classList.add("show");
    } else {
      menuEl.classList.remove("show");
    }
  }
  
  document.addEventListener("click", function(e) {
    var clickedInShadow = e.composedPath().includes(menuEl) || e.composedPath().includes(el);
    if (!clickedInShadow && menuVisible) {
      menuEl.classList.remove("show");
      menuVisible = false;
    }
  });

  el.addEventListener("click", function(e) {
    e.stopPropagation();
    // Always toggle menu - even when there are errors
    toggleMenu(e);
  });
  
  var routeInfoBtn = sr.getElementById("bini-route-info");
  if (routeInfoBtn) {
    routeInfoBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      menuEl.classList.remove("show");
      menuVisible = false;
      console.log("[Bini] Route Info:", window.location.pathname);
    });
  }
  
  function updateMenuInfo() {
    var routeTypeEl = sr.getElementById("bini-route-type");
    var routeNameEl = sr.getElementById("bini-route-name");
    
    if (routeNameEl) {
      routeNameEl.textContent = window.location.pathname || '/';
    }
    
    if (window.__bini_get_route_type) {
      try {
        var routeType = window.__bini_get_route_type();
        if (routeTypeEl) {
          if (routeType === 'dynamic') {
            routeTypeEl.textContent = 'Dynamic';
            routeTypeEl.style.color = '#fbbf24';
          } else if (routeType === 'static') {
            routeTypeEl.textContent = 'Static';
            routeTypeEl.style.color = '#10b981';
          } else {
            routeTypeEl.textContent = 'Not Found';
            routeTypeEl.style.color = '#ef4444';
          }
        }
      } catch (e) {
        if (routeTypeEl) {
          routeTypeEl.textContent = 'Static';
          routeTypeEl.style.color = '#10b981';
        }
      }
    }
  }
  
  updateMenuInfo();

  if (import.meta.hot) {
    import.meta.hot.on("vite:beforeUpdate", start);
    import.meta.hot.on("vite:afterUpdate", function () { 
      ready = true; 
      if (animDone) idle();
      updateMenuInfo();
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
function biniErrorOverlay(options: BiniOverlayOptions = {}): BiniPlugin {
  const shikiTheme = options.shikiTheme || 'dark-plus';

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
  #__bini_error_content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  #__bini_error_content::-webkit-scrollbar-track {
    background: ${theme.surfaceMuted};
    border-radius: 4px;
  }
  #__bini_error_content::-webkit-scrollbar-thumb {
    background: #3a3a3a;
    border-radius: 4px;
    border: 1px solid ${theme.border};
  }
  #__bini_error_content::-webkit-scrollbar-thumb:hover {
    background: #4a4a4a;
  }
  #__bini_error_content {
    scrollbar-width: thin;
    scrollbar-color: #3a3a3a ${theme.surfaceMuted};
  }
  #__bini_error_content pre {
    overflow-x: auto;
    white-space: pre;
  }
  #__bini_error_content pre::-webkit-scrollbar {
    height: 6px;
  }
  #__bini_error_content pre::-webkit-scrollbar-track {
    background: transparent;
  }
  #__bini_error_content pre::-webkit-scrollbar-thumb {
    background: #3a3a3a;
    border-radius: 3px;
  }
  .bini-code-scroll {
    overflow-x: auto;
  }
  .bini-code-scroll::-webkit-scrollbar {
    height: 8px;
  }
  .bini-code-scroll::-webkit-scrollbar-track {
    background: ${theme.surfaceMuted};
    border-radius: 4px;
  }
  .bini-code-scroll::-webkit-scrollbar-thumb {
    background: #3a3a3a;
    border-radius: 4px;
  }
  .bini-code-scroll {
    scrollbar-width: thin;
    scrollbar-color: #3a3a3a ${theme.surfaceMuted};
  }
</style>
<div id="__bini_root" style="position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;padding-top:10vh;padding-left:15px;padding-right:15px;background:${theme.bg};font-family:'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace;display:none;">
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
  <div style="position:relative;z-index:10;display:flex;width:100%;max-width:${theme.maxWidth};flex-direction:column;overflow:hidden;border-radius:0 0 16px 16px;background:${theme.surface};color:${theme.text};box-shadow:0 8px 30px rgba(0,0,0,0.6);border:1px solid ${theme.border};border-top:none;">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${theme.border};background:${theme.surface};padding:12px 20px;">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        <span id="__bini_heading" style="color:${theme.accent};font-family:'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace;font-size:12px;background:rgba(248,113,113,0.12);padding:4px 12px;border-radius:20px;border:1px solid rgba(248,113,113,0.25);white-space:nowrap;"></span>
        <span id="__bini_file_info" style="font-size:11px;font-family:'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace;color:${theme.info};background:rgba(59,130,246,0.1);padding:4px 8px;border-radius:6px;"></span>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="__bini_copy" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${theme.chipBg};border:1px solid ${theme.border};border-radius:8px;cursor:pointer;color:${theme.text};transition:all 0.2s;">${COPY_ICON}</button>
      </div>
    </div>
    <div id="__bini_error_content" style="padding:24px;max-height:60vh;overflow-y:auto;font-family:'SF Mono','Fira Code','Fira Mono','Roboto Mono',monospace;"></div>
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
  var _biniErrorHandler = null;
  
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
    if (!stack) return [];
    var frames = [];
    var lines = stack.split("\\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.includes('vite:oxc')) continue;
      if (line.includes('vite:')) continue;
      
      var match = line.match(/^at\\s+(?:(.+?)\\s+\\()?(.+?):(\\d+):(\\d+)\\)?$/);
      if (match) {
        var fnName = match[1] || null;
        var file = match[2];
        var ln = match[3];
        if (file.includes('node_modules') || file.startsWith('node:') ||
            file.includes('/@vite/') || file.includes('/@vitejs/') ||
            file.includes('/vite/dist/') || file.includes('react-dom') ||
            file.includes('chunk-') || file.includes('?v=')) continue;
        var shortFile = shortenPath(file);
        frames.push({ fn: fnName, file: shortFile, line: ln });
      }
    }
    return frames.slice(0, 6);
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
    shikiLoadPromise = new Promise(function(resolve) {
      if (window.shiki && window.shiki.codeToHtml) {
        shikiHighlighter = window.shiki;
        resolve(window.shiki);
        return;
      }
      var shikiScript = document.createElement("script");
      shikiScript.src = "https://cdn.jsdelivr.net/npm/shiki@1.0.0/dist/index.min.js";
      shikiScript.onload = function() {
        if (window.shiki) {
          shikiHighlighter = window.shiki;
          resolve(window.shiki);
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
    if (shikiHighlighter && shikiHighlighter.codeToHtml) {
      try {
        return shikiHighlighter.codeToHtml(code, { lang: lang || "javascript", theme: "${shikiTheme}" });
      } catch(e) {
        return "<pre style='margin:0;font-family:\\"SF Mono\\",\\"Fira Code\\",\\"Fira Mono\\",\\"Roboto Mono\\",monospace;'><code>" + escapeHtml(code) + "</code></pre>";
      }
    }
    return "<pre style='margin:0;font-family:\\"SF Mono\\",\\"Fira Code\\",\\"Fira Mono\\",\\"Roboto Mono\\",monospace;'><code>" + escapeHtml(code) + "</code></pre>";
  }
  
  function formatErrorMessage(message, codeLines, fileLang, stack, err) {
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
      html += "<div style='margin:16px 0;border:1px solid ${theme.border};border-radius:12px;overflow:hidden;background:${theme.surfaceMuted};'>";
      html += "<div style='background:${theme.surface};padding:8px 16px;border-bottom:1px solid ${theme.border};font-size:11px;color:#9ca3af;font-weight:500;display:flex;align-items:center;justify-content:space-between;'>";
      html += "<span style='background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:4px;'>" + lang.toUpperCase() + "</span>";
      if (err && err.file && err.line) {
        html += "<span style='color:#6b7280;'>" + escapeHtml(shortenPath(err.file)) + ":" + err.line + "</span>";
      }
      html += "</div>";
      
      html += "<div class='bini-code-scroll' style='overflow-x:auto;'>";
      html += "<div style='display:inline-block;min-width:100%;padding:12px 0;'>";
      
      for (var k = 0; k < codeLines.length; k++) {
        var cl = codeLines[k];
        var isErr = cl.includes('>>>');
        var clBg = isErr ? "background:rgba(239,68,68,0.08);" : "";
        var clNumMatch = cl.match(/(\\d+):/);
        var clNum = clNumMatch ? clNumMatch[1] : "";
        var clCode = clNumMatch ? cl.substring(cl.indexOf(':') + 1).trim() : cl;
        clCode = clCode.replace(/^>>>\\s*/, "");
        
        html += "<div style='display:flex;padding:2px 0;" + clBg + "'>";
        html += "<span style='min-width:55px;padding:0 12px;text-align:right;color:" + (isErr ? "#f87171" : "#6b7280") + ";user-select:none;font-size:11px;font-weight:500;flex-shrink:0;'>" + clNum + "</span>";
        html += "<div style='flex:1;padding:0 12px 0 0;white-space:pre;font-family:\\"SF Mono\\",\\"Fira Code\\",\\"Fira Mono\\",\\"Roboto Mono\\",monospace;font-size:13px;line-height:1.5;'>" + highlightCode(clCode, lang) + "</div>";
        html += "</div>";
      }
      
      html += "</div></div>";
      html += "</div>";
    }

    var frames = parseStack(stack);
    if (frames.length > 0) {
      html += "<div style='margin-top:20px;'>";
      html += "<div style='font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;'>Call Stack</div>";
      html += "<div style='background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;'>";
      for (var j = 0; j < frames.length; j++) {
        var f = frames[j];
        html += "<div style='padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-family:\\"SF Mono\\",\\"Fira Code\\",\\"Fira Mono\\",\\"Roboto Mono\\",monospace;font-size:12px;'>";
        html += "<span style='color:#6b7280;'>▶</span> ";
        html += "<span style='color:#60a5fa;'>" + escapeHtml(f.fn || '<anonymous>') + "</span>";
        html += "<span style='color:#6b7280;'> @ </span>";
        html += "<span style='color:#10b981;'>" + escapeHtml(f.file) + "</span>";
        html += "<span style='color:#6b7280;'>:</span><span style='color:#fbbf24;'>" + f.line + "</span>";
        html += "</div>";
      }
      html += "</div></div>";
    }
    
    if (err && err.componentStack) {
      html += "<div style='margin-top:20px;'>";
      html += "<div style='font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;'>Component Stack</div>";
      html += "<div style='background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:auto;padding:12px;max-height:200px;'>";
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
  }
  
  function render() {
    var err = errors[currentIndex];
    if (!err || !overlayRoot) {
      return;
    }
    
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
      contentEl.innerHTML = formatErrorMessage(cleanMessage, err.codeLines || [], err.fileLang || "javascript", err.stack || "", err);
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

  function addError(err) {
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
    if (_biniErrorHandler) { window.removeEventListener("__bini_error__", _biniErrorHandler); _biniErrorHandler = null; }
  }
  
  function extractFileFromError(message, stack) {
    var moduleMatch = (message || '').match(/module ['"]([^'"]+)['"]/);
    if (moduleMatch) {
      return { file: moduleMatch[1], line: 1 };
    }
    var fileMatch = (stack || '').match(/([^\\s(]+\\.(?:tsx?|jsx?|js|ts)):(\\d+):(\\d+)/);
    if (fileMatch) {
      return { file: fileMatch[1], line: parseInt(fileMatch[2], 10) };
    }
    return { file: '', line: null };
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
          addError(errorObj);
        }).catch(function() { addError(errorObj); });
      } else if (errorObj.file && errorObj.line) {
        fetchCodeLines(errorObj.file, errorObj.line).then(function(lines) {
          errorObj.codeLines = lines;
          addError(errorObj);
        }).catch(function() { addError(errorObj); });
      } else {
        addError(errorObj);
      }
    }
  };
  window.addEventListener("__bini_error__", _biniErrorHandler);
  
  _errorHandler = function(e) {
    e.preventDefault();
    var fileInfo = extractFileFromError(e.message, (e.error && e.error.stack) || '');
    var errorObj = {
      name: (e.error && e.error.name) || "Runtime Error",
      message: cleanErrorMessage(e.message),
      stack: e.error && e.error.stack,
      file: e.filename || fileInfo.file || "",
      line: e.lineno || fileInfo.line || null,
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
    } else if (errorObj.file && errorObj.line) {
      fetchCodeLines(errorObj.file, errorObj.line).then(function(lines) {
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
    var fileInfo = extractFileFromError((r && r.message) || String(r), (r && r.stack) || '');
    var errorObj = {
      name: (r && r.name) || "Unhandled Rejection",
      message: cleanErrorMessage((r && r.message) || String(r)),
      stack: r && r.stack,
      file: fileInfo.file || "",
      line: fileInfo.line || null,
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
    } else if (errorObj.file && errorObj.line) {
      fetchCodeLines(errorObj.file, errorObj.line).then(function(lines) {
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
          message: cleanErrorMessage(err.message || "Unknown build error"),
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
          message: cleanErrorMessage(data.message),
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
        updateBadge();
      } else {
        render();
        updateBadge();
      }
    });
    
    import.meta.hot.on("vite:afterUpdate", function() {
      // Clear ALL errors on successful HMR
      errors = [];
      currentIndex = 0;
      updateBadge();
      window.dispatchEvent(new CustomEvent('__bini_clear_errors__'));
    });

    import.meta.hot.dispose(function() {
      cleanup();
    });
  }
  
  loadShiki();
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
  return {
    name: 'bini-overlay:code-context',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__bini_code_context', async (req: IncomingMessage, res: ServerResponse) => {
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
          let cleanPath = decodeURIComponent(filePath)
            .replace(/^vite:/, '')
            .replace(/\\x00/g, '')
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
          
          const content = await fs.promises.readFile(resolved, 'utf-8');
          const lines = content.split('\n');
          
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
// PLUGIN 5 — Routes API for Bini Router
// ─────────────────────────────────────────────────────────────
function biniRoutesPlugin(): BiniPlugin {
  return {
    name: 'bini-overlay:routes',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__bini_route_match', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const pathToMatch = url.searchParams.get('path') || '/';
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ type: 'static', path: pathToMatch }));
        } catch (error) {
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