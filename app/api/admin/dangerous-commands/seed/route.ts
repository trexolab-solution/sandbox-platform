import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { dangerousCommandPatterns } from "@/database/schemas";
import { nanoid } from "nanoid";

// Built-in dangerous command patterns
// These match the patterns from lib/security/command-filter.ts
const BUILT_IN_PATTERNS = [
  // Privilege Escalation
  {
    name: "su command",
    pattern: String.raw`\bsu\s+-?\s*$`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks 'su' and 'su -' commands that switch to root user",
    examples: ["su", "su -"],
  },
  {
    name: "su root",
    pattern: String.raw`\bsu\s+root\b`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks direct switching to root user",
    examples: ["su root"],
  },
  {
    name: "sudo -i (login shell)",
    pattern: String.raw`\bsudo\s+-i\b`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks sudo login shell which gives full root access",
    examples: ["sudo -i"],
  },
  {
    name: "sudo su",
    pattern: String.raw`\bsudo\s+su\b`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks sudo su combination for root access",
    examples: ["sudo su", "sudo su -"],
  },
  {
    name: "sudo -s (shell)",
    pattern: String.raw`\bsudo\s+-s\b`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks sudo shell access",
    examples: ["sudo -s"],
  },
  {
    name: "setuid chmod",
    pattern: String.raw`\bchmod\s+[0-7]*[4-7][0-7]*s`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks setuid/setgid file permission changes",
    examples: ["chmod 4755 file", "chmod u+s file"],
  },
  {
    name: "chmod u+s",
    pattern: String.raw`\bchmod\s+u\+s\b`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks setuid bit setting on files",
    examples: ["chmod u+s file"],
  },
  {
    name: "chmod g+s",
    pattern: String.raw`\bchmod\s+g\+s\b`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks setgid bit setting on files",
    examples: ["chmod g+s file"],
  },
  {
    name: "passwd root",
    pattern: String.raw`\bpasswd\s+root\b`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks changing root password",
    examples: ["passwd root"],
  },
  {
    name: "visudo",
    pattern: String.raw`\bvisudo\b`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks editing sudoers file",
    examples: ["visudo"],
  },
  {
    name: "usermod sudo/wheel group",
    pattern: String.raw`\busermod\s+-aG\s+(sudo|wheel)`,
    category: "privilege_escalation" as const,
    riskLevel: "critical" as const,
    description: "Blocks adding users to sudo or wheel group",
    examples: ["usermod -aG sudo user", "usermod -aG wheel user"],
  },

  // Host Probing
  {
    name: "/proc/1/cgroup access",
    pattern: String.raw`\bcat\s+\/proc\/1\/cgroup\b`,
    category: "host_probing" as const,
    riskLevel: "high" as const,
    description: "Blocks container detection via cgroup inspection",
    examples: ["cat /proc/1/cgroup"],
  },
  {
    name: "/proc/1/environ access",
    pattern: String.raw`\bcat\s+\/proc\/1\/environ\b`,
    category: "host_probing" as const,
    riskLevel: "high" as const,
    description: "Blocks reading init process environment variables",
    examples: ["cat /proc/1/environ"],
  },
  {
    name: "/etc/shadow access",
    pattern: String.raw`\bcat\s+\/etc\/shadow\b`,
    category: "host_probing" as const,
    riskLevel: "high" as const,
    description: "Blocks reading password shadow file",
    examples: ["cat /etc/shadow"],
  },
  {
    name: "mount commands",
    pattern: String.raw`\bmount\s+-t`,
    category: "host_probing" as const,
    riskLevel: "high" as const,
    description: "Blocks filesystem mounting",
    examples: ["mount -t tmpfs", "mount --bind"],
  },
  {
    name: "disk probing tools",
    pattern: String.raw`\b(fdisk|lsblk|blkid)\b`,
    category: "host_probing" as const,
    riskLevel: "high" as const,
    description: "Blocks disk and partition information tools",
    examples: ["fdisk -l", "lsblk", "blkid"],
  },
  {
    name: "path traversal",
    pattern: String.raw`\/\.\.\/\.\.\//`,
    category: "host_probing" as const,
    riskLevel: "high" as const,
    description: "Blocks directory traversal attempts",
    examples: ["cat /../../../etc/passwd"],
  },
  {
    name: "docker socket access",
    pattern: String.raw`\/var\/run\/docker\.sock`,
    category: "host_probing" as const,
    riskLevel: "high" as const,
    description: "Blocks Docker socket access attempts",
    examples: ["curl --unix-socket /var/run/docker.sock"],
  },
  {
    name: "dmesg",
    pattern: String.raw`\bdmesg\b`,
    category: "host_probing" as const,
    riskLevel: "high" as const,
    description: "Blocks kernel ring buffer access",
    examples: ["dmesg"],
  },
  {
    name: "sysctl",
    pattern: String.raw`\bsysctl\b`,
    category: "host_probing" as const,
    riskLevel: "high" as const,
    description: "Blocks kernel parameter access and modification",
    examples: ["sysctl -a", "sysctl -w"],
  },

  // Network Scanning
  {
    name: "nmap",
    pattern: String.raw`\bnmap\b`,
    category: "network_scanning" as const,
    riskLevel: "high" as const,
    description: "Blocks network mapping and port scanning",
    examples: ["nmap 192.168.1.0/24"],
  },
  {
    name: "netcat",
    pattern: String.raw`\b(netcat|nc\s+-[a-z]*[lzv])\b`,
    category: "network_scanning" as const,
    riskLevel: "high" as const,
    description: "Blocks netcat port scanning and connections",
    examples: ["nc -zv host 1-1000", "netcat -l 8080"],
  },
  {
    name: "tcpdump/wireshark",
    pattern: String.raw`\b(tcpdump|wireshark|tshark)\b`,
    category: "network_scanning" as const,
    riskLevel: "high" as const,
    description: "Blocks packet capture tools",
    examples: ["tcpdump -i eth0", "wireshark"],
  },
  {
    name: "arp scanning",
    pattern: String.raw`\b(arp\s+-a|arp-scan)\b`,
    category: "network_scanning" as const,
    riskLevel: "high" as const,
    description: "Blocks ARP table inspection and scanning",
    examples: ["arp -a", "arp-scan --localnet"],
  },
  {
    name: "masscan/zmap",
    pattern: String.raw`\b(masscan|zmap)\b`,
    category: "network_scanning" as const,
    riskLevel: "high" as const,
    description: "Blocks fast network scanners",
    examples: ["masscan 0.0.0.0/0 -p80"],
  },
  {
    name: "internal IP scanning",
    pattern: String.raw`(172\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)`,
    category: "network_scanning" as const,
    riskLevel: "high" as const,
    description: "Blocks scanning of internal IP ranges",
    examples: ["ping 192.168.1.1", "curl 10.0.0.1"],
  },

  // Container Escape
  {
    name: "docker/kubectl commands",
    pattern: String.raw`\b(docker|kubectl|crictl)\s+(run|exec|attach)`,
    category: "container_escape" as const,
    riskLevel: "critical" as const,
    description: "Blocks container runtime commands",
    examples: ["docker run", "kubectl exec", "crictl run"],
  },
  {
    name: "nsenter",
    pattern: String.raw`\bnsenter\b`,
    category: "container_escape" as const,
    riskLevel: "critical" as const,
    description: "Blocks namespace entering",
    examples: ["nsenter -t 1 -m sh"],
  },
  {
    name: "unshare",
    pattern: String.raw`\bunshare\b`,
    category: "container_escape" as const,
    riskLevel: "critical" as const,
    description: "Blocks namespace unsharing",
    examples: ["unshare -r /bin/bash"],
  },
  {
    name: "capability tools",
    pattern: String.raw`\b(capsh|setcap|getcap)\b`,
    category: "container_escape" as const,
    riskLevel: "critical" as const,
    description: "Blocks Linux capability manipulation",
    examples: ["setcap cap_net_raw+ep /bin/ping"],
  },
  {
    name: "device access",
    pattern: String.raw`\/dev\/(sd[a-z]|vd[a-z]|nvme|mem|kmem)`,
    category: "container_escape" as const,
    riskLevel: "critical" as const,
    description: "Blocks direct device access",
    examples: ["dd if=/dev/sda", "cat /dev/mem"],
  },
  {
    name: "chroot/pivot_root",
    pattern: String.raw`\b(chroot|pivot_root)\b`,
    category: "container_escape" as const,
    riskLevel: "critical" as const,
    description: "Blocks root filesystem changes",
    examples: ["chroot /mnt", "pivot_root"],
  },

  // Dangerous Operations
  {
    name: "rm -rf /",
    pattern: String.raw`\brm\s+-rf\s+\/\s*$`,
    category: "dangerous_operations" as const,
    riskLevel: "critical" as const,
    description: "Blocks recursive root deletion",
    examples: ["rm -rf /", "rm -rf /*"],
  },
  {
    name: "rm --no-preserve-root",
    pattern: String.raw`\brm\s+-rf\s+--no-preserve-root`,
    category: "dangerous_operations" as const,
    riskLevel: "critical" as const,
    description: "Blocks forced root deletion",
    examples: ["rm -rf --no-preserve-root /"],
  },
  {
    name: "dd to device",
    pattern: String.raw`\bdd\s+if=.*of=\/dev`,
    category: "dangerous_operations" as const,
    riskLevel: "critical" as const,
    description: "Blocks writing to block devices",
    examples: ["dd if=/dev/zero of=/dev/sda"],
  },
  {
    name: "mkfs",
    pattern: String.raw`\bmkfs\b`,
    category: "dangerous_operations" as const,
    riskLevel: "critical" as const,
    description: "Blocks filesystem formatting",
    examples: ["mkfs.ext4 /dev/sda1"],
  },
  {
    name: "shutdown/reboot/halt",
    pattern: String.raw`\b(shutdown|reboot|halt|poweroff)\b`,
    category: "dangerous_operations" as const,
    riskLevel: "critical" as const,
    description: "Blocks system power management",
    examples: ["shutdown -h now", "reboot"],
  },
  {
    name: "init runlevel",
    pattern: String.raw`\binit\s+[06]\b`,
    category: "dangerous_operations" as const,
    riskLevel: "critical" as const,
    description: "Blocks system runlevel changes",
    examples: ["init 0", "init 6"],
  },
  {
    name: "fork bomb",
    pattern: String.raw`:\(\)\{\s*:\|:&\s*\};:`,
    category: "dangerous_operations" as const,
    riskLevel: "critical" as const,
    description: "Blocks fork bomb attacks",
    examples: [":(){ :|:& };:"],
  },
  {
    name: "kernel modules",
    pattern: String.raw`\b(insmod|rmmod|modprobe)\b`,
    category: "dangerous_operations" as const,
    riskLevel: "critical" as const,
    description: "Blocks kernel module manipulation",
    examples: ["insmod mymodule.ko", "modprobe module"],
  },

  // Unsafe Package Installation
  {
    name: "curl/wget pipe to bash",
    pattern: String.raw`\b(curl|wget)\s+.*\|\s*(bash|sh)`,
    category: "package_managers_dangerous" as const,
    riskLevel: "medium" as const,
    description: "Blocks piping remote scripts directly to shell",
    examples: ["curl https://example.com/script.sh | bash", "wget -O- url | sh"],
  },
  {
    name: "apt --allow-unauthenticated",
    pattern: String.raw`\bapt(-get)?\s+.*--allow-unauthenticated`,
    category: "package_managers_dangerous" as const,
    riskLevel: "medium" as const,
    description: "Blocks bypassing package authentication",
    examples: ["apt install --allow-unauthenticated package"],
  },
  {
    name: "pip --trusted-host",
    pattern: String.raw`\bpip\s+install\s+--trusted-host`,
    category: "package_managers_dangerous" as const,
    riskLevel: "medium" as const,
    description: "Blocks bypassing pip SSL verification",
    examples: ["pip install --trusted-host pypi.org package"],
  },
  {
    name: "npm --unsafe-perm",
    pattern: String.raw`\bnpm\s+install\s+--unsafe-perm`,
    category: "package_managers_dangerous" as const,
    riskLevel: "medium" as const,
    description: "Blocks npm unsafe permission mode",
    examples: ["npm install --unsafe-perm package"],
  },
];

// POST: Seed built-in dangerous command patterns
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    // Check if patterns already exist
    const existing = await db.query.dangerousCommandPatterns.findMany({
      where: (dcp, { eq }) => eq(dcp.isBuiltIn, true),
    });

    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        message: `Built-in patterns already exist (${existing.length} patterns)`,
        seeded: false,
      });
    }

    // Insert all built-in patterns
    const patterns = BUILT_IN_PATTERNS.map((p) => ({
      id: nanoid(),
      name: p.name,
      pattern: p.pattern,
      category: p.category,
      riskLevel: p.riskLevel,
      description: p.description,
      examples: p.examples,
      enabled: true,
      isBuiltIn: true,
      createdBy: null,
    }));

    await db.insert(dangerousCommandPatterns).values(patterns);

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${patterns.length} built-in patterns`,
      seeded: true,
      count: patterns.length,
    });
  } catch (error) {
    console.error("Error seeding dangerous command patterns:", error);

    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to seed dangerous command patterns" },
      { status: 500 }
    );
  }
}
