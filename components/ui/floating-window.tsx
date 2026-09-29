"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { DndContext, useDraggable, DragEndEvent } from "@dnd-kit/core";
import { GripHorizontal, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FloatingWindowProps {
  /** Unique identifier for the window */
  id: string;
  /** Window title displayed in header - can be string or ReactNode */
  title: React.ReactNode;
  /** Window content */
  children: React.ReactNode;
  /** Whether the window is open */
  open: boolean;
  /** Callback when close button is clicked */
  onClose: () => void;
  /** Whether the window is minimized */
  minimized?: boolean;
  /** Callback when minimize state changes */
  onMinimizedChange?: (minimized: boolean) => void;
  /** Whether the window is maximized */
  maximized?: boolean;
  /** Callback when maximize state changes */
  onMaximizedChange?: (maximized: boolean) => void;
  /** Default width in pixels */
  defaultWidth?: number;
  /** Default height in pixels */
  defaultHeight?: number;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Additional class names for the window container */
  className?: string;
  /** Additional class names for the content area */
  contentClassName?: string;
  /** Z-index for the window */
  zIndex?: number;
  /** Header actions (buttons) to show in header */
  headerActions?: React.ReactNode;
  /** Use fixed positioning for full-screen dragging */
  fullScreenDrag?: boolean;
  /** @deprecated No longer used */
  minimizedPortalId?: string;
}

interface DraggableWindowProps extends Omit<FloatingWindowProps, "open"> {
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  windowRefCallback?: (node: HTMLDivElement | null) => void;
  fullScreenDrag?: boolean;
}

function DraggableWindowContent({
  id,
  title,
  children,
  onClose,
  minimized = false,
  onMinimizedChange,
  maximized = false,
  onMaximizedChange,
  defaultWidth = 800,
  defaultHeight = 500,
  minWidth = 400,
  minHeight = 200,
  className,
  contentClassName,
  zIndex = 50,
  headerActions,
  position,
  onPositionChange,
  windowRefCallback,
  fullScreenDrag = false,
}: DraggableWindowProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `floating-window-${id}`,
    disabled: maximized || minimized,
  });

  const windowRef = useRef<HTMLDivElement>(null);

  // Calculate final transform position
  const finalX = position.x + (transform?.x ?? 0);
  const finalY = position.y + (transform?.y ?? 0);

  // Ref to track current position for bounds checking without causing re-renders
  const positionRef = useRef(position);
  positionRef.current = position;

  // Keep window within bounds on resize only
  useEffect(() => {
    if (maximized || minimized) return;

    const checkBounds = () => {
      if (!windowRef.current) return;
      const rect = windowRef.current.getBoundingClientRect();
      const currentPos = positionRef.current;

      let containerWidth: number;
      let containerHeight: number;

      if (fullScreenDrag) {
        containerWidth = window.innerWidth;
        containerHeight = window.innerHeight;
      } else {
        const parent = windowRef.current.parentElement;
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();
        containerWidth = parentRect.width;
        containerHeight = parentRect.height;
      }

      let newX = currentPos.x;
      let newY = currentPos.y;
      let needsUpdate = false;

      if (currentPos.x + rect.width < 100) {
        newX = 100 - rect.width;
        needsUpdate = true;
      } else if (currentPos.x > containerWidth - 100) {
        newX = containerWidth - 100;
        needsUpdate = true;
      }

      if (currentPos.y < 0) {
        newY = 0;
        needsUpdate = true;
      } else if (currentPos.y > containerHeight - 40) {
        newY = containerHeight - 40;
        needsUpdate = true;
      }

      if (needsUpdate) {
        onPositionChange({ x: newX, y: newY });
      }
    };

    window.addEventListener("resize", checkBounds);
    return () => window.removeEventListener("resize", checkBounds);
  }, [maximized, minimized, onPositionChange, fullScreenDrag]);

  // Traffic light button component
  const TrafficLight = ({
    color,
    onClick,
    tooltip,
  }: {
    color: "red" | "yellow" | "green";
    onClick: () => void;
    tooltip: string;
  }) => {
    const colorClasses = {
      red: "bg-destructive/80 hover:bg-destructive",
      yellow: "bg-yellow-500/80 hover:bg-yellow-500",
      green: "bg-green-500/80 hover:bg-green-500",
    };

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-3 h-3 rounded-full transition-colors",
              colorClasses[color]
            )}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  };

  // Always render everything - use CSS to show/hide to prevent unmounting
  return (
    <>
      {/* Minimized bar - shown when minimized */}
      <div
        className={cn(
          "fixed bottom-4 right-4 bg-card border rounded-xl shadow-2xl transition-all duration-200",
          minimized
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
        style={{ zIndex: zIndex + 10, width: 280 }}
      >
        <div
          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-xl"
          onClick={() => onMinimizedChange?.(false)}
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10"
            onClick={(e) => e.stopPropagation()}
          >
            <TerminalSquare className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">Terminal</div>
            <div className="text-xs text-muted-foreground truncate">Click to restore</div>
          </div>
          <div
            className="flex gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <TrafficLight color="red" onClick={onClose} tooltip="Close" />
            <TrafficLight
              color="yellow"
              onClick={() => onMinimizedChange?.(false)}
              tooltip="Restore"
            />
            <TrafficLight
              color="green"
              onClick={() => {
                onMinimizedChange?.(false);
                onMaximizedChange?.(true);
              }}
              tooltip="Maximize"
            />
          </div>
        </div>
      </div>

      {/* Main window - always rendered, visibility controlled by CSS */}
      <div
        ref={(node) => {
          setNodeRef(node);
          if (windowRef) {
            (windowRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
          windowRefCallback?.(node);
        }}
        className={cn(
          "bg-card text-card-foreground border rounded-lg shadow-2xl flex flex-col overflow-hidden transition-opacity duration-150",
          fullScreenDrag ? "fixed" : "absolute",
          minimized ? "opacity-0 pointer-events-none" : "opacity-100",
          maximized && (fullScreenDrag ? "!inset-4" : "!inset-0"),
          className
        )}
        style={{
          zIndex: minimized ? -1 : zIndex,
          top: maximized ? undefined : 0,
          left: maximized ? undefined : 0,
          transform: maximized ? undefined : `translate(${finalX}px, ${finalY}px)`,
          width: maximized ? undefined : defaultWidth,
          height: maximized ? undefined : defaultHeight,
          minWidth: maximized ? undefined : minWidth,
          minHeight: maximized ? undefined : minHeight,
          maxWidth: maximized ? undefined : (fullScreenDrag ? "calc(100vw - 32px)" : "calc(100% - 32px)"),
          maxHeight: maximized ? undefined : (fullScreenDrag ? "calc(100vh - 32px)" : "calc(100% - 32px)"),
          // Keep the element in the layout but invisible when minimized
          visibility: minimized ? "hidden" : "visible",
          position: maximized ? (fullScreenDrag ? "fixed" : "absolute") : undefined,
        }}
      >
        {/* Header - Draggable */}
        <div
          className="flex items-center gap-3 px-3 h-9 border-b bg-muted/30 cursor-move shrink-0 select-none"
          {...(maximized || minimized ? {} : { ...listeners, ...attributes })}
        >
          <div
            className="flex gap-1.5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TrafficLight color="red" onClick={onClose} tooltip="Close" />
            <TrafficLight
              color="yellow"
              onClick={() => onMinimizedChange?.(true)}
              tooltip="Minimize"
            />
            <TrafficLight
              color="green"
              onClick={() => onMaximizedChange?.(!maximized)}
              tooltip={maximized ? "Restore" : "Maximize"}
            />
          </div>
          {!maximized && <GripHorizontal className="h-4 w-4 text-muted-foreground" />}
          <div className="text-sm font-medium">{title}</div>
          {headerActions && (
            <div
              className="flex items-center gap-1 ml-auto"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {headerActions}
            </div>
          )}
        </div>

        {/* Content - always rendered */}
        <div className={cn("flex-1 min-h-0 overflow-hidden", contentClassName)}>
          {children}
        </div>
      </div>
    </>
  );
}

export function FloatingWindow({
  id,
  open,
  defaultWidth = 800,
  defaultHeight = 500,
  fullScreenDrag = false,
  ...props
}: FloatingWindowProps) {
  const hasInitializedRef = useRef(false);
  const windowNodeRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x: 16, y: 16 });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.delta) {
        setPosition((prev) => ({
          x: prev.x + event.delta.x,
          y: prev.y + event.delta.y,
        }));
      }
    },
    []
  );

  useEffect(() => {
    if (!open) {
      hasInitializedRef.current = false;
    }
  }, [open]);

  const handleWindowRef = useCallback((node: HTMLDivElement | null) => {
    windowNodeRef.current = node;

    if (node && !hasInitializedRef.current) {
      hasInitializedRef.current = true;

      if (fullScreenDrag) {
        setPosition({
          x: Math.max(16, (window.innerWidth - defaultWidth) / 2),
          y: Math.max(16, (window.innerHeight - defaultHeight) / 2),
        });
      } else {
        const parent = node.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          setPosition({
            x: Math.max(16, (parentRect.width - defaultWidth) / 2),
            y: Math.max(16, (parentRect.height - defaultHeight) / 2),
          });
        }
      }
    }
  }, [defaultWidth, defaultHeight, fullScreenDrag]);

  if (!open) {
    return null;
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <DraggableWindowContent
        id={id}
        defaultWidth={defaultWidth}
        defaultHeight={defaultHeight}
        position={position}
        onPositionChange={setPosition}
        windowRefCallback={handleWindowRef}
        fullScreenDrag={fullScreenDrag}
        {...props}
      />
    </DndContext>
  );
}

export type { FloatingWindowProps };
