"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw } from "lucide-react";
import { useSandboxNotifications, type CreationProgressData } from "@/hooks/use-sandbox-notifications";
import { useRouter } from "next/navigation";

interface CreatingSandbox {
  id: string;
  displayName: string;
  image: string;
  status: string;
  creationProgress: number;
  creationStep: string;
  creationError?: string | null;
}

interface CreatingSandboxCardProps {
  sandbox: CreatingSandbox;
}

export function CreatingSandboxCard({ sandbox }: CreatingSandboxCardProps) {
  const router = useRouter();
  const [progress, setProgress] = useState(sandbox.creationProgress || 0);
  const [step, setStep] = useState(sandbox.creationStep || "Initializing...");
  const [status, setStatus] = useState<"creating" | "initializing" | "stopped" | "error">(
    sandbox.status === "error" ? "error" :
    sandbox.status === "stopped" ? "stopped" :
    "creating"
  );
  const [error, setError] = useState<string | null>(sandbox.creationError || null);

  // Subscribe to SSE updates for this specific sandbox
  useSandboxNotifications({
    showToasts: false, // Parent component handles toasts
    onCreationProgress: (data) => {
      if (data.containerId === sandbox.id) {
        setProgress(data.progress);
        setStep(data.step);
        setStatus(data.status);
        if (data.error) {
          setError(data.error);
        }
      }
    },
    onCreationComplete: (containerId) => {
      if (containerId === sandbox.id) {
        setStatus("stopped");
        setProgress(100);
        setStep("Ready!");
        // Refresh the page to show the completed sandbox
        setTimeout(() => router.refresh(), 1500);
      }
    },
    onCreationError: (containerId, errorMsg) => {
      if (containerId === sandbox.id) {
        setStatus("error");
        setError(errorMsg);
      }
    },
  });

  // Also poll for progress as fallback
  useEffect(() => {
    if (status === "stopped" || status === "error") return;

    const pollProgress = async () => {
      try {
        const res = await fetch(`/api/sandbox/containers/${sandbox.id}/progress`);
        if (res.ok) {
          const data = await res.json();
          setProgress(data.progress || 0);
          setStep(data.step || "Processing...");

          if (data.isComplete) {
            setStatus("stopped");
            setProgress(100);
            setStep("Ready!");
            router.refresh();
          } else if (data.hasError) {
            setStatus("error");
            setError(data.error || "Unknown error");
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    const interval = setInterval(pollProgress, 2000);
    return () => clearInterval(interval);
  }, [sandbox.id, status, router]);

  const isComplete = status === "stopped" && progress >= 100;
  const hasError = status === "error";

  return (
    <Card className={`relative overflow-hidden transition-all ${
      hasError ? "border-destructive/50" : isComplete ? "border-green-500/50" : "border-primary/30"
    }`}>
      {/* Animated gradient background for creating state */}
      {!isComplete && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
      )}

      <CardContent className="relative p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Status Icon */}
            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
              hasError
                ? "bg-destructive/10"
                : isComplete
                  ? "bg-green-500/10"
                  : "bg-primary/10"
            }`}>
              {hasError ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{sandbox.displayName}</p>
                <Badge variant={hasError ? "destructive" : isComplete ? "default" : "secondary"} className="flex-shrink-0">
                  {hasError ? "Failed" : isComplete ? "Ready" : "Creating"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {sandbox.image}
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex-shrink-0">
            {isComplete ? (
              <Button size="sm" asChild>
                <Link href={`/sandbox/${sandbox.id}`}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open
                </Link>
              </Button>
            ) : hasError ? (
              <Button size="sm" variant="outline" onClick={() => router.refresh()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Refresh
              </Button>
            ) : null}
          </div>
        </div>

        {/* Progress Section */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className={`truncate ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
              {hasError ? error : step}
            </span>
            <span className="font-medium flex-shrink-0 ml-2">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress
            value={progress}
            className={`h-2 ${hasError ? "[&>div]:bg-destructive" : isComplete ? "[&>div]:bg-green-500" : ""}`}
          />
        </div>

        {/* Step Details for Creating State */}
        {!isComplete && !hasError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    progress >= (i + 1) * 20 ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <span>Setting up your environment...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CreatingSandboxesListProps {
  sandboxes: CreatingSandbox[];
}

export function CreatingSandboxesList({ sandboxes }: CreatingSandboxesListProps) {
  if (sandboxes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Creating ({sandboxes.length})
      </h3>
      <div className="space-y-3">
        {sandboxes.map((sandbox) => (
          <CreatingSandboxCard key={sandbox.id} sandbox={sandbox} />
        ))}
      </div>
    </div>
  );
}
