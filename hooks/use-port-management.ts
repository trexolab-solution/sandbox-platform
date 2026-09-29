"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Options for the port management hook
 */
export interface UsePortManagementOptions {
  /** Container ID for port operations */
  containerId: string;
  /** Callback on successful operation */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * Validation result for service name
 */
export interface ServiceNameValidation {
  valid: boolean;
  error?: string;
}

/**
 * Return type for the port management hook
 */
export interface UsePortManagementReturn {
  /** Add a port mapping */
  addPort: (serviceName: string, port: number, protocol?: string) => Promise<boolean>;
  /** Delete a port mapping */
  deletePort: (portId: string) => Promise<boolean>;
  /** Whether an add operation is in progress */
  isAdding: boolean;
  /** Whether a delete operation is in progress */
  isDeleting: boolean;
  /** Validate a port number */
  validatePort: (port: number) => boolean;
  /** Validate a service name */
  validateServiceName: (name: string) => ServiceNameValidation;
}

/**
 * Custom hook for managing container port mappings
 * Provides functions to add/delete ports with validation and loading states
 *
 * @example
 * ```tsx
 * const { addPort, deletePort, isAdding, validatePort, validateServiceName } = usePortManagement({
 *   containerId: container.id,
 *   onSuccess: () => router.refresh(),
 * });
 *
 * // Add a port
 * const success = await addPort("my-service", 8080);
 *
 * // Delete a port
 * await deletePort(portId);
 * ```
 */
export function usePortManagement({
  containerId,
  onSuccess,
  onError,
}: UsePortManagementOptions): UsePortManagementReturn {
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Validate a port number
   */
  const validatePort = useCallback((port: number): boolean => {
    return !isNaN(port) && port >= 1000 && port <= 65535;
  }, []);

  /**
   * Validate a service name
   */
  const validateServiceName = useCallback((name: string): ServiceNameValidation => {
    const trimmed = name.trim().toLowerCase();

    if (!trimmed) {
      return { valid: false, error: "Please provide a service name" };
    }

    if (trimmed.length < 3 || trimmed.length > 30) {
      return { valid: false, error: "Service name must be 3-30 characters" };
    }

    const validPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!validPattern.test(trimmed)) {
      return {
        valid: false,
        error: "Service name must be lowercase, start/end with letter or number",
      };
    }

    return { valid: true };
  }, []);

  /**
   * Add a port mapping
   */
  const addPort = useCallback(
    async (
      serviceName: string,
      port: number,
      protocol: string = "tcp"
    ): Promise<boolean> => {
      // Validate inputs
      if (!validatePort(port)) {
        const error = "Invalid port number (1000-65535)";
        toast.error(error);
        onError?.(error);
        return false;
      }

      const nameValidation = validateServiceName(serviceName);
      if (!nameValidation.valid) {
        toast.error(nameValidation.error);
        onError?.(nameValidation.error!);
        return false;
      }

      setIsAdding(true);
      try {
        const response = await fetch(`/api/sandbox/containers/${containerId}/ports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceName: serviceName.trim().toLowerCase(),
            port,
            protocol,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to add port");
        }

        toast.success(`Port ${port} mapped successfully`);
        onSuccess?.();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add port";
        toast.error(message);
        onError?.(message);
        return false;
      } finally {
        setIsAdding(false);
      }
    },
    [containerId, onSuccess, onError, validatePort, validateServiceName]
  );

  /**
   * Delete a port mapping
   */
  const deletePort = useCallback(
    async (portId: string): Promise<boolean> => {
      setIsDeleting(true);
      try {
        const response = await fetch(
          `/api/sandbox/containers/${containerId}/ports/${portId}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to remove port");
        }

        toast.success("Port removed successfully");
        onSuccess?.();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to remove port";
        toast.error(message);
        onError?.(message);
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [containerId, onSuccess, onError]
  );

  return {
    addPort,
    deletePort,
    isAdding,
    isDeleting,
    validatePort,
    validateServiceName,
  };
}
