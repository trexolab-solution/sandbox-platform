"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Trash2,
  Cpu,
  MemoryStick,
  Box,
  Network,
  Server,
  Shield,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { RuntimeSelector } from "./runtime-selector";
import { ResourceLimitsExplainer } from "./resource-limits-card";
import { PortMappingExplainer } from "./port-mapping-explainer";
import { SandboxInfoBanner } from "./security-notice";
import { getDefaultVersion, type RuntimeType, RUNTIME_CONFIGS, BASE_IMAGES } from "@/lib/docker/runtime-images";
import { formatMemory } from "@/lib/config";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { toast } from "sonner";

// Static config for non-settings values
const STATIC_CONFIG = {
  maxPortMappings: 10,
};

interface ImageOption {
  id: string;
  name: string;
  description: string;
}

interface CreateSandboxWizardProps {
  images: ImageOption[];
}

// Schema with reasonable defaults - actual limits enforced at runtime from settings
const createSandboxSchema = z.object({
  displayName: z
    .string()
    .min(1, "Name is required")
    .max(32, "Name must be 32 characters or less")
    .regex(
      /^[a-z][a-z0-9\-_]*$/,
      "Name must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores (no spaces)"
    ),
  image: z.string().min(1, "Please select a base image"),
  cpuLimit: z
    .number()
    .min(0.5, "CPU must be at least 0.5 cores")
    .max(16, "CPU cannot exceed 16 cores"),
  memoryLimitMb: z
    .number()
    .int("Memory must be a whole number")
    .min(128, "Memory must be at least 128 MB")
    .max(16384, "Memory cannot exceed 16 GB"),
  ports: z
    .array(
      z.object({
        serviceName: z
          .string()
          .min(1, "Service name is required")
          .max(50, "Service name must be 50 characters or less")
          .regex(
            /^[a-zA-Z0-9\-_]*$/,
            "Service name can only contain letters, numbers, hyphens, and underscores"
          ),
        port: z
          .number()
          .int("Port must be a whole number")
          .min(1, "Port must be between 1 and 65535")
          .max(65535, "Port must be between 1 and 65535"),
      })
    )
    .max(10, "Maximum 10 port mappings allowed"),
});

type FormValues = z.infer<typeof createSandboxSchema>;

interface SelectedRuntime {
  runtime: RuntimeType;
  version: string;
}

const STEPS = [
  { id: 1, title: "Basics", description: "Name your sandbox" },
  { id: 2, title: "Environment", description: "Choose base image & runtimes" },
  { id: 3, title: "Resources", description: "Set CPU & memory limits" },
  { id: 4, title: "Services", description: "Configure port mappings" },
];

