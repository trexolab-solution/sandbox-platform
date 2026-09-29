"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface NavButtonProps extends Omit<React.ComponentProps<typeof Button>, "asChild"> {
  /** Navigation destination */
  href: string;
  /** Icon to show (will be replaced with spinner when navigating) */
  icon?: React.ReactNode;
  /** Whether to show only the icon */
  iconOnly?: boolean;
  /** External link */
  external?: boolean;
}

/**
 * Navigation button that shows loading state when clicked.
 * Icon is replaced with spinner during navigation.
 */
export function NavButton({
  href,
  icon,
  iconOnly = false,
  external = false,
  children,
  className,
  disabled,
  ...props
}: NavButtonProps) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = React.useState(false);

  // Reset navigation state when pathname changes
  React.useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      // Don't set loading for external links or same page
      if (external || pathname === href) return;
      setIsNavigating(true);
    },
    [external, pathname, href]
  );

  const iconElement = isNavigating ? (
    <Spinner className="h-4 w-4" />
  ) : icon ? (
    icon
  ) : null;

  if (external) {
    return (
      <Button asChild className={className} disabled={disabled} {...props}>
        <Link href={href} target="_blank" rel="noopener noreferrer">
          {iconElement && <span className={cn(!iconOnly && children && "mr-2")}>{iconElement}</span>}
          {!iconOnly && children}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      asChild
      className={cn(className, isNavigating && "pointer-events-none")}
      disabled={disabled || isNavigating}
      {...props}
    >
      <Link href={href} onClick={handleClick}>
        {iconElement && <span className={cn(!iconOnly && children && "mr-2")}>{iconElement}</span>}
        {!iconOnly && children}
      </Link>
    </Button>
  );
}
