"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Options for the creation progress hook
 */
export interface UseCreationProgressOptions {
  /** Container ID to track progress for */
  containerId: string | null;
  /** Whether polling is enabled (default: true when containerId is provided) */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Callback when creation completes */
  onComplete?: () => void;
  /** Callback when creation encounters an error */
  onError?: (error: string) => void;
}

/**
 * Return type for the creation progress hook
 */
export interface UseCreationProgressReturn {
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current step description */
  step: string;
  /** Error message if creation failed */
  error: string | null;
  /** Whether creation is complete */
  isComplete: boolean;
  /** Whether there is an error */
  hasError: boolean;
  /** Whether currently polling */
  isLoading: boolean;
}

/**
 * Custom hook for polling container creation progress
 * Automatically polls the progress API and calls callbacks on completion/error
 *
 * @example
 * ```tsx
 * const { progress, step, error, isComplete } = useCreationProgress({
 *   containerId: container.id,
 *   enabled: container.status === "creating",
 *   onComplete: () => router.refresh(),
 *   onError: (err) => toast.error(err),
 * });
 * ```
 */
export function useCreationProgress({
  containerId,
  enabled = true,
  pollInterval = 2000,
  onComplete,
  onError,
}: UseCreationProgressOptions): UseCreationProgressReturn {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Use refs for callbacks to avoid re-triggering effect
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const pollProgress = useCallback(async () => {
    if (!containerId) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/sandbox/containers/${containerId}/progress`);

      if (response.ok) {
        const data = await response.json();
        setProgress(data.progress || 0);
        setStep(data.step || "");

        if (data.error) {
          setError(data.error);
          onErrorRef.current?.(data.error);
        }

        if (data.isComplete) {
          setIsComplete(true);
          onCompleteRef.current?.();
        } else if (data.hasError) {
          onErrorRef.current?.(data.error || "Creation failed");
        }
      }
    } catch {
      // Ignore polling errors - connection might be temporarily unavailable
    } finally {
      setIsLoading(false);
    }
  }, [containerId]);

  useEffect(() => {
    if (!containerId || !enabled) {
      return;
    }

    // Initial poll
    pollProgress();

    // Set up interval
    const interval = setInterval(pollProgress, pollInterval);

    return () => {
      clearInterval(interval);
    };
  }, [containerId, enabled, pollInterval, pollProgress]);

  // Reset state when containerId changes
  useEffect(() => {
    if (!containerId) {
      setProgress(0);
      setStep("");
      setError(null);
      setIsComplete(false);
    }
  }, [containerId]);

  return {
    progress,
    step,
    error,
    isComplete,
    hasError: error !== null,
    isLoading,
  };
}
