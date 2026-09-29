/**
 * Docker configuration constants
 * Centralized configuration for Docker operations
 */

export const DOCKER_CONFIG = {
  // Timeouts (in milliseconds)
  timeouts: {
    userCreation: 30000,
    sudoInstall: 120000,
    networkToolsInstall: 120000,
    runtimeInstall: 300000,
    socketOperation: 60000,
    execDefault: 60000,
    containerStart: 30000,
    containerStop: 30000,
    healthCheck: 10000,
  },

  // Resource limits
  resources: {
    cpu: {
      min: 0.5,
      max: 16,
      default: 1,
    },
    memory: {
      min: 128,
      max: 16384,
      default: 512,
    },
    disk: {
      min: 512,
      max: 512000,
      default: 1024,
    },
    pidsLimit: 100,
  },

  // Network configuration
  networks: {
    isolated: {
      name: "sandbox-isolated",
      subnet: "172.29.0.0/16",
      gateway: "172.29.0.1",
      internal: true,
    },
    internet: {
      name: "sandbox-internet",
      subnet: "172.30.0.0/16",
      gateway: "172.30.0.1",
      internal: false,
    },
  },

  // Container configuration
  container: {
    workspaceDir: "/workspace",
    defaultShell: "/bin/bash",
    alpineShell: "/bin/sh",
    defaultUser: "sandbox",
    defaultUid: 1000,
    defaultGid: 1000,
  },

  // Service environment variables for development servers
  serviceEnvironment: [
    "HOST=0.0.0.0",
    "HOSTNAME=0.0.0.0",
    "BIND=0.0.0.0",
    "NEXT_TELEMETRY_DISABLED=1",
    "NUXT_HOST=0.0.0.0",
    "VITE_HOST=0.0.0.0",
    "DEV_HOST=0.0.0.0",
    "WEBPACK_DEV_HOST=0.0.0.0",
    "REACT_SCRIPTS_HOST=0.0.0.0",
    "SVELTE_HOST=0.0.0.0",
    "SOLID_HOST=0.0.0.0",
    "QWIK_HOST=0.0.0.0",
    "ASTRO_HOST=0.0.0.0",
    "FLASK_HOST=0.0.0.0",
    "FLASK_RUN_HOST=0.0.0.0",
    "DJANGO_ALLOWED_HOSTS=*",
    "RAILS_HOST=0.0.0.0",
    "PHP_CLI_SERVER_WORKERS=4",
    "ASPNETCORE_URLS=http://0.0.0.0:5000",
    "TERM=xterm-256color",
  ],

  // Security configuration
  security: {
    dropCapabilities: ["ALL"],
    addCapabilities: ["CHOWN", "SETUID", "SETGID", "DAC_OVERRIDE", "NET_BIND_SERVICE"],
    seccompProfile: "runtime/default",
    readOnlyRootfs: false,
    noNewPrivileges: false, // Required for sudo
  },

  // Heartbeat configuration (for terminal connections)
  heartbeat: {
    interval: 30000,
    timeout: 600000,
  },

  // Activity tracking
  activity: {
    updateInterval: 30000, // How often to update lastActivityAt
    idleTimeout: 1800000, // 30 minutes - stop idle containers
  },
} as const;

/**
 * Get network config by type
 */
export function getNetworkConfig(type: "isolated" | "internet") {
  return DOCKER_CONFIG.networks[type];
}

/**
 * Validate resource limits
 */
export function validateResourceLimits(options: {
  cpuLimit?: number;
  memoryLimitMb?: number;
  diskLimitMb?: number;
}): {
  cpuLimit: number;
  memoryLimitMb: number;
  diskLimitMb: number;
} {
  const { resources } = DOCKER_CONFIG;

  return {
    cpuLimit: Math.max(
      resources.cpu.min,
      Math.min(options.cpuLimit || resources.cpu.default, resources.cpu.max)
    ),
    memoryLimitMb: Math.max(
      resources.memory.min,
      Math.min(options.memoryLimitMb || resources.memory.default, resources.memory.max)
    ),
    diskLimitMb: Math.max(
      resources.disk.min,
      Math.min(options.diskLimitMb || resources.disk.default, resources.disk.max)
    ),
  };
}

/**
 * Get shell for image type
 */
export function getShellForImage(image: string): string {
  if (image.includes("alpine")) {
    return DOCKER_CONFIG.container.alpineShell;
  }
  return DOCKER_CONFIG.container.defaultShell;
}

/**
 * Check if image is Alpine-based
 */
export function isAlpineImage(image: string): boolean {
  return image.toLowerCase().includes("alpine");
}

/**
 * Check if image is Fedora/Rocky-based
 */
export function isFedoraRockyImage(image: string): boolean {
  const lower = image.toLowerCase();
  return lower.includes("fedora") || lower.includes("rocky");
}
