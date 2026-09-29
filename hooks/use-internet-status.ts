"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface InternetStatus {
  hasInternet: boolean;
  expiresAt: Date | null;
  hasPendingRequest: boolean;
  pendingRequestId: string | null;
}

interface UseInternetStatusOptions {
  containerId: string;
  initialStatus?: boolean;
  initialExpiresAt?: Date | null;
  onExpired?: () => void;
  onExpiring?: () => void;  // Called when 5 minutes or less remaining
}

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  formatted: string;
  isExpiring: boolean;  // Less than 5 minutes remaining
}

export function useInternetStatus({
  containerId,
  initialStatus = false,
  initialExpiresAt = null,
  onExpired,
  onExpiring,
}: UseInternetStatusOptions) {
  const [hasInternet, setHasInternet] = useState(initialStatus);
  const [expiresAt, setExpiresAt] = useState<Date | null>(initialExpiresAt);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCalledExpiring = useRef(false);
  const hasCalledExpired = useRef(false);

  // Store callbacks in refs to avoid infinite loops when callers pass inline functions
  const onExpiredRef = useRef(onExpired);
  const onExpiringRef = useRef(onExpiring);

  // Keep refs in sync with latest callbacks
  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    onExpiringRef.current = onExpiring;
  }, [onExpiring]);

  // Format time remaining
  const formatTimeRemaining = useCallback((totalSeconds: number): TimeRemaining => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const isExpiring = totalSeconds <= 300; // 5 minutes

    let formatted: string;
    if (hours > 0) {
      formatted = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      formatted = `${minutes}m ${seconds}s`;
    } else {
      formatted = `${seconds}s`;
    }

    return { hours, minutes, seconds, totalSeconds, formatted, isExpiring };
  }, []);

  // Fetch current internet status
  const fetchStatus = useCallback(async () => {
    if (!containerId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/internet-request`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch internet status");
      }

      const data = await response.json();

      setHasInternet(data.hasInternet);
      setExpiresAt(data.internetExpiresAt ? new Date(data.internetExpiresAt) : null);
      setHasPendingRequest(data.hasPendingRequest);
      setPendingRequestId(data.pendingRequestId || null);
      setError(null);

      // Reset callback flags when status changes
      if (!data.hasInternet) {
        hasCalledExpiring.current = false;
        hasCalledExpired.current = false;
      }
    } catch (err) {
      console.error("Error fetching internet status:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch status");
    } finally {
      setIsLoading(false);
    }
  }, [containerId]);

  // Countdown timer effect
  useEffect(() => {
    if (!hasInternet || !expiresAt) {
      setTimeRemaining(null);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const expiry = expiresAt.getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));

      if (remaining <= 0) {
        setTimeRemaining(null);
        setHasInternet(false);
        setExpiresAt(null);

        if (!hasCalledExpired.current) {
          hasCalledExpired.current = true;
          onExpiredRef.current?.();
        }
        return;
      }

      const timeInfo = formatTimeRemaining(remaining);
      setTimeRemaining(timeInfo);

      // Call onExpiring when 5 minutes or less remaining
      if (timeInfo.isExpiring && !hasCalledExpiring.current) {
        hasCalledExpiring.current = true;
        onExpiringRef.current?.();
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, [hasInternet, expiresAt, formatTimeRemaining]);

  // SSE listener for real-time updates
  useEffect(() => {
    if (!containerId) return;

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
              setHasInternet(true);
              setHasPendingRequest(false);
              setPendingRequestId(null);
              if (data.data?.expiresAt) {
                setExpiresAt(new Date(data.data.expiresAt));
              }
              hasCalledExpiring.current = false;
              hasCalledExpired.current = false;
              break;

            case "request_denied":
              setHasPendingRequest(false);
              setPendingRequestId(null);
              break;

            case "internet_expired":
              setHasInternet(false);
              setExpiresAt(null);
              setTimeRemaining(null);
              if (!hasCalledExpired.current) {
                hasCalledExpired.current = true;
                onExpiredRef.current?.();
              }
              break;

            case "internet_expiring":
              if (!hasCalledExpiring.current) {
                hasCalledExpiring.current = true;
                onExpiringRef.current?.();
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

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    hasInternet,
    expiresAt,
    hasPendingRequest,
    pendingRequestId,
    timeRemaining,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}
