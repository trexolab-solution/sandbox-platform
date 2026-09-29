import {
  docker,
  ALLOWED_IMAGES,
  DEFAULT_CONTAINER_CONFIG,
  getContainerConfig,
  type AllowedImage,
} from "./client";
import {
  NetworkService,
  SANDBOX_NETWORK_ISOLATED,
  SANDBOX_NETWORK_INTERNET,
} from "./network-service";
import {
  getEssentialToolsInstallCommand,
  getHelperScriptsInstallCommand,
} from "./essential-tools";
import { db } from "@/database";
import { containers, portMappings, auditLogs } from "@/database/schemas";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getAppSettings, getSetting } from "@/lib/settings";
import { sseManager } from "@/lib/sse/sse-manager";

export interface CreateContainerOptions {
  userId: string;
  displayName: string;
  image: AllowedImage;
  cpuLimit?: number;
  memoryLimitMb?: number;
  diskLimitMb?: number;
  ports?: Array<{
    serviceName: string;
    port: number;
    protocol?: "tcp" | "udp";
  }>;
  runtimes?: string[];
  runtimeVersions?: Record<string, string>;
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsageMb: number;
  memoryLimitMb: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

export interface ContainerRecord {
  id: string;
  userId: string;
  containerId: string;
  containerName: string;
  displayName: string;
  image: string;
  status: string;
  cpuLimit: number;
  memoryLimitMb: number;
  diskLimitMb: number;
  networkId: string | null;
  internalIp: string | null;
  internetAccess: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastStartedAt: Date | null;
  lastStoppedAt: Date | null;
}

export class ContainerService {
  /**
   * Update container creation progress and broadcast via SSE
   */
  static async updateProgress(
    containerDbId: string,
    progress: number,
    step: string,
    status?: "creating" | "initializing" | "stopped" | "error",
    error?: string,
    userId?: string
  ): Promise<void> {
    await db
      .update(containers)
      .set({
        creationProgress: progress,
        creationStep: step,
        ...(status && { status }),
        ...(error && { creationError: error }),
      })
      .where(eq(containers.id, containerDbId));

    // Broadcast progress via SSE if userId is provided
    if (userId) {
      sseManager.sendCreationProgress(
        userId,
        containerDbId,
        progress,
        step,
        status || "creating",
        error
      );
    }
  }

