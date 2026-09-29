"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  HelpCircle,
  Copy,
  Check,
  Terminal,
  Package,
  Folder,
  FileText,
  Network,
  Settings,
  Info,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface TerminalGuideProps {
  containerImage: string;
}

interface CommandSection {
  title: string;
  icon: React.ElementType;
  commands: {
    description: string;
    command: string;
    note?: string;
  }[];
}

function getImageType(image: string): "ubuntu" | "alpine" | "fedora" | "debian" | "generic" {
  const imageLower = image.toLowerCase();
  if (imageLower.includes("ubuntu")) return "ubuntu";
  if (imageLower.includes("alpine")) return "alpine";
  if (imageLower.includes("fedora") || imageLower.includes("centos") || imageLower.includes("rhel")) return "fedora";
  if (imageLower.includes("debian")) return "debian";
  return "generic";
}

function getPackageManager(imageType: string): { name: string; install: string; update: string; search: string } {
  switch (imageType) {
    case "ubuntu":
    case "debian":
      return {
        name: "apt",
        install: "sudo apt install",
        update: "sudo apt update && sudo apt upgrade",
        search: "apt search",
      };
    case "alpine":
      return {
        name: "apk",
        install: "sudo apk add",
        update: "sudo apk update && sudo apk upgrade",
        search: "apk search",
      };
    case "fedora":
      return {
        name: "dnf",
        install: "sudo dnf install",
        update: "sudo dnf update",
        search: "dnf search",
      };
    default:
      return {
        name: "package manager",
        install: "package-manager install",
        update: "package-manager update",
        search: "package-manager search",
      };
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

function CommandItem({ description, command, note }: { description: string; command: string; note?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground flex-1">{description}</p>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border font-mono text-xs group hover:bg-muted transition-colors">
        <code className="flex-1 break-all">{command}</code>
        <CopyButton text={command} />
      </div>
      {note && (
        <p className="text-xs text-muted-foreground italic flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          {note}
        </p>
      )}
    </div>
  );
}

export function TerminalGuide({ containerImage }: TerminalGuideProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const imageType = getImageType(containerImage);
  const pkgManager = getPackageManager(imageType);

  const sections: CommandSection[] = [
    {
      title: "Package Management",
      icon: Package,
      commands: [
        {
          description: "Update package lists",
          command: pkgManager.update,
          note: "Run this before installing new packages",
        },
        {
          description: "Install a package",
          command: `${pkgManager.install} <package-name>`,
        },
        {
          description: "Search for packages",
          command: `${pkgManager.search} <keyword>`,
        },
        {
          description: "List installed packages",
          command: imageType === "alpine" ? "apk list --installed" :
                   imageType === "fedora" ? "dnf list installed" :
                   "apt list --installed",
        },
      ],
    },
    {
      title: "File & Directory Operations",
      icon: Folder,
      commands: [
        {
          description: "List files in current directory",
          command: "ls -la",
          note: "-l for details, -a to show hidden files",
        },
        {
          description: "Change directory",
          command: "cd /path/to/directory",
        },
        {
          description: "Create a directory",
          command: "mkdir my-folder",
        },
        {
          description: "Create a file",
          command: "touch filename.txt",
        },
        {
          description: "Copy files/folders",
          command: "cp -r source destination",
        },
        {
          description: "Move or rename files",
          command: "mv oldname newname",
        },
        {
          description: "Delete a file",
          command: "rm filename",
        },
        {
          description: "Delete a directory",
          command: "rm -rf directory-name",
          note: "Be careful with -rf, it deletes permanently!",
        },
        {
          description: "Show current directory path",
          command: "pwd",
        },
      ],
    },
    {
      title: "File Viewing & Editing",
      icon: FileText,
      commands: [
        {
          description: "View file contents",
          command: "cat filename.txt",
        },
        {
          description: "View file with pagination",
          command: "less filename.txt",
          note: "Press 'q' to quit",
        },
        {
          description: "View first 10 lines",
          command: "head filename.txt",
        },
        {
          description: "View last 10 lines",
          command: "tail filename.txt",
        },
        {
          description: "Follow file updates (logs)",
          command: "tail -f logfile.log",
        },
        {
          description: "Edit file with nano",
          command: "nano filename.txt",
          note: "Ctrl+X to exit, Y to save",
        },
        {
          description: "Edit file with vi/vim",
          command: "vi filename.txt",
          note: "Press 'i' to insert, 'ESC' then ':wq' to save & quit",
        },
      ],
    },
    {
      title: "System Information",
      icon: Settings,
      commands: [
        {
          description: "Show disk usage",
          command: "df -h",
        },
        {
          description: "Show directory size",
          command: "du -sh *",
        },
        {
          description: "Show memory usage",
          command: "free -h",
        },
        {
          description: "Show running processes",
          command: "ps aux",
        },
        {
          description: "Interactive process viewer",
          command: "top",
          note: "Press 'q' to quit",
        },
        {
          description: "Show system information",
          command: "uname -a",
        },
        {
          description: "Show current user",
          command: "whoami",
        },
      ],
    },
    {
      title: "Network & Connectivity",
      icon: Network,
      commands: [
        {
          description: "Show network interfaces",
          command: "ip addr",
        },
        {
          description: "Show active connections",
          command: "ss -tulpn",
          note: "View listening ports and connections",
        },
        {
          description: "Check DNS resolution",
          command: "nslookup example.com",
        },
        {
          description: "Show routing table",
          command: "ip route",
        },
      ],
    },
    {
      title: "Permissions & Users",
      icon: Terminal,
      commands: [
        {
          description: "Change file permissions",
          command: "chmod 755 script.sh",
          note: "755 = rwxr-xr-x (owner, group, others)",
        },
        {
          description: "Make file executable",
          command: "chmod +x script.sh",
        },
        {
          description: "View file permissions",
          command: "ls -l filename",
        },
        {
          description: "Show current user",
          command: "id",
        },
      ],
    },
  ];

  // Filter sections and commands based on search query
  const filteredSections = searchQuery.trim()
    ? sections
        .map((section) => ({
          ...section,
          commands: section.commands.filter(
            (cmd) =>
              cmd.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
              cmd.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (cmd.note && cmd.note.toLowerCase().includes(searchQuery.toLowerCase()))
          ),
        }))
        .filter((section) => section.commands.length > 0)
    : sections;

  const totalResults = filteredSections.reduce((acc, section) => acc + section.commands.length, 0);

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setSearchQuery("");
    }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" tabIndex={-1} className="h-7 w-7">
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="end">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              <h3 className="font-semibold">Terminal Guide</h3>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {containerImage}
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search commands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground">
              Found {totalResults} result{totalResults !== 1 ? "s" : ""} in {filteredSections.length} section{filteredSections.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <ScrollArea className="h-[500px]">
          <div className="p-4 space-y-4">
            {filteredSections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No commands found for "{searchQuery}"</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              filteredSections.map((section, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <section.icon className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-sm">{section.title}</h4>
                    {searchQuery && (
                      <Badge variant="secondary" className="text-xs">
                        {section.commands.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-3 pl-6">
                    {section.commands.map((cmd, cmdIdx) => (
                      <CommandItem
                        key={cmdIdx}
                        description={cmd.description}
                        command={cmd.command}
                        note={cmd.note}
                      />
                    ))}
                  </div>
                  {idx < filteredSections.length - 1 && <Separator className="mt-4" />}
                </div>
              ))
            )}

            {/* Only show info boxes when not searching */}
            {!searchQuery && (
              <>
                {/* Security Warning */}
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <h4 className="font-medium text-sm text-red-900 dark:text-red-200">
                      Security Notice
                    </h4>
                  </div>
                  <ul className="text-xs text-red-900 dark:text-red-200 space-y-1 ml-6 list-disc">
                    <li>Certain commands are restricted for security reasons</li>
                    <li>Prohibited commands include privilege escalation, network scanning, and container escape attempts</li>
                    <li>Repeated attempts to run prohibited commands will result in <strong>automatic account blocking</strong></li>
                    <li>Check with your administrator if you need access to restricted features</li>
                  </ul>
                </div>

                {/* Additional Tips */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-2 mt-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-sm text-blue-900 dark:text-blue-200">
                      Quick Tips
                    </h4>
                  </div>
                  <ul className="text-xs text-blue-900 dark:text-blue-200 space-y-1 ml-6 list-disc">
                    <li>Use Tab key for auto-completion</li>
                    <li>Press Ctrl+C to cancel a running command</li>
                    <li>Use arrow up/down to browse command history</li>
                    <li>Type <code className="px-1 py-0.5 rounded bg-blue-500/20">clear</code> to clear the terminal screen</li>
                    <li>Use <code className="px-1 py-0.5 rounded bg-blue-500/20">man command-name</code> to read manual pages</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
