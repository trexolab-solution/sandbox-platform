import { NextRequest, NextResponse } from "next/server";
import { db } from "@/database";
import { containers, portMappings } from "@/database/schemas";
import { eq, and } from "drizzle-orm";
import zlib from "zlib";
import { promisify } from "util";

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

async function decompressBody(body: ArrayBuffer, encoding: string | null): Promise<Buffer> {
  const buffer = Buffer.from(body);
  if (!encoding) return buffer;

  const enc = encoding.toLowerCase().trim();
  try {
    switch (enc) {
      case 'gzip':
        return Buffer.from(await gunzip(buffer));
      case 'deflate':
        return Buffer.from(await inflate(buffer));
      case 'br':
        return Buffer.from(await brotliDecompress(buffer));
      default:
        return buffer;
    }
  } catch (error) {
    console.error('Decompression error:', error);
    return buffer;
  }
}

// ============================================================================
// URL REWRITER CLASS - Handles all URL rewriting logic
// ============================================================================

class UrlRewriter {
  private basePath: string;

  // Patterns that should NOT be rewritten
  private static readonly SKIP_PATTERNS = [
    /^\/\//,           // Protocol-relative URLs
    /^\/s\//,          // Already rewritten
    /^https?:/i,       // Full URLs
    /^data:/i,         // Data URLs
    /^blob:/i,         // Blob URLs
    /^javascript:/i,   // JavaScript URLs
    /^mailto:/i,       // Email links
    /^tel:/i,          // Phone links
    /^#/,              // Hash links
    /^\s*$/,           // Empty strings
  ];

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  // Check if a path should be rewritten
  private shouldRewrite(path: string): boolean {
    if (!path || !path.startsWith('/')) return false;
    return !UrlRewriter.SKIP_PATTERNS.some(pattern => pattern.test(path));
  }

  // Rewrite a single URL path
  rewritePath(path: string): string {
    if (!this.shouldRewrite(path)) return path;
    return `${this.basePath}${path}`;
  }

  // Rewrite HTML content
  rewriteHtml(content: string): string {
    let result = content;

    // 1. Rewrite HTML attributes (src, href, action, etc.)
    result = result.replace(
      /(<[^>]*?\s(?:src|href|action|poster|data|content|formaction|icon|manifest|srcset)=["'])([^"']*)(["'])/gi,
      (match, prefix, url, suffix) => {
        if (url.includes(',')) {
          // Handle srcset with multiple URLs
          const rewritten = url.split(',').map((part: string) => {
            const [urlPart, ...rest] = part.trim().split(/\s+/);
            const rewrittenUrl = this.shouldRewrite(urlPart) ? this.rewritePath(urlPart) : urlPart;
            return rest.length ? `${rewrittenUrl} ${rest.join(' ')}` : rewrittenUrl;
          }).join(', ');
          return `${prefix}${rewritten}${suffix}`;
        }
        return `${prefix}${this.rewritePath(url)}${suffix}`;
      }
    );

    // 2. Rewrite CSS url() in style attributes and <style> tags
    result = result.replace(
      /url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
      (match, quote, url) => {
        return `url(${quote}${this.rewritePath(url)}${quote})`;
      }
    );

    // 3. Rewrite inline script string literals with absolute paths
    // This handles: "/path", '/path', `/path`
    result = this.rewriteStringLiterals(result);

    // 4. Rewrite meta refresh URLs
    result = result.replace(
      /(content=["']\d+;\s*url=)([^"']+)(["'])/gi,
      (match, prefix, url, suffix) => `${prefix}${this.rewritePath(url)}${suffix}`
    );

    // 5. Inject the proxy script
    const proxyScript = this.generateProxyScript();
    if (/<head[^>]*>/i.test(result)) {
      result = result.replace(/<head([^>]*)>/i, `<head$1>${proxyScript}`);
    } else if (/<html[^>]*>/i.test(result)) {
      result = result.replace(/<html([^>]*)>/i, `<html$1>${proxyScript}`);
    } else {
      result = proxyScript + result;
    }

    return result;
  }

