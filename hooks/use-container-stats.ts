"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface ContainerStats {
  cpuPercent: number;
  memoryUsageMb: number;
  memoryLimitMb: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

interface UseContainerStatsOptions {
  interval?: number; // polling interval in ms
  enabled?: boolean;
  onStatusChange?: (newStatus: string) => void; // callback when status changes externally
}

export function useContainerStats(
  containerId: string | null,
  isRunning: boolean,
  options: UseContainerStatsOptions = {}
) {
  const { interval = 3000, enabled = true, onStatusChange } = options;

  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualStatus, setActualStatus] = useState<string | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const fetchStats = useCallback(async () => {
    if (!containerId || !isRunning || !enabled) {
      setStats(null);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/stats`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }

      const data = await response.json();

      // Check if container status changed externally (e.g., stopped via docker stop)
      if (data.statusChanged && data.status !== "running") {
        setActualStatus(data.status);
        setStats(null);
        if (onStatusChangeRef.current) {
          onStatusChangeRef.current(data.status);
        }
        return;
      }

      setStats(data.stats);
      setActualStatus(data.status || "running");
      setError(null);
    } catch (err) {
      console.error("Error fetching container stats:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch stats"
      );
    } finally {
      setLoading(false);
    }
  }, [containerId, isRunning, enabled]);

  useEffect(() => {
    if (!containerId || !isRunning || !enabled) {
      setStats(null);
      setError(null);
      return;
    }

    // Fetch immediately
    fetchStats();

    // Set up polling
    const intervalId = setInterval(fetchStats, interval);

    return () => clearInterval(intervalId);
  }, [containerId, isRunning, enabled, interval, fetchStats]);

  return {
    stats,
    loading,
    error,
    actualStatus,
    refetch: fetchStats,
  };
}
