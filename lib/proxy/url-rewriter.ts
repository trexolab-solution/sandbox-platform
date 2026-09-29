/**
 * URL Rewriter for Sandbox Proxy
 * Handles rewriting URLs in HTML, JavaScript, CSS, and JSON content
 * to ensure all resource requests go through the proxy
 */

export class UrlRewriter {
  private basePath: string;

  private static readonly SKIP_PATTERNS = [
    /^\/\//,          // Protocol-relative URLs
    /^\/p\//,         // Already proxied
    /^https?:/i,      // Absolute URLs
    /^data:/i,        // Data URIs
    /^blob:/i,        // Blob URLs
    /^javascript:/i,  // JavaScript URIs
    /^mailto:/i,      // Email links
    /^tel:/i,         // Phone links
    /^#/,             // Hash links
    /^\s*$/,          // Empty strings
  ];

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private shouldRewrite(path: string): boolean {
    if (!path || !path.startsWith("/")) return false;
    return !UrlRewriter.SKIP_PATTERNS.some((pattern) => pattern.test(path));
  }

  rewritePath(path: string): string {
    if (!this.shouldRewrite(path)) return path;
    return `${this.basePath}${path}`;
  }

  rewriteHtml(content: string): string {
    let result = content;

    // Rewrite src, href, action, and other URL attributes
    result = result.replace(
      /(<[^>]*?\s(?:src|href|action|poster|data|content|formaction|icon|manifest|srcset)=["'])([^"']*)(["'])/gi,
      (match, prefix, url, suffix) => {
        // Handle srcset with multiple URLs
        if (url.includes(",")) {
          const rewritten = url
            .split(",")
            .map((part: string) => {
              const [urlPart, ...rest] = part.trim().split(/\s+/);
              const rewrittenUrl = this.shouldRewrite(urlPart) ? this.rewritePath(urlPart) : urlPart;
              return rest.length ? `${rewrittenUrl} ${rest.join(" ")}` : rewrittenUrl;
            })
            .join(", ");
          return `${prefix}${rewritten}${suffix}`;
        }
        return `${prefix}${this.rewritePath(url)}${suffix}`;
      }
    );

    // Rewrite CSS url() functions
    result = result.replace(
      /url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
      (match, quote, url) => `url(${quote}${this.rewritePath(url)}${quote})`
    );

    // Rewrite string literals
    result = this.rewriteStringLiterals(result);

    // Rewrite meta refresh redirects
    result = result.replace(
      /(content=["']\d+;\s*url=)([^"']+)(["'])/gi,
      (match, prefix, url, suffix) => `${prefix}${this.rewritePath(url)}${suffix}`
    );

    // Inject proxy script
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

  rewriteJavaScript(content: string): string {
    let result = this.rewriteStringLiterals(content);
    // Rewrite source map URLs
    result = result.replace(
      /\/\/[#@]\s*sourceMappingURL=(\S+)/g,
      (match, url) => `//# sourceMappingURL=${this.rewritePath(url)}`
    );
    return result;
  }

  rewriteCss(content: string): string {
    let result = content;
    // Rewrite url() functions
    result = result.replace(
      /url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
      (match, quote, url) => `url(${quote}${this.rewritePath(url)}${quote})`
    );
    // Rewrite @import with quotes
    result = result.replace(
      /@import\s+(["'])([^"']+)\1/gi,
      (match, quote, url) => `@import ${quote}${this.rewritePath(url)}${quote}`
    );
    // Rewrite @import url()
    result = result.replace(
      /@import\s+url\(\s*(["']?)([^)"']+)\1\s*\)/gi,
      (match, quote, url) => `@import url(${quote}${this.rewritePath(url)}${quote})`
    );
    // Rewrite source map URLs
    result = result.replace(
      /\/\*[#@]\s*sourceMappingURL=(\S+)\s*\*\//g,
      (match, url) => `/*# sourceMappingURL=${this.rewritePath(url)} */`
    );
    return result;
  }

  rewriteJson(content: string): string {
    try {
      const json = JSON.parse(content);
      const rewritten = this.rewriteJsonObject(json);
      return JSON.stringify(rewritten);
    } catch {
      // If parsing fails, use regex fallback
      return content.replace(/"(\/[^"]+)"/g, (match, url) => `"${this.rewritePath(url)}"`);
    }
  }

  private rewriteJsonObject(obj: unknown): unknown {
    if (typeof obj === "string") return this.rewritePath(obj);
    if (Array.isArray(obj)) return obj.map((item) => this.rewriteJsonObject(item));
    if (obj && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.rewriteJsonObject(value);
      }
      return result;
    }
    return obj;
  }

  private rewriteStringLiterals(content: string): string {
    const stringPattern = /(["'`])(?:(?!\1|\\).|\\.)*?\1/g;
    return content.replace(stringPattern, (match) => {
      const quote = match[0];
      const inner = match.slice(1, -1);
      if (inner.startsWith("/") && this.shouldRewrite(inner)) {
        return `${quote}${this.basePath}${inner}${quote}`;
      }
      return match;
    });
  }

  private generateProxyScript(): string {
    return `<script data-proxy-injected="true">
(function(){
  if(window.__sandboxProxyInit)return;
  window.__sandboxProxyInit=true;
  var B="${this.basePath}";
  function r(u){
    if(typeof u!=="string")return u;
    if(u.startsWith("/")&&!u.startsWith("//")&&!u.startsWith(B)&&!u.startsWith("/p/"))return B+u;
    return u;
  }
  var _f=window.fetch;
  window.fetch=function(u,o){
    if(typeof u==="string")u=r(u);
    else if(u instanceof Request){var n=r(u.url);if(n!==u.url)u=new Request(n,u);}
    return _f.call(this,u,o);
  };
  var _o=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){return _o.apply(this,[m,r(u)].concat([].slice.call(arguments,2)));};
  if(window.EventSource){var _e=window.EventSource;window.EventSource=function(u,o){return new _e(r(u),o);};window.EventSource.prototype=_e.prototype;}
  if(window.WebSocket){var _w=window.WebSocket;window.WebSocket=function(u,p){try{var U=new URL(u,location.origin);if(U.pathname.startsWith("/")&&!U.pathname.startsWith(B)&&!U.pathname.startsWith("/p/")){U.pathname=B+U.pathname;u=U.toString();}}catch(e){}return p?new _w(u,p):new _w(u);};window.WebSocket.prototype=_w.prototype;Object.assign(window.WebSocket,_w);}
  var _p=history.pushState,_r=history.replaceState;
  history.pushState=function(s,t,u){return _p.call(this,s,t,u?r(u):u);};
  history.replaceState=function(s,t,u){return _r.call(this,s,t,u?r(u):u);};
  var _I=window.Image;
  window.Image=function(w,h){var i=new _I(w,h);var d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");if(d&&d.set){var _s=d.set;Object.defineProperty(i,"src",{set:function(v){_s.call(this,r(v));},get:function(){return this.getAttribute("src");}});}return i;};
  var ce=document.createElement.bind(document);
  document.createElement=function(t){
    var el=ce(t);
    if(t.toLowerCase()==="script"||t.toLowerCase()==="link"||t.toLowerCase()==="img"){
      var d=Object.getOwnPropertyDescriptor(el.constructor.prototype,"src")||Object.getOwnPropertyDescriptor(HTMLElement.prototype,"src");
      if(d&&d.set){var _s=d.set;Object.defineProperty(el,"src",{set:function(v){_s.call(this,r(v));},get:function(){return this.getAttribute("src");},configurable:true});}
      var h=Object.getOwnPropertyDescriptor(el.constructor.prototype,"href");
      if(h&&h.set){var _h=h.set;Object.defineProperty(el,"href",{set:function(v){_h.call(this,r(v));},get:function(){return this.getAttribute("href");},configurable:true});}
    }
    return el;
  };
})();
</script>`;
  }
}
