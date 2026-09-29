/**
 * Compression Utilities for Sandbox Proxy
 * Handles decompression of gzip, deflate, and brotli encoded responses
 */

import zlib from "zlib";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * Decompress a response body based on the Content-Encoding header
 * @param body - The raw response body as ArrayBuffer
 * @param encoding - The Content-Encoding header value
 * @returns Decompressed Buffer
 */
export async function decompressBody(body: ArrayBuffer, encoding: string | null): Promise<Buffer> {
  const buffer = Buffer.from(body);
  if (!encoding) return buffer;

  const enc = encoding.toLowerCase().trim();
  try {
    switch (enc) {
      case "gzip":
        return Buffer.from(await gunzip(buffer));
      case "deflate":
        return Buffer.from(await inflate(buffer));
      case "br":
        return Buffer.from(await brotliDecompress(buffer));
      default:
        return buffer;
    }
  } catch (error) {
    console.error("Decompression error:", error);
    return buffer;
  }
}
