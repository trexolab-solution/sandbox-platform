"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Server,
  ExternalLink,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface PortMapping {
  id: string;
  serviceName: string;
  internalPort: number;
  protocol: string;
}

interface PortMappingSidebarProps {
  containerId: string;
  portMappings: PortMapping[];
  isRunning: boolean;
  defaultOpen?: boolean;
  onPortsChanged?: () => void;
}

export function PortMappingSidebar({
  containerId,
  portMappings,
  isRunning,
  defaultOpen = true,
  onPortsChanged,
}: PortMappingSidebarProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [addPortOpen, setAddPortOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; port: PortMapping | null }>({
    open: false,
    port: null,
  });

  // Add port form state
  const [serviceName, setServiceName] = useState("");
  const [port, setPort] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getServiceUrl = (serviceNameParam: string) => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}/s/${serviceNameParam}/`;
  };

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

  const handleAddPort = async () => {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1000 || portNum > 65535) {
      toast.error("Invalid port number (1000-65535)");
      return;
    }

    const trimmedName = serviceName.trim().toLowerCase();
    if (!trimmedName) {
      toast.error("Please provide a service name");
      return;
    }

    if (trimmedName.length < 3 || trimmedName.length > 30) {
      toast.error("Service name must be 3-30 characters");
      return;
    }

    const validPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!validPattern.test(trimmedName)) {
      toast.error("Service name must be lowercase, start/end with letter or number");
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`/api/sandbox/containers/${containerId}/ports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: trimmedName,
          port: portNum,
          protocol: "tcp",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add port");
      }

      toast.success(`Port ${portNum} mapped successfully`);
      setAddPortOpen(false);
      setServiceName("");
      setPort("");
      onPortsChanged?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add port");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeletePort = async () => {
    if (!deleteDialog.port) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/ports?portId=${deleteDialog.port.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove port");
      }

      toast.success(`Port ${deleteDialog.port.internalPort} removed`);
      setDeleteDialog({ open: false, port: null });
      onPortsChanged?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove port");
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
                  <Server className="h-4 w-4" />
                  <CardTitle className="text-sm font-medium">Port Mappings</CardTitle>
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
                  No ports mapped yet.
                </p>
              ) : (
                portMappings.map((pm) => (
                  <div
                    key={pm.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">{pm.serviceName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">:{pm.internalPort}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
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

              <Popover open={addPortOpen} onOpenChange={setAddPortOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 mt-2"
                    disabled={!isRunning}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Port Mapping
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="start">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Add Port Mapping</h4>
                      <p className="text-xs text-muted-foreground">
                        Map a container port to make your service accessible.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="serviceName">Service Name <span className="text-destructive">*</span></Label>
                        <Input
                          id="serviceName"
                          placeholder="e.g., my-web-app"
                          value={serviceName}
                          onChange={(e) => setServiceName(e.target.value.toLowerCase())}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Lowercase letters, numbers, hyphens only (3-30 chars). Must be unique.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="port">Port Number <span className="text-destructive">*</span></Label>
                        <Input
                          id="port"
                          type="number"
                          min={1000}
                          max={65535}
                          placeholder="e.g., 3000"
                          value={port}
                          onChange={(e) => setPort(e.target.value)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Valid range: 1000-65535
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setAddPortOpen(false);
                          setServiceName("");
                          setPort("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleAddPort}
                        disabled={isAdding || !serviceName.trim() || !port}
                      >
                        {isAdding ? (
                          <>
                            <Spinner className="mr-2 h-3.5 w-3.5" />
                            Adding...
                          </>
                        ) : (
                          "Add Port"
                        )}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, port: deleteDialog.port })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Port Mapping</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the port mapping for{" "}
              <strong>{deleteDialog.port?.serviceName}</strong> (port{" "}
              {deleteDialog.port?.internalPort})? This service will no longer be
              accessible from outside the container.
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
