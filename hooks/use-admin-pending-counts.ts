"use client";

import { useState, useEffect, useCallback } from "react";

export interface AdminPendingCounts {
  pendingInternetRequests: number;
  unacknowledgedAlerts: number;
  criticalAlerts: number;
  blockedUsers: number;
  pendingScheduleRequests: number;
}

const DEFAULT_COUNTS: AdminPendingCounts = {
  pendingInternetRequests: 0,
  unacknowledgedAlerts: 0,
  criticalAlerts: 0,
  blockedUsers: 0,
  pendingScheduleRequests: 0,
};

const REFRESH_INTERVAL = 30000; // 30 seconds

export function useAdminPendingCounts() {
  const [counts, setCounts] = useState<AdminPendingCounts>(DEFAULT_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/pending-counts");
      if (response.ok) {
        const data = await response.json();
        setCounts(data);
        setError(null);
      } else if (response.status === 401 || response.status === 403) {
        // Not authorized, don't show error
        setError(null);
      } else {
        setError("Failed to fetch counts");
      }
    } catch {
      setError("Failed to fetch counts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();

    // Set up polling for real-time updates
    const interval = setInterval(fetchCounts, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchCounts]);

  return { counts, isLoading, error, refetch: fetchCounts };
}
