/**
 * URL Utilities
 * Shared URL construction functions
 */

/**
 * Get the public URL for a service (requires port mapping registration)
 * @param serviceName - The service name to construct URL for
 * @returns The full service URL or empty string if running server-side
 */
export function getServiceUrl(serviceName: string): string {
  if (typeof window === "undefined") return "";
  const { protocol, host } = window.location;
  return `${protocol}//${host}/s/${serviceName}/`;
}

/**
 * Get the universal proxy URL for any port on a sandbox (no registration required)
 * @param sandboxName - The sandbox container name (unique identifier)
 * @param port - The port number the service is running on
 * @returns The full proxy URL or empty string if running server-side
 */
export function getUniversalProxyUrl(sandboxName: string, port: number): string {
  if (typeof window === "undefined") return "";
  const { protocol, host } = window.location;
  return `${protocol}//${host}/p/${sandboxName}/${port}/`;
}

/**
 * Get the universal proxy URL (server-side version with base URL)
 * @param baseUrl - The base URL of the application
 * @param sandboxName - The sandbox container name (unique identifier)
 * @param port - The port number the service is running on
 * @returns The full proxy URL
 */
export function getUniversalProxyUrlServer(baseUrl: string, sandboxName: string, port: number): string {
  return `${baseUrl}/p/${sandboxName}/${port}/`;
}