  // Rewrite JavaScript content
  rewriteJavaScript(content: string): string {
    let result = content;

    // Rewrite all string literals containing absolute paths
    result = this.rewriteStringLiterals(result);

    // Rewrite source map URLs
    result = result.replace(
      /\/\/[#@]\s*sourceMappingURL=(\S+)/g,
      (match, url) => `//# sourceMappingURL=${this.rewritePath(url)}`
    );

    return result;
  }

  // Rewrite CSS content
  rewriteCss(content: string): string {
    let result = content;

    // 1. Rewrite url() patterns
    result = result.replace(
      /url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
      (match, quote, url) => {
        return `url(${quote}${this.rewritePath(url)}${quote})`;
      }
    );

    // 2. Rewrite @import statements
    result = result.replace(
      /@import\s+(["'])([^"']+)\1/gi,
      (match, quote, url) => `@import ${quote}${this.rewritePath(url)}${quote}`
    );

    result = result.replace(
      /@import\s+url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
      (match, quote, url) => `@import url(${quote}${this.rewritePath(url)}${quote})`
    );

    // 3. Rewrite source map URLs
    result = result.replace(
      /\/\*[#@]\s*sourceMappingURL=(\S+)\s*\*\//g,
      (match, url) => `/*# sourceMappingURL=${this.rewritePath(url)} */`
    );

    return result;
  }

  // Rewrite JSON content (for manifest.json, etc.)
  rewriteJson(content: string): string {
    try {
      const json = JSON.parse(content);
      const rewritten = this.rewriteJsonObject(json);
      return JSON.stringify(rewritten);
    } catch {
      // If JSON parsing fails, use regex fallback
      return content.replace(
        /"(\/[^"]+)"/g,
        (match, url) => `"${this.rewritePath(url)}"`
      );
    }
  }

  // Recursively rewrite URLs in JSON objects
  private rewriteJsonObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.rewritePath(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.rewriteJsonObject(item));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.rewriteJsonObject(value);
      }
      return result;
    }
    return obj;
  }

  // Rewrite string literals in JavaScript/HTML content
  private rewriteStringLiterals(content: string): string {
    // Pattern to match string literals: "...", '...', `...`
    // Handles escaped quotes inside strings
    const stringPattern = /(["'`])(?:(?!\1|\\).|\\.)*?\1/g;

    return content.replace(stringPattern, (match) => {
      const quote = match[0];
      const inner = match.slice(1, -1);

      // Check if this looks like an absolute path
      if (inner.startsWith('/') && this.shouldRewrite(inner)) {
        // Handle paths with query strings and hashes
        return `${quote}${this.basePath}${inner}${quote}`;
      }

      return match;
    });
  }

  // Generate the client-side proxy script for runtime interception
  private generateProxyScript(): string {
    return `<script data-proxy-injected="true">
(function(){
  if(window.__sandboxProxyInit)return;
  window.__sandboxProxyInit=true;
  var B="${this.basePath}";
  function r(u){
    if(typeof u!=="string")return u;
    if(u.startsWith("/")&&!u.startsWith("//")&&!u.startsWith(B))return B+u;
    return u;
  }
  // Fetch
  var _f=window.fetch;
  window.fetch=function(u,o){
    if(typeof u==="string")u=r(u);
    else if(u instanceof Request){var n=r(u.url);if(n!==u.url)u=new Request(n,u);}
    return _f.call(this,u,o);
  };
  // XHR
  var _o=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){return _o.apply(this,[m,r(u)].concat([].slice.call(arguments,2)));};
  // EventSource
  if(window.EventSource){var _e=window.EventSource;window.EventSource=function(u,o){return new _e(r(u),o);};window.EventSource.prototype=_e.prototype;}
  // WebSocket
  if(window.WebSocket){var _w=window.WebSocket;window.WebSocket=function(u,p){try{var U=new URL(u,location.origin);if(U.pathname.startsWith("/")&&!U.pathname.startsWith(B)){U.pathname=B+U.pathname;u=U.toString();}}catch(e){}return p?new _w(u,p):new _w(u);};window.WebSocket.prototype=_w.prototype;Object.assign(window.WebSocket,_w);}
  // History
  var _p=history.pushState,_r=history.replaceState;
  history.pushState=function(s,t,u){return _p.call(this,s,t,u?r(u):u);};
  history.replaceState=function(s,t,u){return _r.call(this,s,t,u?r(u):u);};
  // Image
  var _I=window.Image;
  window.Image=function(w,h){var i=new _I(w,h);var d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");if(d&&d.set){var _s=d.set;Object.defineProperty(i,"src",{set:function(v){_s.call(this,r(v));},get:function(){return this.getAttribute("src");}});}return i;};
  // Dynamic script/link creation
  var ce=document.createElement.bind(document);
  document.createElement=function(t){
    var el=ce(t);
    if(t.toLowerCase()==="script"||t.toLowerCase()==="link"||t.toLowerCase()==="img"){
      var d=Object.getOwnPropertyDescriptor(el.constructor.prototype,"src")||Object.getOwnPropertyDescriptor(HTMLElement.prototype,"src");
      if(d&&d.set){
        var _s=d.set;
        Object.defineProperty(el,"src",{set:function(v){_s.call(this,r(v));},get:function(){return this.getAttribute("src");},configurable:true});
      }
      var h=Object.getOwnPropertyDescriptor(el.constructor.prototype,"href");
      if(h&&h.set){
        var _h=h.set;
        Object.defineProperty(el,"href",{set:function(v){_h.call(this,r(v));},get:function(){return this.getAttribute("href");},configurable:true});
      }
    }
    return el;
  };
})();
</script>`;
  }
}

// ============================================================================
// CONTENT TYPE DETECTION
// ============================================================================

interface ContentTypeInfo {
  isHtml: boolean;
  isJavaScript: boolean;
  isCss: boolean;
  isJson: boolean;
  needsRewriting: boolean;
}

function detectContentType(contentType: string, requestPath: string): ContentTypeInfo {
  const ct = contentType.toLowerCase();
  const path = requestPath.toLowerCase();

  // Check by content-type header
  const isHtml = ct.includes('text/html');
  const isJavaScript = ct.includes('javascript') ||
                       ct.includes('ecmascript') ||
                       ct.includes('application/x-javascript') ||
                       ct.includes('text/x-javascript');
  const isCss = ct.includes('text/css');
  const isJson = ct.includes('application/json') ||
                 ct.includes('application/manifest');

  // Also check by file extension (fallback for incorrect content-types)
  const jsExtensions = /\.(js|mjs|jsx|ts|tsx|cjs)(\?.*)?$/;
  const cssExtensions = /\.css(\?.*)?$/;
  const htmlExtensions = /\.(html?|htm)(\?.*)?$/;
  const jsonExtensions = /\.(json|webmanifest)(\?.*)?$/;

  const isJsByExt = jsExtensions.test(path);
  const isCssByExt = cssExtensions.test(path);
  const isHtmlByExt = htmlExtensions.test(path);
  const isJsonByExt = jsonExtensions.test(path);

  // Special Vite paths that contain JavaScript
  const isVitePath = path.includes('/@vite/') ||
                     path.includes('/@react-refresh') ||
                     path.includes('/@id/') ||
                     path.includes('/.vite/') ||
                     path.startsWith('/node_modules/') ||
                     path.startsWith('/@fs/');

  const finalIsHtml = isHtml || isHtmlByExt;
  const finalIsJavaScript = isJavaScript || isJsByExt || isVitePath;
  const finalIsCss = isCss || isCssByExt;
  const finalIsJson = isJson || isJsonByExt;

  return {
    isHtml: finalIsHtml,
    isJavaScript: finalIsJavaScript && !finalIsHtml, // HTML takes priority
    isCss: finalIsCss && !finalIsHtml && !finalIsJavaScript,
    isJson: finalIsJson && !finalIsHtml && !finalIsJavaScript && !finalIsCss,
    needsRewriting: finalIsHtml || finalIsJavaScript || finalIsCss || finalIsJson,
  };
}

// ============================================================================
// DATABASE & SERVICE TARGET
// ============================================================================

interface RouteParams {
  params: Promise<{
    serviceName: string;
    path?: string[];
  }>;
}

interface ServiceTarget {
  ip: string;
  port: number;
  serviceName: string;
}

async function getServiceTarget(serviceName: string): Promise<ServiceTarget | null> {
  const portMapping = await db.query.portMappings.findFirst({
    where: eq(portMappings.serviceName, serviceName),
    with: { container: true },
  });

  if (!portMapping) return null;

  const container = await db.query.containers.findFirst({
    where: and(
      eq(containers.id, portMapping.containerId),
      eq(containers.status, "running")
    ),
  });

  if (!container?.internalIp) return null;

  return {
    ip: container.internalIp,
    port: portMapping.internalPort,
    serviceName: portMapping.serviceName,
  };
}

// ============================================================================
// PROXY REQUEST HANDLER
// ============================================================================

async function proxyRequest(
  request: NextRequest,
  target: ServiceTarget,
  pathSegments: string[] | undefined
): Promise<NextResponse> {
  const targetPath = pathSegments?.join("/") || "";
  const searchParams = request.nextUrl.search;
  const targetUrl = `http://${target.ip}:${target.port}/${targetPath}${searchParams}`;
  const basePath = `/s/${target.serviceName}`;
  const rewriter = new UrlRewriter(basePath);

  try {
    // Build request headers
    const headers = new Headers();
    const skipHeaders = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection']);

    request.headers.forEach((value, key) => {
      if (!skipHeaders.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    // Set forwarding headers
    headers.set("Host", `${target.ip}:${target.port}`);
    headers.set("X-Forwarded-For", request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown");
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Forwarded-Host", request.headers.get("host") || "localhost");
    headers.set("X-Forwarded-Base", basePath);
    headers.set("Accept-Encoding", "gzip, deflate, br, identity");

    // Get request body
    let body: ArrayBuffer | null = null;
    if (!['GET', 'HEAD'].includes(request.method)) {
      body = await request.arrayBuffer();
    }

    // Make proxied request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      // @ts-expect-error - Required for streaming request bodies
      duplex: body ? "half" : undefined,
    });

    // Build response headers
    const responseHeaders = new Headers();
    const skipResponseHeaders = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length']);
    const contentEncoding = response.headers.get("content-encoding");

    response.headers.forEach((value, key) => {
      if (!skipResponseHeaders.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Add CORS headers
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Access-Control-Allow-Credentials", "true");

    // Detect content type
    const contentType = response.headers.get("content-type") || "";
    const typeInfo = detectContentType(contentType, targetPath);

    // Process response body
    if (response.body) {
      const rawBody = await response.arrayBuffer();
      let bodyBuffer = await decompressBody(rawBody, contentEncoding);

      if (typeInfo.needsRewriting) {
        let content = bodyBuffer.toString("utf-8");

        if (typeInfo.isHtml) {
          content = rewriter.rewriteHtml(content);
        } else if (typeInfo.isJavaScript) {
          content = rewriter.rewriteJavaScript(content);
        } else if (typeInfo.isCss) {
          content = rewriter.rewriteCss(content);
        } else if (typeInfo.isJson) {
          content = rewriter.rewriteJson(content);
        }

        bodyBuffer = Buffer.from(content, "utf-8");
      }

      responseHeaders.set("content-length", bodyBuffer.length.toString());

      return new NextResponse(new Uint8Array(bodyBuffer), {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    return new NextResponse(null, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error("Proxy request error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const cause = (error as { cause?: { code?: string } })?.cause;

    if (cause?.code === "ECONNREFUSED" || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed")) {
      return new NextResponse(generateServiceNotAvailablePage(target), {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json({ error: "Proxy error", details: errorMessage }, { status: 502 });
  }
}

// ============================================================================
// ERROR PAGES
// ============================================================================

function generateServiceNotAvailablePage(target: ServiceTarget): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Service Not Available</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
    .container{max-width:520px;width:100%}
    .error-card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:1.5rem;text-align:center}
    .error-icon{width:48px;height:48px;margin:0 auto 1rem;background:#7f1d1d;border-radius:50%;display:flex;align-items:center;justify-content:center}
    .error-icon svg{width:24px;height:24px;color:#fca5a5}
    h1{color:#fafafa;font-size:1.125rem;font-weight:600;margin-bottom:0.5rem}
    .subtitle{color:#71717a;font-size:0.875rem;margin-bottom:0.25rem}
    code{background:#27272a;padding:0.125rem 0.375rem;border-radius:4px;color:#a1a1aa;font-family:ui-monospace,monospace;font-size:0.8125rem}
    .divider{height:1px;background:#27272a;margin:1.25rem 0}
    .collapsible{border:1px solid #27272a;border-radius:8px;overflow:hidden}
    .collapsible-trigger{width:100%;padding:0.75rem 1rem;background:#18181b;border:none;color:#a1a1aa;font-size:0.8125rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:background 0.15s}
    .collapsible-trigger:hover{background:#1f1f23}
    .collapsible-trigger svg{width:16px;height:16px;transition:transform 0.2s}
    .collapsible-trigger[aria-expanded="true"] svg{transform:rotate(180deg)}
    .collapsible-content{display:none;padding:0.75rem 1rem;background:#0f0f10;border-top:1px solid #27272a}
    .collapsible-content.open{display:block}
    .guide-item{margin-bottom:0.875rem}
    .guide-item:last-child{margin-bottom:0}
    .guide-label{color:#71717a;font-size:0.75rem;margin-bottom:0.375rem;display:block}
    .guide-code{background:#18181b;border:1px solid #27272a;border-radius:6px;padding:0.5rem 0.75rem;font-family:ui-monospace,monospace;font-size:0.75rem;color:#4ade80;overflow-x:auto;white-space:nowrap}
  </style>
</head>
<body>
  <div class="container">
    <div class="error-card">
      <div class="error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h1>Service Not Available</h1>
      <p class="subtitle">No service responding on port <code>${target.port}</code></p>
      <div class="divider"></div>
      <div class="collapsible">
        <button class="collapsible-trigger" aria-expanded="false" onclick="this.setAttribute('aria-expanded',this.getAttribute('aria-expanded')==='true'?'false':'true');this.nextElementSibling.classList.toggle('open')">
          <span>How to fix this?</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div class="collapsible-content">
          <div class="guide-item">
            <span class="guide-label">Vite / React / Vue</span>
            <div class="guide-code">npm run dev -- --host 0.0.0.0 --port ${target.port}</div>
          </div>
          <div class="guide-item">
            <span class="guide-label">Next.js</span>
            <div class="guide-code">next dev -H 0.0.0.0 -p ${target.port}</div>
          </div>
          <div class="guide-item">
            <span class="guide-label">Express / Node.js</span>
            <div class="guide-code">app.listen(${target.port}, '0.0.0.0')</div>
          </div>
          <div class="guide-item">
            <span class="guide-label">Python HTTP Server</span>
            <div class="guide-code">python -m http.server ${target.port} --bind 0.0.0.0</div>
          </div>
          <div class="guide-item">
            <span class="guide-label">Flask</span>
            <div class="guide-code">flask run --host=0.0.0.0 --port=${target.port}</div>
          </div>
          <div class="guide-item">
            <span class="guide-label">Django</span>
            <div class="guide-code">python manage.py runserver 0.0.0.0:${target.port}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function generateServiceNotFoundPage(serviceName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Service Not Found</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
    .container{max-width:520px;width:100%}
    .error-card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:1.5rem;text-align:center}
    .error-icon{width:48px;height:48px;margin:0 auto 1rem;background:#78350f;border-radius:50%;display:flex;align-items:center;justify-content:center}
    .error-icon svg{width:24px;height:24px;color:#fcd34d}
    h1{color:#fafafa;font-size:1.125rem;font-weight:600;margin-bottom:0.5rem}
    .subtitle{color:#71717a;font-size:0.875rem}
    code{background:#27272a;padding:0.125rem 0.375rem;border-radius:4px;color:#a1a1aa;font-family:ui-monospace,monospace;font-size:0.8125rem}
    .divider{height:1px;background:#27272a;margin:1.25rem 0}
    .hint{background:#0f0f10;border:1px solid #27272a;border-radius:8px;padding:0.75rem 1rem;text-align:left}
    .hint-label{color:#71717a;font-size:0.75rem;margin-bottom:0.375rem;display:block}
    .hint-text{color:#a1a1aa;font-size:0.8125rem;line-height:1.5}
  </style>
</head>
<body>
  <div class="container">
    <div class="error-card">
      <div class="error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"/>
        </svg>
      </div>
      <h1>Service Not Found</h1>
      <p class="subtitle">The service <code>${serviceName}</code> does not exist</p>
      <div class="divider"></div>
      <div class="hint">
        <span class="hint-label">Possible reasons</span>
        <p class="hint-text">The port mapping does not exist or the sandbox container is not running. Check your sandbox settings.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

async function handleOptions(request: NextRequest, { params }: RouteParams) {
  const { serviceName } = await params;
  const target = await getServiceTarget(serviceName);

  if (!target) {
    return new NextResponse(null, { status: 404 });
  }

  const headers = new Headers({
    "Access-Control-Allow-Origin": request.headers.get("origin") || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  });

  return new NextResponse(null, { status: 204, headers });
}

async function handler(request: NextRequest, { params }: RouteParams) {
  try {
    const { serviceName, path } = await params;
    const target = await getServiceTarget(serviceName);

    if (!target) {
      return new NextResponse(generateServiceNotFoundPage(serviceName), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return await proxyRequest(request, target, path);
  } catch (error) {
    console.error("Proxy handler error:", error);
    return NextResponse.json(
      { error: "Proxy error", details: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handleOptions;
