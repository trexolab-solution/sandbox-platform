/**
 * Content Type Detection for Sandbox Proxy
 * Determines content type and whether URL rewriting is needed
 */

export interface ContentTypeInfo {
  isHtml: boolean;
  isJavaScript: boolean;
  isCss: boolean;
  isJson: boolean;
  needsRewriting: boolean;
}

/**
 * Detect content type from headers and request path
 * @param contentType - The Content-Type header value
 * @param requestPath - The request path for extension-based detection
 * @returns ContentTypeInfo object
 */
export function detectContentType(contentType: string, requestPath: string): ContentTypeInfo {
  const ct = contentType.toLowerCase();
  const path = requestPath.toLowerCase();

  // Check Content-Type header
  const isHtml = ct.includes("text/html");
  const isJavaScript = ct.includes("javascript") || ct.includes("ecmascript");
  const isCss = ct.includes("text/css");
  const isJson = ct.includes("application/json") || ct.includes("application/manifest");

  // Extension-based detection patterns
  const jsExtensions = /\.(js|mjs|jsx|ts|tsx|cjs)(\?.*)?$/;
  const cssExtensions = /\.css(\?.*)?$/;
  const htmlExtensions = /\.(html?|htm)(\?.*)?$/;
  const jsonExtensions = /\.(json|webmanifest)(\?.*)?$/;

  const isJsByExt = jsExtensions.test(path);
  const isCssByExt = cssExtensions.test(path);
  const isHtmlByExt = htmlExtensions.test(path);
  const isJsonByExt = jsonExtensions.test(path);

  // Vite-specific paths that should be treated as JavaScript
  const isVitePath =
    path.includes("/@vite/") ||
    path.includes("/@react-refresh") ||
    path.includes("/@id/") ||
    path.includes("/.vite/") ||
    path.startsWith("/node_modules/") ||
    path.startsWith("/@fs/");

  // Combine header and extension detection
  const finalIsHtml = isHtml || isHtmlByExt;
  const finalIsJavaScript = isJavaScript || isJsByExt || isVitePath;
  const finalIsCss = isCss || isCssByExt;
  const finalIsJson = isJson || isJsonByExt;

  // Prioritize HTML over other types, then JS, then CSS, then JSON
  return {
    isHtml: finalIsHtml,
    isJavaScript: finalIsJavaScript && !finalIsHtml,
    isCss: finalIsCss && !finalIsHtml && !finalIsJavaScript,
    isJson: finalIsJson && !finalIsHtml && !finalIsJavaScript && !finalIsCss,
    needsRewriting: finalIsHtml || finalIsJavaScript || finalIsCss || finalIsJson,
  };
}
