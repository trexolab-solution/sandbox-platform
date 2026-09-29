"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorAlertProps {
  error: Error | string | null;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  className?: string;
  variant?: "default" | "destructive";
}

export function ErrorAlert({
  error,
  title = "Error",
  onRetry,
  onDismiss,
  retryLabel = "Try again",
  className,
  variant = "destructive",
}: ErrorAlertProps) {
  if (!error) return null;

  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <Alert variant={variant} className={cn("relative", className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{errorMessage}</span>
        <div className="flex items-center gap-2 shrink-0">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-7 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {retryLabel}
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

// Inline error display (for form fields, etc.)
interface InlineErrorProps {
  error: string | null | undefined;
  className?: string;
}

export function InlineError({ error, className }: InlineErrorProps) {
  if (!error) return null;

  return (
    <p className={cn("text-sm text-destructive mt-1", className)}>{error}</p>
  );
}

// Network error with automatic retry suggestion
interface NetworkErrorAlertProps {
  error: Error | string | null;
  onRetry?: () => void;
  className?: string;
}

export function NetworkErrorAlert({
  error,
  onRetry,
  className,
}: NetworkErrorAlertProps) {
  if (!error) return null;

  const errorMessage = error instanceof Error ? error.message : error;
  const isNetworkError =
    errorMessage.toLowerCase().includes("network") ||
    errorMessage.toLowerCase().includes("fetch") ||
    errorMessage.toLowerCase().includes("connection");

  return (
    <ErrorAlert
      error={error}
      title={isNetworkError ? "Connection Error" : "Error"}
      onRetry={onRetry}
      retryLabel={isNetworkError ? "Retry connection" : "Try again"}
      className={className}
    />
  );
}

// Toast-style error (for temporary display)
interface ToastErrorProps {
  error: string;
  onDismiss: () => void;
  duration?: number;
  className?: string;
}

export function ToastError({
  error,
  onDismiss,
  duration = 5000,
  className,
}: ToastErrorProps) {
  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(onDismiss, duration);
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-2",
        className
      )}
    >
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-7 w-7 p-0 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
