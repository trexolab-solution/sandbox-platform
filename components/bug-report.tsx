"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Bug, ChevronDown, Send, CheckCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

interface SystemInfo {
  browser: string;
  os: string;
  screenSize: string;
  pageUrl: string;
  timestamp: string;
  userAgent: string;
}

function getSystemInfo(): SystemInfo {
  if (typeof window === "undefined") {
    return {
      browser: "Unknown",
      os: "Unknown",
      screenSize: "Unknown",
      pageUrl: "Unknown",
      timestamp: new Date().toISOString(),
      userAgent: "Unknown",
    };
  }

  const ua = navigator.userAgent;
  let browser = "Unknown";
  let os = "Unknown";

  // Detect browser
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Opera")) browser = "Opera";

  // Detect OS
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return {
    browser,
    os,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    pageUrl: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: ua,
  };
}

type BugSeverity = "low" | "medium" | "high" | "critical";
type BugCategory = "ui" | "functionality" | "performance" | "security" | "other";

interface BugReportButtonProps {
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  iconOnly?: boolean;
}

export function BugReportButton({ variant = "ghost", size = "sm", className, iconOnly = false }: BugReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    stepsToReproduce: "",
    expectedBehavior: "",
    severity: "medium" as BugSeverity,
    category: "functionality" as BugCategory,
  });

  useEffect(() => {
    if (open) {
      setSystemInfo(getSystemInfo());
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please fill in the required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Build full description with additional details
      let fullDescription = formData.description;
      if (formData.stepsToReproduce) {
        fullDescription += `\n\n**Steps to Reproduce:**\n${formData.stepsToReproduce}`;
      }
      if (formData.expectedBehavior) {
        fullDescription += `\n\n**Expected Behavior:**\n${formData.expectedBehavior}`;
      }

      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: fullDescription,
          category: formData.category,
          priority: formData.severity,
          pageUrl: systemInfo?.pageUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit bug report");
      }

      setIsSubmitted(true);
      toast.success("Bug report submitted successfully");

      // Reset after showing success
      setTimeout(() => {
        setOpen(false);
        setIsSubmitted(false);
        setFormData({
          title: "",
          description: "",
          stepsToReproduce: "",
          expectedBehavior: "",
          severity: "medium",
          category: "functionality",
        });
      }, 2000);
    } catch (error) {
      console.error("Failed to submit bug report:", error);
      toast.error("Failed to submit bug report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const severityColors: Record<BugSeverity, string> = {
    low: "bg-blue-500/10 text-blue-600",
    medium: "bg-yellow-500/10 text-yellow-600",
    high: "bg-orange-500/10 text-orange-600",
    critical: "bg-red-500/10 text-red-600",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Bug className={iconOnly ? "h-5 w-5" : "h-4 w-4 mr-2"} />
          {!iconOnly && "Report Bug"}
          {iconOnly && <span className="sr-only">Report Bug</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden p-0">
        <ScrollArea className="max-h-[90vh] p-6">
        {isSubmitted ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="p-3 rounded-full bg-green-500/10">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Thank you!</h3>
            <p className="text-sm text-muted-foreground text-center">
              Your bug report has been submitted successfully. We&apos;ll look into it as soon as possible.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Report a Bug
              </DialogTitle>
              <DialogDescription>
                Help us improve by reporting any issues you encounter. Please provide as much detail as possible.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Brief description of the issue"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              {/* Category and Severity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v as BugCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ui">UI/Visual</SelectItem>
                      <SelectItem value="functionality">Functionality</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(v) => setFormData({ ...formData, severity: v as BugSeverity })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <Badge className={severityColors.low}>Low</Badge>
                          <span className="text-xs text-muted-foreground">Minor issue</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <Badge className={severityColors.medium}>Medium</Badge>
                          <span className="text-xs text-muted-foreground">Noticeable impact</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <Badge className={severityColors.high}>High</Badge>
                          <span className="text-xs text-muted-foreground">Significant impact</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="critical">
                        <div className="flex items-center gap-2">
                          <Badge className={severityColors.critical}>Critical</Badge>
                          <span className="text-xs text-muted-foreground">Blocking issue</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="What happened? What did you expect to happen?"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Steps to Reproduce */}
              <div className="space-y-2">
                <Label htmlFor="steps">Steps to Reproduce</Label>
                <Textarea
                  id="steps"
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                  rows={3}
                  value={formData.stepsToReproduce}
                  onChange={(e) => setFormData({ ...formData, stepsToReproduce: e.target.value })}
                />
              </div>

              {/* Expected Behavior */}
              <div className="space-y-2">
                <Label htmlFor="expected">Expected Behavior</Label>
                <Textarea
                  id="expected"
                  placeholder="What should have happened instead?"
                  rows={2}
                  value={formData.expectedBehavior}
                  onChange={(e) => setFormData({ ...formData, expectedBehavior: e.target.value })}
                />
              </div>

              <Separator />

              {/* System Info Collapsible */}
              <Collapsible open={showSystemInfo} onOpenChange={setShowSystemInfo}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-sm text-muted-foreground">System Information (auto-gathered)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showSystemInfo ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  {systemInfo && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Browser:</span>{" "}
                          <span className="font-medium">{systemInfo.browser}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">OS:</span>{" "}
                          <span className="font-medium">{systemInfo.os}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Screen:</span>{" "}
                          <span className="font-medium">{systemInfo.screenSize}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time:</span>{" "}
                          <span className="font-medium">{new Date(systemInfo.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="pt-2">
                        <span className="text-muted-foreground">Page:</span>{" "}
                        <code className="text-xs bg-background px-1 py-0.5 rounded">{systemInfo.pageUrl}</code>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Report
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Floating button version for easy access
export function BugReportFloatingButton() {
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <BugReportButton
        variant="outline"
        size="default"
        className="shadow-lg bg-background hover:bg-muted"
      />
    </div>
  );
}
