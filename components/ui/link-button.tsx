"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface LinkButtonProps extends Omit<React.ComponentProps<typeof Button>, "asChild"> {
  href: string;
  children: React.ReactNode;
  /** Icon to show before children (will be replaced with spinner when loading) */
  icon?: React.ReactNode;
  /** Whether to replace the current history entry */
  replace?: boolean;
  /** Whether to prefetch the linked page */
  prefetch?: boolean;
  /** External link (opens in new tab) */
  external?: boolean;
}

/**
 * A button that navigates to a link with loading state.
 * Shows a spinner when clicked until navigation completes.
 */
export function LinkButton({
  href,
  children,
  icon,
  replace = false,
  prefetch = true,
  external = false,
  className,
  disabled,
  ...props
}: LinkButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Don't handle external links or if disabled
      if (external || disabled) return;

      // Prevent default link behavior
      e.preventDefault();

      // Set loading state
      setIsLoading(true);

      // Navigate programmatically
      if (replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [href, replace, external, disabled, router]
  );

  // Reset loading state when href changes (navigation completed)
  React.useEffect(() => {
    setIsLoading(false);
  }, [href]);

  // For external links, just use regular Link behavior
  if (external) {
    return (
      <Button asChild className={className} disabled={disabled} {...props}>
        <Link href={href} target="_blank" rel="noopener noreferrer" prefetch={prefetch}>
          {icon && <span className="mr-2">{icon}</span>}
          {children}
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild className={className} disabled={disabled || isLoading} {...props}>
      <Link href={href} onClick={handleClick} prefetch={prefetch}>
        {isLoading ? (
          <Spinner className="mr-2 h-4 w-4" />
        ) : icon ? (
          <span className="mr-2">{icon}</span>
        ) : null}
        {children}
      </Link>
    </Button>
  );
}

/**
 * Hook to create a navigation function with loading state.
 * Useful for programmatic navigation with loading feedback.
 */
export function useNavigationLoading() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [targetPath, setTargetPath] = React.useState<string | null>(null);

  const navigate = React.useCallback(
    (href: string, options?: { replace?: boolean }) => {
      setIsNavigating(true);
      setTargetPath(href);

      if (options?.replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    },
    [router]
  );

  // Reset when navigation target changes
  React.useEffect(() => {
    if (targetPath) {
      // Add a small delay to ensure the navigation has started
      const timeout = setTimeout(() => {
        setIsNavigating(false);
        setTargetPath(null);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [targetPath]);

  return { navigate, isNavigating, targetPath };
}
