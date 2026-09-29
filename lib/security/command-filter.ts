export interface CommandFilterResult {
  allowed: boolean;
  command: string;
  reason?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  category?: string;
}

export type BlockedCategory =
  | "privilege_escalation"
  | "host_probing"
  | "network_scanning"
  | "container_escape"
  | "dangerous_operations"
  | "package_managers_dangerous";

// Dangerous command patterns organized by category
const BLOCKED_PATTERNS: Record<BlockedCategory, RegExp[]> = {
  privilege_escalation: [
    /\bsu\s+-?\s*$/,                    // su or su -
    /\bsu\s+root\b/,                    // su root
    /\bsudo\s+-i\b/,                    // sudo -i (login shell)
    /\bsudo\s+su\b/,                    // sudo su
    /\bsudo\s+-s\b/,                    // sudo -s (shell)
    /\bchmod\s+[0-7]*[4-7][0-7]*s/i,    // setuid/setgid chmod
    /\bchmod\s+u\+s\b/i,                // chmod u+s
    /\bchmod\s+g\+s\b/i,                // chmod g+s
    /\bpasswd\s+root\b/,                // passwd root
    /\bvisudo\b/,                       // visudo
    /\busermod\s+-aG\s+(sudo|wheel)/i,  // Add user to sudo/wheel group
  ],

  host_probing: [
    /\bcat\s+\/proc\/1\/cgroup\b/,      // Container detection
    /\bcat\s+\/proc\/1\/environ\b/,     // Process environment
    /\bcat\s+\/proc\/1\/status\b/,      // Process status
    /\bls\s+(-la?\s+)?\/proc\/1\b/,     // List init process
    /\bcat\s+\/etc\/shadow\b/,          // Shadow file
    /\bcat\s+\/etc\/passwd\b.*root/,    // Root user info
    /\bmount\s+-t/,                     // Mount with type
    /\bmount\s+--bind/,                 // Bind mount
    /\bfdisk\b/,                        // Disk partitioning
    /\blsblk\b/,                        // Block devices
    /\bblkid\b/,                        // Block device attributes
    /\/\.\.\/\.\.\//,                   // Path traversal attempts
    /\/host\//,                         // Host filesystem access
    /\/var\/run\/docker\.sock/,         // Docker socket
    /\bcat\s+\/proc\/version\b/,        // Kernel version
    /\bdmesg\b/,                        // Kernel messages
    /\bsysctl\b/,                       // Kernel parameters
  ],

  network_scanning: [
    /\bnmap\b/,                         // Network mapper
    /\bnetcat\b/,                       // Netcat
    /\bnc\s+-[a-z]*[lzv]/,              // nc with scanning flags
    /\btelnet\s+\d{1,3}\.\d{1,3}/,      // Telnet to IP
    /\barp\s+-a\b/,                     // ARP table
    /\barp-scan\b/,                     // ARP scanner
    /\bip\s+neigh\b/,                   // IP neighbor
    /\bss\s+-[tlunpa]/,                 // Socket statistics
    /\bnetstat\s+-[tlunpa]/,            // Network statistics
    /\btcpdump\b/,                      // Packet capture
    /\bwireshark\b/,                    // Wireshark
    /\btshark\b/,                       // Terminal shark
    /\bettercap\b/,                     // Network attack tool
    /\bmasscan\b/,                      // Mass IP scanner
    /\bzmap\b/,                         // Internet scanner
    /172\.\d+\.\d+\.\d+/,               // Internal subnet probing (172.x.x.x)
    /10\.\d+\.\d+\.\d+/,                // Internal subnet probing (10.x.x.x)
    /192\.168\.\d+\.\d+/,               // Internal subnet probing (192.168.x.x)
  ],

  container_escape: [
    /\bdocker\s+(run|exec|attach)/,     // Docker commands
    /\bkubectl\b/,                      // Kubernetes
    /\bcrictl\b/,                       // Container runtime
    /\bnsenter\b/,                      // Namespace enter
    /\bunshare\b/,                      // Unshare namespaces
    /\bcapsh\b/,                        // Capability shell
    /\bsetcap\b/,                       // Set capabilities
    /\bgetcap\b/,                       // Get capabilities
    /\/dev\/sd[a-z]/,                   // Raw disk access
    /\/dev\/vd[a-z]/,                   // Virtual disk access
    /\/dev\/xvd[a-z]/,                  // Xen disk access
    /\/dev\/nvme/,                      // NVMe devices
    /\/dev\/mem\b/,                     // Physical memory
    /\/dev\/kmem\b/,                    // Kernel memory
    /\bchroot\b/,                       // Change root
    /\bpivot_root\b/,                   // Pivot root
  ],

  dangerous_operations: [
    /\brm\s+-rf\s+\/\s*$/,              // rm -rf /
    /\brm\s+-rf\s+\/\*\s*$/,            // rm -rf /*
    /\brm\s+-rf\s+--no-preserve-root/,  // Force root deletion
    /\bdd\s+if=.*of=\/dev/,             // dd to device
    /\bmkfs\b/,                         // Format filesystem
    /\bshutdown\b/,                     // Shutdown
    /\breboot\b/,                       // Reboot
    /\bhalt\b/,                         // Halt
    /\bpoweroff\b/,                     // Power off
    /\binit\s+[06]\b/,                  // Init runlevel
    /\bkillall\s+-9\s+-1\b/,            // Kill all processes
    /:\(\)\{\s*:\|:&\s*\};:/,           // Fork bomb
    /\bfork\s*while/i,                  // Fork bomb variant
    />\s*\/dev\/sda/,                   // Write to disk
    /\binsmod\b/,                       // Insert kernel module
    /\brmmod\b/,                        // Remove kernel module
    /\bmodprobe\b/,                     // Module probe
  ],

  package_managers_dangerous: [
    /\bapt\s+.*--allow-unauthenticated/,  // Bypass apt authentication
    /\bapt-get\s+.*--allow-unauthenticated/,
    /\bcurl\s+.*\|\s*bash/,             // Pipe curl to bash
    /\bwget\s+.*\|\s*bash/,             // Pipe wget to bash
    /\bcurl\s+.*\|\s*sh/,               // Pipe curl to sh
    /\bwget\s+.*\|\s*sh/,               // Pipe wget to sh
    /\bcurl\s+.*\|\s*sudo\s+bash/,      // Pipe curl to sudo bash
    /\bwget\s+.*\|\s*sudo\s+bash/,      // Pipe wget to sudo bash
    /\bpip\s+install\s+--trusted-host/, // Bypass pip SSL
    /\bnpm\s+install\s+--unsafe-perm/,  // npm unsafe permissions
  ],
};

