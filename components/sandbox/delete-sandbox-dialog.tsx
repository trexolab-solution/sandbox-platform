"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Trash2,
  AlertTriangle,
  HardDrive,
  Network,
  Clock,
  Terminal,
  FileX,
} from "lucide-react";
import { toast } from "sonner";

interface DeleteSandboxDialogProps {
  /** Sandbox ID */
  sandboxId: string;
  /** Sandbox display name */
  sandboxName: string;
  /** Current sandbox status */
  status?: string;
  /** Whether the sandbox has port mappings */
  hasPortMappings?: boolean;
  /** Whether the sandbox has internet access */
  hasInternetAccess?: boolean;
  /** Whether the sandbox has scheduled tasks */
  hasScheduledTasks?: boolean;
  /** Custom trigger element (defaults to delete button) */
  trigger?: React.ReactNode;
  /** Callback after successful deletion */
  onDeleted?: () => void;
  /** Redirect path after deletion (defaults to /sandbox, set to null to disable redirect) */
  redirectTo?: string | null;
  /** Whether trigger button should be disabled */
  disabled?: boolean;
  /** Variant for default trigger button */
  variant?: "icon" | "button" | "outline";
  /** Size for default trigger button */
  size?: "sm" | "default" | "lg";
  /** Use admin API endpoint instead of user API */
  isAdmin?: boolean;
}

interface ConsequenceItemProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function ConsequenceItem({ icon: Icon, title, description }: ConsequenceItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <Icon className="h-4 w-4 text-destructive" />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * Reusable delete sandbox confirmation dialog.
 * Shows consequences of deletion and handles the delete API call.
 */
export function DeleteSandboxDialog({
  sandboxId,
  sandboxName,
  status,
  hasPortMappings = false,
  hasInternetAccess = false,
  hasScheduledTasks = false,
  trigger,
  onDeleted,
  redirectTo = "/sandbox",
  disabled = false,
  variant = "icon",
  size = "default",
  isAdmin = false,
}: DeleteSandboxDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const apiUrl = isAdmin
        ? `/api/admin/sandboxes/${sandboxId}`
        : `/api/sandbox/containers/${sandboxId}`;

      const response = await fetch(apiUrl, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorMsg = data.error || "Failed to delete sandbox";
        toast.error(errorMsg);
        return;
      }

      toast.success("Sandbox deleted successfully");
      setOpen(false);

      if (onDeleted) {
        onDeleted();
      }

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      } else if (redirectTo === null) {
        // No redirect, just refresh
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to delete sandbox:", error);
      toast.error("Failed to delete sandbox");
    } finally {
      setIsDeleting(false);
    }
  };

  // Default trigger button based on variant
  const defaultTrigger = variant === "icon" ? (
    <Button
      variant="destructive"
      size="icon"
      className="h-8 w-8"
      disabled={disabled}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  ) : variant === "outline" ? (
    <Button
      variant="outline"
      size={size}
      disabled={disabled}
      className="gap-2"
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </Button>
  ) : (
    <Button
      variant="destructive"
      size={size}
      disabled={disabled}
      className="gap-2"
    >
      <Trash2 className="h-4 w-4" />
      Delete Sandbox
    </Button>
  );

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || defaultTrigger}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg">Delete Sandbox</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">{sandboxName}</span>?
                This action is <span className="font-semibold text-destructive">permanent</span> and cannot be undone.
              </p>

              {/* Consequences */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">What will be deleted:</p>

                <ConsequenceItem
                  icon={FileX}
                  title="All Files & Data"
                  description="All files, folders, and data stored in this sandbox will be permanently deleted."
                />

                <ConsequenceItem
                  icon={Terminal}
                  title="Container & Configuration"
                  description="The container instance and all its configurations will be removed."
                />

                {hasPortMappings && (
                  <ConsequenceItem
                    icon={Network}
                    title="Port Mappings"
                    description="All exposed ports and service URLs will become unavailable."
                  />
                )}

                {hasInternetAccess && (
                  <ConsequenceItem
                    icon={HardDrive}
                    title="Internet Access"
                    description="Any granted internet access permissions will be revoked."
                  />
                )}

                {hasScheduledTasks && (
                  <ConsequenceItem
                    icon={Clock}
                    title="Scheduled Tasks"
                    description="All pending schedule requests will be cancelled."
                  />
                )}

                {status === "running" && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <p className="text-xs">
                      This sandbox is currently running. It will be forcefully stopped before deletion.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Sandbox
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
