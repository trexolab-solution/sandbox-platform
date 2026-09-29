"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FolderOpen } from "lucide-react";
import { FileManager } from "./file-manager";

interface FileManagerSheetProps {
  containerId: string;
  isRunning: boolean;
  trigger?: React.ReactNode;
  side?: "left" | "right" | "top" | "bottom";
  /** The sandbox username for constructing home path */
  sandboxUsername?: string;
}

export function FileManagerSheet({
  containerId,
  isRunning,
  trigger,
  side = "right",
  sandboxUsername = "sandbox",
}: FileManagerSheetProps) {
  const [open, setOpen] = useState(false);

  // Calculate home path from sandbox username
  const homePath = `/home/${sandboxUsername}`;

  // Persist current path state at sheet level so it survives close/reopen
  const [currentPath, setCurrentPath] = useState(homePath);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    // Request terminal focus when sheet closes
    if (!isOpen) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("terminal-focus"));
      }, 100);
    }
  };

  // Default trigger - simple button without tooltip wrapper
  const defaultTrigger = (
    <Button variant="outline" size="default" className="w-full justify-start gap-2">
      <FolderOpen className="h-4 w-4" />
      Files
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent side={side} className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            File Manager
          </SheetTitle>
          <SheetDescription>
            Browse and manage files in {homePath}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0 p-4">
          <FileManager
            containerId={containerId}
            isRunning={isRunning}
            homePath={homePath}
            currentPath={currentPath}
            onPathChange={setCurrentPath}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Icon button variant for compact UI
export function FileManagerIconButton({
  containerId,
  isRunning,
  side = "right",
  sandboxUsername,
}: Omit<FileManagerSheetProps, "trigger">) {
  return (
    <FileManagerSheet
      containerId={containerId}
      isRunning={isRunning}
      side={side}
      sandboxUsername={sandboxUsername}
      trigger={
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <FolderOpen className="h-4 w-4" />
        </Button>
      }
    />
  );
}
