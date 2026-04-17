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
export interface BiniOverlayOptions {}

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
const PREV_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.24996 12.0608L8.71963 11.5304L5.89641 8.70722C5.50588 8.3167 5.50588 7.68353 5.89641 7.29301L8.71963 4.46978L9.24996 3.93945L10.3106 5.00011L9.78029 5.53044L7.31062 8.00011L9.78029 10.4698L10.3106 11.0001L9.24996 12.0608Z" fill="currentColor"/></svg>`;
const NEXT_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.75011 3.93945L7.28044 4.46978L10.1037 7.29301C10.4942 7.68353 10.4942 8.3167 10.1037 8.70722L7.28044 11.5304L6.75011 12.0608L5.68945 11.0001L6.21978 10.4698L8.68945 8.00011L6.21978 5.53044L5.68945 5.00011L6.75011 3.93945Z" fill="currentColor"/></svg>`;
const CHEVRON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill="#666" fill-rule="evenodd" clip-rule="evenodd" d="M5.50011 1.93945L6.03044 2.46978L10.8537 7.293C11.2442 7.68353 11.2442 8.31669 10.8537 8.70722L6.03044 13.5304L5.50011 14.0608L4.43945 13.0001L4.96978 12.4698L9.43945 8.00011L4.96978 3.53044L4.43945 3.00011L5.50011 1.93945Z"></path></svg>`;

function isDev(ctx: IndexHtmlTransformContext): boolean {
  return !!ctx.server;
}

function scriptTag(js: string, injectTo: HtmlTagDescriptor['injectTo'] = 'head-prepend', isModule: boolean = true): HtmlTagDescriptor {
  return { tag: 'script', attrs: isModule ? { type: 'module' } : {}, children: js, injectTo };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 1 — HMR loading badge
// ─────────────────────────────────────────────────────────────
function biniLoadingPlugin(): BiniPlugin {
  return {
    name: 'bini-overlay:loading',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler(html: string, ctx: IndexHtmlTransformContext): string | HtmlTagDescriptor[] {
        if (!isDev(ctx)) return html;

        const js = `
