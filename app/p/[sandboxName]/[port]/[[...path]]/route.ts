import { NextRequest, NextResponse } from "next/server";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq, and } from "drizzle-orm";
import { docker } from "@/lib/docker/client";
import { PROXY_CONFIG } from "@/lib/config/proxy-config";
import {
  UrlRewriter,
  decompressBody,
  detectContentType,
  generateServiceNotAvailablePage,
  generateSandboxNotFoundPage,
  handleOptionsRequest,
  applyCorsHeaders,
  checkProxyRateLimit,
  shouldStreamResponse,
  createStreamingResponse,
  isStaticAsset,
  createProxyRequestLog,
  logProxyRequest,
  logProxyResponse,
  logProxyError,
  applyBandwidthLimit,
  isBandwidthLimitingEnabled,
} from "@/lib/proxy";

// ============================================================================
// UNIVERSAL PROXY ROUTE - /p/[sandboxName]/[port]/
// No port mapping registration required - just run your service and access it!
// ============================================================================

// ============================================================================
// DATABASE & CONTAINER TARGET
// ============================================================================

interface RouteParams {
  params: Promise<{
    sandboxName: string;
    port: string;
    path?: string[];
  }>;
}

interface ContainerTarget {
  ip: string;
  port: number;
  dockerContainerId: string;
}

async function getContainerByName(sandboxName: string, port: number): Promise<ContainerTarget | null> {
  // Look up container by containerName (the unique sandbox identifier)
  const container = await db.query.containers.findFirst({
    where: and(eq(containers.containerName, sandboxName), eq(containers.status, "running")),
  });

  if (!container?.internalIp || !container?.containerId) return null;

  // No port mapping required! Directly use the requested port
  return {
    ip: container.internalIp,
    port: port,
    dockerContainerId: container.containerId,
  };
}

// ============================================================================
// LOCALHOST FORWARDING - Auto-forward localhost-bound services
// ============================================================================

// Track active forwarders to avoid duplicates: Map<containerId:port, timestamp>
const activeForwarders = new Map<string, number>();

/**
 * Check if a service is listening on localhost inside the container
 */
