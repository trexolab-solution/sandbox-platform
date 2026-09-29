"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingButtonProps extends React.ComponentProps<typeof Button> {
  /** Whether the button is in loading state */
  loading?: boolean;
  /** Icon to show when not loading */
  icon?: React.ReactNode;
  /** Text to show when loading (defaults to children) */
  loadingText?: string;
  /** Position of the icon/spinner */
  iconPosition?: "left" | "right";
}

/**
 * A button that shows a spinner when loading.
 * Replaces the icon with a spinner during loading state.
 */
export function LoadingButton({
  loading = false,
  icon,
  loadingText,
  iconPosition = "left",
  children,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  const content = loading && loadingText ? loadingText : children;

  const iconElement = loading ? (
    <Spinner className="h-4 w-4" />
  ) : icon ? (
    icon
  ) : null;

  return (
    <Button
      disabled={disabled || loading}
      className={cn(className)}
      {...props}
    >
      {iconPosition === "left" && iconElement && (
        <span className={cn(content && "mr-2")}>{iconElement}</span>
      )}
      {content}
      {iconPosition === "right" && iconElement && (
        <span className={cn(content && "ml-2")}>{iconElement}</span>
      )}
    </Button>
  );
}

/**
 * Hook to manage async button operations with loading state.
 * Returns loading state and a wrapper function for async operations.
 */
export function useAsyncButton() {
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);

  const execute = React.useCallback(
    async (key: string, asyncFn: () => Promise<void>) => {
      setLoadingKey(key);
      try {
        await asyncFn();
      } finally {
        setLoadingKey(null);
      }
    },
    []
  );

  const isLoading = React.useCallback(
    (key: string) => loadingKey === key,
    [loadingKey]
  );

  const isAnyLoading = loadingKey !== null;

  return { execute, isLoading, isAnyLoading, loadingKey };
}