  /**
   * Get the shell command to install a runtime in the container
   * Uses version-specific installation methods to ensure the correct version is installed
   * Works across Ubuntu, Debian, Alpine, Fedora, and Rocky Linux
   */
  static getRuntimeInstallCommand(
    runtime: string,
    version: string | undefined,
    isAlpine: boolean,
    isFedoraRocky: boolean,
    isDebian: boolean = false
  ): string[] | null {
    // Runtime installation commands for different distros
    // Uses universal installers (like n, rustup, etc.) to ensure cross-distro compatibility

    const commands: Record<string, { alpine: string; fedora: string; debian: string; ubuntu: string }> = {
      nodejs: {
        // Node.js: Alpine needs musl builds from unofficial-builds.nodejs.org
        // Falls back to apk package if musl build not available for that version
        alpine: version
          ? `apk add --no-cache curl libstdc++ xz && ARCH=$(uname -m) && if [ "$ARCH" = "x86_64" ]; then ARCH="x64"; elif [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi && (curl -fsSL "https://unofficial-builds.nodejs.org/download/release/v${version}/node-v${version}-linux-$ARCH-musl.tar.xz" -o /tmp/node.tar.xz && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 && rm /tmp/node.tar.xz && ln -sf /usr/local/bin/node /usr/bin/node 2>/dev/null; ln -sf /usr/local/bin/npm /usr/bin/npm 2>/dev/null; ln -sf /usr/local/bin/npx /usr/bin/npx 2>/dev/null) || (echo "Musl build not available for v${version}, installing from apk..." && apk add --no-cache nodejs npm); node --version`
          : `apk add --no-cache nodejs npm && node --version`,
        fedora: version
          ? `dnf install -y curl tar xz && curl -fsSL https://raw.githubusercontent.com/tj/n/master/bin/n -o /usr/local/bin/n && chmod +x /usr/local/bin/n && N_PREFIX=/usr/local n ${version} && ln -sf /usr/local/bin/node /usr/bin/node 2>/dev/null; ln -sf /usr/local/bin/npm /usr/bin/npm 2>/dev/null; node --version`
          : `dnf install -y nodejs npm || yum install -y nodejs npm`,
        debian: version
          ? `apt-get update && apt-get install -y curl ca-certificates xz-utils && curl -fsSL https://raw.githubusercontent.com/tj/n/master/bin/n -o /usr/local/bin/n && chmod +x /usr/local/bin/n && N_PREFIX=/usr/local n ${version} && ln -sf /usr/local/bin/node /usr/bin/node 2>/dev/null; ln -sf /usr/local/bin/npm /usr/bin/npm 2>/dev/null; node --version`
          : `apt-get update && apt-get install -y nodejs npm`,
        ubuntu: version
          ? `apt-get update && apt-get install -y curl ca-certificates xz-utils && curl -fsSL https://raw.githubusercontent.com/tj/n/master/bin/n -o /usr/local/bin/n && chmod +x /usr/local/bin/n && N_PREFIX=/usr/local n ${version} && ln -sf /usr/local/bin/node /usr/bin/node 2>/dev/null; ln -sf /usr/local/bin/npm /usr/bin/npm 2>/dev/null; node --version`
          : `apt-get update && apt-get install -y nodejs npm`,
      },
      python: {
        // Python: Install from package manager (specific versions via pyenv if needed)
        alpine: `apk add --no-cache python3 py3-pip python3-dev && ln -sf /usr/bin/python3 /usr/bin/python 2>/dev/null; python3 --version`,
        fedora: `dnf install -y python3 python3-pip python3-devel && ln -sf /usr/bin/python3 /usr/bin/python 2>/dev/null; python3 --version`,
        debian: `apt-get update && apt-get install -y python3 python3-pip python3-venv python3-dev && ln -sf /usr/bin/python3 /usr/bin/python 2>/dev/null; python3 --version`,
        ubuntu: version
          ? `apt-get update && apt-get install -y software-properties-common && add-apt-repository -y ppa:deadsnakes/ppa && apt-get update && apt-get install -y python${version} python${version}-venv python${version}-dev python3-pip && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python${version} 1 2>/dev/null; ln -sf /usr/bin/python3 /usr/bin/python 2>/dev/null; python3 --version`
          : `apt-get update && apt-get install -y python3 python3-pip python3-venv python3-dev && ln -sf /usr/bin/python3 /usr/bin/python 2>/dev/null; python3 --version`,
      },
      java: {
        // Java: Install OpenJDK
        alpine: `apk add --no-cache openjdk${version || "21"}-jdk 2>/dev/null || apk add --no-cache openjdk${version || "17"}-jdk 2>/dev/null || apk add --no-cache openjdk17-jdk && java -version`,
        fedora: `dnf install -y java-${version || "21"}-openjdk-devel 2>/dev/null || dnf install -y java-${version || "17"}-openjdk-devel 2>/dev/null || dnf install -y java-17-openjdk-devel && java -version`,
        debian: `apt-get update && apt-get install -y openjdk-${version || "17"}-jdk && java -version`,
        ubuntu: `apt-get update && apt-get install -y openjdk-${version || "21"}-jdk 2>/dev/null || apt-get install -y openjdk-${version || "17"}-jdk && java -version`,
      },
      go: {
        // Go: Download from golang.org for consistent version across all distros
        alpine: version
          ? `apk add --no-cache curl && curl -fsSL https://go.dev/dl/go${version}.linux-amd64.tar.gz | tar -C /usr/local -xzf - && ln -sf /usr/local/go/bin/go /usr/bin/go && ln -sf /usr/local/go/bin/gofmt /usr/bin/gofmt && go version`
          : `apk add --no-cache go && go version`,
        fedora: version
          ? `dnf install -y curl tar && curl -fsSL https://go.dev/dl/go${version}.linux-amd64.tar.gz | tar -C /usr/local -xzf - && ln -sf /usr/local/go/bin/go /usr/bin/go && ln -sf /usr/local/go/bin/gofmt /usr/bin/gofmt && go version`
          : `dnf install -y golang && go version`,
        debian: version
          ? `apt-get update && apt-get install -y curl && curl -fsSL https://go.dev/dl/go${version}.linux-amd64.tar.gz | tar -C /usr/local -xzf - && ln -sf /usr/local/go/bin/go /usr/bin/go && ln -sf /usr/local/go/bin/gofmt /usr/bin/gofmt && go version`
          : `apt-get update && apt-get install -y golang-go && go version`,
        ubuntu: version
          ? `apt-get update && apt-get install -y curl && curl -fsSL https://go.dev/dl/go${version}.linux-amd64.tar.gz | tar -C /usr/local -xzf - && ln -sf /usr/local/go/bin/go /usr/bin/go && ln -sf /usr/local/go/bin/gofmt /usr/bin/gofmt && go version`
          : `apt-get update && apt-get install -y golang-go && go version`,
      },
      rust: {
        // Rust: Use rustup for consistent version across all distros
        alpine: `apk add --no-cache curl gcc musl-dev && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y ${version ? `--default-toolchain ${version}` : ""} && . /root/.cargo/env && ln -sf /root/.cargo/bin/rustc /usr/bin/rustc 2>/dev/null; ln -sf /root/.cargo/bin/cargo /usr/bin/cargo 2>/dev/null; rustc --version`,
        fedora: `dnf install -y curl gcc && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y ${version ? `--default-toolchain ${version}` : ""} && . /root/.cargo/env && ln -sf /root/.cargo/bin/rustc /usr/bin/rustc 2>/dev/null; ln -sf /root/.cargo/bin/cargo /usr/bin/cargo 2>/dev/null; rustc --version`,
        debian: `apt-get update && apt-get install -y curl gcc && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y ${version ? `--default-toolchain ${version}` : ""} && . /root/.cargo/env && ln -sf /root/.cargo/bin/rustc /usr/bin/rustc 2>/dev/null; ln -sf /root/.cargo/bin/cargo /usr/bin/cargo 2>/dev/null; rustc --version`,
        ubuntu: `apt-get update && apt-get install -y curl gcc && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y ${version ? `--default-toolchain ${version}` : ""} && . /root/.cargo/env && ln -sf /root/.cargo/bin/rustc /usr/bin/rustc 2>/dev/null; ln -sf /root/.cargo/bin/cargo /usr/bin/cargo 2>/dev/null; rustc --version`,
      },
      php: {
        // PHP: Install from package manager
        alpine: `apk add --no-cache php${version ? version.replace(".", "") : ""} php${version ? version.replace(".", "") : ""}-cli php${version ? version.replace(".", "") : ""}-mbstring php${version ? version.replace(".", "") : ""}-xml php${version ? version.replace(".", "") : ""}-curl 2>/dev/null || apk add --no-cache php php-cli php-mbstring php-xml php-curl php-phar php-iconv php-openssl && php --version`,
        fedora: `dnf install -y php-cli php-mbstring php-xml php-curl && php --version`,
        debian: `apt-get update && apt-get install -y php php-cli php-mbstring php-xml php-curl && php --version`,
        ubuntu: version
          ? `apt-get update && apt-get install -y software-properties-common && add-apt-repository -y ppa:ondrej/php && apt-get update && apt-get install -y php${version} php${version}-cli php${version}-mbstring php${version}-xml php${version}-curl && php --version`
          : `apt-get update && apt-get install -y php php-cli php-mbstring php-xml php-curl && php --version`,
      },
      ruby: {
        // Ruby: Install from package manager
        alpine: `apk add --no-cache ruby ruby-dev ruby-bundler && ruby --version`,
        fedora: `dnf install -y ruby ruby-devel rubygem-bundler && ruby --version`,
        debian: `apt-get update && apt-get install -y ruby ruby-dev ruby-bundler && ruby --version`,
        ubuntu: `apt-get update && apt-get install -y ruby ruby-dev ruby-bundler && ruby --version`,
      },
      dotnet: {
        // .NET: Use Microsoft's install script for consistent version
        alpine: `apk add --no-cache bash icu-libs krb5-libs libgcc libintl libssl3 libstdc++ zlib curl && curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel ${version || "8.0"} --install-dir /usr/share/dotnet && ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet && dotnet --version`,
        fedora: `dnf install -y dotnet-sdk-${version || "8.0"} 2>/dev/null || (dnf install -y curl libicu && curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel ${version || "8.0"} --install-dir /usr/share/dotnet && ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet) && dotnet --version`,
        debian: `apt-get update && apt-get install -y curl libicu-dev && curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel ${version || "8.0"} --install-dir /usr/share/dotnet && ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet && dotnet --version`,
        ubuntu: `apt-get update && (apt-get install -y dotnet-sdk-${version || "8.0"} 2>/dev/null || (apt-get install -y curl libicu-dev && curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel ${version || "8.0"} --install-dir /usr/share/dotnet && ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet)) && dotnet --version`,
      },
    };

    const runtimeCmds = commands[runtime];
    if (!runtimeCmds) return null;

    let cmd: string;
    if (isAlpine) {
      cmd = runtimeCmds.alpine;
    } else if (isFedoraRocky) {
      cmd = runtimeCmds.fedora;
    } else if (isDebian) {
      cmd = runtimeCmds.debian;
    } else {
      // Default to Ubuntu (includes PPA support)
      cmd = runtimeCmds.ubuntu;
    }

    // Add error handling wrapper
    return ["sh", "-c", `set -e; ${cmd}`];
  }

  /**
   * Ensure both sandbox networks exist
   * @deprecated Use NetworkService.ensureNetworks() directly
   */
  static async ensureNetwork(): Promise<string> {
    await NetworkService.ensureNetworks();
    return NetworkService.getNetworkId("isolated");
  }

