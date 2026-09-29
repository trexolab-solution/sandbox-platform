import Docker from "dockerode";
import { BASE_IMAGES, RUNTIME_CONFIGS, type RuntimeType } from "./runtime-images";
import { getAppSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { ENV } from "@/lib/config/env";

export const docker = new Docker({
  socketPath: ENV.DOCKER_SOCKET_PATH,
});

export const SANDBOX_NETWORK_NAME = "sandbox-network";
export const SANDBOX_NETWORK_SUBNET = "172.28.0.0/16";

// Combine base images and runtime images
const baseImageValues = BASE_IMAGES.map((img) => img.value);
const runtimeImages = Object.values(RUNTIME_CONFIGS).flatMap((config) =>
  config.versions.map((v) => config.getImage(v.version))
);

export const ALLOWED_IMAGES = [...new Set([...baseImageValues, ...runtimeImages])] as string[];

export type AllowedImage = string;

// Static fallback config (used when settings can't be loaded)
export const DEFAULT_CONTAINER_CONFIG = {
  cpuLimit: DEFAULT_SETTINGS.defaultCpuCores,
  memoryLimitMb: DEFAULT_SETTINGS.defaultMemoryMb,
  diskLimitMb: DEFAULT_SETTINGS.defaultDiskMb,
  pidsLimit: 100,
} as const;

// Get container config from settings (async)
export async function getContainerConfig() {
  const settings = await getAppSettings();
  return {
    cpuLimit: settings.defaultCpuCores,
    memoryLimitMb: settings.defaultMemoryMb,
    diskLimitMb: settings.defaultDiskMb,
    pidsLimit: 100,
    maxCpuCores: settings.maxCpuCores,
    maxMemoryMb: settings.maxMemoryMb,
    maxDiskMb: settings.maxDiskMb,
  };
}
