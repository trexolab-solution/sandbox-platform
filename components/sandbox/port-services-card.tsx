"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  Plus,
  Server,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getServiceUrl } from "@/lib/utils/url";

interface PortMapping {
  id: string;
  serviceName: string;
  internalPort: number;
  protocol: string;
}

interface PortServicesCardProps {
  containerId: string;
  portMappings: PortMapping[];
  onPortAdded?: () => void;
  defaultOpen?: boolean;
}

export function PortServicesCard({
  containerId,
  portMappings,
  onPortAdded,
  defaultOpen = true,
}: PortServicesCardProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add port dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [port, setPort] = useState("");
  const [protocol, setProtocol] = useState<"tcp" | "udp">("tcp");

  // Delete confirmation state
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; port: PortMapping | null }>({
    open: false,
    port: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const copyUrl = async (pm: PortMapping) => {
    const url = getServiceUrl(pm.serviceName);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(pm.id);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const handleAddPort = async (e: React.FormEvent) => {
    e.preventDefault();

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error("Port must be between 1 and 65535");
      return;
    }

    if (!serviceName.trim()) {
      toast.error("Service name is required");
      return;
    }

    // Validate service name format
    const trimmed = serviceName.trim().toLowerCase();
    if (trimmed.length < 3 || trimmed.length > 30) {
      toast.error("Service name must be 3-30 characters");
      return;
    }

    const validPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!validPattern.test(trimmed)) {
      toast.error("Service name must be lowercase, start/end with letter or number");
      return;
    }

    setIsAdding(true);

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/ports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceName: trimmed,
            port: portNum,
            protocol,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add port");
      }

      toast.success(`Port ${portNum} mapped as "${trimmed}"`);
      setDialogOpen(false);
      setServiceName("");
      setPort("");
      setProtocol("tcp");
      onPortAdded?.();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add port mapping"
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeletePort = async () => {
    if (!deleteDialog.port) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/ports/${deleteDialog.port.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove port");
      }

      toast.success("Port removed successfully");
      setDeleteDialog({ open: false, port: null });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove port"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="py-0 gap-0">
          <CollapsibleTrigger asChild>
            <CardHeader className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <CardTitle className="text-sm font-medium">Services</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {portMappings.length}
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isOpen ? "" : "-rotate-90"
                    }`}
                  />
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4 pt-0 space-y-2">
              {portMappings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No services configured yet.
                </p>
              ) : (
                portMappings.map((pm) => (
                  <div
                    key={pm.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Server className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {pm.serviceName}
                      </span>
                      <Badge variant="secondary" className="text-xs font-mono shrink-0">
                        {pm.internalPort}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => copyUrl(pm)}
                          >
                            {copiedId === pm.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy URL</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            asChild
                          >
                            <a
                              href={`/s/${pm.serviceName}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open in new tab</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteDialog({ open: true, port: pm })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove port</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 mt-2"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Port
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Add Port Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!isAdding) {
          setDialogOpen(open);
          if (!open) {
            setServiceName("");
            setPort("");
            setProtocol("tcp");
          }
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Add Port Mapping
            </DialogTitle>
            <DialogDescription>
              Map a port from your sandbox to make it accessible via URL.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPort}>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serviceName">
                  Service Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="serviceName"
                  placeholder="e.g., web-server, api"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  disabled={isAdding}
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase, 3-30 chars, letters, numbers, and hyphens only
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="port">
                    Port <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="port"
                    type="number"
                    placeholder="e.g., 3000"
                    min={1}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    disabled={isAdding}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="protocol">Protocol</Label>
                  <Select
                    value={protocol}
                    onValueChange={(v) => setProtocol(v as "tcp" | "udp")}
                    disabled={isAdding}
                  >
                    <SelectTrigger id="protocol">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tcp">TCP</SelectItem>
                      <SelectItem value="udp">UDP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAdding}>
                {isAdding ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Port
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setDeleteDialog({ open, port: open ? deleteDialog.port : null });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Port Mapping</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the port mapping for{" "}
              <span className="font-medium">{deleteDialog.port?.serviceName}</span>
              {" "}(port {deleteDialog.port?.internalPort})?
              This will make the service inaccessible via URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePort}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