(function () {
  if (document.getElementById("bini-loading-root")) return;
  var container = document.createElement("div");
  container.id = "bini-loading-root";
  document.body.appendChild(container);
  var sr = container.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host { all: initial; display: block; }",
    "#w { position: fixed; bottom: 20px; left: 20px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; z-index: 2147483647; border-radius: 50%; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 20px rgba(0,0,0,0.5); pointer-events: auto; cursor: pointer; transition: all 0.3s; overflow: hidden; }",
    "#w.has-errors { width: auto; border-radius: 999px; background: #dc2626; border: none; box-shadow: 0 4px 20px rgba(220,38,38,0.4); padding: 0; height: 40px; }",
    ".bf, .bs { position: absolute; width: 20px; height: auto; transition: opacity .25s; }",
    ".bf { opacity: 1; } .bs { opacity: 0; }",
    "#w.loading .bf { opacity: 0; } #w.loading .bs { opacity: 1; }",
    "#w.has-errors .bf, #w.has-errors .bs { opacity: 0; }",
    ".ep { display: none; align-items: center; height: 40px; }",
    "#w.has-errors .ep { display: flex; }",
    ".ep-icon { width: 40px; height: 40px; background: rgba(0,0,0,0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; }",
    ".ep-content { display: flex; align-items: baseline; gap: 6px; padding: 0 14px 0 6px; }",
    ".ep-count { font-family: monospace; font-size: 20px; font-weight: 700; color: #fff; }",
    ".ep-label { font-family: monospace; font-size: 17px; font-weight: 700; color: #fff; }",
    ".bsp { fill: none; stroke: url(#sg); stroke-width: 1.4; stroke-dasharray: 300; stroke-dashoffset: 300; }",
    "#w.loading .bsp { animation: draw 1.3s ease-out forwards; }",
    "@keyframes draw { to { stroke-dashoffset: 0; } }",
    "#bini-menu { position: fixed; bottom: 80px; left: 20px; min-width: 248px; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); z-index: 2147483647; display: none; font-family: monospace; padding: 6px; }",
    "#bini-menu.show { display: block; }",
    ".bini-menu-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 6px; }",
    ".bini-menu-item:hover { background: rgba(255,255,255,0.06); }",
    ".bini-menu-item-clickable { cursor: pointer; }",
    ".bini-menu-label { color: #a1a1aa; font-size: 13px; }",
    ".bini-menu-value { color: #e4e4e7; font-size: 13px; display: flex; align-items: center; gap: 4px; }",
    ".bini-route-value { color: #60a5fa; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }"
  ].join("\\n");

  var biniPath = "${BINI_PATH}";
  
  var menu = document.createElement("div");
  menu.id = "bini-menu";
  menu.innerHTML = '<div class="bini-menu-item"><span class="bini-menu-label">Route</span><span class="bini-menu-value" id="bini-route-type">Static</span></div><div class="bini-menu-item"><span class="bini-menu-label">Bundler</span><span class="bini-menu-value">Rolldown</span></div><div class="bini-menu-item bini-menu-item-clickable" id="bini-route-info"><span class="bini-menu-label">Route Info</span><span class="bini-menu-value"><span id="bini-route-name" class="bini-route-value">/</span>${CHEVRON_RIGHT}</span></div>';
  
  var w = document.createElement("div");
  w.id = "w";
  w.className = "loading";
  w.innerHTML = '<svg class="bf" width="20" height="28" viewBox="0 0 22 31"><defs><linearGradient id="fg"><stop stop-color="#00CFFF"/><stop offset="1" stop-color="#0077FF"/></linearGradient></defs><path fill="url(#fg)" d="' + biniPath + '"/></svg>' +
    '<svg class="bs" width="20" height="28" viewBox="0 0 22 31"><defs><linearGradient id="sg"><stop stop-color="#00CFFF"/><stop offset="1" stop-color="#0077FF"/></linearGradient></defs><path class="bsp" d="' + biniPath + '"/></svg>' +
    '<div class="ep"><span class="ep-icon"><svg width="20" height="28" viewBox="0 0 22 31"><path fill="#fff" d="' + biniPath + '"/></svg></span><div class="ep-content"><span class="ep-count" id="bini-err-count">0</span><span class="ep-label" id="bini-err-label">Issues</span></div></div>';

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
    el.classList.toggle("has-errors", count > 0);
  };
  window.__bini_set_error_count(0);

  function loop() {
    if (ready) return;
    animDone = false;
    sp.style.animation = "none";
    sp.offsetHeight;
    sp.style.strokeDashoffset = "300";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        sp.style.animation = "";
        el.classList.add("loading");
      });
    });
    timer = setTimeout(function () { if (!ready) loop(); }, 2000);
  }
  
  function start() { animDone = false; ready = false; loop(); }
  
  sp.addEventListener("animationend", function (e) {
    if (e.animationName !== "draw") return;
    animDone = true;
    clearTimeout(timer);
    if (ready) el.classList.remove("loading");
    else loop();
  });
  
  if (document.readyState === "complete") { ready = true; }
  else { window.addEventListener("load", function () { ready = true; }, { once: true }); }

  el.addEventListener("click", function(e) {
    e.stopPropagation();
    menuVisible = !menuVisible;
    menuEl.classList.toggle("show", menuVisible);
  });
  
  document.addEventListener("click", function(e) {
    if (!e.composedPath().includes(menuEl) && !e.composedPath().includes(el) && menuVisible) {
      menuEl.classList.remove("show");
      menuVisible = false;
    }
  });

  sr.getElementById("bini-route-info").addEventListener("click", function(e) {
    e.stopPropagation();
    menuEl.classList.remove("show");
    menuVisible = false;
  });
  
  function updateMenuInfo() {
    var routeTypeEl = sr.getElementById("bini-route-type");
    var routeNameEl = sr.getElementById("bini-route-name");
    if (routeNameEl) routeNameEl.textContent = window.location.pathname || '/';
    if (window.__bini_get_route_type && routeTypeEl) {
      try {
        var routeType = window.__bini_get_route_type();
        routeTypeEl.textContent = routeType === 'dynamic' ? 'Dynamic' : routeType === 'static' ? 'Static' : 'Not Found';
        routeTypeEl.style.color = routeType === 'dynamic' ? '#fbbf24' : routeType === 'static' ? '#10b981' : '#ef4444';
      } catch (e) {
        routeTypeEl.textContent = 'Static';
        routeTypeEl.style.color = '#10b981';
      }
    }
  }
  updateMenuInfo();

  if (import.meta.hot) {
    import.meta.hot.on("vite:beforeUpdate", start);
    import.meta.hot.on("vite:afterUpdate", function () { ready = true; el.classList.remove("loading"); updateMenuInfo(); });
  }
})();`;
        const tag = '<script type="module">' + js + '<\/script>';
        return html.replace('</body>', tag + '</body>');
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 2 — Error overlay with Highlight.js
// ─────────────────────────────────────────────────────────────
function biniErrorOverlay(): BiniPlugin {
  const theme = {
    bg: '#0a0a0a',
    surface: '#0a0a0a',
    surfaceMuted: '#050505',
    border: 'rgba(255,255,255,0.08)',
    text: '#e4e4e7',
    accent: '#f87171',
    info: '#3b82f6',
    chipBg: 'rgba(255,255,255,0.05)',
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
  #__bini_error_content::-webkit-scrollbar { width: 8px; height: 8px; }
  #__bini_error_content::-webkit-scrollbar-track { background: ${theme.surfaceMuted}; border-radius: 4px; }
  #__bini_error_content::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 4px; }
  #__bini_error_content { scrollbar-width: thin; scrollbar-color: #3a3a3a ${theme.surfaceMuted}; }
  .bini-code-scroll { overflow-x: auto; }
  .bini-code-scroll::-webkit-scrollbar { height: 8px; }
  .bini-code-scroll::-webkit-scrollbar-track { background: ${theme.surfaceMuted}; }
  .bini-code-scroll::-webkit-scrollbar-thumb { background: #3a3a3a; }
  .hljs { background: transparent !important; color: #e4e4e7; }
  .hljs-keyword { color: #569cd6; }
  .hljs-string { color: #ce9178; }
  .hljs-comment { color: #6a9955; }
  .hljs-function { color: #dcdcaa; }
  .hljs-number { color: #b5cea8; }
  .hljs-operator { color: #d4d4d4; }
  .hljs-punctuation { color: #d4d4d4; }
</style>
<div id="__bini_root" style="position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;padding-top:10vh;padding-left:15px;padding-right:15px;background:${theme.bg};font-family:monospace;display:none;">
  <div style="display:flex;width:100%;max-width:900px;align-items:flex-end;justify-content:space-between;">
    <div style="display:flex;gap:8px;background:${theme.surface};padding:12px;border-radius:16px 16px 0 0;border:1px solid ${theme.border};border-bottom:none;">
      <button id="__bini_prev" style="width:32px;height:32px;background:${theme.chipBg};border-radius:8px;border:1px solid ${theme.border};cursor:pointer;color:${theme.text};">${PREV_ICON}</button>
      <div style="display:flex;align-items:center;min-width:48px;height:32px;color:${theme.text};font-size:13px;background:${theme.chipBg};border-radius:8px;padding:0 12px;border:1px solid ${theme.border};">
        <span id="__bini_current">1</span><span>/</span><span id="__bini_total">1</span>
      </div>
      <button id="__bini_next" style="width:32px;height:32px;background:${theme.chipBg};border-radius:8px;border:1px solid ${theme.border};cursor:pointer;color:${theme.text};">${NEXT_ICON}</button>
    </div>
    <div style="display:flex;align-items:center;background:${theme.surface};padding:8px 24px;border-radius:16px 16px 0 0;border:1px solid ${theme.border};border-bottom:none;">
      <span style="font-size:14px;font-weight:500;background:linear-gradient(135deg,#00CFFF,#0077FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Bini.js</span>
    </div>
  </div>
  <div style="display:flex;width:100%;max-width:900px;flex-direction:column;border-radius:0 0 16px 16px;background:${theme.surface};color:${theme.text};box-shadow:0 8px 30px rgba(0,0,0,0.6);border:1px solid ${theme.border};border-top:none;">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${theme.border};padding:12px 20px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span id="__bini_heading" style="color:${theme.accent};font-size:12px;background:rgba(248,113,113,0.12);padding:4px 12px;border-radius:20px;border:1px solid rgba(248,113,113,0.25);"></span>
        <span id="__bini_file_info" style="font-size:11px;color:${theme.info};background:rgba(59,130,246,0.1);padding:4px 8px;border-radius:6px;"></span>
      </div>
      <button id="__bini_copy" style="width:32px;height:32px;background:${theme.chipBg};border:1px solid ${theme.border};border-radius:8px;cursor:pointer;color:${theme.text};">${COPY_ICON}</button>
    </div>
    <div id="__bini_error_content" style="padding:24px;max-height:60vh;overflow-y:auto;font-family:monospace;"></div>
  </div>
</div>`;

        const js = `
(function() {
  if (window.__bini_initialized) return;
  window.__bini_initialized = true;
  
  var errors = [], currentIndex = 0, overlayRoot = null, hljs = null;
  var highlightCache = new Map();
  
  function shortenPath(p) {
    if (!p) return '';
    p = p.replace(/^vite:/, '').replace(/\\x00/g, '').replace(/\\\\/g, '/');
    var m = p.match(/(?:src\\/)?(?:app\\/.*)$/);
    return m ? m[0] : p.split('/').slice(-2).join('/');
  }
  
  function cleanErrorMessage(msg) {
    return (msg || '').replace(/vite:oxc\\s*/gi, '').replace(/vite:\\s*/gi, '').trim();
  }

  function parseComponentStack(cs) {
    if (!cs) return [];
    var frames = [], lines = cs.split("\\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim(), m;
      if ((m = line.match(/at\\s+(.+?)\\s+\\((.+?):(\\d+):(\\d+)\\)/))) frames.push({ fn: m[1], file: shortenPath(m[2]), line: m[3] });
      else if ((m = line.match(/at\\s+(.+?):(\\d+):(\\d+)/))) frames.push({ fn: '<anonymous>', file: shortenPath(m[1]), line: m[2] });
      else if ((m = line.match(/at\\s+(.+?)$/)) && !line.includes('/')) frames.push({ fn: m[1], file: '', line: '' });
    }
    return frames;
  }

  function highlight(code, lang) {
    if (!hljs) return escapeHtml(code);
    if (code.length > 8000) return escapeHtml(code);
    var key = code + '|' + lang;
    if (highlightCache.has(key)) return highlightCache.get(key);
    try {
      var result = lang ? hljs.highlight(code, { language: lang }) : hljs.highlightAuto(code, ['ts', 'tsx', 'js', 'jsx']);
      highlightCache.set(key, result.value);
      return result.value;
    } catch (e) {
      return escapeHtml(code);
    }
  }
  
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  
  function loadHljs() { return import('https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/es/core.min.js').then(function(m) { hljs = m.default; return Promise.all([import('https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/es/languages/typescript.min.js'), import('https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/es/languages/javascript.min.js'), import('https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/es/languages/tsx.min.js'), import('https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/es/languages/jsx.min.js')]).then(function(langs) { hljs.registerLanguage('typescript', langs[0].default); hljs.registerLanguage('javascript', langs[1].default); hljs.registerLanguage('tsx', langs[2].default); hljs.registerLanguage('jsx', langs[3].default); }); }); }

  function formatErrorMessage(msg, codeLines, lang, stack, err) {
    var clean = cleanErrorMessage(msg), lines = clean.split("\\n"), main = lines[0];
    var html = "<div style='font-size:13px;line-height:1.6;'>";
    if (err && err.plugin && err.plugin !== 'vite:oxc') html += "<div style='margin-bottom:16px;'><span style='color:#6b7280;font-size:11px;'>" + escapeHtml(err.plugin.replace(/^vite:/, '')) + "</span></div>";
    if (main) html += "<div style='background:rgba(248,113,113,0.08);padding:16px;border-radius:8px;margin:8px 0;'><div style='color:#f87171;font-weight:600;margin-bottom:8px;'>Error</div><div style='color:#e4e4e7;font-size:14px;'>" + escapeHtml(main) + "</div></div>";
    for (var i = 1; i < lines.length; i++) { if (lines[i] && !lines[i].includes('Component Stack')) html += "<div style='color:#9ca3af;padding:2px 0;'>" + escapeHtml(lines[i]) + "</div>"; }
    
    if (codeLines && codeLines.length) {
      html += "<div style='margin:16px 0;border:1px solid ${theme.border};border-radius:12px;overflow:hidden;background:${theme.surfaceMuted};'><div style='background:${theme.surface};padding:8px 16px;border-bottom:1px solid ${theme.border};font-size:11px;color:#9ca3af;display:flex;justify-content:space-between;'><span>" + (lang || 'javascript').toUpperCase() + "</span>" + (err && err.file ? "<span>" + escapeHtml(shortenPath(err.file)) + ":" + err.line + "</span>" : "") + "</div><div class='bini-code-scroll'><div style='display:inline-block;min-width:100%;padding:12px 0;'>";
      for (var k = 0; k < codeLines.length; k++) {
        var cl = codeLines[k], isErr = cl.includes('>>>'), m = cl.match(/(\\d+):/), num = m ? m[1] : "", code = m ? cl.substring(cl.indexOf(':') + 1).trim() : cl;
        code = code.replace(/^>>>\\s*/, "");
        html += "<div style='display:flex;padding:2px 0;" + (isErr ? "background:rgba(239,68,68,0.08);" : "") + "'><span style='min-width:55px;padding:0 12px;text-align:right;color:" + (isErr ? "#f87171" : "#6b7280") + ";font-size:11px;flex-shrink:0;'>" + num + "</span><span style='flex:1;padding:0 12px 0 0;white-space:pre;font-size:13px;'>" + highlight(code, lang) + "</span></div>";
      }
      html += "</div></div></div>";
    }
    
    var frames = parseComponentStack(err?.componentStack || stack);
    if (frames.length) {
      html += "<div style='margin-top:20px;'><div style='font-size:11px;font-weight:600;color:#9ca3af;margin-bottom:12px;'>Call Stack</div><div style='background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;'>";
      for (var j = 0; j < frames.length; j++) {
        var f = frames[j];
        html += "<div style='padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;'><span style='color:#6b7280;'>▶</span> <span style='color:#60a5fa;'>" + escapeHtml(f.fn || '<anonymous>') + "</span>";
        if (f.file) html += "<span style='color:#6b7280;'> @ </span><span style='color:#10b981;'>" + escapeHtml(f.file) + "</span><span style='color:#6b7280;'>:</span><span style='color:#fbbf24;'>" + f.line + "</span>";
        html += "</div>";
      }
      html += "</div></div>";
    }
    return html + "</div>";
  }
  
  function updateBadge() { if (window.__bini_set_error_count) window.__bini_set_error_count(errors.length); }
  window.__bini_show_overlay = function() { if (overlayRoot) overlayRoot.style.display = "flex"; };

  function ensureOverlay() {
    if (overlayRoot) return;
    var c = document.createElement("div"); c.id = "__bini_ov__"; c.innerHTML = \`${overlayHtml}\`; document.body.appendChild(c);
    overlayRoot = c.querySelector("#__bini_root");
    document.getElementById("__bini_copy").addEventListener("click", function() { var t = errors[currentIndex]; if (t) navigator.clipboard?.writeText((t.name||'Error')+': '+(t.originalMessage||t.message)+'\\n\\n'+(t.stack||'')); });
    document.getElementById("__bini_prev").addEventListener("click", function() { currentIndex = Math.max(0, currentIndex - 1); render(); });
    document.getElementById("__bini_next").addEventListener("click", function() { currentIndex = Math.min(errors.length - 1, currentIndex + 1); render(); });
  }
  
  function render() {
    var e = errors[currentIndex];
    if (!e || !overlayRoot) return;
    var heading = document.getElementById("__bini_heading"), fileInfo = document.getElementById("__bini_file_info");
    if (heading) { var t = e._type === 'runtime' ? 'Runtime Error' : (e.name || 'Build Error'); heading.textContent = t; }
    if (fileInfo) fileInfo.textContent = e.file ? shortenPath(e.file) + (e.line ? ':' + e.line : '') : '';
    document.getElementById("__bini_error_content").innerHTML = formatErrorMessage(e.originalMessage || e.message, e.codeLines || [], e.fileLang || 'javascript', e.stack || '', e);
    document.getElementById("__bini_current").textContent = currentIndex + 1;
    document.getElementById("__bini_total").textContent = errors.length;
    overlayRoot.style.display = "flex";
  }
  
  function addError(err) {
    err.originalMessage = err.message;
    if (!errors.some(function(e) { return (e.file||'')+':'+(e.line||'')+':'+(e.message||'').slice(0,100) === (err.file||'')+':'+(err.line||'')+':'+(err.message||'').slice(0,100); })) {
      errors.push(err); currentIndex = errors.length - 1;
      ensureOverlay(); loadHljs().then(function() { render(); });
      updateBadge();
    }
  }

  function extractFile(msg, stack) {
    var m = (msg||'').match(/Failed to fetch dynamically imported module:\\s*(.+?)(?:\\?|$)/) || (msg||'').match(/module ['"]([^'"]+)['"]/);
    if (m) return { file: m[1], line: 1 };
    m = (stack||'').match(/([^\\s(]+\\.(?:tsx?|jsx?|js|ts)):(\\d+):(\\d+)/);
    return m ? { file: m[1], line: parseInt(m[2]) } : { file: '', line: null };
  }
  
  window.addEventListener("__bini_error__", function(e) {
    var d = e.detail, f = extractFile(d.message, d.stack);
    var err = { name: d.name || 'Runtime Error', message: cleanErrorMessage(d.message), stack: d.stack, componentStack: d.componentStack, _type: 'runtime', file: d.file || f.file, line: d.line || f.line };
    addError(err);
  });
  
  window.addEventListener("error", function(e) {
    e.preventDefault();
    var f = extractFile(e.message, e.error?.stack);
    addError({ name: e.error?.name || 'Runtime Error', message: cleanErrorMessage(e.message), stack: e.error?.stack, file: e.filename || f.file, line: e.lineno || f.line });
  });
  
  window.addEventListener("unhandledrejection", function(e) {
    e.preventDefault();
    var r = e.reason, f = extractFile(r?.message || String(r), r?.stack);
    addError({ name: r?.name || 'Unhandled Rejection', message: cleanErrorMessage(r?.message || String(r)), stack: r?.stack, file: f.file, line: f.line });
  });
  
  if (import.meta.hot) {
    import.meta.hot.on("vite:error", function(d) {
      var e = d?.err;
      if (e) {
        var err = { name: 'Build Error', message: cleanErrorMessage(e.message), stack: e.stack, id: e.id, file: e.loc?.file || e.id || e.file, line: e.loc?.line, plugin: e.plugin };
        addError(err);
      } else if (d?.message) addError({ name: 'Build Error', message: cleanErrorMessage(d.message), stack: d.stack });
    });
    import.meta.hot.on("vite:afterUpdate", function() { errors = []; currentIndex = 0; updateBadge(); if (overlayRoot) overlayRoot.style.display = "none"; window.dispatchEvent(new CustomEvent('__bini_clear_errors__')); });
  }
  
  loadHljs();
})();`.trim();

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
        return [scriptTag("customElements.define('vite-error-overlay', class extends HTMLElement { constructor() { super(); this.style.display = 'none'; } });", 'head-prepend', true)];
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
          const filePath = url.searchParams.get('file'), lineStr = url.searchParams.get('line');
          if (!filePath || !lineStr) { res.statusCode = 400; res.end(); return; }
          
          let cleanPath = decodeURIComponent(filePath).replace(/^vite:/, '').replace(/\\x00/g, '').replace(/\?.*$/, '');
          if (cleanPath.startsWith('http')) cleanPath = new URL(cleanPath).pathname;
          const fullPath = path.isAbsolute(cleanPath) ? cleanPath : path.join(process.cwd(), cleanPath);
          const resolved = path.resolve(fullPath);
          
          if (!resolved.startsWith(process.cwd() + path.sep) && resolved !== process.cwd()) { res.statusCode = 403; res.end(); return; }
          if (!fs.existsSync(resolved)) { res.statusCode = 404; res.end(JSON.stringify({ lines: [] })); return; }
          
          const content = await fs.promises.readFile(resolved, 'utf-8'), lines = content.split('\n');
          const line = parseInt(lineStr, 10), start = Math.max(0, line - 3), end = Math.min(lines.length, line + 2);
          const context = [];
          for (let i = start; i < end; i++) context.push((i + 1 === line ? '>>> ' : '    ') + (i + 1) + ': ' + lines[i]);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ lines: context }));
        } catch { res.statusCode = 500; res.end(JSON.stringify({ lines: [] })); }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// PLUGIN 5 — Routes API
// ─────────────────────────────────────────────────────────────
function biniRoutesPlugin(): BiniPlugin {
  return {
    name: 'bini-overlay:routes',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__bini_route_match', async (_req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ type: 'static' }));
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────
export function biniOverlay(_options: BiniOverlayOptions = {}): PluginOption[] {
  return [biniCodeContextPlugin(), biniRoutesPlugin(), biniViteErrorInterceptPlugin(), biniErrorOverlay(), biniLoadingPlugin()];
}