"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ChevronDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SandboxPanel } from "./sandbox-panel";
import { SandboxInfoBanner } from "./security-notice";

interface PortMapping {
  id: string;
  serviceName: string;
  internalPort: number;
  protocol: string;
}

interface ContainerData {
  id: string;
  displayName: string;
  image: string;
  status: string;
  cpuLimit: number;
  memoryLimitMb: number;
  runtimes?: string[];
  runtimeVersions?: Record<string, string>;
  internalIp: string | null;
  portMappings: PortMapping[];
}

interface DualSandboxViewProps {
  containers: ContainerData[];
  sessionToken: string;
  initialLeft?: string;
  initialRight?: string;
}

export function DualSandboxView({
  containers,
  sessionToken,
  initialLeft,
  initialRight,
}: DualSandboxViewProps) {
  const router = useRouter();

  // Find initial containers or use first two available
  const [leftId, setLeftId] = useState<string | null>(() => {
    if (initialLeft && containers.find((c) => c.id === initialLeft)) {
      return initialLeft;
    }
    return containers[0]?.id || null;
  });

  const [rightId, setRightId] = useState<string | null>(() => {
    if (initialRight && containers.find((c) => c.id === initialRight)) {
      return initialRight;
    }
    // Find a different container than left
    const other = containers.find((c) => c.id !== leftId);
    return other?.id || null;
  });

  const [expandedPanel, setExpandedPanel] = useState<"left" | "right" | null>(null);

  const leftContainer = containers.find((c) => c.id === leftId);
  const rightContainer = containers.find((c) => c.id === rightId);

  // Get available containers for selection (excluding the other panel's selection)
  const getAvailableContainers = (excludeId: string | null) => {
    return containers.filter((c) => c.id !== excludeId);
  };

  // Handle container removal
  const handleRemove = useCallback(
    (panel: "left" | "right") => {
      if (panel === "left") {
        setLeftId(null);
      } else {
        setRightId(null);
      }
      router.refresh();
    },
    [router]
  );

  // Toggle panel expansion
  const toggleExpand = (panel: "left" | "right") => {
    setExpandedPanel((prev) => (prev === panel ? null : panel));
  };

  // Panel selector component
  const PanelSelector = ({
    currentId,
    onSelect,
    excludeId,
    position,
  }: {
    currentId: string | null;
    onSelect: (id: string) => void;
    excludeId: string | null;
    position: "left" | "right";
  }) => {
    const available = getAvailableContainers(excludeId);
    const current = containers.find((c) => c.id === currentId);

    if (available.length === 0 && !current) {
      return (
        <Card className="h-full flex items-center justify-center">
          <CardContent className="text-center">
            <Layers className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No containers available</p>
            <Button className="mt-4" onClick={() => router.push("/sandbox/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Sandbox
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!current) {
      return (
        <Card className="h-full flex items-center justify-center">
          <CardContent className="text-center">
            <Layers className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Select a sandbox for the {position} panel
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Select Sandbox
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {available.map((container) => (
                  <DropdownMenuItem
                    key={container.id}
                    onClick={() => onSelect(container.id)}
                  >
                    <div className="flex flex-col">
                      <span>{container.displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {container.status} - {container.image}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  // Determine grid layout based on expansion state
  const getGridClass = () => {
    if (expandedPanel === "left") return "grid-cols-1";
    if (expandedPanel === "right") return "grid-cols-1";
    return "grid-cols-1 lg:grid-cols-2";
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <SandboxInfoBanner />

      {/* Workspace Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Side-by-Side Workspace</h2>
        </div>

        {/* Container Selectors */}
        <div className="flex items-center gap-2">
          {/* Left selector */}
          {leftContainer && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Left: {leftContainer.displayName}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {getAvailableContainers(rightId).map((container) => (
                  <DropdownMenuItem
                    key={container.id}
                    onClick={() => setLeftId(container.id)}
                  >
                    {container.displayName}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => setLeftId(null)}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Right selector */}
          {rightContainer && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Right: {rightContainer.displayName}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {getAvailableContainers(leftId).map((container) => (
                  <DropdownMenuItem
                    key={container.id}
                    onClick={() => setRightId(container.id)}
                  >
                    {container.displayName}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => setRightId(null)}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Dual Panel View */}
      <div className={`flex-1 min-h-0 grid ${getGridClass()} gap-4`}>
        {/* Left Panel */}
        {(expandedPanel === null || expandedPanel === "left") && (
          <div className="min-h-0">
            {leftContainer ? (
              <SandboxPanel
                container={leftContainer}
                sessionToken={sessionToken}
                onRemove={() => handleRemove("left")}
                isExpanded={expandedPanel === "left"}
                onToggleExpand={() => toggleExpand("left")}
              />
            ) : (
              <PanelSelector
                currentId={leftId}
                onSelect={setLeftId}
                excludeId={rightId}
                position="left"
              />
            )}
          </div>
        )}

        {/* Right Panel */}
        {(expandedPanel === null || expandedPanel === "right") && (
          <div className="min-h-0">
            {rightContainer ? (
              <SandboxPanel
                container={rightContainer}
                sessionToken={sessionToken}
                onRemove={() => handleRemove("right")}
                isExpanded={expandedPanel === "right"}
                onToggleExpand={() => toggleExpand("right")}
              />
            ) : (
              <PanelSelector
                currentId={rightId}
                onSelect={setRightId}
                excludeId={leftId}
                position="right"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
