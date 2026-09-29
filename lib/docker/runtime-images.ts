// Runtime configuration for sandbox environments
// Each runtime maps to specific images and available versions

export type RuntimeType = "java" | "nodejs" | "python" | "go" | "rust" | "php" | "ruby" | "dotnet";

export interface RuntimeVersion {
  version: string;
  label: string;
  isDefault?: boolean;
  isLTS?: boolean;
}

export interface RuntimeConfig {
  id: RuntimeType;
  name: string;
  description: string;
  icon: string;
  category: "backend" | "frontend" | "systems" | "scripting";
  versions: RuntimeVersion[];
  getImage: (version: string) => string;
}

export const RUNTIME_CONFIGS: Record<RuntimeType, RuntimeConfig> = {
  java: {
    id: "java",
    name: "Java",
    description: "Enterprise-grade JDK for building robust applications",
    icon: "Coffee",
    category: "backend",
    versions: [
      { version: "22", label: "Java 22 (Latest)" },
      { version: "21", label: "Java 21 (LTS)", isDefault: true, isLTS: true },
      { version: "17", label: "Java 17 (LTS)", isLTS: true },
      { version: "11", label: "Java 11 (LTS)", isLTS: true },
      { version: "8", label: "Java 8 (Legacy LTS)", isLTS: true },
    ],
    getImage: (version: string) => {
      // Java 8 uses different image tag
      if (version === "8") return "eclipse-temurin:8-jdk-alpine";
      return `eclipse-temurin:${version}-jdk-alpine`;
    },
  },
  nodejs: {
    id: "nodejs",
    name: "Node.js",
    description: "JavaScript runtime for scalable server-side applications",
    icon: "Hexagon",
    category: "backend",
    versions: [
      { version: "25", label: "Node.js 25 (Latest)" },
      { version: "24", label: "Node.js 24 (LTS)", isLTS: true },
      { version: "23", label: "Node.js 23" },
      { version: "22", label: "Node.js 22 (LTS)", isDefault: true, isLTS: true },
      { version: "21", label: "Node.js 21" },
      { version: "20", label: "Node.js 20 (LTS)", isLTS: true },
      { version: "19", label: "Node.js 19" },
      { version: "18", label: "Node.js 18 (LTS)", isLTS: true },
    ],
    getImage: (version: string) => `node:${version}-alpine`,
  },
  python: {
    id: "python",
    name: "Python",
    description: "Versatile language for web, data science, and automation",
    icon: "FileCode",
    category: "scripting",
    versions: [
      { version: "3.13", label: "Python 3.13 (Latest)" },
      { version: "3.12", label: "Python 3.12", isDefault: true },
      { version: "3.11", label: "Python 3.11" },
      { version: "3.10", label: "Python 3.10" },
      { version: "3.9", label: "Python 3.9" },
    ],
    getImage: (version: string) => `python:${version}-slim`,
  },
  go: {
    id: "go",
    name: "Go",
    description: "Fast, statically typed language for cloud and systems",
    icon: "Disc",
    category: "systems",
    versions: [
      { version: "1.22", label: "Go 1.22 (Latest)", isDefault: true },
      { version: "1.21", label: "Go 1.21" },
      { version: "1.20", label: "Go 1.20" },
    ],
    getImage: (version: string) => `golang:${version}-alpine`,
  },
  rust: {
    id: "rust",
    name: "Rust",
    description: "Memory-safe systems programming language",
    icon: "Settings",
    category: "systems",
    versions: [
      { version: "1.77", label: "Rust 1.77 (Latest)", isDefault: true },
      { version: "1.76", label: "Rust 1.76" },
      { version: "1.75", label: "Rust 1.75" },
    ],
    getImage: (version: string) => `rust:${version}-alpine`,
  },
  php: {
    id: "php",
    name: "PHP",
    description: "Popular server-side scripting for web development",
    icon: "Code",
    category: "backend",
    versions: [
      { version: "8.3", label: "PHP 8.3 (Latest)", isDefault: true },
      { version: "8.2", label: "PHP 8.2" },
      { version: "8.1", label: "PHP 8.1" },
      { version: "7.4", label: "PHP 7.4 (Legacy)" },
    ],
    getImage: (version: string) => `php:${version}-cli-alpine`,
  },
  ruby: {
    id: "ruby",
    name: "Ruby",
    description: "Dynamic language designed for developer happiness",
    icon: "Gem",
    category: "scripting",
    versions: [
      { version: "3.3", label: "Ruby 3.3 (Latest)", isDefault: true },
      { version: "3.2", label: "Ruby 3.2" },
      { version: "3.1", label: "Ruby 3.1" },
    ],
    getImage: (version: string) => `ruby:${version}-alpine`,
  },
  dotnet: {
    id: "dotnet",
    name: ".NET",
    description: "Microsoft's cross-platform development framework",
    icon: "Box",
    category: "backend",
    versions: [
      { version: "8.0", label: ".NET 8.0 (LTS)", isDefault: true, isLTS: true },
      { version: "7.0", label: ".NET 7.0" },
      { version: "6.0", label: ".NET 6.0 (LTS)", isLTS: true },
    ],
    getImage: (version: string) => `mcr.microsoft.com/dotnet/sdk:${version}-alpine`,
  },
};

