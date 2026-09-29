/**
 * Essential Tools Configuration
 * Defines minimal required tools to be installed in every sandbox container
 * These tools are essential for basic development and debugging
 */

export interface ToolCategory {
  name: string;
  description: string;
  tools: {
    alpine: string[];
    fedora: string[];
    debian: string[];
  };
}

/**
 * Essential tools organized by category
 * Each category contains tool packages for different distros
 */
export const ESSENTIAL_TOOLS: ToolCategory[] = [
  {
    name: "editors",
    description: "Text editors for file editing",
    tools: {
      alpine: ["nano", "vim"],
      fedora: ["nano", "vim-minimal"],
      debian: ["nano", "vim-tiny"],
    },
  },
  {
    name: "network",
    description: "Network diagnostic and utilities",
    tools: {
      // Note: Some of these are already in the network tools step
      // but we include them here for completeness
      alpine: ["net-tools", "iproute2", "bind-tools", "iputils", "busybox-extras"],
      fedora: ["net-tools", "iproute", "bind-utils", "iputils", "telnet"],
      debian: ["net-tools", "iproute2", "dnsutils", "iputils-ping", "telnet"],
    },
  },
  {
    name: "http",
    description: "HTTP clients and SSL tools",
    tools: {
      alpine: ["curl", "wget", "ca-certificates", "openssl"],
      fedora: ["curl", "wget", "ca-certificates", "openssl"],
      debian: ["curl", "wget", "ca-certificates", "openssl"],
    },
  },
  {
    name: "utilities",
    description: "Common utility tools",
    tools: {
      alpine: ["htop", "tree", "less", "file", "findutils", "grep", "sed", "gawk", "coreutils", "rsync"],
      fedora: ["htop", "tree", "less", "file", "findutils", "grep", "sed", "gawk", "coreutils", "rsync"],
      debian: ["htop", "tree", "less", "file", "findutils", "grep", "sed", "gawk", "coreutils", "rsync"],
    },
  },
  {
    name: "compression",
    description: "File compression tools",
    tools: {
      alpine: ["zip", "unzip", "tar", "gzip", "xz", "bzip2"],
      fedora: ["zip", "unzip", "tar", "gzip", "xz", "bzip2"],
      debian: ["zip", "unzip", "tar", "gzip", "xz-utils", "bzip2"],
    },
  },
  {
    name: "development",
    description: "Development utilities",
    tools: {
      alpine: ["git", "jq", "make", "patch", "diffutils", "sqlite"],
      fedora: ["git", "jq", "make", "patch", "diffutils", "sqlite"],
      debian: ["git", "jq", "make", "patch", "diffutils", "sqlite3"],
    },
  },
  {
    name: "process",
    description: "Process management tools",
    tools: {
      alpine: ["procps", "psmisc", "lsof"],
      fedora: ["procps-ng", "psmisc", "lsof"],
      debian: ["procps", "psmisc", "lsof"],
    },
  },
  {
    name: "shell",
    description: "Shell utilities",
    tools: {
      alpine: ["bash", "bash-completion"],
      fedora: ["bash", "bash-completion"],
      debian: ["bash", "bash-completion"],
    },
  },
];

/**
 * Get the install command for essential tools based on distro
 */
export function getEssentialToolsInstallCommand(
  isAlpine: boolean,
  isFedoraRocky: boolean,
  categories?: string[]
): string[] {
  // Filter categories if specified, otherwise use all
  const selectedCategories = categories
    ? ESSENTIAL_TOOLS.filter((cat) => categories.includes(cat.name))
    : ESSENTIAL_TOOLS;

  // Collect all unique packages
  const packagesSet = new Set<string>();

  for (const category of selectedCategories) {
    const distroKey = isAlpine ? "alpine" : isFedoraRocky ? "fedora" : "debian";
    for (const pkg of category.tools[distroKey]) {
      packagesSet.add(pkg);
    }
  }

  const packages = Array.from(packagesSet).join(" ");

  if (isAlpine) {
    return [
      "sh",
      "-c",
      `apk update && apk add --no-cache ${packages}`,
    ];
  } else if (isFedoraRocky) {
    return [
      "sh",
      "-c",
      `dnf install -y ${packages} || yum install -y ${packages}`,
    ];
  } else {
    return [
      "sh",
      "-c",
      `apt-get update && apt-get install -y ${packages}`,
    ];
  }
}

/**
 * Get a list of all tool packages for a distro
 */
export function getAllToolPackages(
  isAlpine: boolean,
  isFedoraRocky: boolean
): string[] {
  const packagesSet = new Set<string>();
  const distroKey = isAlpine ? "alpine" : isFedoraRocky ? "fedora" : "debian";

  for (const category of ESSENTIAL_TOOLS) {
    for (const pkg of category.tools[distroKey]) {
      packagesSet.add(pkg);
    }
  }

  return Array.from(packagesSet);
}

