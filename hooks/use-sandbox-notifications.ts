"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

export interface CreationProgressData {
  containerId: string;
  progress: number;
  step: string;
  status: "creating" | "initializing" | "stopped" | "error";
  error?: string | null;
  isComplete: boolean;
  hasError: boolean;
}

interface SandboxNotification {
  type: string;
  containerId?: string;
  title: string;
  message: string;
  severity?: "info" | "warning" | "error";
  timestamp: string;
  data?: CreationProgressData;
}

interface UseSandboxNotificationsOptions {
  onCreationProgress?: (data: CreationProgressData & { containerId: string }) => void;
  onCreationComplete?: (containerId: string) => void;
  onCreationError?: (containerId: string, error: string) => void;
  showToasts?: boolean;
}

export function useSandboxNotifications(options: UseSandboxNotificationsOptions = {}) {
  const {
    onCreationProgress,
    onCreationComplete,
    onCreationError,
    showToasts = true,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [creatingContainers, setCreatingContainers] = useState<Map<string, CreationProgressData>>(
    new Map()
  );

  // Track which containers we've already shown completion toast for
  const completedToastsRef = useRef<Set<string>>(new Set());

  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    try {
      const eventSource = new EventSource("/api/sandbox/notifications/stream");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log("[SSE] Connected to sandbox notifications");
      };

      eventSource.onmessage = (event) => {
        try {
          const notification: SandboxNotification = JSON.parse(event.data);

          // Handle creation progress
          if (notification.type === "creation_progress" && notification.data) {
            const progressData = notification.data;
            const containerId = notification.containerId || progressData.containerId;

            if (!containerId) return;

            // Update local state
            setCreatingContainers((prev) => {
              const newMap = new Map(prev);
              if (progressData.isComplete || progressData.hasError) {
                newMap.delete(containerId);
              } else {
                newMap.set(containerId, { ...progressData, containerId });
              }
              return newMap;
            });

            // Call progress callback
            onCreationProgress?.({ ...progressData, containerId });

            // Handle completion
            if (progressData.isComplete) {
              onCreationComplete?.(containerId);

              // Show success toast (only once per container)
              if (showToasts && !completedToastsRef.current.has(containerId)) {
                completedToastsRef.current.add(containerId);
                toast.success("Sandbox Ready!", {
                  description: "Your sandbox has been created successfully.",
                  action: {
                    label: "Open",
                    onClick: () => {
                      window.location.href = `/sandbox/${containerId}`;
                    },
                  },
                  duration: 10000,
                });
              }
            }

            // Handle error
            if (progressData.hasError) {
              onCreationError?.(containerId, progressData.error || "Unknown error");

              // Show error toast (only once per container)
              if (showToasts && !completedToastsRef.current.has(containerId)) {
                completedToastsRef.current.add(containerId);
                toast.error("Sandbox Creation Failed", {
                  description: progressData.error || "An error occurred during setup.",
                  duration: 10000,
                });
              }
            }
          }

          // Handle other notification types (internet access, etc.)
          if (notification.type === "request_approved" && showToasts) {
            toast.success(notification.title, {
              description: notification.message,
            });
          }

          if (notification.type === "request_denied" && showToasts) {
            toast.error(notification.title, {
              description: notification.message,
            });
          }

          if (notification.type === "internet_expired" && showToasts) {
            toast.warning("Internet Access Expired", {
              description: notification.message,
            });
          }

          if (notification.type === "internet_expiring" && showToasts) {
            toast.warning("Internet Access Expiring Soon", {
              description: notification.message,
            });
          }

        } catch (err) {
          console.error("[SSE] Failed to parse message:", err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        eventSourceRef.current = null;

        // Reconnect after delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[SSE] Attempting to reconnect...");
          connect();
        }, 5000);
      };
    } catch (err) {
      console.error("[SSE] Failed to connect:", err);
      setIsConnected(false);
    }
  }, [onCreationProgress, onCreationComplete, onCreationError, showToasts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Clear completed toasts cache periodically
  useEffect(() => {
    const interval = setInterval(() => {
      completedToastsRef.current.clear();
    }, 60000); // Clear every minute
    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    creatingContainers: Array.from(creatingContainers.values()),
    reconnect: connect,
  };
}
