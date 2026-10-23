import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  HtmlTagDescriptor,
  Plugin,
  PluginOption,
  ResolvedConfig,
  ViteDevServer,
} from 'vite';
import type { RouteManifest, RouteManifestEntry } from 'bini-router';
import { siJavascript, siReact, siTypescript } from 'simple-icons';

export interface BiniOverlayOptions {
  /** Hide the floating badge. The error overlay and dev endpoints stay active. */
  disableBadge?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const PREFS_KEY = 'bini-overlay:prefs';

const ASSET_PREFIX = '/__bini_overlay';
const BADGE_MODULE_PATH = `${ASSET_PREFIX}/badge.js`;
const OVERLAY_MODULE_PATH = `${ASSET_PREFIX}/overlay.js`;
const FONT_CSS_PATH = `${ASSET_PREFIX}/fonts.css`;
const FONT_FILE_PREFIX = '/__bini_font';

const FONT_SANS =
  "'Inter Variable', 'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_GEIST = `'Geist Variable', 'Geist', ${FONT_SANS}`;
const FONT_MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

const FONT_PACKAGES = {
  inter: '@fontsource-variable/inter',
  geist: '@fontsource-variable/geist',
} as const;

const BINI_PATH = [
  'M8.04688 29.9219V24.8047C9.1276 25.4948 10.2734 25.8398 11.4844 25.8398C12.5651 25.8398',
  ' 13.4245 25.5013 14.0625 24.8242C14.7135 24.1341 15.0391 23.1901 15.0391 21.9922C15.0391',
  ' 20.4818 14.4596 19.2904 13.3008 18.418C12.1419 17.5326 10.5078 17.0573 8.39844 16.9922V12.6758',
  'C9.84375 12.5716 10.9635 12.1289 11.7578 11.3477C12.5651 10.5664 12.9688 9.53125 12.9688',
  ' 8.24219C12.9688 7.14844 12.6758 6.28906 12.0898 5.66406C11.5169 5.03906 10.7422 4.72656',
  ' 9.76562 4.72656C7.36979 4.72656 6.17188 6.32161 6.17188 9.51172V30.0781H0V9.58984C0 6.6862',
  ' 0.891927 4.36198 2.67578 2.61719C4.45964 0.872396 6.9401 0 10.1172 0C12.9427 0 15.1758',
  ' 0.716146 16.8164 2.14844C18.457 3.56771 19.2773 5.39714 19.2773 7.63672C19.2773 9.22526',
  ' 18.8086 10.6185 17.8711 11.8164C16.9466 13.0143 15.7487 13.8346 14.2773 14.2773V14.3555',
  'C19.0039 15.2539 21.3672 17.8516 21.3672 22.1484C21.3672 24.4922 20.5404 26.4844 18.8867',
  ' 28.125C17.2461 29.7526 15.0195 30.5664 12.207 30.5664C10.8398 30.5664 9.45312 30.3516 8.04688 29.9219Z',
].join('');

// ─── Icons ─────────────────────────────────────────────────────────────────

const icon = (
  viewBox: string,
  body: string,
  { size = 14, attrs = '' }: { size?: number; attrs?: string } = {},
): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="none" ${attrs}>${body}</svg>`;

const STROKE = 'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  copy: icon(
    '0 0 24 24',
    '<rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5"/>',
  ),
  check: icon('0 0 24 24', `<path d="M20 6L9 17L4 12" stroke-width="2" ${STROKE}/>`),
  prev: icon(
    '0 0 16 16',
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M9.24996 12.0608L8.71963 11.5304L5.89641 8.70722C5.50588 8.3167 5.50588 7.68353 5.89641 7.29301L8.71963 4.46978L9.24996 3.93945L10.3106 5.00011L9.78029 5.53044L7.31062 8.00011L9.78029 10.4698L10.3106 11.0001L9.24996 12.0608Z" fill="currentColor"/>',
  ),
  next: icon(
    '0 0 16 16',
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M6.75011 3.93945L7.28044 4.46978L10.1037 7.29301C10.4942 7.68353 10.4942 8.3167 10.1037 8.70722L7.28044 11.5304L6.75011 12.0608L5.68945 11.0001L6.21978 10.4698L8.68945 8.00011L6.21978 5.53044L5.68945 5.00011L6.75011 3.93945Z" fill="currentColor"/>',
  ),
  chevronRight: icon(
    '0 0 16 16',
    '<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M5.50011 1.93945L6.03044 2.46978L10.8537 7.293C11.2442 7.68353 11.2442 8.31669 10.8537 8.70722L6.03044 13.5304L5.50011 14.0608L4.43945 13.0001L4.96978 12.4698L9.43945 8.00011L4.96978 3.53044L4.43945 3.00011L5.50011 1.93945Z"/>',
    { size: 16 },
  ),
  chevronDown: icon(
    '0 0 16 16',
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M12.0608 5.50011L11.5304 6.03044L8.00011 9.56011L4.46978 6.03044L3.93945 5.50011L3.00011 6.56078L3.53044 7.09111L7.46978 11.0304C7.76267 11.3233 8.23756 11.3233 8.53044 11.0304L12.4698 7.09111L13.0001 6.56078L12.0608 5.50011Z" fill="currentColor"/>',
  ),
  close: icon('0 0 16 16', '<path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  gear: icon(
    '0 0 24 24',
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    { attrs: `stroke-width="1.8" ${STROKE}` },
  ),
  eyeOff: icon(
    '0 0 24 24',
    '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    { attrs: `stroke-width="1.8" ${STROKE}` },
  ),
  routeArrow: icon('0 0 24 24', '<polyline points="9 6 15 12 9 18"/>', {
    attrs: `stroke-width="2" ${STROKE}`,
  }),
  thumbUp: icon(
    '0 0 24 24',
    '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
    { size: 16, attrs: `stroke-width="1.8" ${STROKE}` },
  ),
  thumbDown: icon(
    '0 0 24 24',
    '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>',
    { size: 16, attrs: `stroke-width="1.8" ${STROKE}` },
  ),
  external: icon('0 0 24 24', '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>', {
    attrs: `stroke-width="1.8" ${STROKE}`,
  }),
  updown: icon('0 0 24 24', '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>', {
    attrs: `stroke-width="1.8" ${STROKE}`,
  }),
} as const;

// ─── Shared helpers ────────────────────────────────────────────────────────

const json = (value: unknown): string => JSON.stringify(value);

const apiBaseOf = (config: ResolvedConfig): string => config.base.replace(/\/$/, '');

/**
 * Externally served modules are NOT transformed by Vite, so `import.meta.hot` is undefined in them.
 * This header builds the HMR context explicitly from Vite's client instead.
 */
const hotHeader = (apiBase: string, modulePath: string): string =>
  `import { createHotContext } from ${json(`${apiBase}/@vite/client`)};\n` +
  `const hot = createHotContext(${json(`${apiBase}${modulePath}`)});\n`;

function isSameOrigin(req: IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string') return site === 'same-origin' || site === 'none';
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

type EndpointHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => void | Promise<void>;

/** Same-origin guarded dev endpoint with uniform error handling. */
function useEndpoint(server: ViteDevServer, route: string, handler: EndpointHandler): void {
  server.middlewares.use(route, async (req: IncomingMessage, res: ServerResponse) => {
    if (!isSameOrigin(req)) {
      sendJson(res, 403, { error: 'Forbidden: cross-origin request' });
      return;
    }
    try {
      await handler(req, res, new URL(req.url ?? '', `http://${req.headers.host}`));
    } catch {
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal error' });
    }
  });
}

type AssetKind = 'js' | 'css';

const ASSET_CONTENT_TYPES: Record<AssetKind, string> = {
  js: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
};

/** Same-origin guarded dev endpoint that serves a JS or CSS asset. */
function registerStaticAsset(
  server: ViteDevServer,
  route: string,
  kind: AssetKind,
  body: string | (() => string),
): void {
  server.middlewares.use(route, (req: IncomingMessage, res: ServerResponse) => {
    if (!isSameOrigin(req)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', ASSET_CONTENT_TYPES[kind]);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(typeof body === 'function' ? body() : body);
  });
}

const isInside = (root: string, file: string): boolean =>
  file === root || file.startsWith(root + path.sep);

/** Resolve a file reference from the browser (fs path, URL or root-relative path) inside the project root. */
function resolveProjectFile(root: string, input: string): string | null {
  const cleaned = input.replace(/^vite:/, '').replace(/\0/g, '').replace(/\?.*$/, '');
  const pathname = /^https?:\/\//.test(cleaned) ? new URL(cleaned).pathname : cleaned;
  const candidates = path.isAbsolute(pathname)
    ? [pathname, path.join(root, pathname)]
    : [path.join(root, pathname)];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (isInside(root, resolved) && fs.existsSync(resolved)) return resolved;
  }
  return null;
}

// ─── Fonts ─────────────────────────────────────────────────────────────────

function findFontCss(pkg: string, root: string): string | null {
  const resolvers = [createRequire(path.join(root, 'package.json')), createRequire(import.meta.url)];
  for (const resolver of resolvers) {
    try {
      return resolver.resolve(`${pkg}/index.css`);
    } catch {
      // try the next resolver
    }
  }
  const fallback = path.join(root, 'node_modules', ...pkg.split('/'), 'index.css');
  return fs.existsSync(fallback) ? fallback : null;
}