export function CreateSandboxWizard({ images }: CreateSandboxWizardProps) {
  const router = useRouter();
  const { settings: platformSettings, isLoading: settingsLoading } = usePlatformSettings();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  const [selectedRuntimes, setSelectedRuntimes] = useState<SelectedRuntime[]>([]);

  // Initialize default runtime when settings load
  useEffect(() => {
    if (!settingsLoading && selectedRuntimes.length === 0) {
      // Set first enabled runtime as default, or empty if none enabled
      const firstEnabledRuntime = platformSettings.enabledRuntimes[0] as RuntimeType | undefined;
      if (firstEnabledRuntime && RUNTIME_CONFIGS[firstEnabledRuntime]) {
        setSelectedRuntimes([
          { runtime: firstEnabledRuntime, version: getDefaultVersion(firstEnabledRuntime) },
        ]);
      }
    }
  }, [settingsLoading, platformSettings.enabledRuntimes, selectedRuntimes.length]);

  const [ports, setPorts] = useState<Array<{ serviceName: string; port: number }>>([]);

  // Creation progress tracking
  const [creatingContainerId, setCreatingContainerId] = useState<string | null>(null);
  const [creationProgress, setCreationProgress] = useState(0);
  const [creationStep, setCreationStep] = useState<string>("");
  const [creationComplete, setCreationComplete] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(createSandboxSchema),
    defaultValues: {
      displayName: "",
      image: "",
      cpuLimit: platformSettings.defaultCpuCores,
      memoryLimitMb: platformSettings.defaultMemoryMb,
      ports: [],
    },
  });

  // Update form defaults when settings load
  useEffect(() => {
    if (!settingsLoading) {
      form.setValue("cpuLimit", platformSettings.defaultCpuCores);
      form.setValue("memoryLimitMb", platformSettings.defaultMemoryMb);
    }
  }, [settingsLoading, platformSettings, form]);

  // Check name availability via API
  const checkNameAvailability = useCallback(async (name: string, showError: boolean = false) => {
    // Clear previous state
    setNameAvailable(null);

    if (!name || name.length < 1) {
      return;
    }

    // Validate format first
    const isValidFormat = /^[a-z][a-z0-9\-_]*$/.test(name);
    if (!isValidFormat) {
      return;
    }

    setIsCheckingName(true);
    try {
      const response = await fetch("/api/sandbox/containers/check-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        const data = await response.json();
        setNameAvailable(data.available);

        // Show error in form if name is taken and showError is true (on blur)
        if (!data.available && showError) {
          form.setError("displayName", {
            type: "manual",
            message: `A sandbox with the name "${name}" already exists`,
          });
        } else if (data.available) {
          // Clear the error if name is now available
          form.clearErrors("displayName");
        }
      }
    } catch {
      setNameAvailable(null);
    } finally {
      setIsCheckingName(false);
    }
  }, [form]);

  // Check if current step is valid (all required fields filled)
  const isStepValid = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        const name = form.watch("displayName");
        // Name must exist, be valid format, and be available
        const isValidFormat = name && /^[a-z][a-z0-9\-_]*$/.test(name);
        return !!isValidFormat && nameAvailable === true;
      case 2:
        const image = form.watch("image");
        return !!image && image.length > 0;
      case 3:
        // Resources have defaults, always valid
        return true;
      case 4:
        // Ports are optional, always valid
        return true;
      default:
        return true;
    }
  }, [form, nameAvailable]);

  const canProceed = isStepValid(currentStep);

  const nextStep = () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      const name = form.getValues("displayName");
      if (!name || name.length < 1) {
        form.setError("displayName", { message: "Name is required" });
        return;
      }
      // Check if name is available
      if (nameAvailable === false) {
        form.setError("displayName", { message: `A sandbox with the name "${name}" already exists` });
        return;
      }
      if (nameAvailable === null) {
        // Name hasn't been checked yet, check now
        checkNameAvailability(name, true);
        return;
      }
    }
    if (currentStep === 2) {
      const image = form.getValues("image");
      if (!image) {
        form.setError("image", { message: "Please select a base image" });
        return;
      }
    }
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const addPort = () => {
    if (ports.length < STATIC_CONFIG.maxPortMappings) {
      setPorts([...ports, { serviceName: "", port: 3000 }]);
    }
  };

  const removePort = (index: number) => {
    setPorts(ports.filter((_, i) => i !== index));
  };

  const updatePort = (index: number, field: "serviceName" | "port", value: string | number) => {
    const newPorts = [...ports];
    newPorts[index] = { ...newPorts[index], [field]: value };
    setPorts(newPorts);
  };

  async function onSubmit() {
    const data = form.getValues();
    setIsLoading(true);
    setError(null);
    setCreationError(null);
    setCreationComplete(false);
    setCreationProgress(0);
    setCreationStep("Starting...");

    // Convert selected runtimes to the format expected by the API
    const runtimes = selectedRuntimes.map((r) => r.runtime);
    const runtimeVersions = selectedRuntimes.reduce(
      (acc, r) => ({ ...acc, [r.runtime]: r.version }),
      {} as Record<string, string>
    );

    try {
      const response = await fetch("/api/sandbox/containers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          ports: ports.filter((p) => p.serviceName && p.port),
          runtimes,
          runtimeVersions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create sandbox");
      }

      const result = await response.json();
      const containerId = result.container.id;
      setCreatingContainerId(containerId);

      // Helper to update progress state
      const updateProgressState = (data: {
        progress?: number;
        step?: string;
        error?: string | null;
        isComplete?: boolean;
        hasError?: boolean;
      }) => {
        if (data.progress !== undefined) setCreationProgress(data.progress);
        if (data.step) setCreationStep(data.step);

        if (data.hasError) {
          setCreationError(data.error || "An error occurred during setup");
          setIsLoading(false);
          return false;
        }

        if (data.isComplete) {
          setCreationComplete(true);
          setCreationProgress(100);
          setCreationStep("Ready!");
          toast.success("Sandbox created successfully!");
          setIsLoading(false);
          return false;
        }

        return true; // Continue listening
      };

      // Try SSE first for real-time updates
      let eventSource: EventSource | null = null;
      let pollInterval: ReturnType<typeof setInterval> | null = null;
      let sseConnected = false;

      try {
        eventSource = new EventSource("/api/sandbox/notifications/stream");

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Filter for creation_progress events for this container
            if (data.type === "creation_progress" && data.containerId === containerId) {
              sseConnected = true;
              const progressData = data.data || data;
              const shouldContinue = updateProgressState(progressData);

              if (!shouldContinue && eventSource) {
                eventSource.close();
                if (pollInterval) clearInterval(pollInterval);
              }
            }
          } catch {
            // Ignore parse errors
          }
        };

        eventSource.onerror = () => {
          // SSE failed, will fall back to polling
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
        };
      } catch {
        // SSE not available
      }

      // Also poll as fallback (less frequent if SSE is connected)
      const pollProgress = async () => {
        try {
          const progressRes = await fetch(`/api/sandbox/containers/${containerId}/progress`);
          if (!progressRes.ok) return true;

          const progressData = await progressRes.json();
          return updateProgressState(progressData);
        } catch {
          return true; // Continue polling on error
        }
      };

      // Start polling (slower rate when SSE is working)
      pollInterval = setInterval(async () => {
        const shouldContinue = await pollProgress();
        if (!shouldContinue) {
          if (pollInterval) clearInterval(pollInterval);
          if (eventSource) eventSource.close();
        }
      }, sseConnected ? 3000 : 1000);

      // Initial poll
      await pollProgress();

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setCreationError(err instanceof Error ? err.message : "An error occurred");
      toast.error("Failed to create sandbox");
      setIsLoading(false);
    }
  }

  // Navigate to sandbox when creation is complete
  const goToSandbox = () => {
    if (creatingContainerId) {
      router.push(`/sandbox/${creatingContainerId}`);
      router.refresh();
    }
  };

  // Reset to create another sandbox
  const resetCreation = () => {
    setCreatingContainerId(null);
    setCreationProgress(0);
    setCreationStep("");
    setCreationComplete(false);
    setCreationError(null);
    setCurrentStep(1);
    form.reset();
  };

  const progress = (currentStep / STEPS.length) * 100;

  // Show loading state while settings are loading
  if (settingsLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Spinner className="h-8 w-8" />
              <p className="text-sm text-muted-foreground">Loading configuration...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show creation progress view when creating
  if (creatingContainerId) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4">
              {creationComplete ? (
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              ) : creationError ? (
                <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              )}
            </div>
            <CardTitle className="text-xl">
              {creationComplete
                ? "Sandbox Ready!"
                : creationError
                ? "Creation Failed"
                : "Creating Your Sandbox"}
            </CardTitle>
            <CardDescription>
              {creationComplete
                ? "Your sandbox environment is ready to use"
                : creationError
                ? "There was an error setting up your sandbox"
                : "Please wait while we set up your environment"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{creationStep}</span>
                <span className="font-medium">{creationProgress}%</span>
              </div>
              <Progress value={creationProgress} className="h-2" />
            </div>

            {/* Error message */}
            {creationError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400">
                {creationError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {creationComplete ? (
                <>
                  <Button onClick={goToSandbox} className="flex-1">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Sandbox
                  </Button>
                  <Button variant="outline" onClick={resetCreation} className="flex-1">
                    Create Another
                  </Button>
                </>
              ) : creationError ? (
                <>
                  <Button onClick={resetCreation} className="flex-1">
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/sandbox")}
                    className="flex-1"
                  >
                    Go to Dashboard
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => router.push("/sandbox")}
                  className="w-full"
                >
                  Continue in Background
                </Button>
              )}
            </div>

            {/* Background creation hint */}
            {!creationComplete && !creationError && (
              <p className="text-xs text-center text-muted-foreground">
                You can leave this page and continue using the app.
                Your sandbox will be ready when you return.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <SandboxInfoBanner />

      {/* Side-by-side Layout: Stepper on Left, Form on Right */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Left Side: Stepper - horizontal on mobile, vertical on desktop */}
        <div className="lg:w-64 shrink-0">
          <Card className="lg:sticky lg:top-6">
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
              <div className="space-y-4 sm:space-y-6">
                {/* Progress Bar */}
                <Progress value={progress} className="h-2" />

                {/* Step Indicators - horizontal scroll on mobile, vertical on desktop */}
                <div className="flex lg:flex-col gap-3 lg:gap-4 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                  {STEPS.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-2 lg:gap-3 shrink-0 lg:shrink ${
                        step.id <= currentStep ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs lg:text-sm font-medium ${
                          step.id < currentStep
                            ? "bg-primary border-primary text-primary-foreground"
                            : step.id === currentStep
                              ? "border-primary text-primary"
                              : "border-muted-foreground"
                        }`}
                      >
                        {step.id < currentStep ? <Check className="h-3 w-3 lg:h-4 lg:w-4" /> : step.id}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs lg:text-sm font-medium whitespace-nowrap lg:whitespace-normal">{step.title}</span>
                        <span className="text-[10px] lg:text-xs text-muted-foreground hidden lg:block">{step.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Form Card */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="pb-4 sm:pb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10">
                  {currentStep === 1 && <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
                  {currentStep === 2 && <Box className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
                  {currentStep === 3 && <Cpu className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
                  {currentStep === 4 && <Network className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl">{STEPS[currentStep - 1].title}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">{STEPS[currentStep - 1].description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Step 1: Basics */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sandbox Name <span className="text-destructive">*</span></FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              placeholder="my-sandbox"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                // Clear error and check availability on change (without showing error)
                                form.clearErrors("displayName");
                                setNameAvailable(null);
                                // Debounce the check
                                const value = e.target.value;
                                if (value) {
                                  checkNameAvailability(value, false);
                                }
                              }}
                              onBlur={(e) => {
                                field.onBlur();
                                // Check availability and show error on blur
                                if (e.target.value) {
                                  checkNameAvailability(e.target.value, true);
                                }
                              }}
                              className={`pr-10 ${nameAvailable === false ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            />
                          </FormControl>
                          {isCheckingName && (
                            <Spinner className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          )}
                          {!isCheckingName && nameAvailable === true && field.value && (
                            <Check className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />
                          )}
                          {!isCheckingName && nameAvailable === false && field.value && (
                            <XCircle className="absolute right-3 top-2.5 h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <FormDescription>
                          Choose a unique name for your sandbox. Must start with a lowercase letter, use only lowercase letters, numbers, hyphens, and underscores.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">What you&apos;ll get:</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-2 ml-6">
                      <li>• Isolated development environment</li>
                      <li>• Pre-installed programming languages</li>
                      <li>• Terminal access</li>
                      <li>• File manager</li>
                      <li>• Exposed services via URLs</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 2: Environment */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="image"
                    render={({ field }) => {
                      // Filter images based on admin-enabled settings
                      const enabledImages = BASE_IMAGES.filter(
                        (img) => platformSettings.enabledBaseImages.includes(img.value)
                      );

                      return (
                        <FormItem>
                          <FormLabel>Base Image <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a base image" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {enabledImages.length === 0 ? (
                                <div className="p-3 text-sm text-muted-foreground text-center">
                                  No base images are currently enabled. Contact admin.
                                </div>
                              ) : (
                                enabledImages.map((image) => (
                                  <SelectItem key={image.value} value={image.value}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{image.label}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {image.description}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            The operating system and base tools for your sandbox.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <Separator />

                  <RuntimeSelector
                    value={selectedRuntimes}
                    onChange={setSelectedRuntimes}
                    maxRuntimes={3}
                    enabledRuntimes={platformSettings.enabledRuntimes}
                  />
                </div>
              )}

              {/* Step 3: Resources */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Resource limits are enforced for system stability</span>
                    </div>
                    <ResourceLimitsExplainer />
                  </div>

                  <FormField
                    control={form.control}
                    name="cpuLimit"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="flex items-center gap-2">
                            <Cpu className="h-4 w-4" />
                            CPU Limit
                          </FormLabel>
                          <Badge variant="secondary">
                            {field.value} / {platformSettings.maxCpuCores} cores
                          </Badge>
                        </div>
                        <FormControl>
                          <Slider
                            min={0.5}
                            max={platformSettings.maxCpuCores}
                            step={0.5}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                          />
                        </FormControl>
                        <FormDescription>
                          CPU cores allocated to your sandbox (0.5 - {platformSettings.maxCpuCores} cores)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="memoryLimitMb"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="flex items-center gap-2">
                            <MemoryStick className="h-4 w-4" />
                            Memory Limit
                          </FormLabel>
                          <Badge variant="secondary">
                            {formatMemory(field.value)} / {formatMemory(platformSettings.maxMemoryMb)}
                          </Badge>
                        </div>
                        <FormControl>
                          <Slider
                            min={128}
                            max={platformSettings.maxMemoryMb}
                            step={128}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                          />
                        </FormControl>
                        <FormDescription>
                          RAM allocated to your sandbox (128 MB - {formatMemory(platformSettings.maxMemoryMb)})
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Resource Summary */}
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <h4 className="text-sm font-medium mb-3">Resource Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-blue-500" />
                        <span className="text-muted-foreground">CPU:</span>
                        <span className="font-medium">{form.watch("cpuLimit")} core(s)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MemoryStick className="h-4 w-4 text-purple-500" />
                        <span className="text-muted-foreground">Memory:</span>
                        <span className="font-medium">{formatMemory(form.watch("memoryLimitMb"))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Services */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Port Mappings</span>
                      <PortMappingExplainer />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPort}
                      disabled={ports.length >= STATIC_CONFIG.maxPortMappings}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Port
                    </Button>
                  </div>

                  {ports.length > 0 ? (
                    <div className="space-y-3">
                      {ports.map((port, index) => (
                        <div
                          key={index}
                          className="flex gap-3 items-start p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground">Service Name</label>
                            <Input
                              placeholder="e.g., web, api, db"
                              value={port.serviceName}
                              onChange={(e) => updatePort(index, "serviceName", e.target.value)}
                            />
                          </div>
                          <div className="w-28">
                            <label className="text-xs text-muted-foreground">Port</label>
                            <Input
                              type="number"
                              placeholder="3000"
                              value={port.port}
                              onChange={(e) => updatePort(index, "port", parseInt(e.target.value, 10) || 0)}
                            />
                          </div>
                          <div className="pt-5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePort(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove port mapping</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <Network className="h-8 w-8 mx-auto text-muted-foreground/50" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        No ports mapped yet. Add a port mapping to expose services from your sandbox.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        You can always add ports later from the sandbox settings.
                      </p>
                    </div>
                  )}

                  <Separator />

                  {/* Final Review */}
                  <div className="rounded-lg border bg-card p-4 space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Review Your Sandbox
                    </h4>
                    <div className="grid gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{form.watch("displayName") || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Image:</span>
                        <span className="font-mono text-xs">{form.watch("image")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Runtimes:</span>
                        <span>{selectedRuntimes.length > 0 ? selectedRuntimes.map((r) => RUNTIME_CONFIGS[r.runtime].name).join(", ") : "None"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resources:</span>
                        <span>{form.watch("cpuLimit")} CPU, {formatMemory(form.watch("memoryLimitMb"))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ports:</span>
                        <span>{ports.length > 0 ? ports.map((p) => p.port).join(", ") : "None"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1 || isLoading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>

                {currentStep < STEPS.length ? (
                  <Button type="button" onClick={nextStep} disabled={!canProceed}>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={onSubmit} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Create Sandbox
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