async function isListeningOnLocalhost(dockerContainerId: string, port: number): Promise<boolean> {
  try {
    const dockerContainer = docker.getContainer(dockerContainerId);
    const exec = await dockerContainer.exec({
      Cmd: ["sh", "-c", `ss -tln 2>/dev/null | grep -q ":${port} " || netstat -tln 2>/dev/null | grep -q ":${port} " || cat /proc/net/tcp 2>/dev/null | awk '{print $2}' | grep -qi ":$(printf '%04X' ${port})$"`],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({ hijack: true, stdin: false });

    await new Promise<void>((resolve) => {
      stream.on("end", resolve);
      stream.on("error", resolve);
      setTimeout(resolve, 5000);
    });

    const inspect = await exec.inspect();
    return inspect.ExitCode === 0;
  } catch (error) {
    console.error("Error checking localhost listener:", error);
    return false;
  }
}

/**
 * Start socat forwarding from container IP to localhost
 */
async function startLocalhostForwarder(dockerContainerId: string, containerIp: string, port: number): Promise<boolean> {
  const forwarderKey = `${dockerContainerId}:${port}`;
  const now = Date.now();

  // Check if we already have an active forwarder
  const lastStarted = activeForwarders.get(forwarderKey);
  if (lastStarted && (now - lastStarted) < PROXY_CONFIG.timeouts.forwarderTTL) {
    return true; // Assume it's still running
  }

  try {
    const dockerContainer = docker.getContainer(dockerContainerId);

    // Kill any existing forwarder for this port first
    try {
      const killExec = await dockerContainer.exec({
        Cmd: ["sh", "-c", `pkill -f "socat.*LISTEN:${port}.*fork" 2>/dev/null || true`],
        AttachStdout: false,
        AttachStderr: false,
      });
      await killExec.start({ hijack: true, stdin: false });
    } catch {
      // Ignore kill errors
    }

    // Start socat forwarder in background
    // socat listens on the container's external IP and forwards to localhost
    const exec = await dockerContainer.exec({
      Cmd: [
        "sh", "-c",
        `nohup socat TCP-LISTEN:${port},bind=${containerIp},reuseaddr,fork TCP:127.0.0.1:${port} >/dev/null 2>&1 &`
      ],
      AttachStdout: true,
      AttachStderr: true,
      User: "root",
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    await new Promise<void>((resolve) => {
      stream.on("end", resolve);
      stream.on("error", resolve);
      setTimeout(resolve, 3000);
    });

    // Mark forwarder as active
    activeForwarders.set(forwarderKey, now);

    // Give socat a moment to start
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log(`[Universal Proxy] Started localhost forwarder for ${containerIp}:${port}`);
    return true;
  } catch (error) {
    console.error("Error starting localhost forwarder:", error);
    return false;
  }
}

/**
 * Try to auto-forward a localhost-bound service
 * Returns true if forwarding was set up successfully
 */
async function tryAutoForward(dockerContainerId: string, containerIp: string, port: number): Promise<boolean> {
  // Check if service is listening on localhost
  const isLocalhost = await isListeningOnLocalhost(dockerContainerId, port);
  if (!isLocalhost) {
    return false;
  }

  // Start the forwarder
  return await startLocalhostForwarder(dockerContainerId, containerIp, port);
}

// ============================================================================
// PROXY REQUEST HANDLER
// ============================================================================

async function proxyRequest(
  request: NextRequest,
  target: ContainerTarget,
  basePath: string,
  pathSegments: string[] | undefined,
  isRetry: boolean = false
): Promise<NextResponse> {
  const targetPath = pathSegments?.join("/") || "";
  const searchParams = request.nextUrl.search;
  const targetUrl = `http://${target.ip}:${target.port}/${targetPath}${searchParams}`;
  const rewriter = new UrlRewriter(basePath);

  try {
    const headers = new Headers();

    request.headers.forEach((value, key) => {
      if (!PROXY_CONFIG.skipRequestHeaders.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    headers.set("Host", `${target.ip}:${target.port}`);
    headers.set("X-Forwarded-For", request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown");
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Forwarded-Host", request.headers.get("host") || "localhost");
    headers.set("X-Forwarded-Base", basePath);
    headers.set("Accept-Encoding", "gzip, deflate, br, identity");

    let body: ArrayBuffer | null = null;
    if (!["GET", "HEAD"].includes(request.method)) {
      body = await request.arrayBuffer();
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      // @ts-expect-error - Required for streaming
      duplex: body ? "half" : undefined,
    });

    const responseHeaders = new Headers();
    const contentEncoding = response.headers.get("content-encoding");

    response.headers.forEach((value, key) => {
      if (!PROXY_CONFIG.skipResponseHeaders.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    const contentType = response.headers.get("content-type") || "";
    const typeInfo = detectContentType(contentType, targetPath);

    // Check if we should stream this response
    if (shouldStreamResponse(response, targetPath) || isStaticAsset(targetPath)) {
      // Stream directly without buffering
      const bandwidthEnabled = await isBandwidthLimitingEnabled();

      if (bandwidthEnabled) {
        // Apply bandwidth limiting
        const throttledResponse = await applyBandwidthLimit(
          response,
          target.dockerContainerId,
          responseHeaders
        );
        const nextResponse = new NextResponse(throttledResponse.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
        return await applyCorsHeaders(nextResponse, request);
      }

      // No bandwidth limiting, create streaming response
      const streamingResponse = createStreamingResponse(response, responseHeaders);
      const nextResponse = new NextResponse(streamingResponse.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
      return await applyCorsHeaders(nextResponse, request);
    }

    // Buffer and potentially rewrite the response
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

      const nextResponse = new NextResponse(new Uint8Array(bodyBuffer), {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

      return await applyCorsHeaders(nextResponse, request);
    }

    const nextResponse = new NextResponse(null, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

    return await applyCorsHeaders(nextResponse, request);
  } catch (error) {
    console.error("Proxy request error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const cause = (error as { cause?: { code?: string } })?.cause;

    const isConnectionRefused = cause?.code === "ECONNREFUSED" || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch failed");

    // If connection refused and this is the first attempt, try auto-forwarding
    if (isConnectionRefused && !isRetry) {
      console.log(`[Universal Proxy] Connection refused on ${target.ip}:${target.port}, trying auto-forward...`);

      const forwardSuccess = await tryAutoForward(target.dockerContainerId, target.ip, target.port);

      if (forwardSuccess) {
        console.log(`[Universal Proxy] Auto-forward set up, retrying request...`);
        // Retry the request
        return proxyRequest(request, target, basePath, pathSegments, true);
      }
    }

    if (isConnectionRefused) {
      return new NextResponse(generateServiceNotAvailablePage(target.port), {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json({ error: "Proxy error", details: errorMessage }, { status: 502 });
  }
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

async function handler(request: NextRequest, { params }: RouteParams) {
  const requestLog = createProxyRequestLog(
    request.method,
    request.nextUrl.pathname,
    "",
    0
  );

  try {
    const { sandboxName, port, path } = await params;
    const portNum = parseInt(port, 10);

    // Update request log with actual values
    requestLog.sandboxName = sandboxName;
    requestLog.port = portNum;

    // Log request start
    await logProxyRequest(requestLog);

    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      const response = NextResponse.json({ error: "Invalid port" }, { status: 400 });
      await logProxyResponse(requestLog, 400);
      return response;
    }

    // Check rate limit
    const rateLimitResult = await checkProxyRateLimit(sandboxName);
    if (!rateLimitResult.allowed && rateLimitResult.response) {
      await logProxyResponse(requestLog, 429);
      return rateLimitResult.response;
    }

    const target = await getContainerByName(sandboxName, portNum);

    if (!target) {
      const response = new NextResponse(generateSandboxNotFoundPage(sandboxName), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      await logProxyResponse(requestLog, 404);
      return response;
    }

    const basePath = `/p/${sandboxName}/${port}`;
    const response = await proxyRequest(request, target, basePath, path);

    await logProxyResponse(requestLog, response.status, {
      contentLength: parseInt(response.headers.get("content-length") || "0", 10),
      contentType: response.headers.get("content-type") || undefined,
    });

    return response;
  } catch (error) {
    await logProxyError(requestLog, error instanceof Error ? error : String(error));
    console.error("Proxy handler error:", error);
    return NextResponse.json({ error: "Proxy error", details: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handleOptionsRequest;