function fontPlugin(): Plugin {
  const fonts = new Map<string, { css: string; dir: string }>();
  let combinedCss = '';
  let apiBase = '';

  return {
    name: 'bini-overlay:font',
    apply: 'serve',

    configResolved(config) {
      apiBase = apiBaseOf(config);
      const base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      for (const [key, pkg] of Object.entries(FONT_PACKAGES)) {
        const cssPath = findFontCss(pkg, config.root);
        if (!cssPath) continue;
        try {
          const css = fs.readFileSync(cssPath, 'utf8').replace(
            /url\(\s*(['"]?)\.\/files\/([^'")\s]+)\1\s*\)/g,
            (_match, quote: string, file: string) => `url(${quote}${base}__bini_font/${key}/${file}${quote})`,
          );
          fonts.set(key, { css, dir: path.join(path.dirname(cssPath), 'files') });
        } catch {
          // font is optional; the system stack is used instead
        }
      }
      combinedCss = [...fonts.values()].map((font) => font.css).join('\n');
    },

    configureServer(server) {
      registerStaticAsset(server, FONT_CSS_PATH, 'css', () => combinedCss);

      server.middlewares.use(FONT_FILE_PREFIX, (req: IncomingMessage, res: ServerResponse) => {
        const match = /^\/([a-z]+)\/([\w.-]+\.(?:woff2|woff))$/i.exec((req.url ?? '').split('?')[0] ?? '');
        const font = match?.[1] ? fonts.get(match[1]) : undefined;
        const file = font && match?.[2] ? path.join(font.dir, match[2]) : null;

        if (!font || !file || !file.startsWith(font.dir + path.sep) || !fs.existsSync(file)) {
          res.statusCode = 404;
          res.end();
          return;
        }

        res.setHeader('Content-Type', file.endsWith('.woff2') ? 'font/woff2' : 'font/woff');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        fs.createReadStream(file).pipe(res);
      });
    },

    transformIndexHtml() {
      if (!combinedCss) return [];
      return [
        {
          tag: 'link',
          attrs: { rel: 'stylesheet', href: `${apiBase}${FONT_CSS_PATH}`, 'data-bini-font': 'inter-geist' },
          injectTo: 'head-prepend',
        } as HtmlTagDescriptor,
      ];
    },
  };
}

// ─── Dev endpoints (code context, sourcemap, open editor, routes) ──────────

const LINE_CACHE_MAX = 64;
const lineCache = new Map<string, { mtimeMs: number; lines: string[] }>();

function readLines(file: string): string[] {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(file).mtimeMs;
  } catch {
    return [];
  }

  const hit = lineCache.get(file);
  if (hit && hit.mtimeMs === mtimeMs) return hit.lines;

  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lineCache.delete(file);
  if (lineCache.size >= LINE_CACHE_MAX) {
    const oldest = lineCache.keys().next().value;
    if (oldest !== undefined) lineCache.delete(oldest);
  }
  lineCache.set(file, { mtimeMs, lines });
  return lines;
}

function registerCodeContext(server: ViteDevServer, root: string): void {
  useEndpoint(server, '/__bini_code_context', (_req, res, url) => {
    const file = url.searchParams.get('file');
    const line = Number.parseInt(url.searchParams.get('line') ?? '', 10);
    if (!file || !Number.isFinite(line) || line < 1) {
      sendJson(res, 400, { lines: [] });
      return;
    }

    const resolved = resolveProjectFile(root, file);
    if (!resolved) {
      sendJson(res, 404, { lines: [] });
      return;
    }

    const lines = readLines(resolved);
    const start = Math.max(0, line - 3);
    const end = Math.min(lines.length, line + 2);
    sendJson(res, 200, {
      lines: lines
        .slice(start, end)
        .map((text, i) => `${start + i + 1 === line ? '>>> ' : '    '}${start + i + 1}: ${text}`),
    });
  });
}

interface TraceMapping {
  TraceMap: new (map: unknown) => unknown;
  originalPositionFor(
    map: unknown,
    position: { line: number; column: number },
  ): { source: string | null; line: number | null; column: number | null };
}

function registerSourcemap(server: ViteDevServer, root: string): void {
  let trace: TraceMapping | null | undefined;

  useEndpoint(server, '/__bini_sourcemap', async (_req, res, url) => {
    const file = url.searchParams.get('file');
    const line = Number.parseInt(url.searchParams.get('line') ?? '', 10);
    const column = Number.parseInt(url.searchParams.get('column') ?? '0', 10) || 0;
    if (!file || !Number.isFinite(line) || line < 1) {
      sendJson(res, 400, { error: 'invalid file or line' });
      return;
    }

    const base = server.config.base;
    const rooted = file.startsWith('/') ? file : `/${file}`;
    const candidates = [rooted];
    if (base !== '/' && !file.startsWith(base)) candidates.push(base.replace(/\/$/, '') + rooted);

    const graph = server.environments.client.moduleGraph;
    let mod = null;
    for (const candidate of candidates) {
      mod = await graph.getModuleByUrl(candidate);
      if (mod) break;
    }

    let map: unknown = mod?.transformResult?.map;
    if (typeof map === 'string') {
      try {
        map = JSON.parse(map);
      } catch {
        map = null;
      }
    }
    if (!mod || !map || !(map as { mappings?: string }).mappings) {
      sendJson(res, 404, { error: 'no sourcemap' });
      return;
    }

    if (trace === undefined) {
      trace = (await import('@jridgewell/trace-mapping').catch(() => null)) as TraceMapping | null;
    }
    if (!trace) {
      sendJson(res, 503, { error: 'trace-mapping unavailable' });
      return;
    }

    let position: ReturnType<TraceMapping['originalPositionFor']> | null = null;
    try {
      position = trace.originalPositionFor(new trace.TraceMap(map), {
        line,
        column: Math.max(0, column - 1),
      });
    } catch {
      position = null;
    }
    if (!position?.source) {
      sendJson(res, 404, { error: 'no mapping' });
      return;
    }

    let source = position.source.replace(/^\/+/, '').replace(/^(\.\.\/)+/, '');
    if (source.startsWith('src/') || source.startsWith('app/')) {
      source = `/${source}`;
    } else {
      const absolute = path.resolve(mod.file ? path.dirname(mod.file) : root, source);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      source = relative.startsWith('src/') || relative.startsWith('app/') ? `/${relative}` : relative;
    }

    sendJson(res, 200, {
      file: source,
      line: position.line ?? line,
      column: (position.column ?? column - 1) + 1,
    });
  });
}

type LaunchEditor = (file: string, onError?: (fileName: string, message: string | null) => void) => void;

let launchEditorPromise: Promise<LaunchEditor | null> | undefined;

function loadLaunchEditor(): Promise<LaunchEditor | null> {
  if (!launchEditorPromise) {
    launchEditorPromise = import('launch-editor')
      .then((m: any) => (m.default ?? m) as LaunchEditor)
      .catch(() => null);
  }
  return launchEditorPromise;
}

function registerOpenEditor(server: ViteDevServer, root: string): void {
  useEndpoint(server, '/__bini_open_editor', async (_req, res, url) => {
    const file = url.searchParams.get('file');
    if (!file) {
      sendJson(res, 400, { error: 'Missing file parameter' });
      return;
    }

    const resolved = resolveProjectFile(root, file);
    if (!resolved) {
      sendJson(res, 404, { error: 'File not found' });
      return;
    }

    const editor = await loadLaunchEditor();
    if (!editor) {
      sendJson(res, 503, { error: 'launch-editor is not installed', hint: 'Run: npm i launch-editor' });
      return;
    }

    const line = Math.max(1, Number.parseInt(url.searchParams.get('line') ?? '', 10) || 1);
    const column = Math.max(1, Number.parseInt(url.searchParams.get('column') ?? '', 10) || 1);
    editor(`${resolved}:${line}:${column}`, (_fileName, message) => {
      server.config.logger.warn(`[bini-overlay] Could not open your editor${message ? `: ${message}` : ''}.`);
    });

    res.statusCode = 204;
    res.end();
  });
}

/** Slot/intercept data added by newer bini-router versions; absent on older ones. */
interface RouteExtras {
  parallel?: Array<{ slotName: string; filePath: string }>;
  intercepts?: Array<{ from: string; level: 'same' | 'up' | 'root'; filePath: string; slotName: string | null }>;
}

function registerRoutes(server: ViteDevServer, root: string): void {
  const appDir = path.join(root, 'src/app');
  const base = server.config.base.replace(/\/$/, '');

  const MANIFEST_TTL_MS = 200;
  let routerModule: Promise<typeof import('bini-router')> | undefined;
  let manifest: RouteManifest | null = null;
  let manifestTime = 0;

  const loadRouter = () => (routerModule ??= import('bini-router'));
  loadRouter().catch(() => undefined);

  async function currentManifest(): Promise<RouteManifest> {
    const now = Date.now();
    if (!manifest || now - manifestTime >= MANIFEST_TTL_MS) {
      manifest = (await loadRouter()).generateRouteManifest(appDir);
      manifestTime = now;
    }
    return manifest;
  }

  function normalizePath(input: string): string {
    let p = input || '/';
    if (base && (p === base || p.startsWith(`${base}/`))) p = p.slice(base.length) || '/';
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return p || '/';
  }

  useEndpoint(server, '/__bini_route_match', async (_req, res, url) => {
    const pathname = normalizePath(url.searchParams.get('path') ?? '/');
    const result = (await loadRouter()).matchManifestRoute(await currentManifest(), pathname);
    sendJson(res, 200, { type: result.type, path: pathname, routePath: result.routePath });
  });

  useEndpoint(server, '/__bini_route_info', async (_req, res, url) => {
    const pathname = normalizePath(url.searchParams.get('path') ?? '/');
    const routes = await currentManifest();
    const result = (await loadRouter()).matchManifestRoute(routes, pathname);

    if (result.type === 'not_found' || !result.routePath) {
      sendJson(res, 200, {
        path: pathname,
        type: 'not_found',
        segments: [],
        layouts: [],
        pageFile: '',
        parallel: [],
        intercepts: [],
      });
      return;
    }

    const meta = routes.metadata[result.routePath] as (RouteManifestEntry & RouteExtras) | undefined;
    const segments = result.routePath
      .split('/')
      .filter(Boolean)
      .map((name, depth) => ({
        name,
        depth,
        kind: name.startsWith(':') ? 'dynamic' : name === '*' ? 'catch-all' : 'static',
      }));

    sendJson(res, 200, {
      path: result.routePath,
      type: result.type,
      segments,
      layouts: meta?.layouts ?? [],
      pageFile: meta?.filePath ?? '',
      parallel: meta?.parallel ?? [],
      intercepts: meta?.intercepts ?? [],
    });
  });
}

function apiPlugin(): Plugin {
  return {
    name: 'bini-overlay:api',
    apply: 'serve',

    configureServer(server) {
      const root = path.resolve(server.config.root);
      registerCodeContext(server, root);
      registerSourcemap(server, root);
      registerOpenEditor(server, root);
      registerRoutes(server, root);
    },
  };
}

// ─── Floating badge, menu, preferences, route info ─────────────────────────

const BADGE_CSS = `
:host { all: initial; display: block; font-family: ${FONT_SANS}; }

:host {
  --bini-bg: #0a0a0a;
  --bini-text: #e4e4e7;
  --bini-text-muted: #71717a;
  --bini-menu-value: #a1a1aa;
  --bini-menu-label: #ffffff;
  --bini-border: rgba(255,255,255,0.08);
  --bini-border-strong: rgba(255,255,255,0.18);
  --bini-hover: rgba(255,255,255,0.06);
  --bini-chip-bg: rgba(255,255,255,0.05);
  --bini-accent: #3b82f6;
  --bini-dropdown-bg: #111111;
  --bini-dropdown-border: rgba(255,255,255,0.1);
  --bini-dropdown-hover: rgba(255,255,255,0.08);
  --bini-badge-bg: #0a0a0a;
  --bini-badge-border: rgba(255,255,255,0.15);
  --bini-font-sans: ${FONT_SANS};
  --bini-font-geist: ${FONT_GEIST};
  --bini-font-mono: ${FONT_MONO};
}
:host([data-theme='light']) {
  --bini-bg: #ffffff;
  --bini-text: #18181b;
  --bini-text-muted: #6b7280;
  --bini-menu-value: #6b7280;
  --bini-menu-label: #18181b;
  --bini-border: rgba(0,0,0,0.08);
  --bini-border-strong: rgba(0,0,0,0.18);
  --bini-hover: rgba(0,0,0,0.04);
  --bini-chip-bg: rgba(0,0,0,0.04);
  --bini-accent: #2563eb;
  --bini-dropdown-bg: #ffffff;
  --bini-dropdown-border: rgba(0,0,0,0.1);
  --bini-dropdown-hover: rgba(0,0,0,0.04);
}

/* Badge */
#w {
  position: fixed;
  width: var(--bini-badge-size, 48px);
  height: var(--bini-badge-size, 48px);
  display: flex; align-items: center; justify-content: center;
  z-index: 2147483647;
  border-radius: 50%;
  background: var(--bini-badge-bg);
  border: 1px solid var(--bini-badge-border);
  pointer-events: auto; cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
}
#w.has-errors {
  box-sizing: border-box;
  width: auto;
  height: var(--bini-pill-h, 40px);
  border: none;
  border-radius: 999px;
  background: #cf3535;
  justify-content: flex-start;
}
.bf, .bs {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: var(--bini-logo-w, 20px);
  height: var(--bini-logo-h, 28px);
  transition: opacity 0.25s;
}
.bf { opacity: 1; }
.bs { opacity: 0; }
#w.loading .bf, #w.has-errors .bf, #w.has-errors .bs { opacity: 0; }
#w.loading .bs { opacity: 1; }
.bsp {
  fill: none; stroke: url(#sg); stroke-width: 1.4;
  stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 300; stroke-dashoffset: 300;
}
#w.loading .bsp { animation: draw 1.3s ease-out 0.1s forwards; }
@keyframes draw { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }

/* Error pill */
.ep {
  display: none; align-items: center;
  width: 100%; height: 100%;
  opacity: 0; transition: opacity 0.2s;
}
#w.has-errors .ep { display: flex; opacity: 1; }
.ep-icon {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  width: var(--bini-pill-h, 40px); height: var(--bini-pill-h, 40px); min-width: var(--bini-pill-h, 40px);
  border-radius: 50%;
  background: rgba(255,255,255,0.14);
  cursor: pointer;
  transition: background 0.15s;
}
.ep-icon:hover { background: rgba(255,255,255,0.24); }
.ep-icon svg { display: block; width: var(--bini-icon-logo-w, 16px); height: var(--bini-icon-logo-h, 22px); }
.ep-content {
  position: relative; z-index: 1;
  display: flex; align-items: center; gap: 5px;
  flex-shrink: 0;
  height: calc(100% - 8px);
  margin-right: 4px;
  padding: 0 calc(var(--bini-pill-pad, 16px) - 4px) 0 8px;
  border-radius: 999px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s;
}
.ep-content:hover { background: rgba(255,255,255,0.16); }
.ep-count, .ep-label {
  font-family: var(--bini-font-geist);
  font-size: var(--bini-label-size, 15px);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
  color: #ffffff;
}

/* Menu and popovers */
#bini-menu {
  position: fixed;
  display: none;
  min-width: 280px;
  padding: 6px;
  overflow: hidden;
  z-index: 2147483647;
  background: var(--bini-bg);
  border: 1px solid var(--bini-border-strong);
  border-radius: 12px;
  font-family: var(--bini-font-sans);
}
#bini-menu.show { display: block; }

.bini-menu-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 4px;
  padding: 10px 12px 12px;
  border-bottom: 1px solid var(--bini-border);
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  transition: background 0.15s;
}
.bini-menu-header:hover { background: var(--bini-hover); }
.bini-menu-header .bini-menu-label { color: var(--bini-text); font-size: 15px; font-weight: 600; }
.bini-issue-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px 3px 6px;
  background: rgba(220,38,38,0.15);
  border: 1px solid rgba(220,38,38,0.3);
  border-radius: 999px;
}
.bini-issue-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; }
.bini-issue-count { color: var(--bini-text); font-size: 13px; font-weight: 600; line-height: 1; }

.bini-menu-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: default;
  transition: background 0.15s;
}
.bini-menu-item:hover { background: var(--bini-hover); }
.bini-menu-item-clickable { cursor: pointer; }
.bini-menu-label { color: var(--bini-menu-label); font-size: 13px; font-weight: 400; }
.bini-menu-value { display: flex; align-items: center; gap: 6px; color: var(--bini-menu-value); font-size: 13px; font-weight: 400; }
.bini-menu-value-icon { display: inline-flex; align-items: center; color: var(--bini-menu-value); }
.bini-menu-divider { height: 1px; margin: 4px 0; background: var(--bini-border); }

.bini-popover {
  position: fixed;
  display: none;
  box-sizing: border-box;
  min-width: 280px;
  width: min(360px, calc(100vw - 40px));
  max-width: min(360px, calc(100vw - 40px));
  max-height: 80vh;
  padding: 6px;
  overflow-x: hidden; overflow-y: auto;
  z-index: 2147483647;
  background: var(--bini-bg);
  border: 1px solid var(--bini-border-strong);
  border-radius: 12px;
  font-family: var(--bini-font-sans);
}
.bini-popover.show { display: block; }
.bini-popover-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 6px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--bini-border-strong);
}
.bini-popover-title { color: var(--bini-text); font-size: 14px; font-weight: 600; }
.bini-popover-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  background: none; border: none; border-radius: 6px;
  color: var(--bini-text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.bini-popover-close:hover { background: var(--bini-hover); color: var(--bini-text); }

.bini-pref-row-popover {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
}
.bini-pref-row-popover:hover { background: var(--bini-hover); }
.bini-pref-info-popover { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.bini-pref-label-popover { color: var(--bini-text); font-size: 13px; font-weight: 500; }
.bini-pref-desc-popover { color: var(--bini-text-muted); font-size: 11px; line-height: 1.3; }

.bini-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  background: var(--bini-chip-bg);
  color: var(--bini-text);
  border: 1px solid var(--bini-border-strong);
  border-radius: 8px;
  font-family: inherit; font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.bini-btn:hover { background: var(--bini-hover); }
.bini-btn-recording { border-color: #ef4444; color: #ef4444; }

/* Route info */
.bini-route-path-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--bini-border);
}
.bini-route-path-icon { display: inline-flex; color: var(--bini-text-muted); }
.bini-route-path { color: var(--bini-text); font-family: var(--bini-font-mono); font-size: 14px; font-weight: 500; }
.bini-segment-tree { padding: 8px 0; overflow-x: hidden; }
.bini-segment-row {
  display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px;
  min-width: 0;
  padding: 8px 20px;
}
.bini-segment-name {
  flex-shrink: 1; min-width: 0; max-width: 100%;
  color: var(--bini-text);
  font-family: var(--bini-font-sans); font-size: 13px; font-weight: 500;
  word-break: break-all;
}
.bini-segment-spacer { flex: 1 1 8px; min-width: 8px; }
.bini-segment-chips {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px;
  min-width: 0; max-width: 100%;
}
.bini-chip {
  display: inline-flex; align-items: center;
  max-width: 100%;
  padding: 3px 10px;
  background: var(--bini-chip-bg);
  border: 1px solid var(--bini-border);
  border-radius: 6px;
  color: var(--bini-text);
  font-family: var(--bini-font-sans); font-size: 11px;
  white-space: normal; word-break: break-all;
}

/* Dropdown */
.bini-dropdown { position: relative; display: inline-block; }
.bini-dropdown-toggle {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  min-width: 90px;
  padding: 5px 10px;
  background: var(--bini-dropdown-bg);
  color: var(--bini-text);
  border: 1px solid var(--bini-dropdown-border);
  border-radius: 6px;
  font-family: inherit; font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.bini-dropdown-toggle:hover { border-color: var(--bini-text-muted); }
.bini-dropdown-menu {
  position: absolute; top: 100%; right: 0;
  display: none;
  min-width: 100%;
  margin-top: 4px; padding: 4px;
  overflow: hidden;
  z-index: 2147483647;
  background: var(--bini-dropdown-bg);
  border: 1px solid var(--bini-dropdown-border);
  border-radius: 8px;
}
.bini-dropdown-menu.show { display: block; }
.bini-dropdown-item {
  display: flex; align-items: center;
  padding: 6px 10px;
  border-radius: 4px;
  color: var(--bini-text);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.1s;
}
.bini-dropdown-item:hover { background: var(--bini-dropdown-hover); }
.bini-dropdown-item.selected { color: var(--bini-accent); }
`;

const GRADIENT_STOPS = '<stop stop-color="#00CFFF"/><stop offset="1" stop-color="#0077FF"/>';

const logoSvg = (className: string, gradientId: string, shape: string): string =>
  `<svg class="${className}" viewBox="0 0 22 31" fill="none" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="${gradientId}" x1="9.96" y1="-12.92" x2="9.96" y2="40.08" gradientUnits="userSpaceOnUse">${GRADIENT_STOPS}</linearGradient></defs>${shape}</svg>`;

const BADGE_HTML =
  logoSvg('bf', 'fg', `<path fill="url(#fg)" d="${BINI_PATH}"/>`) +
  logoSvg('bs', 'sg', `<path class="bsp" d="${BINI_PATH}"/>`) +
  `<div class="ep"><span class="ep-icon" id="bini-err-icon"><svg viewBox="0 0 22 31" fill="none" preserveAspectRatio="xMidYMid meet"><path fill="#fff" d="${BINI_PATH}"/></svg></span><div class="ep-content" id="bini-err-open"><span class="ep-count" id="bini-err-count">0</span><span class="ep-label" id="bini-err-label">Issues</span></div></div>`;

const MENU_HTML = `
<div class="bini-menu-header" id="bini-menu-issues" style="display:none">
  <span class="bini-menu-label">Issues</span>
  <span class="bini-issue-badge"><span class="bini-issue-dot"></span><span class="bini-issue-count" id="bini-menu-issue-count">0</span></span>
</div>
<div class="bini-menu-item"><span class="bini-menu-label">Route</span><span class="bini-menu-value" id="bini-route-type">Static</span></div>
<div class="bini-menu-item"><span class="bini-menu-label">Bundler</span><span class="bini-menu-value">Rolldown</span></div>
<div class="bini-menu-item bini-menu-item-clickable" id="bini-route-info"><span class="bini-menu-label">Route Info</span><span class="bini-menu-value"><span class="bini-menu-value-icon">${ICONS.chevronRight}</span></span></div>
<div class="bini-menu-divider"></div>
<div class="bini-menu-item bini-menu-item-clickable" id="bini-menu-prefs"><span class="bini-menu-label">Preferences</span><span class="bini-menu-value"><span class="bini-menu-value-icon">${ICONS.gear}</span></span></div>`;

const dropdownHtml = (id: string, options: ReadonlyArray<readonly [value: string, label: string]>): string =>
  `<div class="bini-dropdown" id="${id}"><button class="bini-dropdown-toggle" type="button"></button><div class="bini-dropdown-menu">${options
    .map(([value, label]) => `<div class="bini-dropdown-item" data-value="${value}">${label}</div>`)
    .join('')}</div></div>`;

const prefRow = (label: string, description: string, control: string): string =>
  `<div class="bini-pref-row-popover"><div class="bini-pref-info-popover"><span class="bini-pref-label-popover">${label}</span><span class="bini-pref-desc-popover">${description}</span></div><div class="bini-pref-control">${control}</div></div>`;

const PREFS_HTML =
  `<div class="bini-popover-header"><span class="bini-popover-title">Preferences</span><button class="bini-popover-close" id="bini-prefs-close" type="button">${ICONS.close}</button></div>` +
  prefRow(
    'Theme',
    'Select your theme preference.',
    dropdownHtml('dd-theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]),
  ) +
  prefRow(
    'Position',
    'Adjust the placement of your dev tools.',
    dropdownHtml('dd-position', [
      ['bottom-left', 'Bottom Left'],
      ['bottom-right', 'Bottom Right'],
      ['top-left', 'Top Left'],
      ['top-right', 'Top Right'],
    ]),
  ) +
  prefRow(
    'Size',
    'Adjust the size of your dev tools.',
    dropdownHtml('dd-size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]),
  ) +
  prefRow(
    'Hide for this session',
    'Hide Dev Tools until you restart or close the tab.',
    `<button class="bini-btn" id="bini-pref-hide" type="button">${ICONS.eyeOff} Hide</button>`,
  ) +
  prefRow(
    'Shortcut',
    'Toggle visibility.',
    '<button class="bini-btn" id="bini-pref-shortcut" type="button"><span id="bini-pref-shortcut-label">Record Shortcut</span></button>',
  );

const ROUTE_HTML =
  `<div class="bini-popover-header"><span class="bini-popover-title">Route Info</span><button class="bini-popover-close" id="bini-route-close" type="button">${ICONS.close}</button></div>` +
  `<div class="bini-route-path-row"><span class="bini-route-path-icon">${ICONS.routeArrow}</span><span class="bini-route-path" id="bini-route-path">/</span></div>` +
  '<div class="bini-segment-tree" id="bini-segment-tree"></div>';

function badgeScript(apiBase: string): string {
  return String.raw`
(() => {
  if (document.getElementById('bini-loading-root')) return;

  const API_BASE = ${json(apiBase)};
  const PREFS_KEY = ${json(PREFS_KEY)};
  const HIDE_KEY = 'bini-overlay:hide-session';
  const CSS = ${json(BADGE_CSS)};
  const HTML = ${json({ menu: MENU_HTML, badge: BADGE_HTML, prefs: PREFS_HTML, route: ROUTE_HTML })};
  const CHEVRON_DOWN = ${json(ICONS.chevronDown)};

  const DEFAULT_PREFS = { theme: 'system', position: 'bottom-left', size: 'medium', shortcut: 'Alt+B' };
  const POSITIONS = {
    'top-left': { top: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' },
  };
  const SIZES = {
    small: { pill: 36, logoW: 14, logoH: 19, circle: 28, label: 12, pad: 12 },
    medium: { pill: 48, logoW: 20, logoH: 28, circle: 40, label: 15, pad: 16 },
    large: { pill: 56, logoW: 24, logoH: 33, circle: 46, label: 17, pad: 20 },
  };

  // ── Preferences ──
  const prefs = { ...DEFAULT_PREFS };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(prefs)) if (saved[key]) prefs[key] = saved[key];
    }
  } catch (_e) {}
  const savePrefs = () => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_e) {}
  };

  // ── DOM ──
  const container = document.createElement('div');
  container.id = 'bini-loading-root';
  document.body.appendChild(container);
  const sr = container.attachShadow({ mode: 'open' });
  const $ = (id) => sr.getElementById(id);

  const make = (tag, props, html) => {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.innerHTML = html;
    return node;
  };
  const style = make('style', {}, '');
  style.textContent = CSS;
  const menu = make('div', { id: 'bini-menu' }, HTML.menu);
  menu.setAttribute('role', 'menu');
  const badge = make('div', { id: 'w', className: 'loading' }, HTML.badge);
  const prefsPopover = make('div', { id: 'bini-prefs-popover', className: 'bini-popover' }, HTML.prefs);
  const routePopover = make('div', { id: 'bini-route-popover', className: 'bini-popover' }, HTML.route);
  sr.append(style, menu, badge, prefsPopover, routePopover);

  // ── Theme, layout, visibility ──
  const lightQuery = window.matchMedia('(prefers-color-scheme: light)');
  const applyTheme = () => {
    const theme = prefs.theme === 'system' ? (lightQuery.matches ? 'light' : 'dark') : prefs.theme;
    container.setAttribute('data-theme', theme);
    window.dispatchEvent(new CustomEvent('__bini_theme__', { detail: theme }));
  };
  lightQuery.addEventListener('change', () => { if (prefs.theme === 'system') applyTheme(); });

  const applyLayout = () => {
    const position = POSITIONS[prefs.position] || POSITIONS['bottom-left'];
    const size = SIZES[prefs.size] || SIZES.medium;
    for (const side of ['top', 'bottom', 'left', 'right']) badge.style[side] = position[side] || '';

    const iconH = Math.round(size.circle * 0.5);
    const vars = {
      '--bini-badge-size': size.pill + 'px',
      '--bini-logo-w': size.logoW + 'px',
      '--bini-logo-h': size.logoH + 'px',
      '--bini-icon-logo-w': Math.round((iconH * 22) / 31) + 'px',
      '--bini-icon-logo-h': iconH + 'px',
      '--bini-pill-h': size.circle + 'px',
      '--bini-pill-pad': size.pad + 'px',
      '--bini-label-size': size.label + 'px',
    };
    for (const name of Object.keys(vars)) badge.style.setProperty(name, vars[name]);

    const offset = 20 + size.pill + 12 + 'px';
    const top = prefs.position.indexOf('top') === 0;
    const right = prefs.position.slice(-5) === 'right';
    for (const node of [menu, prefsPopover, routePopover]) {
      node.style.top = top ? offset : '';
      node.style.bottom = top ? '' : offset;
      node.style.left = right ? '' : '20px';
      node.style.right = right ? '20px' : '';
    }
  };

  let hidden = false;
  try { hidden = sessionStorage.getItem(HIDE_KEY) === '1'; } catch (_e) {}
  const setHidden = (value) => {
    hidden = value;
    try {
      if (value) sessionStorage.setItem(HIDE_KEY, '1');
      else sessionStorage.removeItem(HIDE_KEY);
    } catch (_e) {}
    container.style.display = hidden ? 'none' : 'block';
  };

  applyTheme();
  applyLayout();
  setHidden(hidden);

  // ── Shortcut ──
  const parseShortcut = (text) => {
    const result = { alt: false, ctrl: false, meta: false, shift: false, key: null };
    for (const part of String(text || '').split('+').map((p) => p.trim())) {
      const lower = part.toLowerCase();
      if (lower === 'alt') result.alt = true;
      else if (lower === 'ctrl' || lower === 'control') result.ctrl = true;
      else if (lower === 'meta' || lower === 'cmd' || lower === 'command') result.meta = true;
      else if (lower === 'shift') result.shift = true;
      else result.key = part.toUpperCase();
    }
    return result;
  };
  const matchesShortcut = (event, shortcut) => {
    const s = parseShortcut(shortcut);
    return !!s.key && event.key.toUpperCase() === s.key && event.altKey === s.alt &&
      event.ctrlKey === s.ctrl && event.metaKey === s.meta && event.shiftKey === s.shift;
  };
  document.addEventListener('keydown', (event) => {
    if (!matchesShortcut(event, prefs.shortcut)) return;
    event.preventDefault();
    setHidden(!hidden);
  }, true);

  // ── Error count (called by the error overlay) ──
  window.__bini_set_error_count = (count) => {
    $('bini-err-count').textContent = count;
    $('bini-err-label').textContent = count === 1 ? 'Issue' : 'Issues';
    $('bini-menu-issue-count').textContent = count;
    $('bini-menu-issues').style.display = count > 0 ? 'flex' : 'none';
    badge.classList.toggle('has-errors', count > 0);
    if (count > 0) badge.classList.remove('loading');
  };
  window.__bini_set_error_count(0);

  // ── Logo animation ──
  const stroke = badge.querySelector('.bsp');
  let animDone = false;
  let ready = false;
  let timer = null;

  const idle = () => {
    clearTimeout(timer);
    timer = null;
    if (!badge.classList.contains('has-errors')) badge.classList.remove('loading');
  };
  const loop = () => {
    if (ready) return;
    animDone = false;
    stroke.style.animation = 'none';
    stroke.getBoundingClientRect();
    stroke.style.strokeDashoffset = '300';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      stroke.style.animation = '';
      if (!badge.classList.contains('has-errors')) badge.classList.add('loading');
    }));
    timer = setTimeout(() => { if (!ready) loop(); }, 2000);
  };
  const start = () => {
    animDone = false;
    ready = false;
    loop();
    timer = setTimeout(() => { ready = true; if (animDone) idle(); }, 1800);
  };
  const onReady = () => {
    ready = true;
    clearTimeout(timer);
    timer = null;
    if (animDone) idle();
  };

  stroke.addEventListener('animationend', (event) => {
    if (event.animationName !== 'draw') return;
    animDone = true;
    clearTimeout(timer);
    timer = null;
    if (ready) idle(); else loop();
  });
  if (document.readyState === 'complete') onReady();
  else window.addEventListener('load', onReady, { once: true });

  // ── Menu and popovers ──
  const closeDropdowns = () => sr.querySelectorAll('.bini-dropdown-menu.show').forEach((m) => m.classList.remove('show'));
  const closeAll = () => {
    for (const node of [menu, prefsPopover, routePopover]) node.classList.remove('show');
    closeDropdowns();
  };
  const toggleOnly = (node, onOpen) => {
    const wasOpen = node.classList.contains('show');
    closeAll();
    if (!wasOpen) {
      node.classList.add('show');
      if (onOpen) onOpen();
    }
  };
  const showOverlay = () => {
    closeAll();
    if (typeof window.__bini_show_overlay === 'function') window.__bini_show_overlay();
  };
  const on = (id, handler) => $(id).addEventListener('click', (event) => {
    event.stopPropagation();
    handler(event);
  });

  document.addEventListener('click', (event) => {
    const path = event.composedPath();
    if (![menu, badge, prefsPopover, routePopover].some((node) => path.includes(node))) closeAll();
  });
  prefsPopover.addEventListener('click', closeDropdowns);

  badge.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!badge.classList.contains('has-errors')) toggleOnly(menu);
  });
  on('bini-err-icon', () => toggleOnly(menu));
  on('bini-err-open', () => { if (badge.classList.contains('has-errors')) showOverlay(); });
  on('bini-menu-issues', showOverlay);
  on('bini-route-info', () => toggleOnly(routePopover, openRouteInfo));
  on('bini-menu-prefs', () => toggleOnly(prefsPopover));
  on('bini-prefs-close', closeAll);
  on('bini-route-close', closeAll);
  on('bini-pref-hide', () => { setHidden(true); closeAll(); });

  // ── Preference controls ──
  const setupDropdown = (id, current, onChange) => {
    const dropdown = $(id);
    const toggle = dropdown.querySelector('.bini-dropdown-toggle');
    const list = dropdown.querySelector('.bini-dropdown-menu');
    const items = dropdown.querySelectorAll('.bini-dropdown-item');

    const display = (value) => {
      const item = dropdown.querySelector('.bini-dropdown-item[data-value="' + value + '"]');
      if (!item) return;
      toggle.innerHTML = item.textContent + ' <span class="bini-dropdown-chevron">' + CHEVRON_DOWN + '</span>';
      items.forEach((it) => it.classList.toggle('selected', it.dataset.value === value));
    };

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const wasOpen = list.classList.contains('show');
      closeDropdowns();
      if (!wasOpen) list.classList.add('show');
    });
    items.forEach((item) => item.addEventListener('click', (event) => {
      event.stopPropagation();
      display(item.dataset.value);
      list.classList.remove('show');
      onChange(item.dataset.value);
    }));
    display(current);
  };

  setupDropdown('dd-theme', prefs.theme, (value) => { prefs.theme = value; savePrefs(); applyTheme(); });
  setupDropdown('dd-position', prefs.position, (value) => { prefs.position = value; savePrefs(); applyLayout(); });
  setupDropdown('dd-size', prefs.size, (value) => { prefs.size = value; savePrefs(); applyLayout(); });

  const shortcutButton = $('bini-pref-shortcut');
  const shortcutLabel = $('bini-pref-shortcut-label');
  shortcutLabel.textContent = prefs.shortcut || 'Record Shortcut';

  let recording = false;
  const stopRecording = () => {
    recording = false;
    shortcutButton.classList.remove('bini-btn-recording');
    shortcutLabel.textContent = prefs.shortcut || 'Record Shortcut';
    document.removeEventListener('keydown', recordKey, true);
  };
  function recordKey(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') return stopRecording();
    if (['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) return;

    const parts = [];
    if (event.altKey) parts.push('Alt');
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.metaKey) parts.push('Meta');
    if (event.shiftKey) parts.push('Shift');
    parts.push(event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key);
    prefs.shortcut = parts.join('+');
    savePrefs();
    stopRecording();
  }
  on('bini-pref-shortcut', () => {
    if (recording) return stopRecording();
    recording = true;
    shortcutButton.classList.add('bini-btn-recording');
    shortcutLabel.textContent = 'Press keys...';
    document.addEventListener('keydown', recordKey, true);
  });

  // ── Navigation tracking (intercepts only show after client navigation) ──
  const normalizePath = (value) => (value ? value.replace(/\/+$/, '') || '/' : '/');
  const nav = { prev: null, cur: null };
  const trackNav = () => {
    const current = normalizePath(location.pathname);
    if (nav.cur !== current) {
      nav.prev = nav.cur;
      nav.cur = current;
    }
  };

  // ── Route type in the menu ──
  let matchAbort = null;
  const ROUTE_TYPES = {
    dynamic: ['Dynamic', '#fbbf24'],
    static: ['Static', '#10b981'],
    not_found: ['Not Found', '#ef4444'],
  };
  const updateMenuInfo = () => {
    const label = $('bini-route-type');
    if (matchAbort) matchAbort.abort();
    matchAbort = new AbortController();
    fetch(API_BASE + '/__bini_route_match?path=' + encodeURIComponent(normalizePath(location.pathname)), { signal: matchAbort.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const entry = data && (ROUTE_TYPES[data.type] || ROUTE_TYPES.not_found);
        if (!entry) return;
        label.textContent = entry[0];
        label.style.color = entry[1];
      })
      .catch(() => {});
  };

  // ── Route info popover ──
  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fileBase = (p) => (p ? String(p).replace(/\\/g, '/').split('/').pop() || p : '');
  const lastSegment = (p) => String(p || '').split('/').filter(Boolean).pop() || '';
  const isInterceptFolder = (name) => /^\(\.{1,3}\)/.test(name);

  function interceptFileLabel(filePath) {
    const parts = String(filePath || '').replace(/\\/g, '/').split('/').filter(Boolean);
    const index = parts.findIndex(isInterceptFolder);
    if (index === -1) return fileBase(filePath);
    const folder = parts[index];
    const rest = parts.slice(index + 1);
    if (!rest.length || /\.(tsx?|jsx?|mdx?)$/i.test(folder)) return folder;
    return folder + '/' + rest.join('/');
  }

  function pathsMatch(pattern, pathname) {
    if (!pattern || !pathname) return false;
    const a = normalizePath(pattern).split('/').filter(Boolean);
    const b = normalizePath(pathname).split('/').filter(Boolean);
    return a.length === b.length && a.every((part, i) => part.charAt(0) === ':' || part === b[i]);
  }

  const notFoundHtml = (currentPath) =>
    '<div style="padding:12px 20px;color:var(--bini-text-muted);font-size:12px;line-height:1.6;">No matching route for ' +
    '<code style="font-family:var(--bini-font-mono);color:#f87171;background:rgba(248,113,113,0.1);padding:1px 5px;border-radius:3px;">' +
    escapeHtml(currentPath) + '</code><br><span style="opacity:0.7;margin-top:4px;display:inline-block;">This URL renders your 404 page.</span></div>';

  const rowHtml = (name, depth, chips) => {
    const chipHtml = chips.filter(Boolean).map((chip) => '<span class="bini-chip">' + escapeHtml(chip) + '</span>').join('');
    return '<div class="bini-segment-row" style="padding-left:' + (20 + (depth || 0) * 20) + 'px;">' +
      '<span class="bini-segment-name">' + escapeHtml(name) + '</span><span class="bini-segment-spacer"></span>' +
      (chipHtml ? '<div class="bini-segment-chips">' + chipHtml + '</div>' : '') + '</div>';
  };

  function renderSegmentTree(data, currentPath) {
    if (!data || data.type === 'not_found') return notFoundHtml(currentPath);

    const matched = data.path || currentPath || '/';
    const isRoot = matched === '/';
    const segments = data.segments || [];

    // An intercept is active only when the previous route is its source.
    const active = nav.prev == null ? null : (data.intercepts || []).find((item) => item && pathsMatch(item.from, nav.prev));
    const pageChip = active ? interceptFileLabel(active.filePath) : data.pageFile ? fileBase(data.pageFile) : null;
    const slotChips = (data.parallel || []).filter((slot) => slot && slot.slotName).map((slot) => '@' + slot.slotName);

    let html = '';
    const appChips = (data.layouts || []).map(fileBase);
    if (isRoot) appChips.push(pageChip, ...slotChips);
    if (appChips.filter(Boolean).length) html += rowHtml('app', 0, appChips);

    segments.forEach((segment, index) => {
      const chips = [];
      if (segment.kind === 'dynamic' || segment.kind === 'catch-all') chips.push(segment.kind);
      if (index === segments.length - 1 && !isRoot) chips.push(pageChip, ...slotChips);
      html += rowHtml(segment.name, segment.depth != null ? segment.depth : index, chips);
    });

    if (!segments.length && !isRoot && !appChips.length) {
      html += rowHtml(lastSegment(matched) || matched, 0, [pageChip]);
    }
    return html || notFoundHtml(currentPath);
  }

  async function openRouteInfo() {
    const tree = $('bini-segment-tree');
    const currentPath = normalizePath(location.pathname);
    trackNav();
    $('bini-route-path').textContent = currentPath;
    tree.innerHTML = '<div style="padding:12px 20px;color:var(--bini-text-muted);font-size:12px;">Loading…</div>';

    try {
      const res = await fetch(API_BASE + '/__bini_route_info?path=' + encodeURIComponent(currentPath));
      const text = res.ok ? await res.text() : '';
      tree.innerHTML = text.charAt(0) === '{' ? renderSegmentTree(JSON.parse(text), currentPath) : notFoundHtml(currentPath);
    } catch (_e) {
      tree.innerHTML = notFoundHtml(currentPath);
    }
  }

  // ── Wire navigation + HMR ──
  trackNav();
  updateMenuInfo();
  const onNavigate = () => {
    trackNav();
    setTimeout(updateMenuInfo, 100);
  };
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      onNavigate();
      return result;
    };
  }
  window.addEventListener('popstate', onNavigate);

  if (hot) {
    hot.on('vite:beforeUpdate', start);
    hot.on('vite:afterUpdate', () => {
      ready = true;
      if (animDone) idle();
      setTimeout(updateMenuInfo, 200);
    });
  }
})();
`.trim();
}

function badgePlugin(options: BiniOverlayOptions): Plugin {
  let apiBase = '';

  return {
    name: 'bini-overlay:badge',
    apply: 'serve',

    configResolved(config) {
      apiBase = apiBaseOf(config);
    },

    configureServer(server) {
      if (options.disableBadge) return;
      registerStaticAsset(
        server,
        BADGE_MODULE_PATH,
        'js',
        () => hotHeader(apiBase, BADGE_MODULE_PATH) + badgeScript(apiBase),
      );
    },

    transformIndexHtml: {
      order: 'post',
      handler: () =>
        options.disableBadge
          ? []
          : [
              {
                tag: 'script',
                attrs: { type: 'module', src: `${apiBase}${BADGE_MODULE_PATH}` },
                injectTo: 'body',
              } as HtmlTagDescriptor,
            ],
    },
  };
}

// ─── Error overlay ─────────────────────────────────────────────────────────

/**
 * Tab "wing": one cubic S-curve with horizontal tangents at both ends, so it
 * meets the tab's top border and the panel's top border without a kink.
 */
const WING_SVG =
  '<svg class="bini-wing" viewBox="0 0 40 50" aria-hidden="true"><path class="bini-wing-fill" d="M0 0C20 0 20 50 40 50H0Z"/><path class="bini-wing-line" d="M0 .5C20 .5 20 49.5 40 49.5"/></svg>';

const OVERLAY_CSS = `
#__bini_root, #__bini_root * { box-sizing: border-box; }

#__bini_root {
  --bini-font-sans: ${FONT_SANS};
  --bini-font-mono: ${FONT_MONO};
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
  --bini-backdrop: rgb(26,26,26);
  --bini-scroll-track: #050505;
  --bini-scroll-thumb: #3f3f46;
  --bini-scroll-thumb-hover: #52525b;
  --bini-root-scroll-thumb: #52525b;
  --bini-root-scroll-thumb-hover: #71717a;

  position: fixed; inset: 0; z-index: 2147483646;
  display: none; flex-direction: column; align-items: center;
  padding: 8vh 16px 0;
  overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
  background: var(--bini-backdrop);
  font-family: var(--bini-font-sans);
  scrollbar-width: thin;
  scrollbar-color: var(--bini-root-scroll-thumb) var(--bini-backdrop);
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
  --bini-backdrop: rgb(202,202,202);
  --bini-scroll-track: #f4f4f5;
  --bini-scroll-thumb: #d4d4d8;
  --bini-scroll-thumb-hover: #a1a1aa;
  --bini-root-scroll-thumb: #8f8f95;
  --bini-root-scroll-thumb-hover: #6b6b72;
}

/* Scrollbars */
#__bini_root::-webkit-scrollbar, #__bini_error_content::-webkit-scrollbar,
.bini-code-scroll::-webkit-scrollbar, .bini-component-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
#__bini_root::-webkit-scrollbar-track { background: var(--bini-backdrop); }
#__bini_root::-webkit-scrollbar-thumb { background: var(--bini-root-scroll-thumb); border: 2px solid var(--bini-backdrop); border-radius: 5px; }
#__bini_root::-webkit-scrollbar-thumb:hover { background: var(--bini-root-scroll-thumb-hover); }
#__bini_error_content::-webkit-scrollbar-track { background: var(--bini-panel); }
#__bini_error_content::-webkit-scrollbar-thumb { background: var(--bini-scroll-thumb); border: 2px solid var(--bini-panel); border-radius: 5px; }
#__bini_error_content::-webkit-scrollbar-thumb:hover { background: var(--bini-scroll-thumb-hover); }
.bini-code-scroll::-webkit-scrollbar-track, .bini-component-scroll::-webkit-scrollbar-track { background: var(--bini-scroll-track); }
.bini-code-scroll::-webkit-scrollbar-thumb, .bini-component-scroll::-webkit-scrollbar-thumb { background: var(--bini-scroll-thumb); border-radius: 5px; }
.bini-code-scroll::-webkit-scrollbar-thumb:hover { background: var(--bini-scroll-thumb-hover); }
.bini-code-scroll, .bini-component-scroll { scrollbar-width: thin; scrollbar-color: var(--bini-scroll-thumb) var(--bini-scroll-track); }

/* Layout */
.bini-wrap {
  position: relative; z-index: 2;
  display: flex; flex-direction: column; flex-shrink: 0;
  width: 100%; max-width: 860px;
  max-height: min(815px, calc(100vh - 16vh));
  margin: 0 auto 8vh;
}
.bini-topbar {
  position: relative; z-index: 3;
  display: flex; align-items: flex-end; justify-content: space-between;
  flex-shrink: 0;
}

/* Tabs and wings */
.bini-tab, .bini-tab-r {
  position: relative; isolation: isolate;
  display: flex; align-items: center; justify-content: center;
  height: 50px;
  margin-bottom: -1px;
  /* The tab merges into the panel, so the eye reads it as taller than its 48px interior and
     geometrically centered content looks high. --bini-tab-drop lowers the content of both tabs equally
     (geometric center = 0; the 1px bottom padding accounts for the panel border overlap). */
  --bini-tab-drop: 2px;
  padding-block: calc(var(--bini-tab-drop) * 2) 1px;
  background: var(--bini-panel);
  border-top: 1px solid var(--bini-border);
}
.bini-tab {
  gap: 12px;
  padding-inline: 16px 1px;
  border-left: 1px solid var(--bini-border);
  border-radius: 14px 0 0 0;
}
.bini-tab-r {
  --bini-pill-inset: 4px;
  padding-inline: var(--bini-pill-inset) 16px;
  border-right: 1px solid var(--bini-border);
  border-radius: 0 14px 0 0;
}
.bini-wing {
  position: absolute; top: -1px; left: calc(100% - 1px);
  width: 40px; height: 50px;
  overflow: visible; pointer-events: none;
}
.bini-tab-r .bini-wing { left: auto; right: calc(100% - 1px); transform: scaleX(-1); }
.bini-wing-fill { fill: var(--bini-panel); }
.bini-wing-line { fill: none; stroke: var(--bini-border); stroke-width: 1; }

.bini-pager { display: flex; align-items: center; gap: 4px; }
.bini-nav-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: none; border: none; border-radius: 50%;
  color: var(--bini-text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.bini-nav-btn:hover { background: var(--bini-hover); color: var(--bini-strong); }
.bini-count {
  /* Same 14px line box as the pill text, centered in the 26px button row, so "1/1" and
     "Bini.js Rolldown" land on identical pixel rows. */
  display: inline-flex; align-items: center; justify-content: center;
  height: 26px; line-height: 14px;
  min-width: 34px;
  color: var(--bini-text);
  font-size: 13px; font-weight: 500;
}
.bini-count .bini-sep { margin: 0 2px; color: inherit; }

.bini-badge {
  display: flex; align-items: center; gap: 8px;
  height: 30px;
  padding: 0 13px;
  background: var(--bini-panel);
  border: 1px solid var(--bini-border-strong);
  border-radius: 999px;
  color: var(--bini-badge-text);
  font-size: 13px; font-weight: 500; line-height: 14px; white-space: nowrap;
}
.bini-badge-dot { width: 9px; height: 9px; border-radius: 50%; background: #4ade80; }
.bini-badge-grad {
  background: linear-gradient(90deg, #00cfff, #0077ff);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}

/* Panel */
.bini-panel {
  position: relative; z-index: 2;
  display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0;
  overflow: hidden;
  background: var(--bini-panel);
  color: var(--bini-text);
  border: 1px solid var(--bini-border);
  border-radius: 0 0 14px 14px;
}
.bini-head {
  display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  padding: 14px 24px 0;
}
.bini-chip-err {
  display: inline-flex; align-items: center;
  padding: 4px 10px;
  background: var(--bini-chip-err-bg);
  color: var(--bini-error);
  border-radius: 6px;
  font-family: var(--bini-font-mono); font-size: 11px; font-weight: 600; white-space: nowrap;
}
.bini-actions { display: flex; align-items: center; gap: 8px; }
.bini-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: transparent;
  color: var(--bini-text);
  border: 1px solid var(--bini-border-strong); border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.bini-icon-btn:hover { background: var(--bini-hover); color: var(--bini-strong); }
#__bini_close.bini-hidden { display: none !important; }

#__bini_error_content {
  flex: 1 1 auto; min-height: 0;
  padding: 18px 24px 8px;
  overflow-x: hidden !important; overflow-y: auto !important; overscroll-behavior: contain;
  scrollbar-width: thin; scrollbar-color: var(--bini-scroll-thumb) var(--bini-panel);
}

.bini-headline { margin: 0 0 14px; color: var(--bini-error); font-size: 16px; font-weight: 500; line-height: 1.45; word-break: break-word; }
.bini-details { color: var(--bini-text-muted); font-size: 13px; line-height: 1.65; word-break: break-word; }
.bini-details div { padding: 2px 0; }

/* Code frame */
.bini-code {
  margin-top: 22px;
  overflow: hidden;
  background: var(--bini-code-bg);
  border: 1px solid var(--bini-border-strong); border-radius: 8px;
}
.bini-code-head {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--bini-border);
  color: var(--bini-strong); font-size: 12px;
}
.bini-code-file { font-weight: 500; }
.bini-code-open {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; margin-left: auto; padding: 0;
  background: none; border: none; border-radius: 6px;
  color: var(--bini-text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.bini-code-open:hover { background: var(--bini-hover); color: var(--bini-strong); }
.bini-code-scroll { position: relative; display: block; max-height: 400px; padding: 12px 0 14px; overflow: auto !important; }
.bini-code-scroll pre { margin: 0 !important; padding: 0 !important; background: transparent !important; }
.bini-code-inner { display: inline-block; min-width: 100%; }
.bini-code-line { display: flex; padding: 1px 0; }
.bini-code-line.is-err, .bini-code-line.is-err-caret { background: var(--bini-err-line); }
.bini-code-mark, .bini-code-num, .bini-code-sep, .bini-code-text {
  font-family: var(--bini-font-mono); font-size: 12px; line-height: 1.55;
}
.bini-code-mark { flex-shrink: 0; min-width: 30px; padding: 0 6px 0 14px; color: transparent; font-weight: 700; text-align: right; user-select: none; }
.bini-code-line.is-err .bini-code-mark { color: var(--bini-err-mark); }
.bini-code-num { flex-shrink: 0; min-width: 22px; padding: 0 10px 0 0; color: var(--bini-text-dim); text-align: right; user-select: none; }
.bini-code-line.is-err .bini-code-num { color: var(--bini-strong); font-weight: 600; }
.bini-code-sep { flex-shrink: 0; padding: 0 16px 0 0; color: var(--bini-code-sep); user-select: none; }
.bini-code-text { flex: 1; padding: 0 16px 0 0; white-space: pre; }
.bini-code-caret { color: var(--bini-err-mark); }

/* Stacks */
.bini-stack { margin-top: 28px; }
.bini-stack-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.bini-stack-title { display: flex; align-items: center; gap: 10px; color: var(--bini-strong); font-size: 14px; font-weight: 500; }
.bini-stack-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 20px; padding: 0 7px;
  background: var(--bini-count-bg); color: var(--bini-text);
  border-radius: 999px;
  font-size: 11px; font-weight: 600;
}
.bini-fw-toggle {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 0;
  background: none; border: none;
  color: var(--bini-text-muted);
  font-family: inherit; font-size: 12px;
  cursor: pointer;
  transition: color 0.15s;
}
.bini-fw-toggle:hover { color: var(--bini-strong); }
.bini-frames { margin-top: 14px; }
.bini-frame {
  display: block; width: 100%;
  padding: 9px 0;
  background: none; border: none;
  color: inherit; font-family: inherit; text-align: left;
  cursor: pointer;
}
button.bini-frame:hover .bini-frame-fn { text-decoration: underline; text-underline-offset: 3px; }
.bini-frame-fn { display: block; color: var(--bini-strong); font-size: 13px; font-weight: 600; }
.bini-frame-loc { display: block; margin-top: 2px; color: var(--bini-text-dim); font-size: 12px; word-break: break-all; }
.bini-frame-fw { cursor: default; }
.bini-frame-fw .bini-frame-fn { color: var(--bini-text-muted); font-weight: 500; }
.bini-fw-frames { max-height: 0; overflow: hidden; opacity: 0; transition: max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s; }
.bini-fw-frames.open { max-height: 6000px; opacity: 1; }
.bini-empty { padding: 8px 0; color: var(--bini-text-dim); font-size: 13px; }
.bini-component-scroll {
  max-height: 200px; margin-top: 12px; padding: 12px 14px;
  overflow: auto !important;
  background: var(--bini-code-bg);
  border: 1px solid var(--bini-border-strong); border-radius: 8px;
}

/* Footer */
.bini-footer {
  display: flex; align-items: center; justify-content: flex-end; flex-shrink: 0; gap: 14px;
  padding: 14px 24px;
  border-top: 1px solid var(--bini-border);
}
.bini-footer-text { color: var(--bini-link); font-size: 13px; font-weight: 500; }
.bini-thumb {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; padding: 0;
  background: transparent; border: none; border-radius: 50%;
  color: var(--bini-text-muted);
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
@media (prefers-reduced-motion: reduce) { .bini-thumb, .bini-thumb svg { transition: none; } }
`;

const OVERLAY_HTML = `
<div id="__bini_root">
  <div class="bini-wrap">
    <div class="bini-topbar">
      <div class="bini-tab">
        <div class="bini-pager">
          <button id="__bini_prev" class="bini-nav-btn" type="button" title="Previous">${ICONS.prev}</button>
          <span class="bini-count"><span id="__bini_current">1</span><span class="bini-sep">/</span><span id="__bini_total">1</span></span>
          <button id="__bini_next" class="bini-nav-btn" type="button" title="Next">${ICONS.next}</button>
        </div>
        ${WING_SVG}
      </div>
      <div class="bini-tab-r">
        ${WING_SVG}
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
          <button id="__bini_copy" class="bini-icon-btn" type="button" title="Copy error">${ICONS.copy}</button>
          <button id="__bini_close" class="bini-icon-btn" type="button" title="Close overlay">${ICONS.close}</button>
        </div>
      </div>

      <div id="__bini_error_content"></div>

      <div class="bini-footer">
        <span class="bini-footer-text">Was this helpful?</span>
        <button id="__bini_thumb_up" class="bini-thumb" type="button" title="Helpful" aria-label="Helpful" aria-pressed="false">${ICONS.thumbUp}</button>
        <button id="__bini_thumb_down" class="bini-thumb" type="button" title="Not helpful" aria-label="Not helpful" aria-pressed="false">${ICONS.thumbDown}</button>
      </div>
    </div>
  </div>
</div>`;

function overlayScript(apiBase: string): string {
  return String.raw`
(() => {
  if (window.__bini_initialized) return;
  window.__bini_initialized = true;

  const API_BASE = ${json(apiBase)};
  const PREFS_KEY = ${json(PREFS_KEY)};
  const OVERLAY_HTML = ${json(`<style>${OVERLAY_CSS}</style>${OVERLAY_HTML}`)};
  const ICON = ${json({ check: ICONS.check, updown: ICONS.updown, external: ICONS.external })};
  const FILE_ICONS = ${json({ react: siReact.path, typescript: siTypescript.path, javascript: siJavascript.path })};

  const LOCATION = /([^\s(]+\.(?:tsx?|jsx?)):(\d+):(\d+)/;

  let errors = [];
  let currentIndex = 0;
  let overlayRoot = null;
  let shiki = null;
  let shikiLoad = null;
  let fwOpen = {};
  const feedback = {};

  // ── Theme (shared with the badge preferences) ──
  const lightQuery = window.matchMedia('(prefers-color-scheme: light)');
  const overlayTheme = () => {
    let pref = 'system';
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (saved && saved.theme) pref = saved.theme;
    } catch (_e) {}
    if (pref === 'light' || pref === 'dark') return pref;
    return lightQuery.matches ? 'light' : 'dark';
  };
  const shikiTheme = () => (overlayTheme() === 'light' ? 'light-plus' : 'dark-plus');
  const onThemeChange = () => {
    if (!overlayRoot) return;
    overlayRoot.setAttribute('data-theme', overlayTheme());
    if (overlayRoot.style.display !== 'none') render();
  };
  window.addEventListener('__bini_theme__', onThemeChange);
  lightQuery.addEventListener('change', onThemeChange);

  // ── Text helpers ──
  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const stripNonAscii = (text) => (text || '').replace(/[^\x20-\x7E]/g, '').trim();

  const cleanErrorMessage = (message) => (message || '')
    .replace(/vite:oxc\s*/gi, '')
    .replace(/vite:\s*/gi, '')
    .replace(/\s*at\s+vite:oxc.*$/gm, '')
    .trim();

  const shortenPath = (filePath) => {
    const cleaned = String(filePath || '').replace(/^vite:/, '').replace(/\0/g, '');
    const match = cleaned.match(/(?:src|app)[\/\\].*$/);
    return match ? match[0] : cleaned.split(/[\/\\]/).slice(-2).join('/');
  };

  const langFromFile = (file) => {
    const ext = String(file || '').split('.').pop().toLowerCase();
    return ext === 'tsx' ? 'tsx' : ext === 'ts' ? 'typescript' : ext === 'jsx' ? 'jsx' : 'javascript';
  };

  const fileIconSvg = (filename, size) => {
    const lower = String(filename || '').toLowerCase();
    const d = /\.(tsx|jsx)$/.test(lower) ? FILE_ICONS.react
      : /\.ts$/.test(lower) ? FILE_ICONS.typescript
      : /\.js$/.test(lower) ? FILE_ICONS.javascript : null;
    return d
      ? '<svg role="img" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="currentColor" style="flex-shrink:0;color:var(--bini-strong);"><path d="' + d + '"/></svg>'
      : '';
  };

  const parseCodeLine = (line) => {
    const match = /^\s*(>>>)?\s*(\d+): ?([\s\S]*)$/.exec(line || '');
    return match
      ? { isErr: !!match[1], num: match[2], code: match[3].replace(/\r$/, '') }
      : { isErr: false, num: '', code: String(line || '') };
  };

  // ── Stack parsing ──
  const normalizeFrameUrl = (raw) => (raw || '').trim()
    .replace(/^file:\/\//, '')
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/\?[^#]*$/, '');

  const isSourcemappable = (url) => {
    if (!url || /^(https?:|data:|vite:|\/@|\/node_modules\/|chunks\/)/.test(url) || url === '<anonymous>') return false;
    if (/^\/[^/]*\.(js|mjs|cjs)$/.test(url) && url.indexOf('/src/') !== 0) return false;
    return /\.(tsx?|jsx?|mjs|cjs|vue|svelte)$/.test(url) || url.indexOf('/src/') === 0;
  };

  const FRAMEWORK_FUNCTIONS = ['transformWithOxc', 'viteTransformMiddleware', 'EnvironmentPluginContainer', 'loadAndTransform', 'TransformPluginContext'];
  const isFrameworkFrame = (url, fn) => {
    if (!url) return false;
    if (/chunks\/node\.js|\/node_modules\/vite\/|\/node_modules\/\.pnpm\/vite@|\/@vite\/client|rolldown/.test(url)) return true;
    if (url.indexOf('node:internal') === 0) return true;
    return !!fn && FRAMEWORK_FUNCTIONS.some((name) => fn.indexOf(name) !== -1);
  };

  function parseStack(stack) {
    const user = [];
    const framework = [];
    for (const raw of (stack || '').split('\n')) {
      const line = raw.trim();
      if (line.includes('vite:oxc')) continue;
      const match = line.match(/^at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
      if (!match) continue;
      const url = normalizeFrameUrl(match[2]);
      const frame = { fn: match[1] || null, file: shortenPath(url), rawUrl: url, line: match[3], column: match[4] };
      (isFrameworkFrame(url, frame.fn) ? framework : user).push(frame);
    }
    return { user: user.slice(0, 10), framework: framework.slice(0, 20) };
  }

  async function resolveSourcePosition(url, line, column) {
    if (!isSourcemappable(url)) return null;
    try {
      const res = await fetch(API_BASE + '/__bini_sourcemap?file=' + encodeURIComponent(url) +
        '&line=' + encodeURIComponent(line) + '&column=' + encodeURIComponent(column || 0));
      if (!res.ok) return null;
      const data = await res.json();
      return data && data.file ? data : null;
    } catch (_e) {
      return null;
    }
  }

  const resolveStackFrames = (frames) => Promise.all(frames.map(async (frame) => {
    const mapped = await resolveSourcePosition(frame.rawUrl, frame.line, frame.column);
    return mapped
      ? { ...frame, originalColumn: mapped.column, file: shortenPath(mapped.file) || frame.file, line: String(mapped.line) }
      : frame;
  }));

  async function fetchCodeLines(file, line) {
    try {
      const res = await fetch(API_BASE + '/__bini_code_context?file=' + encodeURIComponent(file) + '&line=' + line);
      if (res.ok) return (await res.json()).lines || [];
    } catch (_e) {}
    return [];
  }

  // ── Syntax highlighting (optional, loaded lazily) ──
  function loadShiki() {
    if (!shikiLoad) {
      shikiLoad = import(/* @vite-ignore */ 'https://esm.sh/shiki@1')
        .then((mod) => { if (mod && typeof mod.codeToHtml === 'function') shiki = mod; return shiki; })
        .catch(() => null);
    }
    return shikiLoad;
  }

  async function prepareHighlights(err) {
    if (!err.codeLines || !err.codeLines.length) return;
    await loadShiki();
    if (!shiki) return;
    const lang = err.fileLang || 'javascript';
    const theme = shikiTheme();
    err.highlightedLines = await Promise.all(err.codeLines.map((line) =>
      shiki.codeToHtml(parseCodeLine(line).code, { lang, theme }).catch(() => null)));
  }

  // ── Rendering ──
  function errorTypeOf(err) {
    const message = err.originalMessage || err.message || '';
    if (err._type === 'runtime') return 'Runtime Error';
    if (err.name === 'Unhandled Rejection') return 'Unhandled Rejection';
    if (/SyntaxError|PARSE_ERROR|Unexpected token|Expected/i.test(message)) return 'Parse Error';
    if (/Transform failed|Build failed/i.test(message)) return 'Build Error';
    if (/TypeError/i.test(message) || err.name === 'TypeError') return 'Type Error';
    if (/Element type is invalid|Cannot read|is not a function|is not defined/i.test(message)) return 'Runtime Error';
    if (err.name && err.name !== 'Plugin Error' && err.name !== 'Vite Error') return err.name;
    return 'Build Error';
  }

  function splitMessage(message) {
    let headline = '';
    const details = [];
    for (const line of cleanErrorMessage(message).split('\n')) {
      if (!line.trim() || line.includes('vite:oxc') || line.includes('NextJs') || line.includes('Turbopack')) continue;
      if (line.includes('╭─[') || line.includes('────╯')) continue;
      if (/^\s*[│|]/.test(line) || /^\s*\d+\s*[│|]/.test(line)) continue;

      const tagged = line.match(/^\[([^\]]+)\]\s*(.+)$/);
      const text = stripNonAscii(tagged ? tagged[2] : line);
      if (!text) continue;
      if (!headline) headline = text; else details.push(text);
    }
    return { headline, details };
  }

  function renderFrame(frame, isFramework) {
    const fn = escapeHtml(frame.fn || '<anonymous>');
    const column = frame.originalColumn || frame.column || '0';
    const location = escapeHtml(frame.file || 'unknown') + ' (' + escapeHtml(frame.line || '0') + ':' + escapeHtml(column) + ')';
    const inner = '<span class="bini-frame-fn">' + fn + '</span><span class="bini-frame-loc">' + location + '</span>';
    return isFramework
      ? '<div class="bini-frame bini-frame-fw">' + inner + '</div>'
      : '<button type="button" class="bini-frame" data-open-file="' + escapeHtml(frame.file) + '" data-open-line="' +
        escapeHtml(frame.line) + '" data-open-column="' + escapeHtml(frame.originalColumn || frame.column || '1') + '">' + inner + '</button>';
  }

  function renderCodeFrame(err) {
    const lines = err.codeLines;
    const file = err.file ? shortenPath(err.file) : '';
    const position = err.line ? ' (' + err.line + ':' + (err.column || 0) + ')' : '';
    const digits = Math.max(1, ...lines.map((line) => parseCodeLine(line).num.length));
    const numStyle = ' style="min-width:calc(' + digits + 'ch + 10px);"';

    let html = '<div class="bini-code"><div class="bini-code-head">' + fileIconSvg(file || 'source', 16) +
      '<span class="bini-code-file">' + escapeHtml((file || 'source') + position) + '</span>';
    if (err.file) {
      html += '<button type="button" class="bini-code-open" title="Open in editor" aria-label="Open in editor" data-open-file="' +
        escapeHtml(file) + '" data-open-line="' + escapeHtml(err.line || '1') + '" data-open-column="' + escapeHtml(err.column || '1') + '">' + ICON.external + '</button>';
    }
    html += '</div><div class="bini-code-scroll"><div class="bini-code-inner">';

    lines.forEach((raw, index) => {
      const line = parseCodeLine(raw);
      const highlighted = err.highlightedLines && err.highlightedLines[index];
      const codeHtml = highlighted || '<pre style="margin:0;font-family:var(--bini-font-mono);"><code>' + escapeHtml(line.code) + '</code></pre>';

      html += '<div class="bini-code-line' + (line.isErr ? ' is-err' : '') + '">' +
        '<span class="bini-code-mark">' + (line.isErr ? '&gt;' : '') + '</span>' +
        '<span class="bini-code-num"' + numStyle + '>' + line.num + '</span>' +
        '<span class="bini-code-sep">|</span><div class="bini-code-text">' + codeHtml + '</div></div>';

      if (line.isErr && err.column > 0) {
        html += '<div class="bini-code-line is-err-caret"><span class="bini-code-mark"></span><span class="bini-code-num"' + numStyle +
          '></span><span class="bini-code-sep">|</span><div class="bini-code-text bini-code-caret">' +
          escapeHtml(' '.repeat(err.column - 1) + '^') + '</div></div>';
      }
    });
    return html + '</div></div></div>';
  }

  function renderStacks(err, index) {
    const parsed = parseStack(err.stack);
    let userFrames = parsed.user;
    if (!userFrames.length && err.file && err.line) {
      userFrames = [{ fn: errorTypeOf(err), file: shortenPath(err.file), line: String(err.line), column: err.column || 0, originalColumn: err.column || 0 }];
    }
    const frameworkFrames = parsed.framework;
    const total = userFrames.length + frameworkFrames.length;
    let html = '';

    if (total > 0) {
      const open = fwOpen[index] === true;
      html += '<div class="bini-stack"><div class="bini-stack-head"><div class="bini-stack-title"><span>Call Stack</span><span class="bini-stack-count">' + total + '</span></div>';
      if (frameworkFrames.length) {
        html += '<button type="button" class="bini-fw-toggle" data-fw-toggle="' + index + '"><span id="bini-fw-label-' + index + '">' +
          (open ? 'Hide ' : 'Show ') + frameworkFrames.length + ' ignore-listed frame(s)</span>' + ICON.updown + '</button>';
      }
      html += '</div><div class="bini-frames">';
      html += userFrames.length ? userFrames.map((f) => renderFrame(f, false)).join('') : '<div class="bini-empty">No application frames in this stack.</div>';
      if (frameworkFrames.length) {
        html += '<div class="bini-fw-frames' + (open ? ' open' : '') + '" id="bini-fw-frames-' + index + '">' +
          frameworkFrames.map((f) => renderFrame(f, true)).join('') + '</div>';
      }
      html += '</div></div>';
    }

    if (err.componentStack) {
      html += '<div class="bini-stack"><div class="bini-stack-head"><div class="bini-stack-title"><span>Component Stack</span></div></div>' +
        '<div class="bini-component-scroll"><pre style="margin:0;color:var(--bini-text-muted);font-family:var(--bini-font-mono);font-size:11px;white-space:pre-wrap;word-break:break-all;">' +
        escapeHtml(err.componentStack) + '</pre></div></div>';
    }
    return html;
  }

  function formatError(err, index) {
    const parts = splitMessage(err.originalMessage || err.message);
    let html = '<div>';
    if (parts.headline) html += '<div class="bini-headline">' + escapeHtml(parts.headline) + '</div>';
    if (parts.details.length) html += '<div class="bini-details">' + parts.details.map((d) => '<div>' + escapeHtml(d) + '</div>').join('') + '</div>';
    if (err.codeLines && err.codeLines.length) html += renderCodeFrame(err);
    return html + renderStacks(err, index) + '</div>';
  }

  function render() {
    const err = errors[currentIndex];
    if (!err || !overlayRoot) return;

    // Highlight lazily, once per theme.
    if (err.codeLines && err.codeLines.length && err.highlightTheme !== shikiTheme()) {
      err.highlightTheme = shikiTheme();
      err.highlightedLines = null;
      prepareHighlights(err).then(() => { if (errors[currentIndex] === err) render(); });
    }

    document.getElementById('__bini_heading').textContent = errorTypeOf(err);
    document.getElementById('__bini_error_content').innerHTML = formatError(err, currentIndex);
    document.getElementById('__bini_current').textContent = currentIndex + 1;
    document.getElementById('__bini_total').textContent = errors.length;
    applyFeedback();
    show();
  }

  // ── Overlay lifecycle ──
  const errorKey = (err) => (err.file || err.id || '') + ':' + (err.line || '') + ':' + (err.originalMessage || err.message || '').slice(0, 100);

  function isPageDestroyed() {
    try {
      const err = errors[currentIndex];
      if (err && err._type === 'runtime' && err.componentStack) return true;
      for (const child of document.body.children) {
        if (!child.id || child.id === '__bini_ov__' || child.id === 'bini-loading-root') continue;
        if (child.offsetWidth > 0 || child.offsetHeight > 0) return false;
      }
      const root = document.getElementById('root') || document.getElementById('app');
      return !(root && root.children.length > 0);
    } catch (_e) {
      return false;
    }
  }

  function show() {
    if (!overlayRoot) return;
    overlayRoot.style.display = 'flex';
    document.getElementById('__bini_close').classList.toggle('bini-hidden', isPageDestroyed());
  }
  const hide = () => { if (overlayRoot) overlayRoot.style.display = 'none'; };
  window.__bini_show_overlay = show;

  function applyFeedback() {
    const err = errors[currentIndex];
    const value = err ? feedback[errorKey(err)] : null;
    const up = document.getElementById('__bini_thumb_up');
    const down = document.getElementById('__bini_thumb_down');
    up.classList.toggle('is-up', value === 'up');
    up.setAttribute('aria-pressed', String(value === 'up'));
    down.classList.toggle('is-down', value === 'down');
    down.setAttribute('aria-pressed', String(value === 'down'));
  }

  function setFeedback(value) {
    const err = errors[currentIndex];
    if (!err) return;
    const key = errorKey(err);
    feedback[key] = feedback[key] === value ? null : value;
    applyFeedback();
  }

  const openInEditor = (file, line, column) => {
    if (!file) return;
    fetch(API_BASE + '/__bini_open_editor?file=' + encodeURIComponent(file) + '&line=' + encodeURIComponent(line || '1') +
      '&column=' + encodeURIComponent(column || '1')).catch(() => {});
  };

  function toggleFrameworkFrames(index) {
    fwOpen[index] = !fwOpen[index];
    const frames = document.getElementById('bini-fw-frames-' + index);
    const label = document.getElementById('bini-fw-label-' + index);
    if (frames) frames.classList.toggle('open', fwOpen[index]);
    if (label) label.textContent = fwOpen[index] ? label.textContent.replace('Show', 'Hide') : label.textContent.replace('Hide', 'Show');
  }

  function buildCodeFrame(err) {
    const parsed = (err.codeLines || []).map(parseCodeLine);
    if (!parsed.length) return '';
    const width = Math.max(1, ...parsed.map((p) => p.num.length));
    const out = [];
    for (const p of parsed) {
      out.push((p.isErr ? '> ' : '  ') + p.num.padStart(width) + ' | ' + p.code);
      if (p.isErr && err.column > 0) out.push('  ' + ' '.repeat(width) + ' | ' + ' '.repeat(err.column - 1) + '^');
    }
    return out.join('\n');
  }

  function copyError() {
    const err = errors[currentIndex];
    if (!err) return;

    const parts = splitMessage(err.originalMessage || err.message);
    const lines = [parts.headline].concat(parts.details).filter(Boolean);
    if (err.file) {
      const location = 'at (' + shortenPath(err.file) + (err.line ? ':' + err.line + ':' + (err.column || 0) : '') + ')';
      if (lines.length) lines.push('', location); else lines.push(location);
    }

    let text = '## Error Type\n' + errorTypeOf(err) + '\n\n## Error Message\n' + lines.join('\n');
    const frames = parseStack(err.stack).user;
    if (frames.length) {
      text += '\n\n\n' + frames.map((f) => '    at ' + (f.fn ? f.fn + ' (' + f.file + ':' + f.line + ')' : f.file + ':' + f.line)).join('\n');
    }
    const codeFrame = buildCodeFrame(err);
    if (codeFrame) text += '\n\n## Code Frame\n' + codeFrame;
    navigator.clipboard.writeText(text + '\n\nBini.js (Rolldown)\n').catch(() => {});
  }

  function ensureOverlay() {
    if (overlayRoot) return;
    const container = document.createElement('div');
    container.id = '__bini_ov__';
    container.innerHTML = OVERLAY_HTML;
    document.body.appendChild(container);
    overlayRoot = container.querySelector('#__bini_root');
    overlayRoot.setAttribute('data-theme', overlayTheme());

    const copyButton = document.getElementById('__bini_copy');
    const copyIcon = copyButton.innerHTML;
    copyButton.addEventListener('click', () => {
      copyError();
      copyButton.innerHTML = ICON.check;
      copyButton.style.color = '#10b981';
      setTimeout(() => { copyButton.innerHTML = copyIcon; copyButton.style.color = ''; }, 2000);
    });

    document.getElementById('__bini_close').addEventListener('click', () => { if (!isPageDestroyed()) hide(); });
    document.getElementById('__bini_thumb_up').addEventListener('click', () => setFeedback('up'));
    document.getElementById('__bini_thumb_down').addEventListener('click', () => setFeedback('down'));
    document.getElementById('__bini_prev').addEventListener('click', () => { currentIndex = Math.max(0, currentIndex - 1); render(); });
    document.getElementById('__bini_next').addEventListener('click', () => { currentIndex = Math.min(errors.length - 1, currentIndex + 1); render(); });

    document.getElementById('__bini_error_content').addEventListener('click', (event) => {
      const open = event.target.closest('[data-open-file]');
      if (open) return openInEditor(open.dataset.openFile, open.dataset.openLine, open.dataset.openColumn);
      const toggle = event.target.closest('[data-fw-toggle]');
      if (toggle) toggleFrameworkFrames(Number(toggle.dataset.fwToggle));
    });
  }

  const updateBadge = () => {
    if (typeof window.__bini_set_error_count === 'function') window.__bini_set_error_count(errors.length);
  };

  // ── Error intake ──
  const isRealError = (err) => {
    const message = err.originalMessage || err.message || '';
    return /PARSE_ERROR|Expected|Unexpected token|Transform failed|SyntaxError|TypeError|ReferenceError/.test(message) ||
      err.plugin === 'vite:oxc' || err._type === 'runtime';
  };
  // Follow-up noise caused by a real error (failed imports, chunk loading).
  const isCascadeError = (err) =>
    /Failed to fetch dynamically imported module|Failed to resolve import|Failed to load module|Loading chunk|ChunkLoadError/.test(err.originalMessage || err.message || '');

  const rank = (err) => {
    const message = err.message || '';
    if (/PARSE_ERROR|Expected/.test(message)) return 0;
    if (message.includes('Transform failed')) return 1;
    return isRealError(err) ? 2 : 3;
  };

  function addError(err) {
    err.originalMessage = err.message;
    if (isCascadeError(err) && errors.some(isRealError)) return;
    if (isRealError(err)) errors = errors.filter((e) => !isCascadeError(e));
    if (errors.some((e) => errorKey(e) === errorKey(err))) return;

    errors.push(err);
    const seen = new Set();
    errors = errors.sort((a, b) => rank(a) - rank(b)).filter((e) => {
      const key = errorKey(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    currentIndex = 0;
    fwOpen = {};
    ensureOverlay();
    render();
    updateBadge();
  }

  async function ingest(err, stack, useStackLocation) {
    if (useStackLocation && !err.file) {
      const match = LOCATION.exec(stack || '');
      if (match) {
        err.file = match[1];
        err.line = parseInt(match[2], 10);
      }
    }
    if (err.file) err.fileLang = langFromFile(err.file);
    if (err.file && err.line) err.codeLines = await fetchCodeLines(err.file, err.line);

    // Map the stack back to original sources before showing it.
    const parsed = parseStack(stack);
    if (parsed.user.length || parsed.framework.length) {
      try {
        const [user, framework] = await Promise.all([resolveStackFrames(parsed.user), resolveStackFrames(parsed.framework)]);
        err.stack = user.concat(framework)
          .map((f) => '    at ' + (f.fn ? f.fn + ' ' : '') + '(' + f.file + ':' + f.line + ':' + (f.originalColumn || f.column) + ')')
          .join('\n') || err.stack;
      } catch (_e) {}
    }
    addError(err);
  }

  const fileFromMessage = (message, stack) => {
    const moduleMatch = /module ['"]([^'"]+)['"]/.exec(message || '');
    if (moduleMatch) return { file: moduleMatch[1], line: 1 };
    const match = /([^\s(]+\.(?:tsx?|jsx?|js|ts)):(\d+):(\d+)/.exec(stack || '');
    return match ? { file: match[1], line: parseInt(match[2], 10) } : { file: '', line: null };
  };

  window.addEventListener('__bini_error__', (event) => {
    const detail = event.detail;
    if (!detail) return;
    const hint = fileFromMessage(detail.message, detail.stack);
    ingest({
      name: detail.name || 'Runtime Error',
      message: cleanErrorMessage(detail.message || 'Unknown error'),
      stack: detail.stack || '',
      componentStack: detail.componentStack || '',
      _type: detail._type || detail.type || 'runtime',
      file: detail.file || hint.file || '',
      line: detail.line || hint.line || null,
    }, detail.stack, true);
  });

  window.addEventListener('error', (event) => {
    event.preventDefault();
    const stack = (event.error && event.error.stack) || '';
    const hint = fileFromMessage(event.message, stack);
    ingest({
      name: (event.error && event.error.name) || 'Runtime Error',
      message: cleanErrorMessage(event.message),
      stack,
      file: event.filename || hint.file || '',
      line: event.lineno || hint.line || null,
    }, stack, true);
  });

  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    const reason = event.reason;
    const stack = (reason && reason.stack) || '';
    const message = (reason && reason.message) || String(reason);
    const hint = fileFromMessage(message, stack);
    ingest({
      name: (reason && reason.name) || 'Unhandled Rejection',
      message: cleanErrorMessage(message),
      stack,
      file: hint.file || '',
      line: hint.line || null,
    }, stack, true);
  });

  // ── Vite HMR integration ──
  if (hot) {
    hot.on('vite:error', (data) => {
      const e = data && data.err;
      if (!e) {
        if (data && data.message) ingest({ name: 'Build Error', message: cleanErrorMessage(data.message), stack: data.stack || '', file: '', line: null }, data.stack, false);
        return;
      }

      const err = {
        name: e.id ? 'Build Error' : 'Vite Error',
        message: cleanErrorMessage(e.message || 'Unknown build error'),
        stack: e.stack || '',
        id: e.id || e.file || '',
        file: (e.loc && e.loc.file) || e.id || e.file || '',
        line: (e.loc && e.loc.line) || null,
        column: (e.loc && e.loc.column) || null,
        plugin: e.plugin || null,
      };
      if (!err.line) {
        const match = LOCATION.exec(e.message || '') || (e.id ? LOCATION.exec(e.id + ':1:1') : null);
        if (match) {
          err.file = err.file || match[1];
          err.line = parseInt(match[2], 10);
        }
      }
      ingest(err, e.stack, false);
    });

    hot.on('vite:beforeUpdate', (payload) => {
      const updates = (payload && payload.updates) || [];
      if (updates.length) {
        errors = errors.filter((err) => {
          const file = err.file || err.id || '';
          return !updates.some((update) => {
            const updated = update.path || update.acceptedPath || '';
            return file && updated && (file.includes(updated) || updated.includes(file.split('/').pop()));
          });
        });
      } else {
        errors = [];
      }
      currentIndex = Math.max(0, Math.min(currentIndex, errors.length - 1));
      fwOpen = {};
      updateBadge();
      if (errors.length) render(); else hide();
    });

    hot.on('vite:afterUpdate', () => {
      errors = [];
      currentIndex = 0;
      fwOpen = {};
      updateBadge();
      hide();
      window.dispatchEvent(new CustomEvent('__bini_clear_errors__'));
    });
  }

  // ── Ready signal ──
  // All listeners above are wired. The SSR bridge (inline, runs before modules) waits for this
  // event to dispatch its queued __bini_error__.
  try { window.dispatchEvent(new Event('__bini_ready__')); } catch (_e) {}
})();
`.trim();
}

function errorOverlayPlugin(): Plugin {
  let apiBase = '';

  return {
    name: 'bini-overlay:error',
    apply: 'serve',

    // Vite's own overlay is replaced by this one. `vite:error` events still fire with the overlay off.
    config(userConfig) {
      if (userConfig.server?.hmr === false) return;
      return { server: { hmr: { overlay: false } } };
    },

    configResolved(config) {
      apiBase = apiBaseOf(config);
    },

    configureServer(server) {
      registerStaticAsset(
        server,
        OVERLAY_MODULE_PATH,
        'js',
        () => hotHeader(apiBase, OVERLAY_MODULE_PATH) + overlayScript(apiBase),
      );
    },

    transformIndexHtml: {
      order: 'post',
      handler: () => [
        {
          tag: 'script',
          attrs: { type: 'module', src: `${apiBase}${OVERLAY_MODULE_PATH}` },
          injectTo: 'head-prepend',
        } as HtmlTagDescriptor,
      ],
    },
  };
}

// ─── SSR error bridge ──────────────────────────────────────────────────────

const VITE_ERROR_PAGE_MARKERS = [
  'vite-error-overlay',
  '__vite_error__',
  'vite:error',
  'data-vite-dev-id="__vite_error',
];

function isHtmlNavigation(req: IncomingMessage): boolean {
  const accept = String(req.headers.accept ?? '');
  if (!accept.includes('text/html')) return false;
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') return false;
  const url = req.url ?? '';
  const pathname = url.split('?')[0] ?? '';
  return !(
    pathname.startsWith('/@') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/__') ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

function isViteErrorPage(body: string): boolean {
  if (!body) return false;
  if (!/<html[\s>]/i.test(body) && !/<!doctype html>/i.test(body)) return false;
  return VITE_ERROR_PAGE_MARKERS.some((marker) => body.includes(marker));
}

interface SsrErrorPayload {
  message: string;
  stack: string;
  file: string;
  line: number | null;
  column: number | null;
  name: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractSsrError(body: string): SsrErrorPayload {
  let message = '';
  let stack = '';
  let file = '';
  let line: number | null = null;
  let column: number | null = null;

  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(body);
  if (titleMatch) message = decodeHtmlEntities((titleMatch[1] ?? '').trim());

  const jsonMatch = /window\.__vite_error__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|$)/.exec(body);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] ?? '{}');
      if (typeof parsed.message === 'string' && parsed.message) message = parsed.message;
      if (typeof parsed.stack === 'string') stack = parsed.stack;
      if (typeof parsed.id === 'string') file = parsed.id;
      if (parsed.loc && typeof parsed.loc.line === 'number') {
        line = parsed.loc.line;
        column = typeof parsed.loc.column === 'number' ? parsed.loc.column : null;
      }
    } catch {
      /* ignore */
    }
  }

  if (!message) {
    const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(body);
    if (preMatch) message = decodeHtmlEntities(stripTags(preMatch[1] ?? '').trim()).split('\n')[0] || '';
  }

  if (!message) message = 'SSR render failed.';

  if (!file) {
    const locMatch = /([^\s"'<>()]+\.(?:tsx?|jsx?|mjs|cjs)):(\d+):(\d+)/.exec(body);
    if (locMatch) {
      file = locMatch[1] ?? '';
      line = Number.parseInt(locMatch[2] ?? '', 10);
      column = Number.parseInt(locMatch[3] ?? '', 10);
    }
  }

  if (!stack) {
    const stackMatch = /<pre[^>]*>([\s\S]*?at [\s\S]*?)<\/pre>/i.exec(body);
    if (stackMatch) stack = decodeHtmlEntities(stripTags(stackMatch[1] ?? '').trim());
  }

  return { message, stack, file, line, column, name: 'SSR Error' };
}

function escapeHtmlForHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttrForHtml(text: string): string {
  return escapeHtmlForHtml(text).replace(/'/g, '&#39;');
}

function renderSsrFallbackPage(indexHtml: string, payload: SsrErrorPayload): string {
  const serialized = JSON.stringify({
    name: payload.name,
    message: payload.message,
    stack: payload.stack,
    file: payload.file,
    line: payload.line,
    column: payload.column,
    _type: 'runtime',
    _kind: 'uncaught',
  }).replace(/</g, '\\u003c');

  // Must be inline so it runs before any module and can queue for `__bini_ready__`.
  const bridge =
    `<script data-bini-ssr-error-bridge>(function(){` +
    `var d=${serialized};` +
    `window.__bini_ssr_error__=d;` +
    `var done=false;` +
    `var fire=function(){if(done)return;done=true;try{window.dispatchEvent(new CustomEvent('__bini_error__',{detail:d}))}catch(e){}};` +
    `if(window.__bini_initialized){fire()}` +
    `else{window.addEventListener('__bini_ready__',fire,{once:true});setTimeout(fire,300)}` +
    `})();<\/script>`;

  const marker = `<pre data-bini-ssr-error style="display:none">${escapeAttrForHtml(serialized)}</pre>`;

  const placeholder =
    `<div id="root" data-bini-ssr-fallback data-bini-ssr-error-marker="1" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;font-family:system-ui,-apple-system,sans-serif;text-align:center">` +
    `<h1 style="font-size:1.5rem;margin:0 0 1rem">Server render error</h1>` +
    `<p style="color:#71717a;max-width:36rem;margin:0 0 1.5rem">The error overlay has the full stack and code frame. Fix the error and reload.</p>` +
    `</div>`;

  // Function replacers: the payload may contain `$&`, `$1`, etc. which string replacements would interpret.
  let html = indexHtml.replace(/<\/head>/i, () => `${bridge}${marker}</head>`);
  html = html.replace(/<div\s+id=["']root["'][^>]*>[\s\S]*?<\/div>/i, () => placeholder);
  return html;
}

function ssrOverlayPlugin(): Plugin {
  let projectRoot = '';

  return {
    name: 'bini-overlay:ssr',
    apply: 'serve',
    enforce: 'post',

    configResolved(config) {
      projectRoot = config.root || process.cwd();
    },

    configureServer(server) {
      const indexPath = path.join(projectRoot, 'index.html');
      let cachedTemplate: string | null = null;
      const readTemplate = (): string => {
        if (cachedTemplate === null) {
          try {
            cachedTemplate = fs.readFileSync(indexPath, 'utf8');
          } catch {
            cachedTemplate = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
          }
        }
        return cachedTemplate;
      };

      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!isHtmlNavigation(req)) return next();

        const originalEnd = res.end.bind(res) as ServerResponse['end'];
        let intercepted = false;

        (res as ServerResponse).end = function patchedEnd(
          this: ServerResponse,
          chunk?: any,
          encodingOrCb?: any,
          cb?: any,
        ): ServerResponse {
          if (!intercepted) {
            const body = chunk && typeof chunk !== 'function' ? chunk.toString() : '';
            if (isViteErrorPage(body)) {
              intercepted = true;
              try {
                const payload = extractSsrError(body);
                const template = readTemplate();
                void server
                  .transformIndexHtml(req.url ?? '/', template)
                  .then((transformed) => {
                    const html = renderSsrFallbackPage(transformed, payload);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.removeHeader('Content-Length');
                    return originalEnd(html);
                  })
                  .catch(() => {
                    const html = renderSsrFallbackPage(template, payload);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.removeHeader('Content-Length');
                    return originalEnd(html);
                  });
                return res;
              } catch {
                intercepted = false;
              }
            }
          }

          if (typeof chunk === 'function') {
            return originalEnd(chunk) as ServerResponse;
          }
          if (typeof encodingOrCb === 'function') {
            return originalEnd(chunk, encodingOrCb) as ServerResponse;
          }
          if (encodingOrCb !== undefined) {
            return originalEnd(chunk, encodingOrCb, cb) as ServerResponse;
          }
          return originalEnd(chunk) as ServerResponse;
        } as ServerResponse['end'];

        next();
      });
    },
  };
}

// ─── Public entry ──────────────────────────────────────────────────────────

export function biniOverlay(options: BiniOverlayOptions = {}): PluginOption[] {
  return [
    fontPlugin(),
    apiPlugin(),
    errorOverlayPlugin(),
    ssrOverlayPlugin(),
    badgePlugin(options),
  ];
}