// Default runtimes to show in the selector
export const DEFAULT_RUNTIMES: RuntimeType[] = ["nodejs", "python", "java"];

// Get all available runtime types
export const AVAILABLE_RUNTIMES = Object.keys(RUNTIME_CONFIGS) as RuntimeType[];

// Get runtimes by category
export function getRuntimesByCategory(category: RuntimeConfig["category"]) {
  return AVAILABLE_RUNTIMES.filter((r) => RUNTIME_CONFIGS[r].category === category);
}

// Get the default version for a runtime
export function getDefaultVersion(runtime: RuntimeType): string {
  const config = RUNTIME_CONFIGS[runtime];
  const defaultVersion = config.versions.find((v) => v.isDefault);
  return defaultVersion?.version || config.versions[0].version;
}

// Get the Docker image for a runtime and version
export function getRuntimeImage(runtime: RuntimeType, version?: string): string {
  const config = RUNTIME_CONFIGS[runtime];
  const ver = version || getDefaultVersion(runtime);
  return config.getImage(ver);
}

// Validate runtime and version combination
export function isValidRuntime(runtime: string): runtime is RuntimeType {
  return runtime in RUNTIME_CONFIGS;
}

export function isValidVersion(runtime: RuntimeType, version: string): boolean {
  const config = RUNTIME_CONFIGS[runtime];
  return config.versions.some((v) => v.version === version);
}

// Base images for general-purpose environments
export const BASE_IMAGES = [
  {
    value: "ubuntu:24.04",
    label: "Ubuntu 24.04 LTS",
    description: "Full-featured Ubuntu with apt package manager",
    category: "linux"
  },
  {
    value: "ubuntu:22.04",
    label: "Ubuntu 22.04 LTS",
    description: "Stable Ubuntu LTS release",
    category: "linux"
  },
  {
    value: "debian:12",
    label: "Debian 12 (Bookworm)",
    description: "Stable Debian release",
    category: "linux"
  },
  {
    value: "debian:11",
    label: "Debian 11 (Bullseye)",
    description: "Previous Debian stable",
    category: "linux"
  },
  {
    value: "alpine:3.19",
    label: "Alpine 3.19",
    description: "Minimal Linux distribution (6MB)",
    category: "minimal"
  },
  {
    value: "alpine:3.18",
    label: "Alpine 3.18",
    description: "Lightweight Alpine release",
    category: "minimal"
  },
  {
    value: "fedora:39",
    label: "Fedora 39",
    description: "Cutting-edge Fedora release",
    category: "linux"
  },
  {
    value: "rockylinux:9",
    label: "Rocky Linux 9",
    description: "Enterprise-grade RHEL compatible",
    category: "enterprise"
  },
] as const;

export type BaseImage = (typeof BASE_IMAGES)[number]["value"];
