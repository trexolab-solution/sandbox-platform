// Empty instrumentation file for Edge runtime
// All instrumentation logic runs only in Node.js runtime (see instrumentation.ts)
// This file prevents Edge bundler from tracing native module dependencies

export async function register() {
  // No-op for Edge runtime
}
