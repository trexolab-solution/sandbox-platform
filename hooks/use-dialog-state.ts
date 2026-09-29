"use client";

import { useState, useCallback } from "react";

/**
 * Dialog state interface
 */
export interface DialogState<T = unknown> {
  open: boolean;
  data: T | null;
}

/**
 * Hook return type
 */
export interface UseDialogStateReturn<T> {
  /** Current dialog state */
  state: DialogState<T>;
  /** Open the dialog with optional data */
  open: (data?: T) => void;
  /** Close the dialog and clear data */
  close: () => void;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Current dialog data */
  data: T | null;
}

/**
 * Custom hook for managing dialog state
 * Provides a unified pattern for open/close states with associated data
 *
 * @example
 * ```tsx
 * // Simple dialog
 * const deleteDialog = useDialogState<string>();
 * // Open with item id
 * deleteDialog.open(itemId);
 * // Access in dialog
 * if (deleteDialog.isOpen) {
 *   const itemId = deleteDialog.data;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Dialog with complex data
 * interface PortMapping { id: string; port: number }
 * const portDialog = useDialogState<PortMapping>();
 * portDialog.open({ id: "123", port: 8080 });
 * ```
 */
export function useDialogState<T = void>(
  initialData?: T
): UseDialogStateReturn<T> {
  const [state, setState] = useState<DialogState<T>>({
    open: false,
    data: initialData ?? null,
  });

  const open = useCallback((data?: T) => {
    setState({ open: true, data: data ?? null });
  }, []);

  const close = useCallback(() => {
    setState({ open: false, data: null });
  }, []);

  return {
    state,
    open,
    close,
    isOpen: state.open,
    data: state.data,
  };
}
