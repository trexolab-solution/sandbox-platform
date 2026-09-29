"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface AddPortDialogProps {
  containerId: string;
  onPortAdded?: () => void;
}

export function AddPortDialog({ containerId, onPortAdded }: AddPortDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [port, setPort] = useState("");
  const [protocol, setProtocol] = useState<"tcp" | "udp">("tcp");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error("Port must be a number between 1 and 65535");
      return;
    }

    if (!serviceName.trim()) {
      toast.error("Service name is required");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/ports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceName: serviceName.trim(),
            port: portNum,
            protocol,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add port");
      }

      toast.success(`Port ${portNum} mapped as "${serviceName}"`);
      setOpen(false);
      setServiceName("");
      setPort("");
      setProtocol("tcp");
      onPortAdded?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add port mapping"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Add Port
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Port Mapping</DialogTitle>
          <DialogDescription>
            Map a port from your sandbox to make it accessible. The service
            running on this port will be available through the platform.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Service Name</Label>
              <Input
                id="serviceName"
                placeholder="e.g., Web Server, API, Database"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                A friendly name for this service
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="port">Port Number</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="e.g., 3000"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocol">Protocol</Label>
                <Select
                  value={protocol}
                  onValueChange={(v) => setProtocol(v as "tcp" | "udp")}
                  disabled={isLoading}
                >
                  <SelectTrigger>
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
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner className="h-4 w-4 mr-2" />}
              Add Port
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
