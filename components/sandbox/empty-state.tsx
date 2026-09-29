"use client";

import { Button } from "@/components/ui/button";
import { LucideIcon, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    variant?: "default" | "outline" | "secondary";
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: {
    container: "py-6",
    icon: "h-8 w-8",
    title: "text-base",
    description: "text-sm",
  },
  md: {
    container: "py-12",
    icon: "h-12 w-12",
    title: "text-lg",
    description: "text-sm",
  },
  lg: {
    container: "py-16",
    icon: "h-16 w-16",
    title: "text-xl",
    description: "text-base",
  },
};

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className,
}: EmptyStateProps) {
  const sizeClasses = SIZE_CLASSES[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sizeClasses.container,
        className
      )}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className={cn("text-muted-foreground", sizeClasses.icon)} />
      </div>
      <h3 className={cn("font-semibold", sizeClasses.title)}>{title}</h3>
      <p
        className={cn(
          "text-muted-foreground mt-2 max-w-sm",
          sizeClasses.description
        )}
      >
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-6">
          {action && (
            action.href ? (
              <Button asChild variant={action.variant || "default"}>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button
                variant={action.variant || "default"}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Button asChild variant="outline">
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// Pre-configured empty states for common use cases
export function NoContainersEmptyState({
  onCreateClick,
}: {
  onCreateClick?: () => void;
}) {
  return (
    <EmptyState
      icon={Package}
      title="No sandboxes yet"
      description="Create your first sandbox to start coding in an isolated environment."
      action={{
        label: "Create Sandbox",
        href: onCreateClick ? undefined : "/sandbox/create",
        onClick: onCreateClick,
      }}
    />
  );
}

export function NoResultsEmptyState({
  searchTerm,
  onClear,
}: {
  searchTerm?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      title="No results found"
      description={
        searchTerm
          ? `No sandboxes match "${searchTerm}". Try a different search term.`
          : "No sandboxes match your current filters."
      }
      action={
        onClear
          ? {
              label: "Clear filters",
              onClick: onClear,
              variant: "outline",
            }
          : undefined
      }
      size="sm"
    />
  );
}

export function ErrorEmptyState({
  error,
  onRetry,
}: {
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      title="Something went wrong"
      description={error || "Failed to load data. Please try again."}
      action={
        onRetry
          ? {
              label: "Try again",
              onClick: onRetry,
              variant: "outline",
            }
          : undefined
      }
      size="sm"
    />
  );
}
