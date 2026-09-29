"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { ContainerStatus } from "@/lib/types/container";

export type ContainerAction = "start" | "stop" | "restart" | "delete";

interface UseContainerActionsOptions {
  containerId: string;
  onSuccess?: (action: ContainerAction) => void;
  onError?: (action: ContainerAction, error: Error) => void;
  showToasts?: boolean;
}

interface UseContainerActionsReturn {
  start: () => Promise<boolean>;
  stop: () => Promise<boolean>;
  restart: () => Promise<boolean>;
  remove: () => Promise<boolean>;
  isLoading: boolean;
  loadingAction: ContainerAction | null;
  error: Error | null;
  clearError: () => void;
}

const ACTION_MESSAGES: Record<ContainerAction, { loading: string; success: string; error: string }> = {
  start: {
    loading: "Starting sandbox...",
    success: "Sandbox started successfully",
    error: "Failed to start sandbox",
  },
  stop: {
    loading: "Stopping sandbox...",
    success: "Sandbox stopped successfully",
    error: "Failed to stop sandbox",
  },
  restart: {
    loading: "Restarting sandbox...",
    success: "Sandbox restarted successfully",
    error: "Failed to restart sandbox",
  },
  delete: {
    loading: "Deleting sandbox...",
    success: "Sandbox deleted successfully",
    error: "Failed to delete sandbox",
  },
};

export function useContainerActions({
  containerId,
  onSuccess,
  onError,
  showToasts = true,
}: UseContainerActionsOptions): UseContainerActionsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<ContainerAction | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const performAction = useCallback(
    async (action: ContainerAction): Promise<boolean> => {
      setIsLoading(true);
      setLoadingAction(action);
      setError(null);

      const messages = ACTION_MESSAGES[action];

      try {
        const endpoint =
          action === "delete"
            ? `/api/sandbox/containers/${containerId}`
            : `/api/sandbox/containers/${containerId}/${action}`;

        const method = action === "delete" ? "DELETE" : "POST";

        const response = await fetch(endpoint, { method });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || messages.error);
        }

        if (showToasts) {
          toast.success(messages.success);
        }

        onSuccess?.(action);
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(messages.error);
        setError(error);

        if (showToasts) {
          toast.error(error.message);
        }

        onError?.(action, error);
        return false;
      } finally {
        setIsLoading(false);
        setLoadingAction(null);
      }
    },
    [containerId, onSuccess, onError, showToasts]
  );

  const start = useCallback(() => performAction("start"), [performAction]);
  const stop = useCallback(() => performAction("stop"), [performAction]);
  const restart = useCallback(() => performAction("restart"), [performAction]);
  const remove = useCallback(() => performAction("delete"), [performAction]);
  const clearError = useCallback(() => setError(null), []);

  return {
    start,
    stop,
    restart,
    remove,
    isLoading,
    loadingAction,
    error,
    clearError,
  };
}

// Hook for managing action confirmation dialogs
interface ActionDialogState {
  open: boolean;
  action: ContainerAction | null;
  containerId: string | null;
  containerName: string | null;
}

interface UseActionDialogReturn {
  dialogState: ActionDialogState;
  openDialog: (action: ContainerAction, containerId: string, containerName: string) => void;
  closeDialog: () => void;
  confirmAction: () => Promise<boolean>;
  isConfirming: boolean;
}

export function useActionDialog(
  onActionComplete?: (action: ContainerAction, containerId: string) => void
): UseActionDialogReturn {
  const [dialogState, setDialogState] = useState<ActionDialogState>({
    open: false,
    action: null,
    containerId: null,
    containerName: null,
  });
  const [isConfirming, setIsConfirming] = useState(false);

  const openDialog = useCallback(
    (action: ContainerAction, containerId: string, containerName: string) => {
      setDialogState({
        open: true,
        action,
        containerId,
        containerName,
      });
    },
    []
  );

  const closeDialog = useCallback(() => {
    setDialogState({
      open: false,
      action: null,
      containerId: null,
      containerName: null,
    });
  }, []);

  const confirmAction = useCallback(async (): Promise<boolean> => {
    if (!dialogState.action || !dialogState.containerId) {
      return false;
    }

    setIsConfirming(true);

    const messages = ACTION_MESSAGES[dialogState.action];

    try {
      const endpoint =
        dialogState.action === "delete"
          ? `/api/sandbox/containers/${dialogState.containerId}`
          : `/api/sandbox/containers/${dialogState.containerId}/${dialogState.action}`;

      const method = dialogState.action === "delete" ? "DELETE" : "POST";

      const response = await fetch(endpoint, { method });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || messages.error);
      }

      toast.success(messages.success);
      onActionComplete?.(dialogState.action, dialogState.containerId);
      closeDialog();
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(messages.error);
      toast.error(error.message);
      return false;
    } finally {
      setIsConfirming(false);
    }
  }, [dialogState, onActionComplete, closeDialog]);

  return {
    dialogState,
    openDialog,
    closeDialog,
    confirmAction,
    isConfirming,
  };
}