  static async create(options: CreateContainerOptions): Promise<string> {
    // Get settings from database
    const settings = await getAppSettings();

    // Check if image is allowed (only if allowedImagesOnly is enabled)
    if (settings.allowedImagesOnly && !ALLOWED_IMAGES.includes(options.image as AllowedImage)) {
      throw new Error(`Image not allowed: ${options.image}`);
    }

    const userContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.userId, options.userId));

    if (userContainers.length >= settings.maxContainersPerUser) {
      throw new Error(`Maximum sandbox limit reached (${settings.maxContainersPerUser})`);
    }

    // Check for unique display name per user
    const existingWithName = userContainers.find(
      (c) => c.displayName.toLowerCase() === options.displayName.toLowerCase()
    );
    if (existingWithName) {
      throw new Error(`A sandbox with the name "${options.displayName}" already exists`);
    }

    const containerDbId = nanoid();
    const containerName = `sandbox-${options.userId.slice(0, 8)}-${containerDbId.slice(0, 8)}`;

    // Use settings for defaults and validate against maximums
    const cpuLimit = Math.min(
      options.cpuLimit || settings.defaultCpuCores,
      settings.maxCpuCores
    );
    const memoryLimitMb = Math.min(
      options.memoryLimitMb || settings.defaultMemoryMb,
      settings.maxMemoryMb
    );

    // Create database record first with "creating" status
    await db.insert(containers).values({
      id: containerDbId,
      userId: options.userId,
      containerId: "", // Will be updated after Docker container creation
      containerName,
      displayName: options.displayName,
      image: options.image,
      status: "creating",
      creationProgress: 0,
      creationStep: "Initializing...",
      cpuLimit,
      memoryLimitMb,
      diskLimitMb: Math.min(options.diskLimitMb || settings.defaultDiskMb, settings.maxDiskMb),
      networkId: null,
      internalIp: null,
      runtimes: options.runtimes || [],
      runtimeVersions: options.runtimeVersions || {},
    });

    if (options.ports?.length) {
      await db.insert(portMappings).values(
        options.ports.map((p) => ({
          id: nanoid(),
          containerId: containerDbId,
          serviceName: p.serviceName,
          internalPort: p.port,
          protocol: p.protocol || "tcp",
        }))
      );
    }

    // Run setup in background (don't await)
    this.setupContainer(containerDbId, containerName, options, settings).catch((err) => {
      console.error("Background container setup failed:", err);
    });

    await this.logAction(
      options.userId,
      "container.create",
      "container",
      containerDbId,
      {
        image: options.image,
        displayName: options.displayName,
      }
    );

