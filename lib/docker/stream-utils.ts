/**
 * Docker stream utilities
 * Shared utilities for handling Docker exec streams
 */

/**
 * Demux Docker stream output
 * Docker multiplexes stdout and stderr into a single stream with headers
 * Header format: [type (1 byte)][0 (3 bytes)][size (4 bytes BE)][data]
 * Type: 1 = stdout, 2 = stderr
 */
export function demuxDockerStream(buffer: Buffer): string {
  const result: string[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    // Check if we have at least 8 bytes for the header
    if (offset + 8 > buffer.length) {
      // Not enough bytes for header, treat rest as raw data
      result.push(buffer.slice(offset).toString("utf8"));
      break;
    }

    // Read the header
    const type = buffer.readUInt8(offset);
    const size = buffer.readUInt32BE(offset + 4);

    // Validate header (type should be 0, 1, or 2)
    if (type > 2) {
      // Invalid header, treat as raw data
      result.push(buffer.slice(offset).toString("utf8"));
      break;
    }

    offset += 8;

    // Read the data
    if (offset + size <= buffer.length) {
      result.push(buffer.slice(offset, offset + size).toString("utf8"));
      offset += size;
    } else {
      // Incomplete data, read what we can
      result.push(buffer.slice(offset).toString("utf8"));
      break;
    }
  }

  return result.join("");
}

/**
 * Collect stream data into a buffer with timeout
 */
export async function collectStreamData(
  stream: NodeJS.ReadableStream,
  timeout: number = 60000
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let timeoutId: NodeJS.Timeout | null = null;
    let resolved = false;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const done = (result: Buffer) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(result);
      }
    };

    const fail = (error: Error) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(error);
      }
    };

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      done(Buffer.concat(chunks));
    });

    stream.on("error", (error: Error) => {
      fail(error);
    });

    // Set timeout
    timeoutId = setTimeout(() => {
      // Try to destroy the stream
      if ("destroy" in stream && typeof (stream as { destroy?: () => void }).destroy === "function") {
        (stream as { destroy: () => void }).destroy();
      }
      done(Buffer.concat(chunks));
    }, timeout);
  });
}

/**
 * Execute a command and return demuxed output
 */
export async function executeAndDemux(
  stream: NodeJS.ReadableStream,
  timeout: number = 60000
): Promise<{ output: string; timedOut: boolean }> {
  const startTime = Date.now();

  try {
    const buffer = await collectStreamData(stream, timeout);
    const output = demuxDockerStream(buffer);
    const elapsed = Date.now() - startTime;
    const timedOut = elapsed >= timeout - 100; // Allow 100ms tolerance

    return { output, timedOut };
  } catch (error) {
    return {
      output: error instanceof Error ? error.message : "Unknown error",
      timedOut: true,
    };
  }
}
