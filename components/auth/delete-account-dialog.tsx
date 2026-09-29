"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Trash2,
  AlertTriangle,
  Server,
  FileText,
  Clock,
  Database,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";

interface Container {
  id: string;
  displayName: string;
  image: string;
  status: string;
}

export function DeleteAccountDialog() {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const [containers, setContainers] = useState<Container[]>([]);
  const [isLoadingContainers, setIsLoadingContainers] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchContainers();
      setConfirmText("");
      setDeletionProgress("");
    }
  }, [open]);

  const fetchContainers = async () => {
    setIsLoadingContainers(true);
    try {
      const response = await fetch("/api/sandbox/containers");
      if (response.ok) {
        const data = await response.json();
        setContainers(data.containers || []);
      }
    } catch (error) {
      console.error("Failed to fetch containers:", error);
    } finally {
      setIsLoadingContainers(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;

    setIsDeleting(true);
    try {
      // Show progress
      if (containers.length > 0) {
        setDeletionProgress("Stopping and removing your sandboxes...");
      } else {
        setDeletionProgress("Deleting your account...");
      }

      const response = await fetch("/api/account/delete", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete account");
      }

      setDeletionProgress("Account deleted successfully!");
      toast.success("Account deleted successfully", {
        description: "You will be redirected to the login page",
      });

      // Small delay to show success message
      await new Promise(resolve => setTimeout(resolve, 1000));

      await signOut();
      router.push("/auth/login?deleted=true");
    } catch (error) {
      setDeletionProgress("");
      toast.error(
        error instanceof Error ? error.message : "Failed to delete account"
      );
      setIsDeleting(false);
    }
  };

  const runningContainers = containers.filter(c => c.status === "running").length;
  const stoppedContainers = containers.filter(c => c.status === "stopped").length;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle className="text-xl text-destructive">
                Delete Your Account
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action is permanent and cannot be undone
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                Deleting your account will permanently:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li className="flex items-center gap-2">
                  <XCircle className="h-3 w-3" />
                  Stop and remove all your sandbox containers
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-3 w-3" />
                  Delete all files, volumes, and configurations
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-3 w-3" />
                  Remove your command history and logs
                </li>
                <li className="flex items-center gap-2">
                  <XCircle className="h-3 w-3" />
                  Erase all your account data and settings
                </li>
              </ul>
            </div>
          </div>

          {/* Containers Overview */}
          {isLoadingContainers ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : containers.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Your Sandboxes ({containers.length})
                </h4>
                <div className="flex gap-2">
                  {runningContainers > 0 && (
                    <Badge variant="outline" className="text-green-600 border-green-500/30">
                      {runningContainers} Running
                    </Badge>
                  )}
                  {stoppedContainers > 0 && (
                    <Badge variant="outline" className="text-gray-600 border-gray-500/30">
                      {stoppedContainers} Stopped
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="max-h-[200px] border rounded-lg">
                <div className="p-3 space-y-2">
                  {containers.map((container, index) => (
                    <div key={container.id}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{container.displayName}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {container.image}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={container.status === "running" ? "default" : "secondary"}
                          className={container.status === "running" ? "bg-green-500" : ""}
                        >
                          {container.status}
                        </Badge>
                      </div>
                      {index < containers.length - 1 && <Separator className="mt-2" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  All {containers.length} sandbox{containers.length !== 1 ? 'es' : ''} will be stopped,
                  removed from Docker, and their data will be permanently deleted.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-muted/50 border rounded-lg">
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                You have no active sandboxes
              </p>
            </div>
          )}

          <Separator />

          {/* Confirmation Input */}
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm:
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
                autoComplete="off"
                disabled={isDeleting}
                autoFocus
              />
            </div>

            {/* Deletion Progress */}
            {deletionProgress && (
              <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  {deletionProgress}
                </p>
              </div>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmText !== "DELETE" || isDeleting}
          >
            {isDeleting ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Deleting Account...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete My Account
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