/**
 * Helper scripts to be installed in containers
 */
export const HELPER_SCRIPTS = {
  // Quick system info script
  sysinfo: `#!/bin/bash
# sysinfo: Display system information
echo "=== System Information ==="
echo "Hostname: $(hostname)"
echo "User: $(whoami)"
echo "Shell: $SHELL"
echo ""
echo "=== Network ==="
ip -4 addr show | grep -E "inet " | awk '{print $NF": "$2}'
echo ""
echo "=== Memory ==="
free -h 2>/dev/null || cat /proc/meminfo | head -3
echo ""
echo "=== Disk ==="
df -h / /workspace 2>/dev/null
echo ""
echo "=== Running Processes ==="
ps aux --sort=-%mem 2>/dev/null | head -10 || ps aux | head -10
`,

  // Port checker script
  ports: `#!/bin/bash
# ports: Show listening ports
echo "=== Listening Ports ==="
if command -v ss &> /dev/null; then
  ss -tlnp 2>/dev/null | grep LISTEN
elif command -v netstat &> /dev/null; then
  netstat -tlnp 2>/dev/null | grep LISTEN
else
  echo "Neither ss nor netstat available"
  cat /proc/net/tcp 2>/dev/null | awk 'NR>1 {print $2}' | cut -d: -f2 | sort -u
fi
`,

  // Quick file search
  search: `#!/bin/bash
# search: Quick file search in workspace
# Usage: search <pattern>
if [ -z "$1" ]; then
  echo "Usage: search <pattern>"
  echo "Example: search '*.js'"
  exit 1
fi
find /workspace -name "$1" -type f 2>/dev/null
`,

  // Environment info
  envinfo: `#!/bin/bash
# envinfo: Show development environment info
echo "=== Development Environment ==="
echo ""

# Node.js
if command -v node &> /dev/null; then
  echo "Node.js: $(node --version)"
  echo "npm: $(npm --version 2>/dev/null || echo 'not found')"
  echo "yarn: $(yarn --version 2>/dev/null || echo 'not found')"
  echo "pnpm: $(pnpm --version 2>/dev/null || echo 'not found')"
  echo "bun: $(bun --version 2>/dev/null || echo 'not found')"
fi

# Python
if command -v python3 &> /dev/null; then
  echo ""
  echo "Python: $(python3 --version)"
  echo "pip: $(pip3 --version 2>/dev/null || echo 'not found')"
fi

# Go
if command -v go &> /dev/null; then
  echo ""
  echo "Go: $(go version)"
fi

# Rust
if command -v rustc &> /dev/null; then
  echo ""
  echo "Rust: $(rustc --version)"
  echo "Cargo: $(cargo --version 2>/dev/null || echo 'not found')"
fi

# Java
if command -v java &> /dev/null; then
  echo ""
  echo "Java: $(java --version 2>&1 | head -1)"
fi

# PHP
if command -v php &> /dev/null; then
  echo ""
  echo "PHP: $(php --version | head -1)"
fi

# Ruby
if command -v ruby &> /dev/null; then
  echo ""
  echo "Ruby: $(ruby --version)"
fi

# Git
if command -v git &> /dev/null; then
  echo ""
  echo "Git: $(git --version)"
fi

echo ""
echo "=== Container IP ==="
hostname -I | awk '{print $1}'
`,

  // Quick download helper
  download: `#!/bin/bash
# download: Download files using curl or wget
# Usage: download <url> [output_filename]
if [ -z "$1" ]; then
  echo "Usage: download <url> [output_filename]"
  echo "Example: download https://example.com/file.zip"
  echo "Example: download https://example.com/file.zip myfile.zip"
  exit 1
fi

URL="$1"
OUTPUT="\${2:-$(basename "$URL")}"

if command -v curl &> /dev/null; then
  echo "Downloading: $URL"
  curl -L -o "$OUTPUT" "$URL"
elif command -v wget &> /dev/null; then
  echo "Downloading: $URL"
  wget -O "$OUTPUT" "$URL"
else
  echo "Error: Neither curl nor wget is available"
  exit 1
fi

if [ -f "$OUTPUT" ]; then
  echo "Downloaded: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
fi
`,

  // Simple HTTP server
  serve: `#!/bin/bash
# serve: Start a simple HTTP server
# Usage: serve [port] [directory]
PORT="\${1:-8000}"
DIR="\${2:-.}"

echo "=== Starting HTTP Server ==="
echo "Directory: $(realpath "$DIR")"
echo "Port: $PORT"
echo "URL: http://0.0.0.0:$PORT"
echo ""
echo "Press Ctrl+C to stop"
echo ""

cd "$DIR"

if command -v python3 &> /dev/null; then
  python3 -m http.server "$PORT" --bind 0.0.0.0
elif command -v python &> /dev/null; then
  python -m SimpleHTTPServer "$PORT"
elif command -v php &> /dev/null; then
  php -S 0.0.0.0:"$PORT"
elif command -v node &> /dev/null; then
  node -e "require('http').createServer((req,res)=>{require('fs').readFile('.'+req.url,(e,d)=>{res.end(d||'Not Found')})}).listen($PORT,'0.0.0.0',()=>console.log('Server running'))"
else
  echo "Error: No suitable HTTP server found (python3, python, php, or node)"
  exit 1
fi
`,

  // Disk usage checker
  diskusage: `#!/bin/bash
# diskusage: Show disk usage summary
# Usage: diskusage [directory]
DIR="\${1:-/workspace}"

echo "=== Disk Usage Summary ==="
echo ""
echo "Overall:"
df -h "$DIR" 2>/dev/null || df -h /
echo ""
echo "Top 10 largest directories in $DIR:"
du -h --max-depth=2 "$DIR" 2>/dev/null | sort -hr | head -10
echo ""
echo "Top 10 largest files in $DIR:"
find "$DIR" -type f -exec du -h {} + 2>/dev/null | sort -hr | head -10
`,

  // Quick backup helper
  backup: `#!/bin/bash
# backup: Create a backup of workspace or specific directory
# Usage: backup [directory] [backup_name]
DIR="\${1:-/workspace}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="\${2:-backup_$TIMESTAMP}"

echo "=== Creating Backup ==="
echo "Source: $DIR"
echo "Backup: $BACKUP_NAME.tar.gz"
echo ""

tar -czf "$BACKUP_NAME.tar.gz" -C "$(dirname "$DIR")" "$(basename "$DIR")"

if [ -f "$BACKUP_NAME.tar.gz" ]; then
  echo "Backup created: $BACKUP_NAME.tar.gz ($(du -h "$BACKUP_NAME.tar.gz" | cut -f1))"
else
  echo "Error: Failed to create backup"
  exit 1
fi
`,

  // Quick git status for workspace
  gitstatus: `#!/bin/bash
# gitstatus: Show git status for all repos in workspace
# Usage: gitstatus [directory]
DIR="\${1:-/workspace}"

echo "=== Git Repository Status ==="
echo ""

find "$DIR" -name ".git" -type d 2>/dev/null | while read gitdir; do
  repo=$(dirname "$gitdir")
  echo "Repository: $repo"
  cd "$repo"

  # Branch info
  branch=$(git branch --show-current 2>/dev/null)
  echo "  Branch: $branch"

  # Status summary
  changes=$(git status --porcelain 2>/dev/null | wc -l)
  if [ "$changes" -gt 0 ]; then
    echo "  Changes: $changes file(s) modified"
  else
    echo "  Changes: Clean"
  fi

  echo ""
done

if [ -z "$(find "$DIR" -name ".git" -type d 2>/dev/null)" ]; then
  echo "No git repositories found in $DIR"
fi
`,

  // Process killer helper
  killport: `#!/bin/bash
# killport: Kill process running on a specific port
# Usage: killport <port>
if [ -z "$1" ]; then
  echo "Usage: killport <port>"
  echo "Example: killport 3000"
  exit 1
fi

PORT="$1"
echo "Finding process on port $PORT..."

# Try ss first, then netstat
if command -v ss &> /dev/null; then
  PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\\K[0-9]+' | head -1)
elif command -v netstat &> /dev/null; then
  PID=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1 | head -1)
else
  PID=$(lsof -t -i:$PORT 2>/dev/null | head -1)
fi

if [ -z "$PID" ]; then
  echo "No process found on port $PORT"
  exit 0
fi

PNAME=$(ps -p $PID -o comm= 2>/dev/null)
echo "Found: $PNAME (PID: $PID)"
read -p "Kill this process? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  kill $PID 2>/dev/null && echo "Process killed" || echo "Failed to kill process"
fi
`,
};

/**
 * Get the command to install helper scripts
 */
export function getHelperScriptsInstallCommand(): string[] {
  const scriptInstalls = Object.entries(HELPER_SCRIPTS)
    .map(([name, content]) => {
      // Escape single quotes in content
      const escapedContent = content.replace(/'/g, "'\\''");
      return `cat > /usr/local/bin/${name} << 'SCRIPT_EOF'
${content}
SCRIPT_EOF
chmod +x /usr/local/bin/${name}`;
    })
    .join("\n\n");

  return ["sh", "-c", scriptInstalls];
}
