"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useContainerStats, ContainerStats } from "@/hooks/use-container-stats";
import { toast } from "sonner";

interface PortMapping {
  id: string;
  serviceName: string;
  internalPort: number;
  protocol: string;
}

interface Container {
  id: string;
  displayName: string;
  image: string;
  status: string;
  cpuLimit?: number;
  memoryLimitMb?: number;
  diskLimitMb?: number;
  runtimes?: string[] | null;
  runtimeVersions?: Record<string, string> | null;
  portMappings?: PortMapping[];
  internetAccess?: boolean | null;
  internetExpiresAt?: Date | null;
  currentNetwork?: string | null;
}

interface InternetStatus {
  hasInternet: boolean;
  expiresAt: Date | null;
  hasPendingRequest: boolean;
  timeRemaining: string | null;
  isExpiring: boolean;
}

interface ContainerContextType {
  container: Container;
  stats: ContainerStats | null;
  internetStatus: InternetStatus;
  portMappings: PortMapping[];
  runtimes: string[];
  runtimeVersions: Record<string, string>;
  isLoading: boolean;

  // Actions
  refreshContainer: () => Promise<void>;
  refreshStats: () => void;
  refreshPorts: () => Promise<void>;
  refreshRuntimes: () => Promise<void>;
  setInternetStatus: (status: Partial<InternetStatus>) => void;
}

const ContainerContext = createContext<ContainerContextType | null>(null);

interface ContainerProviderProps {
  containerId: string;
  initialContainer: Container;
  children: React.ReactNode;
}

