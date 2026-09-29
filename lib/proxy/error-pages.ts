/**
 * Error Page Generators for Sandbox Proxy
 * Generates styled HTML error pages for various proxy errors
 */

/**
 * Generate a 503 Service Not Available page
 * @param port - The port that was requested
 * @returns HTML string
 */
export function generateServiceNotAvailablePage(port: number): string {
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
      <p class="subtitle">No service responding on port <code>${port}</code></p>
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
            <div class="guide-code">npm run dev -- --host 0.0.0.0 --port ${port}</div>
          </div>
          <div class="guide-item">
            <span class="guide-label">Next.js</span>
            <div class="guide-code">next dev -H 0.0.0.0 -p ${port}</div>
          </div>
          <div class="guide-item">
            <span class="guide-label">Express / Node.js</span>
            <div class="guide-code">app.listen(${port}, '0.0.0.0')</div>
          </div>
          <div class="guide-item">
            <span class="guide-label">Python HTTP Server</span>
            <div class="guide-code">python -m http.server ${port} --bind 0.0.0.0</div>
          </div>
          <div class="guide-item">
            <span class="guide-label">Flask</span>
            <div class="guide-code">flask run --host=0.0.0.0 --port=${port}</div>
          </div>
          <div class="guide-item">
            <span class="guide-label">Django</span>
            <div class="guide-code">python manage.py runserver 0.0.0.0:${port}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate a 404 Sandbox Not Found page
 * @param sandboxName - The sandbox name that was requested
 * @returns HTML string
 */
export function generateSandboxNotFoundPage(sandboxName: string): string {
  // Escape HTML to prevent XSS
  const escapedName = sandboxName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Sandbox Not Found</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
    .container{max-width:420px;width:100%}
    .error-card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:1.5rem;text-align:center}
    .error-icon{width:48px;height:48px;margin:0 auto 1rem;background:#78350f;border-radius:50%;display:flex;align-items:center;justify-content:center}
    .error-icon svg{width:24px;height:24px;color:#fcd34d}
    h1{color:#fafafa;font-size:1.125rem;font-weight:600;margin-bottom:0.5rem}
    .subtitle{color:#71717a;font-size:0.875rem}
    code{background:#27272a;padding:0.125rem 0.375rem;border-radius:4px;color:#a1a1aa;font-family:ui-monospace,monospace;font-size:0.8125rem}
  </style>
</head>
<body>
  <div class="container">
    <div class="error-card">
      <div class="error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <h1>Sandbox Not Found</h1>
      <p class="subtitle">The sandbox <code>${escapedName}</code> doesn't exist or is not running.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate a 429 Rate Limited page
 * @param retryAfter - Seconds until the rate limit resets
 * @returns HTML string
 */
export function generateRateLimitedPage(retryAfter: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Too Many Requests</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
    .container{max-width:420px;width:100%}
    .error-card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:1.5rem;text-align:center}
    .error-icon{width:48px;height:48px;margin:0 auto 1rem;background:#7c2d12;border-radius:50%;display:flex;align-items:center;justify-content:center}
    .error-icon svg{width:24px;height:24px;color:#fdba74}
    h1{color:#fafafa;font-size:1.125rem;font-weight:600;margin-bottom:0.5rem}
    .subtitle{color:#71717a;font-size:0.875rem}
    .countdown{color:#fafafa;font-size:1.5rem;font-weight:700;margin-top:1rem}
  </style>
</head>
<body>
  <div class="container">
    <div class="error-card">
      <div class="error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <h1>Too Many Requests</h1>
      <p class="subtitle">You've made too many requests. Please wait and try again.</p>
      <div class="countdown" id="countdown">${retryAfter}s</div>
    </div>
  </div>
  <script>
    let remaining = ${retryAfter};
    const el = document.getElementById('countdown');
    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        location.reload();
      } else {
        el.textContent = remaining + 's';
      }
    }, 1000);
  </script>
</body>
</html>`;
}
