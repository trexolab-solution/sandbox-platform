"use client";

import { useState, useEffect } from "react";

export interface PlatformSettings {
  // Resource limits
  maxCpuCores: number;
  maxMemoryMb: number;
  maxDiskMb: number;
  defaultCpuCores: number;
  defaultMemoryMb: number;
  defaultDiskMb: number;
  maxContainersPerUser: number;
  maxSessionsPerUser: number;

  // File upload settings
  maxFileUploadSizeMb: number;
  fileUploadEnabled: boolean;

  // Network settings
  networkAccessEnabled: boolean;
  internetRequestsEnabled: boolean;

  // Terminal settings
  terminalScrollback: number;
  terminalFontSize: number;

  // Enabled images and runtimes (admin-controlled)
  enabledBaseImages: string[];
  enabledRuntimes: string[];
}

// Default fallback values matching lib/settings.ts
const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  maxCpuCores: 2,
  maxMemoryMb: 1024,
  maxDiskMb: 2048,
  defaultCpuCores: 1,
  defaultMemoryMb: 512,
  defaultDiskMb: 1024,
  maxContainersPerUser: 5,
  maxSessionsPerUser: 3,
  maxFileUploadSizeMb: 50,
  fileUploadEnabled: true,
  networkAccessEnabled: true,
  internetRequestsEnabled: true,
  terminalScrollback: 5000,
  terminalFontSize: 13,
  enabledBaseImages: [
    "ubuntu:24.04",
    "ubuntu:22.04",
    "debian:12",
    "debian:11",
    "alpine:3.19",
    "alpine:3.18",
    "fedora:39",
    "rockylinux:9",
  ],
  enabledRuntimes: [
    "nodejs",
    "python",
    "java",
    "go",
    "rust",
    "php",
    "ruby",
    "dotnet",
  ],
};

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings/limits");
        if (response.ok) {
          const data = await response.json();
          // Merge with defaults to ensure all fields have values
          // This handles cases where settings weren't saved to DB yet
          setSettings({
            ...DEFAULT_PLATFORM_SETTINGS,
            ...data,
            // Ensure arrays are properly handled (don't let empty override defaults)
            enabledBaseImages: data.enabledBaseImages?.length > 0
              ? data.enabledBaseImages
              : DEFAULT_PLATFORM_SETTINGS.enabledBaseImages,
            enabledRuntimes: data.enabledRuntimes?.length > 0
              ? data.enabledRuntimes
              : DEFAULT_PLATFORM_SETTINGS.enabledRuntimes,
          });
        } else {
          // Use defaults if fetch fails
          setError("Failed to fetch settings");
        }
      } catch {
        setError("Failed to fetch settings");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return { settings, isLoading, error };
}