export function ContainerProvider({
  containerId,
  initialContainer,
  children,
}: ContainerProviderProps) {
  const [container, setContainer] = useState<Container>(initialContainer);
  const [portMappings, setPortMappings] = useState<PortMapping[]>(
    initialContainer.portMappings || []
  );
  const [runtimes, setRuntimes] = useState<string[]>(
    initialContainer.runtimes || []
  );
  const [runtimeVersions, setRuntimeVersions] = useState<Record<string, string>>(
    initialContainer.runtimeVersions || {}
  );
  const [internetStatus, setInternetStatusState] = useState<InternetStatus>({
    hasInternet: initialContainer.internetAccess ?? false,
    expiresAt: initialContainer.internetExpiresAt ?? null,
    hasPendingRequest: false,
    timeRemaining: null,
    isExpiring: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Stats polling with status change detection
  const handleStatusChange = useCallback((newStatus: string) => {
    // Container status changed externally (e.g., stopped via docker stop on host)
    setContainer((prev) => ({
      ...prev,
      status: newStatus,
    }));
  }, []);

  const { stats, refetch: refreshStats } = useContainerStats(
    containerId,
    container.status === "running",
    { onStatusChange: handleStatusChange }
  );

  // Internet countdown timer
  useEffect(() => {
    if (!internetStatus.hasInternet || !internetStatus.expiresAt) {
      setInternetStatusState((prev) => ({
        ...prev,
        timeRemaining: null,
        isExpiring: false,
      }));
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const expiry = new Date(internetStatus.expiresAt!).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));

      if (remaining <= 0) {
        setInternetStatusState((prev) => ({
          ...prev,
          hasInternet: false,
          expiresAt: null,
          timeRemaining: null,
          isExpiring: false,
        }));
        toast.warning("Internet Access Expired");
        return;
      }

      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      const isExpiring = remaining <= 300;

      let formatted: string;
      if (hours > 0) {
        formatted = `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        formatted = `${minutes}m ${seconds}s`;
      } else {
        formatted = `${seconds}s`;
      }

      setInternetStatusState((prev) => ({
        ...prev,
        timeRemaining: formatted,
        isExpiring,
      }));
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, [internetStatus.hasInternet, internetStatus.expiresAt]);

  // SSE listener for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource("/api/sandbox/notifications/stream");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Only process events for this container
          if (data.containerId && data.containerId !== containerId) {
            return;
          }

          switch (data.type) {
            case "request_approved":
              setInternetStatusState((prev) => ({
                ...prev,
                hasInternet: true,
                hasPendingRequest: false,
                expiresAt: data.data?.expiresAt ? new Date(data.data.expiresAt) : null,
              }));
              setContainer((prev) => ({
                ...prev,
                internetAccess: true,
                internetExpiresAt: data.data?.expiresAt ? new Date(data.data.expiresAt) : null,
              }));
              toast.success("Internet Access Approved");
              break;

            case "request_denied":
              setInternetStatusState((prev) => ({
                ...prev,
                hasPendingRequest: false,
              }));
              toast.error("Internet Access Denied", {
                description: data.data?.reason || "Your request was denied.",
              });
              break;

            case "internet_expired":
              setInternetStatusState((prev) => ({
                ...prev,
                hasInternet: false,
                expiresAt: null,
                timeRemaining: null,
                isExpiring: false,
              }));
              setContainer((prev) => ({
                ...prev,
                internetAccess: false,
                internetExpiresAt: null,
              }));
              toast.warning("Internet Access Expired");
              break;

            case "internet_expiring":
              toast.warning("Internet Access Expiring Soon", {
                description: "Your internet access will expire in less than 5 minutes.",
              });
              break;

            case "port_added":
              refreshPorts();
              toast.success("Port mapping added");
              break;

            case "port_removed":
              refreshPorts();
              toast.info("Port mapping removed");
              break;

            case "runtime_installed":
              refreshRuntimes();
              toast.success(`Runtime installed: ${data.data?.runtime || "Unknown"}`);
              break;

            case "container_status":
              if (data.data?.status) {
                setContainer((prev) => ({
                  ...prev,
                  status: data.data.status,
                }));
              }
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Reconnect after 5 seconds
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, [containerId]);

  const refreshContainer = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sandbox/containers/${containerId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.container) {
          setContainer(data.container);
          setPortMappings(data.container.portMappings || []);
          setRuntimes(data.container.runtimes || []);
          setRuntimeVersions(data.container.runtimeVersions || {});
          setInternetStatusState((prev) => ({
            ...prev,
            hasInternet: data.container.internetAccess ?? false,
            expiresAt: data.container.internetExpiresAt ?? null,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to refresh container:", error);
    } finally {
      setIsLoading(false);
    }
  }, [containerId]);

  const refreshPorts = useCallback(async () => {
    try {
      const response = await fetch(`/api/sandbox/containers/${containerId}/ports`);
      if (response.ok) {
        const data = await response.json();
        setPortMappings(data.portMappings || []);
      }
    } catch (error) {
      console.error("Failed to refresh ports:", error);
    }
  }, [containerId]);

  const refreshRuntimes = useCallback(async () => {
    try {
      const response = await fetch(`/api/sandbox/containers/${containerId}/runtimes`);
      if (response.ok) {
        const data = await response.json();
        setRuntimes(data.runtimes || []);
        setRuntimeVersions(data.runtimeVersions || {});
      }
    } catch (error) {
      console.error("Failed to refresh runtimes:", error);
    }
  }, [containerId]);

  const setInternetStatus = useCallback((status: Partial<InternetStatus>) => {
    setInternetStatusState((prev) => ({ ...prev, ...status }));
  }, []);

  const value: ContainerContextType = {
    container,
    stats,
    internetStatus,
    portMappings,
    runtimes,
    runtimeVersions,
    isLoading,
    refreshContainer,
    refreshStats,
    refreshPorts,
    refreshRuntimes,
    setInternetStatus,
  };

  return (
    <ContainerContext.Provider value={value}>
      {children}
    </ContainerContext.Provider>
  );
}

export function useContainerContext() {
  const context = useContext(ContainerContext);
  if (!context) {
    throw new Error("useContainerContext must be used within a ContainerProvider");
  }
  return context;
}

export function useContainerContextOptional() {
  return useContext(ContainerContext);
}