    return containerDbId;
  }

  /**
   * Setup container in background with progress tracking
   */
  private static async setupContainer(
    containerDbId: string,
    containerName: string,
    options: CreateContainerOptions,
    settings: Awaited<ReturnType<typeof getAppSettings>>
  ): Promise<void> {
    // Helper to update progress with SSE broadcast
    const progress = async (
      pct: number,
      step: string,
      status?: "creating" | "initializing" | "stopped" | "error",
      error?: string
    ) => {
      await this.updateProgress(containerDbId, pct, step, status, error, options.userId);
    };

    try {
      // Step 1: Ensure networks exist (5%)
      await progress(5, "Setting up network...", "initializing");
      await NetworkService.ensureNetworks();

      // Always start with internet network to install essential tools
      // We'll switch to isolated network after setup is complete
      const needsRuntimeInstall = options.runtimes && options.runtimes.length > 0;
      const initialNetwork = SANDBOX_NETWORK_INTERNET;

      console.log(`Container will start in ${initialNetwork} network for setup (needs runtime install: ${needsRuntimeInstall})`);

      // Step 2: Pull image if needed (10-20%)
      await progress(10, `Pulling image ${options.image}...`);
      await this.pullImageIfNeeded(options.image);
      await progress(20, "Image ready");

      // Step 3: Create Docker container (25%)
      await progress(25, "Creating container...");
      const shell = options.image.includes("alpine") ? "/bin/sh" : "/bin/bash";

      // Environment variables that tell common frameworks to bind to 0.0.0.0
      // This makes services accessible from outside the container
      const serviceEnv = [
        // Universal host binding
        "HOST=0.0.0.0",                    // Vite, React CRA, Vue CLI, many Node.js servers
        "HOSTNAME=0.0.0.0",                // Some frameworks use HOSTNAME
        "BIND_HOST=0.0.0.0",               // Generic
        "SERVER_HOST=0.0.0.0",             // Some frameworks
        // Vite specific
        "VITE_HOST=true",                  // Vite internal
        "VITE_DEV_SERVER_HOST=0.0.0.0",    // Vite dev server
        // Next.js
        "NEXT_HOST=0.0.0.0",               // Next.js
        // Nuxt
        "NUXT_HOST=0.0.0.0",               // Nuxt.js
        // Python frameworks
        "FLASK_RUN_HOST=0.0.0.0",          // Flask
        "DJANGO_ALLOWED_HOSTS=*",          // Django
        "UVICORN_HOST=0.0.0.0",            // Uvicorn (FastAPI)
        "GUNICORN_BIND=0.0.0.0:8000",      // Gunicorn
        "STREAMLIT_SERVER_ADDRESS=0.0.0.0", // Streamlit
        "GRADIO_SERVER_NAME=0.0.0.0",      // Gradio
        // Ruby
        "RAILS_BIND=0.0.0.0",              // Rails
        "WEBRICK_HOST=0.0.0.0",            // WEBrick
        // PHP
        "PHP_CLI_SERVER_WORKERS=1",        // PHP built-in server hint
        // Misc
        "CHOKIDAR_USEPOLLING=true",        // File watcher polling (needed in containers)
        "WATCHPACK_POLLING=true",          // Webpack file watching
      ];

      const container = await docker.createContainer({
        name: containerName,
        Image: options.image,
        Tty: true,
        OpenStdin: true,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Cmd: [shell],
        WorkingDir: "/home/sandbox",
        Env: serviceEnv,
        HostConfig: {
          // Use isolated network by default, or internet network if runtimes need to be installed
          NetworkMode: initialNetwork,
          NanoCpus: (options.cpuLimit || settings.defaultCpuCores) * 1e9,
          CpuShares: 512,
          Memory: (options.memoryLimitMb || settings.defaultMemoryMb) * 1024 * 1024,
          MemorySwap: (options.memoryLimitMb || settings.defaultMemoryMb) * 1024 * 1024,
          MemoryReservation: Math.floor((options.memoryLimitMb || settings.defaultMemoryMb) * 0.5) * 1024 * 1024,
          PidsLimit: DEFAULT_CONTAINER_CONFIG.pidsLimit,
          // Only set no-new-privileges if sudo is disabled for security
          // When sudo is enabled, we need to allow privilege escalation for sudo to work
          SecurityOpt: settings.sudoEnabled ? [] : ["no-new-privileges:true"],
          CapDrop: ["ALL"],
          CapAdd: [
            "CHOWN",        // Change file ownership
            "SETUID",       // Set user ID on execution
            "SETGID",       // Set group ID on execution
            "DAC_OVERRIDE", // Bypass file permission checks
            "FOWNER",       // Bypass ownership checks
            "MKNOD",        // Create special files (needed by some packages)
            "NET_BIND_SERVICE", // Bind to ports below 1024
            "KILL",         // Send signals to processes
            "SYS_CHROOT",   // Use chroot (needed by some package scripts)
            "AUDIT_WRITE",  // Write to audit log
          ],
          Privileged: false,
          Ulimits: [
            { Name: "nofile", Soft: 1024, Hard: 2048 },
            { Name: "core", Soft: 0, Hard: 0 },
          ],
          Tmpfs: { "/tmp": "rw,noexec,nosuid,size=100m" },
          Dns: ["8.8.8.8", "8.8.4.4"],
          Binds: [],
        },
        Labels: {
          "sandbox.user_id": options.userId,
          "sandbox.db_id": containerDbId,
          "sandbox.managed": "true",
          "sandbox.created_at": new Date().toISOString(),
        },
      });

      // Update container ID and network in database
      const networkId = await NetworkService.getNetworkId(
        needsRuntimeInstall ? "internet" : "isolated"
      );
      await db
        .update(containers)
        .set({
          containerId: container.id,
          networkId,
          currentNetwork: initialNetwork,
          internetAccess: true, // Always true during setup for essential tools installation
          installationMode: true,
        })
        .where(eq(containers.id, containerDbId));

      // Step 4: Start container for setup (30%)
      await progress(30, "Starting container for setup...");
      const dockerContainer = docker.getContainer(container.id);
      await dockerContainer.start();

      // Helper to execute a command and wait for completion with output capture
      const execAndWait = async (cmd: string[], user = "root", timeout = 60000): Promise<{ success: boolean; output: string; timedOut?: boolean }> => {
        const exec = await dockerContainer.exec({
          Cmd: cmd,
          AttachStdout: true,
          AttachStderr: true,
          User: user,
        });
        const stream = await exec.start({ hijack: true, stdin: false });

        // Capture output for debugging
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        let timedOut = false;
        let timeoutId: NodeJS.Timeout | null = null;

        await new Promise<void>((resolve) => {
          const cleanup = () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          };

          stream.on("end", () => {
            cleanup();
            resolve();
          });
          stream.on("error", (err) => {
            console.error("Exec stream error:", err);
            cleanup();
            resolve();
          });

          timeoutId = setTimeout(() => {
            timedOut = true;
            console.warn(`Command timed out after ${timeout}ms:`, cmd.join(" "));
            // Try to destroy the stream to release resources
            try {
              stream.destroy();
            } catch {
              // Ignore stream destroy errors
            }
            resolve();
          }, timeout);
        });

        // Check exit code - may be null if command was killed or still running
        let exitCode: number | null = null;
        try {
          const execInspect = await exec.inspect();
          exitCode = execInspect.ExitCode;
        } catch {
          // Ignore inspect errors
        }

        const output = Buffer.concat(chunks).toString("utf-8");
        const success = !timedOut && exitCode === 0;

        if (!success) {
          if (timedOut) {
            console.error(`Command timed out after ${timeout}ms:`, cmd.join(" "));
          } else {
            console.error(`Command failed with exit code ${exitCode}:`, cmd.join(" "));
          }
          console.error("Output:", output.substring(0, 2000)); // Limit output log
        }

        return { success, output, timedOut };
      };

      // Detect distro type for package manager selection
      const isAlpine = options.image.includes("alpine");
      const isFedoraRocky = options.image.includes("fedora") || options.image.includes("rocky");
      const isDebian = options.image.includes("debian"); // Debian doesn't support PPAs, so needs different commands than Ubuntu

      // Step 5: Create sandbox user with dynamic name based on displayName (35%)
      await progress(35, "Creating sandbox user...");
      // The displayName is now URL-compatible (lowercase letters, numbers, hyphens, underscores)
      // For Unix username, we replace hyphens/underscores with nothing and keep only alphanumeric
      const sandboxUsername = options.displayName
        .replace(/[-_]/g, "")
        .slice(0, 32) || "sandbox";

      const createUserCmd = isAlpine
        ? ["sh", "-c", `id -u ${sandboxUsername} 2>/dev/null || adduser -D -u 1000 -g 1000 -h /home/${sandboxUsername} -s /bin/sh ${sandboxUsername}`]
        : ["sh", "-c", `id -u ${sandboxUsername} 2>/dev/null || (groupadd -g 1000 ${sandboxUsername} 2>/dev/null || true; useradd -u 1000 -g 1000 -m -s /bin/bash -d /home/${sandboxUsername} ${sandboxUsername} 2>/dev/null || true)`];

      // User creation is critical - retry up to 3 times with increasing timeout
      let userCreated = false;
      for (let attempt = 1; attempt <= 3 && !userCreated; attempt++) {
        const result = await execAndWait(createUserCmd, "root", 30000 * attempt);
        if (result.success || !result.timedOut) {
          userCreated = true;
        } else {
          console.warn(`User creation attempt ${attempt} timed out, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause before retry
        }
      }

      if (!userCreated) {
        console.error(`Failed to create user ${sandboxUsername} after 3 attempts`);
      }

      // Set up shell profile and home directory ownership for sandbox user
      const homeDir = `/home/${sandboxUsername}`;
      const setupShellCmd = isAlpine
        ? ["sh", "-c", `
chown -R ${sandboxUsername}:${sandboxUsername} /workspace 2>/dev/null || true
chown -R ${sandboxUsername}:${sandboxUsername} ${homeDir} 2>/dev/null || true
cat > ${homeDir}/.profile << EOF
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\\$PATH"
export HOME="${homeDir}"
export PS1='${sandboxUsername}@sandbox:\\w\\$ '
EOF
chown ${sandboxUsername}:${sandboxUsername} ${homeDir}/.profile 2>/dev/null || true
        `]
        : ["sh", "-c", `
chown -R ${sandboxUsername}:${sandboxUsername} /workspace 2>/dev/null || true
chown -R ${sandboxUsername}:${sandboxUsername} ${homeDir} 2>/dev/null || true
cat > ${homeDir}/.bashrc << EOF
# Sandbox user bashrc
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\\$PATH"
export HOME="${homeDir}"
export PS1='\\[\\033[01;32m\\]${sandboxUsername}@sandbox\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '
EOF
chown ${sandboxUsername}:${sandboxUsername} ${homeDir}/.bashrc 2>/dev/null || true
        `];
      await execAndWait(setupShellCmd);

      // Store the username in the database
      await db
        .update(containers)
        .set({ sandboxUsername })
        .where(eq(containers.id, containerDbId));

      // Step 6: Install sudo and add user to sudo group (40%)
      const sudoEnabled = await getSetting("sudoEnabled");
      if (sudoEnabled) {
        await progress(40, "Installing sudo...");
        let installSudoCmd: string[];
        if (isAlpine) {
          // Alpine uses 'wheel' group for sudo access
          installSudoCmd = ["sh", "-c", `apk add --no-cache sudo 2>/dev/null; addgroup ${sandboxUsername} wheel 2>/dev/null || true; echo '${sandboxUsername} ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/${sandboxUsername} && chmod 440 /etc/sudoers.d/${sandboxUsername} || true`];
        } else if (isFedoraRocky) {
          // Fedora/Rocky uses 'wheel' group for sudo access
          installSudoCmd = ["sh", "-c", `dnf install -y -q sudo 2>/dev/null || yum install -y -q sudo 2>/dev/null; usermod -aG wheel ${sandboxUsername} 2>/dev/null || true; echo '${sandboxUsername} ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/${sandboxUsername} && chmod 440 /etc/sudoers.d/${sandboxUsername} || true`];
        } else {
          // Debian/Ubuntu uses 'sudo' group
          installSudoCmd = ["sh", "-c", `apt-get update -qq 2>/dev/null && apt-get install -y -qq sudo 2>/dev/null; usermod -aG sudo ${sandboxUsername} 2>/dev/null || true; echo '${sandboxUsername} ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/${sandboxUsername} && chmod 440 /etc/sudoers.d/${sandboxUsername} || true`];
        }
        await execAndWait(installSudoCmd, "root", 120000);
      }

      // Step 6b: Install essential tools (editors, utilities, etc.) (42%)
      await progress(42, "Installing essential tools...");
      const essentialToolsCmd = getEssentialToolsInstallCommand(isAlpine, isFedoraRocky);
      console.log("Installing essential tools:", essentialToolsCmd[2].substring(0, 200) + "...");
      const toolsResult = await execAndWait(essentialToolsCmd, "root", 300000); // 5 min timeout for essential tools
      if (!toolsResult.success) {
        console.warn("Essential tools installation may have failed:", toolsResult.output.substring(0, 500));
      } else {
        console.log("Essential tools installed successfully");
      }

      // Step 6c: Install helper scripts (sysinfo, ports, search, envinfo, download, serve, etc.) (44%)
      await progress(44, "Installing helper scripts...");
      const helperScriptsCmd = getHelperScriptsInstallCommand();
      const scriptsResult = await execAndWait(helperScriptsCmd, "root", 60000);
      if (!scriptsResult.success) {
        console.warn("Helper scripts installation may have failed:", scriptsResult.output.substring(0, 300));
      } else {
        console.log("Helper scripts installed: sysinfo, ports, search, envinfo, download, serve, diskusage, backup, gitstatus, killport");
      }

      // Step 7: Install runtimes (45-80%)
      if (options.runtimes && options.runtimes.length > 0) {
        console.log(`Installing ${options.runtimes.length} runtime(s):`, options.runtimes);
        const runtimeCount = options.runtimes.length;
        const progressPerRuntime = 35 / runtimeCount; // 35% for all runtimes (45% to 80%)

        for (let i = 0; i < options.runtimes.length; i++) {
          const runtime = options.runtimes[i];
          const version = options.runtimeVersions?.[runtime];
          const runtimeProgress = Math.round(45 + (i * progressPerRuntime));

          console.log(`Installing runtime: ${runtime}${version ? ` v${version}` : ""}`);
          await progress(runtimeProgress, `Installing ${runtime}${version ? ` v${version}` : ""}...`);

          const installCmd = this.getRuntimeInstallCommand(runtime, version, isAlpine, isFedoraRocky, isDebian);
          if (installCmd) {
            console.log(`Running install command:`, installCmd.join(" "));
            const result = await execAndWait(installCmd, "root", 300000); // 5 min timeout for runtime install
            if (!result.success) {
              console.error(`Runtime ${runtime} installation may have failed. Continuing anyway...`);
              // Don't fail the entire setup, just log the error
            } else {
              console.log(`Runtime ${runtime} installed successfully`);
            }
          } else {
            console.warn(`No install command found for runtime: ${runtime}`);
          }
        }
      } else {
        console.log("No runtimes selected for installation");
      }

      // Step 8: Setup workspace and service tools (82-88%)
      await progress(82, "Setting up workspace...");
      await execAndWait(["mkdir", "-p", "/workspace"]);
      await execAndWait(["chown", "-R", "1000:1000", "/workspace"]);

      // Setup user home directory with proper shell configuration
      // User will start in their home directory (/home/${sandboxUsername})
      const setupHomeCmd = `
        mkdir -p /home/${sandboxUsername} &&
        chown -R 1000:1000 /home/${sandboxUsername} &&
        touch /home/${sandboxUsername}/.bashrc /home/${sandboxUsername}/.profile &&
        chown 1000:1000 /home/${sandboxUsername}/.bashrc /home/${sandboxUsername}/.profile &&
        echo 'export PS1="\\u@sandbox:\\w\\$ "' >> /home/${sandboxUsername}/.bashrc &&
        echo 'export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"' >> /home/${sandboxUsername}/.bashrc &&
        echo '[ -f ~/.bashrc ] && . ~/.bashrc' >> /home/${sandboxUsername}/.profile
      `;
      await execAndWait(["sh", "-c", setupHomeCmd], "root", 30000);

      // Step 8b: Install socat for port forwarding (85%)
      await progress(85, "Installing service tools...");
      let installSocatCmd: string[];
      if (isAlpine) {
        installSocatCmd = ["sh", "-c", "apk add --no-cache socat 2>/dev/null || true"];
      } else if (isFedoraRocky) {
        installSocatCmd = ["sh", "-c", "dnf install -y -q socat 2>/dev/null || yum install -y -q socat 2>/dev/null || true"];
      } else {
        installSocatCmd = ["sh", "-c", "apt-get update -qq && apt-get install -y -qq socat 2>/dev/null || true"];
      }
      await execAndWait(installSocatCmd, "root", 60000);

      // Step 8c: Create expose-port helper script (87%)
      await progress(87, "Creating helper scripts...");
      const exposePortScript = `#!/bin/bash
# expose-port: Forward a port from 0.0.0.0 to localhost
# Usage: expose-port <port>
# This allows services bound to localhost to be accessible from outside

if [ -z "$1" ]; then
  echo "Usage: expose-port <port>"
  echo "Example: expose-port 5173"
  exit 1
fi

PORT=$1
CONTAINER_IP=$(hostname -I | awk '{print $1}')

if [ -z "$CONTAINER_IP" ]; then
  echo "Error: Could not determine container IP"
  exit 1
fi

# Check if socat is installed
if ! command -v socat &> /dev/null; then
  echo "Error: socat is not installed"
  exit 1
fi

# Kill any existing forwarder for this port
pkill -f "socat.*LISTEN:$PORT" 2>/dev/null || true

echo "Forwarding $CONTAINER_IP:$PORT -> localhost:$PORT"
echo "Your service will be accessible via the sandbox service URL"
echo "Press Ctrl+C to stop forwarding"
socat TCP-LISTEN:$PORT,bind=$CONTAINER_IP,reuseaddr,fork TCP:127.0.0.1:$PORT
`;

      await execAndWait(["sh", "-c", `cat > /usr/local/bin/expose-port << 'SCRIPT_EOF'
${exposePortScript}
SCRIPT_EOF
chmod +x /usr/local/bin/expose-port`], "root", 30000);

      // Step 8d: Create universal dev server auto-config (88%)
      await progress(88, "Configuring dev server auto-config...");

      // Shell profile for environment variables - sourced on every shell
      const shellProfileScript = `# Sandbox Dev Server Auto-Configuration
# This file is sourced automatically to configure dev servers

# Universal host binding for all frameworks
export HOST=0.0.0.0
export HOSTNAME=0.0.0.0
export BIND_HOST=0.0.0.0

# Node.js / JavaScript frameworks
export VITE_HOST=0.0.0.0
export NEXT_HOST=0.0.0.0
export NUXT_HOST=0.0.0.0

# Python frameworks
export FLASK_RUN_HOST=0.0.0.0
export UVICORN_HOST=0.0.0.0
export DJANGO_ALLOWED_HOSTS='*'
export GUNICORN_BIND=0.0.0.0:8000
export STREAMLIT_SERVER_ADDRESS=0.0.0.0

# Ruby
export RAILS_BIND=0.0.0.0
export WEBRICK_HOST=0.0.0.0

# Go
export GIN_MODE=debug

# PHP
export PHP_CLI_SERVER_WORKERS=1

# Aliases for common dev commands with auto --host
alias vite='npx vite --host'
alias next='npx next dev -H 0.0.0.0'
alias nuxt='npx nuxt dev --host 0.0.0.0'
alias astro='npx astro dev --host 0.0.0.0'
alias remix='npx remix dev --host 0.0.0.0'
alias svelte='npx vite dev --host'
alias vue='npx vite --host'
alias react-scripts='npx react-scripts start'
`;

      // Create shell profile
      await execAndWait(["sh", "-c", `mkdir -p /etc/profile.d && cat > /etc/profile.d/sandbox-dev.sh << 'PROFILE_EOF'
${shellProfileScript}
PROFILE_EOF
chmod +x /etc/profile.d/sandbox-dev.sh`], "root", 30000);

      // Also add to .bashrc and .profile for sandbox user
      await execAndWait(["sh", "-c", `
echo 'source /etc/profile.d/sandbox-dev.sh 2>/dev/null || true' >> /home/${sandboxUsername}/.bashrc 2>/dev/null || true
echo 'source /etc/profile.d/sandbox-dev.sh 2>/dev/null || true' >> /home/${sandboxUsername}/.profile 2>/dev/null || true
echo 'source /etc/profile.d/sandbox-dev.sh 2>/dev/null || true' >> /root/.bashrc 2>/dev/null || true
`], "root", 30000);

      // Create NPM wrapper that auto-configures vite/next/etc
      const npmWrapperScript = `#!/bin/bash
# NPM wrapper that auto-configures dev servers

REAL_NPM=$(which npm.real 2>/dev/null || which npm)

# Check if running a dev command
if [[ "$1" == "run" && "$2" == "dev" ]] || [[ "$1" == "run" && "$2" == "start" ]]; then
  # Check if package.json exists and contains vite
  if [ -f "package.json" ]; then
    if grep -q '"vite"' package.json 2>/dev/null; then
      # Vite project - add --host if not already present
      if [[ ! " $* " =~ " --host " ]] && [[ ! " $* " =~ " -- --host" ]]; then
        exec $REAL_NPM "$@" -- --host
      fi
    fi
  fi
fi

# Default: run npm as-is
exec $REAL_NPM "$@"
`;

      // Create vite wrapper with auto --host
      const viteWrapperScript = `#!/bin/bash
# Vite wrapper that auto-adds --host flag

REAL_VITE=$(npm root)/.bin/vite.real
if [ ! -f "$REAL_VITE" ]; then
  REAL_VITE=$(which vite.real 2>/dev/null)
fi
if [ ! -f "$REAL_VITE" ]; then
  # No .real backup, use npx
  if [[ ! " $* " =~ " --host" ]]; then
    exec npx vite "$@" --host
  else
    exec npx vite "$@"
  fi
fi

# Add --host if not present
if [[ ! " $* " =~ " --host" ]]; then
  exec "$REAL_VITE" "$@" --host
else
  exec "$REAL_VITE" "$@"
fi
`;

      await execAndWait(["sh", "-c", `cat > /usr/local/bin/vite-wrapper << 'WRAPPER_EOF'
${viteWrapperScript}
WRAPPER_EOF
chmod +x /usr/local/bin/vite-wrapper`], "root", 30000);

      // Create a global npmrc that sets scripts-prepend-node-path
      await execAndWait(["sh", "-c", `
mkdir -p /home/${sandboxUsername}/.npm-global
echo 'prefix=/home/${sandboxUsername}/.npm-global' > /home/${sandboxUsername}/.npmrc
echo 'export PATH=/home/${sandboxUsername}/.npm-global/bin:\$PATH' >> /home/${sandboxUsername}/.bashrc
chown -R 1000:1000 /home/${sandboxUsername}/.npm-global /home/${sandboxUsername}/.npmrc
`], "root", 30000);

      // Create default vite.config.js template that users can copy
      const viteConfigTemplate = `// Default Vite configuration for sandbox environment
// Copy this to your project: cp /etc/sandbox/vite.config.template.js vite.config.js

export default {
  server: {
    host: true,  // Listen on all addresses (0.0.0.0)
    strictPort: false,
    watch: {
      usePolling: true,  // Required for some container environments
    },
    hmr: {
      // HMR might not work through proxy, use polling instead
      overlay: true,
    },
  },
  preview: {
    host: true,
  },
};
`;

      const nextConfigTemplate = `// Default Next.js configuration for sandbox environment
// Copy this to your project: cp /etc/sandbox/next.config.template.js next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Listen on all addresses
  experimental: {
    // Enable if needed
  },
};

module.exports = nextConfig;
`;

      await execAndWait(["sh", "-c", `
mkdir -p /etc/sandbox
cat > /etc/sandbox/vite.config.template.js << 'VITE_CONF'
${viteConfigTemplate}
VITE_CONF

cat > /etc/sandbox/next.config.template.mjs << 'NEXT_CONF'
${nextConfigTemplate}
NEXT_CONF
`], "root", 30000);

      // Create a post-install hook for npm that patches vite config
      const postInstallScript = `#!/bin/bash
# Auto-configure vite after npm install

# Check if vite is in package.json
if [ -f "package.json" ] && grep -q '"vite"' package.json 2>/dev/null; then
  # Check if vite.config exists
  if [ ! -f "vite.config.js" ] && [ ! -f "vite.config.ts" ] && [ ! -f "vite.config.mjs" ]; then
    echo "[Sandbox] Creating vite.config.js with host:true for external access..."
    cat > vite.config.js << 'VITE_AUTO'
// Auto-generated by sandbox for external access
export default {
  server: {
    host: true,
    watch: { usePolling: true }
  }
};
VITE_AUTO
  else
    # Config exists, check if host is configured
    for conf in vite.config.js vite.config.ts vite.config.mjs; do
      if [ -f "$conf" ]; then
        if ! grep -q "host.*true\\|host.*:.*true\\|host:.*0.0.0.0" "$conf" 2>/dev/null; then
          echo "[Sandbox] Note: Add 'server: { host: true }' to $conf for external access"
        fi
        break
      fi
    done
  fi
fi
`;

      await execAndWait(["sh", "-c", `cat > /usr/local/bin/sandbox-post-install << 'POSTINST_EOF'
${postInstallScript}
POSTINST_EOF
chmod +x /usr/local/bin/sandbox-post-install`], "root", 30000);

      // Create service-info script with updated info
      const serviceHintScript = `#!/bin/bash
echo ""
echo "=== Sandbox Dev Server Configuration ==="
echo ""
echo "Your dev servers are AUTO-CONFIGURED to be accessible externally!"
echo ""
echo "Just run your project normally:"
echo "  npm run dev"
echo "  yarn dev"
echo "  pnpm dev"
echo ""
echo "The sandbox automatically:"
echo "  ✓ Sets HOST=0.0.0.0 environment variable"
echo "  ✓ Configures Vite, Next.js, and other frameworks"
echo "  ✓ Creates vite.config.js if missing (with host:true)"
echo ""
echo "If auto-config doesn't work, you can:"
echo "  1. Use: vite --host (alias auto-adds --host)"
echo "  2. Use: expose-port <port> (for stubborn servers)"
echo "  3. Copy template: cp /etc/sandbox/vite.config.template.js vite.config.js"
echo ""
`;

      await execAndWait(["sh", "-c", `cat > /usr/local/bin/service-info << 'SCRIPT_EOF'
${serviceHintScript}
SCRIPT_EOF
chmod +x /usr/local/bin/service-info`], "root", 30000);

      // Step 9: Configure network based on defaultInternetAccess setting (90%)
      await progress(90, "Configuring network access...");

      // Check if containers should have internet access by default
      const defaultInternetAccess = await getSetting("defaultInternetAccess");
      const globalInternetEnabled = await getSetting("globalInternetEnabled");

      // Container gets internet by default only if:
      // 1. Global internet is enabled (master switch)
      // 2. Default internet access is enabled
      const shouldHaveInternet = globalInternetEnabled && defaultInternetAccess;

      if (shouldHaveInternet) {
        // Keep internet access - container stays on internet network
        console.log("Container will have internet access by default (as per settings)");
        await db
          .update(containers)
          .set({
            currentNetwork: SANDBOX_NETWORK_INTERNET,
            internetAccess: true,
            installationMode: false,
          })
          .where(eq(containers.id, containerDbId));
      } else {
        // Switch to isolated network - no internet access
        console.log("Switching container to isolated network after setup complete...");
        try {
          await NetworkService.disableInternetAfterInstallation(
            container.id,
            containerDbId
          );
          console.log("Container switched to isolated network successfully");
        } catch (err) {
          console.warn("Failed to switch to isolated network:", err);
          // Update database anyway
          await db
            .update(containers)
            .set({
              currentNetwork: SANDBOX_NETWORK_ISOLATED,
              internetAccess: false,
              installationMode: false,
            })
            .where(eq(containers.id, containerDbId));
        }
      }

      // Step 10: Stop container (95%)
      await progress(95, "Finalizing setup...");
      await dockerContainer.stop({ t: 5 });

      // Step 11: Complete (100%)
      await progress(100, "Ready", "stopped");

    } catch (err) {
      console.error("Container setup error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error during setup";
      await progress(0, "Setup failed", "error", errorMessage);
    }
  }

  static async start(userId: string, containerDbId: string): Promise<void> {
    const containerRecord = await this.getContainerForUser(
      userId,
      containerDbId
    );

    // Don't allow starting if container is still being created
    if (containerRecord.status === "creating" || containerRecord.status === "initializing") {
      throw new Error("Container is still being created. Please wait for setup to complete.");
    }

    // Don't allow starting if there's no Docker container ID (creation failed early)
    if (!containerRecord.containerId) {
      throw new Error("Container setup incomplete. Please try recreating the sandbox.");
    }

    const container = docker.getContainer(containerRecord.containerId);

    await container.start();

    const info = await container.inspect();
    // Get IP from whichever sandbox network the container is on
    const internalIp =
      info.NetworkSettings.Networks[SANDBOX_NETWORK_ISOLATED]?.IPAddress ||
      info.NetworkSettings.Networks[SANDBOX_NETWORK_INTERNET]?.IPAddress ||
      null;

    await db
      .update(containers)
      .set({
        status: "running",
        internalIp,
        lastStartedAt: new Date(),
      })
      .where(eq(containers.id, containerDbId));

    await this.logAction(userId, "container.start", "container", containerDbId);
  }

  static async stop(userId: string, containerDbId: string): Promise<void> {
    const containerRecord = await this.getContainerForUser(
      userId,
      containerDbId
    );
    const container = docker.getContainer(containerRecord.containerId);

    await container.stop({ t: 10 });

    // Check if we should auto-revoke internet on stop
    const autoRevokeInternetOnStop = await getSetting("autoRevokeInternetOnStop");
    const shouldRevokeInternet = autoRevokeInternetOnStop && containerRecord.internetAccess;

    // Build update object
    const updateData: Record<string, unknown> = {
      status: "stopped",
      lastStoppedAt: new Date(),
    };

    // If auto-revoke is enabled and container has internet, revoke it
    if (shouldRevokeInternet) {
      updateData.internetAccess = false;
      updateData.internetExpiresAt = null;
      console.log(`[ContainerService] Auto-revoking internet access for container ${containerDbId} on stop`);
    }

    await db
      .update(containers)
      .set(updateData)
      .where(eq(containers.id, containerDbId));

    await this.logAction(userId, "container.stop", "container", containerDbId);
  }

  static async restart(userId: string, containerDbId: string): Promise<void> {
    const containerRecord = await this.getContainerForUser(
      userId,
      containerDbId
    );
    const container = docker.getContainer(containerRecord.containerId);

    await container.restart({ t: 10 });

    const info = await container.inspect();
    // Get IP from whichever sandbox network the container is on
    const internalIp =
      info.NetworkSettings.Networks[SANDBOX_NETWORK_ISOLATED]?.IPAddress ||
      info.NetworkSettings.Networks[SANDBOX_NETWORK_INTERNET]?.IPAddress ||
      null;

    await db
      .update(containers)
      .set({
        status: "running",
        internalIp,
        lastStartedAt: new Date(),
      })
      .where(eq(containers.id, containerDbId));

    await this.logAction(
      userId,
      "container.restart",
      "container",
      containerDbId
    );
  }

  static async remove(userId: string, containerDbId: string): Promise<void> {
    const containerRecord = await this.getContainerForUser(
      userId,
      containerDbId
    );

    // Mark as removing in database first
    await db
      .update(containers)
      .set({ status: "removing" })
      .where(eq(containers.id, containerDbId));

    // Try to remove the Docker container, but don't fail if it doesn't exist
    let dockerRemoved = false;
    try {
      const container = docker.getContainer(containerRecord.containerId);

      // Try to stop the container first
      try {
        await container.stop({ t: 5 });
      } catch {
        // Container might already be stopped or doesn't exist - ignore
      }

      // Try to remove the container
      try {
        await container.remove({ v: true });
        dockerRemoved = true;
      } catch (removeError: unknown) {
        // Check if the container doesn't exist (404) - that's fine, we can still clean up DB
        const errorMessage = removeError instanceof Error ? removeError.message : String(removeError);
        if (errorMessage.includes("404") || errorMessage.includes("No such container")) {
          // Container doesn't exist in Docker - this is OK, we'll just clean up the DB record
          dockerRemoved = true; // Consider it "removed" since it doesn't exist
        } else {
          // Log but don't throw - allow DB cleanup
          console.error("Docker container removal error (continuing with DB cleanup):", removeError);
        }
      }
    } catch (dockerError) {
      // Docker might be unavailable - log but continue with DB cleanup
      console.error("Docker error during removal (continuing with DB cleanup):", dockerError);
    }

    // Always delete the database record - this ensures users can clean up orphaned records
    await db.delete(containers).where(eq(containers.id, containerDbId));

    // Log the action
    await this.logAction(
      userId,
      "container.remove",
      "container",
      containerDbId,
      { dockerRemoved }
    );
  }

  static async getLogs(
    userId: string,
    containerDbId: string,
    options?: { tail?: number; since?: number }
  ): Promise<string> {
    const containerRecord = await this.getContainerForUser(
      userId,
      containerDbId
    );
    const container = docker.getContainer(containerRecord.containerId);

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: options?.tail || 100,
      since: options?.since,
    });

    return logs.toString();
  }

  static async getStats(
    userId: string,
    containerDbId: string
  ): Promise<ContainerStats> {
    const containerRecord = await this.getContainerForUser(
      userId,
      containerDbId
    );
    const container = docker.getContainer(containerRecord.containerId);

    const stats = await container.stats({ stream: false });

    // Handle cases where stats might not be available
    if (!stats.cpu_stats?.cpu_usage || !stats.precpu_stats?.cpu_usage) {
      return {
        cpuPercent: 0,
        memoryUsageMb: 0,
        memoryLimitMb: containerRecord.memoryLimitMb,
        networkRxBytes: 0,
        networkTxBytes: 0,
      };
    }

    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta =
      (stats.cpu_stats.system_cpu_usage || 0) -
      (stats.precpu_stats.system_cpu_usage || 0);
    const cpuPercent =
      systemDelta > 0
        ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100
        : 0;

    return {
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryUsageMb: Math.round((stats.memory_stats?.usage || 0) / 1024 / 1024),
      memoryLimitMb: Math.round((stats.memory_stats?.limit || containerRecord.memoryLimitMb * 1024 * 1024) / 1024 / 1024),
      networkRxBytes: stats.networks?.eth0?.rx_bytes || 0,
      networkTxBytes: stats.networks?.eth0?.tx_bytes || 0,
    };
  }

  static async syncStatus(
    userId: string,
    containerDbId: string
  ): Promise<string> {
    const containerRecord = await this.getContainerForUser(
      userId,
      containerDbId
    );

    // Don't sync if already in a transitional state
    if (containerRecord.status === "removing" || containerRecord.status === "creating") {
      return containerRecord.status;
    }

    try {
      const container = docker.getContainer(containerRecord.containerId);
      const info = await container.inspect();

      let dockerStatus: "creating" | "running" | "stopped" | "paused" | "error" | "removing";

      if (info.State.Running) {
        dockerStatus = "running";
      } else if (info.State.Paused) {
        dockerStatus = "paused";
      } else if (info.State.Restarting) {
        dockerStatus = "running"; // Treat restarting as running
      } else if (info.State.Dead || info.State.OOMKilled) {
        dockerStatus = "error";
      } else {
        dockerStatus = "stopped";
      }

      if (dockerStatus !== containerRecord.status) {
        await db
          .update(containers)
          .set({ status: dockerStatus })
          .where(eq(containers.id, containerDbId));
      }

      return dockerStatus;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if container doesn't exist (404 error)
      if (errorMessage.includes("404") || errorMessage.includes("No such container")) {
        // Container doesn't exist in Docker - mark as error so user knows to delete it
        if (containerRecord.status !== "error") {
          await db
            .update(containers)
            .set({ status: "error" })
            .where(eq(containers.id, containerDbId));
        }
        return "error";
      }

      // For other errors (Docker daemon unreachable, etc.), keep current status
      // This prevents marking containers as error when Docker is just temporarily unavailable
      console.error("Status sync error:", errorMessage);
      return containerRecord.status;
    }
  }

  static async getContainerForUser(
    userId: string,
    containerDbId: string
  ): Promise<ContainerRecord> {
    const result = await db
      .select()
      .from(containers)
      .where(
        and(eq(containers.id, containerDbId), eq(containers.userId, userId))
      )
      .limit(1);

    if (!result.length) {
      throw new Error("Container not found or access denied");
    }

    return result[0] as ContainerRecord;
  }

  static async getContainerById(
    containerDbId: string
  ): Promise<ContainerRecord | null> {
    const result = await db
      .select()
      .from(containers)
      .where(eq(containers.id, containerDbId))
      .limit(1);

    return (result[0] as ContainerRecord) || null;
  }

  /**
   * Check if a Docker container actually exists
   * Returns true if container exists, false otherwise
   */
  static async dockerContainerExists(containerId: string): Promise<boolean> {
    try {
      const container = docker.getContainer(containerId);
      await container.inspect();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Force sync all containers for a user - useful for cleaning up stale records
   */
  static async syncAllContainersForUser(userId: string): Promise<void> {
    const userContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.userId, userId));

    for (const container of userContainers) {
      // Skip containers that are in transitional states
      if (container.status === "removing" || container.status === "creating") {
        continue;
      }

      const exists = await this.dockerContainerExists(container.containerId);
      if (!exists) {
        // Container doesn't exist in Docker - mark as error
        await db
          .update(containers)
          .set({ status: "error" })
          .where(eq(containers.id, container.id));
      } else {
        // Sync the status with Docker
        try {
          await this.syncStatus(userId, container.id);
        } catch {
          // Ignore sync errors for individual containers
        }
      }
    }
  }

  private static async pullImageIfNeeded(image: string): Promise<void> {
    try {
      await docker.getImage(image).inspect();
    } catch {
      await new Promise<void>((resolve, reject) => {
        docker.pull(
          image,
          (err: Error | null, stream: NodeJS.ReadableStream | undefined) => {
            if (err) return reject(err);
            if (!stream)
              return reject(new Error("No stream returned from pull"));
            docker.modem.followProgress(
              stream,
              (progressErr: Error | null) => {
                if (progressErr) return reject(progressErr);
                resolve();
              }
            );
          }
        );
      });
    }
  }

  private static async logAction(
    userId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    await db.insert(auditLogs).values({
      id: nanoid(),
      userId,
      action,
      resourceType,
      resourceId,
      details: details ? details : null,
      ipAddress,
    });
  }
}
