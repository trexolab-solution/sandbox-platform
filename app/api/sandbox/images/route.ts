import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { ALLOWED_IMAGES } from "@/lib/docker/client";

const IMAGE_DESCRIPTIONS: Record<string, string> = {
  "ubuntu:22.04": "Ubuntu 22.04 LTS (Jammy Jellyfish)",
  "ubuntu:24.04": "Ubuntu 24.04 LTS (Noble Numbat)",
  "debian:12": "Debian 12 (Bookworm)",
  "alpine:3.19": "Alpine Linux 3.19 (Minimal)",
  "node:20-alpine": "Node.js 20 LTS on Alpine Linux",
  "python:3.12-slim": "Python 3.12 (Slim)",
};

export async function GET() {
  try {
    await requireAuth();

    const images = ALLOWED_IMAGES.map((image) => ({
      id: image,
      name: image,
      description: IMAGE_DESCRIPTIONS[image] || image,
    }));

    return NextResponse.json({ images });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
