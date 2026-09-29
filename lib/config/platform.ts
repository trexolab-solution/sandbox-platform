/**
 * Platform Configuration
 * Core platform settings and limits
 */

export const PLATFORM_CONFIG = {
  // Sandbox limits
  maxSandboxesPerUser: 5,
  maxCpuCores: 2,
  maxMemoryMb: 1024, // 1 GB
  maxDiskMb: 2048, // 2 GB
  maxPortMappings: 10,

  // Process limits
  pidsLimit: 100,

  // File manager limits
  maxUploadSizeMb: 10,
  maxTotalUploadSizeMb: 50,
  workspaceRoot: "/workspace",

  // Terminology (hide Docker/container references)
  terms: {
    sandbox: "Sandbox",
    sandboxes: "Sandboxes",
    environment: "Environment",
    instance: "Instance",
    workspace: "Workspace",
  },
} as const;
