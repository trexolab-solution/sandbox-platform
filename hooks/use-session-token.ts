"use client";

import { useState, useEffect, useCallback } from "react";

interface UseSessionTokenResult {
  sessionToken: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSessionToken(): UseSessionTokenResult {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/session-token");

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Not authenticated");
        }
        throw new Error("Failed to fetch session token");
      }

      const data = await response.json();
      setSessionToken(data.token);
    } catch (err) {
      console.error("Error fetching session token:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch token");
      setSessionToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  return {
    sessionToken,
    isLoading,
    error,
    refetch: fetchToken,
  };
}