// Risk levels by category
const CATEGORY_RISK_LEVELS: Record<BlockedCategory, CommandFilterResult["riskLevel"]> = {
  privilege_escalation: "critical",
  container_escape: "critical",
  dangerous_operations: "critical",
  host_probing: "high",
  network_scanning: "high",
  package_managers_dangerous: "medium",
};

// Human-readable category names
const CATEGORY_NAMES: Record<BlockedCategory, string> = {
  privilege_escalation: "Privilege Escalation Attempt",
  host_probing: "Host System Probing",
  network_scanning: "Network Scanning",
  container_escape: "Container Escape Attempt",
  dangerous_operations: "Dangerous System Operation",
  package_managers_dangerous: "Unsafe Package Installation",
};

export class CommandFilter {
  /**
   * Analyze a command for security risks
   */
  static analyze(command: string): CommandFilterResult {
    // Normalize the command for pattern matching
    const normalizedCmd = command.toLowerCase().trim();

    // Check against all blocked patterns
    for (const [category, patterns] of Object.entries(BLOCKED_PATTERNS) as [
      BlockedCategory,
      RegExp[]
    ][]) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedCmd) || pattern.test(command)) {
          return {
            allowed: false,
            command,
            reason: CATEGORY_NAMES[category],
            riskLevel: CATEGORY_RISK_LEVELS[category],
            category,
          };
        }
      }
    }

    // Command is allowed
    return {
      allowed: true,
      command,
      riskLevel: "low",
    };
  }

  /**
   * Check if a specific category is enabled for filtering
   */
  static shouldBlockCategory(
    category: BlockedCategory,
    settings: {
      blockPrivilegeEscalation?: boolean;
      blockHostProbing?: boolean;
      blockNetworkScanning?: boolean;
      blockContainerEscape?: boolean;
      blockDangerousOperations?: boolean;
      blockUnsafePackageInstall?: boolean;
    }
  ): boolean {
    const categorySettings: Record<BlockedCategory, boolean | undefined> = {
      privilege_escalation: settings.blockPrivilegeEscalation,
      host_probing: settings.blockHostProbing,
      network_scanning: settings.blockNetworkScanning,
      container_escape: settings.blockContainerEscape,
      dangerous_operations: settings.blockDangerousOperations,
      package_managers_dangerous: settings.blockUnsafePackageInstall,
    };

    // Default to true (block) if setting is not defined
    return categorySettings[category] !== false;
  }

  /**
   * Analyze with configurable category filtering
   */
  static analyzeWithSettings(
    command: string,
    settings: {
      blockPrivilegeEscalation?: boolean;
      blockHostProbing?: boolean;
      blockNetworkScanning?: boolean;
      blockContainerEscape?: boolean;
      blockDangerousOperations?: boolean;
      blockUnsafePackageInstall?: boolean;
    }
  ): CommandFilterResult {
    const normalizedCmd = command.toLowerCase().trim();

    for (const [category, patterns] of Object.entries(BLOCKED_PATTERNS) as [
      BlockedCategory,
      RegExp[]
    ][]) {
      // Skip if this category is disabled in settings
      if (!this.shouldBlockCategory(category, settings)) {
        continue;
      }

      for (const pattern of patterns) {
        if (pattern.test(normalizedCmd) || pattern.test(command)) {
          return {
            allowed: false,
            command,
            reason: CATEGORY_NAMES[category],
            riskLevel: CATEGORY_RISK_LEVELS[category],
            category,
          };
        }
      }
    }

    return {
      allowed: true,
      command,
      riskLevel: "low",
    };
  }

  /**
   * Extract commands from input buffer (for terminal input processing)
   * Returns commands that end with newline
   */
  static extractCommands(buffer: string): {
    commands: string[];
    remaining: string;
  } {
    const lines = buffer.split(/\r?\n/);
    const commands = lines.slice(0, -1).filter((line) => line.trim().length > 0);
    const remaining = lines[lines.length - 1];

    return { commands, remaining };
  }

  /**
   * Extract sudo command for intelligent validation
   * Returns the command being run with sudo, or null if not a sudo command
   */
  static extractSudoCommand(command: string): string | null {
    const trimmed = command.trim();
    const normalizedCmd = trimmed.toLowerCase();

    // Check if command starts with sudo
    if (!normalizedCmd.startsWith("sudo ")) {
      return null;
    }

    // Extract everything after "sudo "
    const afterSudo = trimmed.substring(5).trim();

    // Skip if it's one of the already-blocked privilege escalation patterns
    if (/^-[is]\b/.test(afterSudo) || /^su\b/.test(afterSudo)) {
      return null; // Let the main filter handle these
    }

    return afterSudo;
  }

  /**
   * Analyze sudo command with intelligent validation
   * This allows safe sudo commands but blocks dangerous ones
   */
  static analyzeSudoCommand(
    command: string,
    settings: {
      blockPrivilegeEscalation?: boolean;
      blockHostProbing?: boolean;
      blockNetworkScanning?: boolean;
      blockContainerEscape?: boolean;
      blockDangerousOperations?: boolean;
      blockUnsafePackageInstall?: boolean;
      sudoEnabled?: boolean;
    }
  ): CommandFilterResult {
    // If sudo is disabled in settings, block all sudo commands
    if (settings.sudoEnabled === false) {
      return {
        allowed: false,
        command,
        reason: "Sudo Access Disabled",
        riskLevel: "critical",
        category: "privilege_escalation",
      };
    }

    // First check if the full command violates any rules
    const initialCheck = this.analyzeWithSettings(command, settings);
    if (!initialCheck.allowed) {
      return initialCheck;
    }

    // Extract the sudo command
    const sudoCmd = this.extractSudoCommand(command);
    if (!sudoCmd) {
      // Not a sudo command or already blocked, return initial check result
      return initialCheck;
    }

    // Validate the underlying command being run with sudo
    const underlyingCheck = this.analyzeWithSettings(sudoCmd, settings);
    if (!underlyingCheck.allowed) {
      // Block sudo command because the underlying command is dangerous
      return {
        allowed: false,
        command,
        reason: `Sudo Blocked: ${underlyingCheck.reason}`,
        riskLevel: underlyingCheck.riskLevel,
        category: underlyingCheck.category,
      };
    }

    // Sudo command is safe
    return {
      allowed: true,
      command,
      riskLevel: "low",
    };
  }

  /**
   * Get all blocked patterns (for debugging/admin view)
   */
  static getBlockedPatterns(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [category, patterns] of Object.entries(BLOCKED_PATTERNS)) {
      result[category] = patterns.map((p) => p.source);
    }
    return result;
  }
}
