"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { RuntimeSelector } from "./runtime-selector";
import { ResourceLimitsExplainer, MAX_CPU_CORES, MAX_MEMORY_MB } from "./resource-limits-card";
import { PortMappingExplainer } from "./port-mapping-explainer";
import { SandboxInfoBanner } from "./security-notice";
import { getDefaultVersion, type RuntimeType } from "@/lib/docker/runtime-images";

interface ImageOption {
  id: string;
  name: string;
  description: string;
}

interface CreateContainerFormProps {
  images: ImageOption[];
}

const createContainerSchema = z.object({
  displayName: z
    .string()
    .min(1, "Name is required")
    .max(64, "Name must be 64 characters or less")
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/,
      "Name can only contain letters, numbers, spaces, hyphens, and underscores"
    ),
  image: z.string().min(1, "Please select a base image"),
  cpuLimit: z
    .number()
    .min(0.5, "CPU must be at least 0.5 cores")
    .max(MAX_CPU_CORES, `CPU cannot exceed ${MAX_CPU_CORES} cores`),
  memoryLimitMb: z
    .number()
    .int("Memory must be a whole number")
    .min(128, "Memory must be at least 128 MB")
    .max(MAX_MEMORY_MB, `Memory cannot exceed ${MAX_MEMORY_MB / 1024} GB`),
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

type FormValues = z.infer<typeof createContainerSchema>;

interface SelectedRuntime {
  runtime: RuntimeType;
  version: string;
}

export function CreateContainerForm({ images }: CreateContainerFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedRuntimes, setSelectedRuntimes] = useState<SelectedRuntime[]>([
    { runtime: "nodejs", version: getDefaultVersion("nodejs") },
  ]);

  const form = useForm<FormValues>({
    resolver: zodResolver(createContainerSchema),
    defaultValues: {
      displayName: "",
      image: "ubuntu:24.04",
      cpuLimit: 1,
      memoryLimitMb: 512,
      ports: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "ports",
  });

  async function onSubmit(data: FormValues) {
    setIsLoading(true);
    setError(null);

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
          runtimes,
          runtimeVersions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to create sandbox"
        );
      }

      const result = await response.json();
      router.push(`/sandbox/${result.container.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      <SandboxInfoBanner />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Box className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Create New Sandbox</CardTitle>
              <CardDescription>
                Configure your isolated sandbox environment
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Basic Info Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Basic Information</h3>
              </div>

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sandbox Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Development Environment" {...field} />
                    </FormControl>
                    <FormDescription>
                      A unique friendly name for your sandbox
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Image</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an image" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {images.map((image) => (
                          <SelectItem key={image.id} value={image.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{image.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {image.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Runtime Selection Section */}
            <div className="space-y-4">
              <RuntimeSelector
                value={selectedRuntimes}
                onChange={setSelectedRuntimes}
                maxRuntimes={3}
              />
            </div>

            <Separator />

            {/* Resource Allocation Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Resource Allocation</h3>
                  <Badge variant="secondary" className="text-[10px]">
                    <Shield className="h-3 w-3 mr-1" />
                    Enforced
                  </Badge>
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
                        {field.value} / {MAX_CPU_CORES} cores
                      </Badge>
                    </div>
                    <FormControl>
                      <Slider
                        min={0.5}
                        max={MAX_CPU_CORES}
                        step={0.5}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      CPU cores allocated (0.5 - {MAX_CPU_CORES} cores max)
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
                        {field.value >= 1024
                          ? `${(field.value / 1024).toFixed(1)} GB`
                          : `${field.value} MB`}{" "}
                        / {MAX_MEMORY_MB / 1024} GB max
                      </Badge>
                    </div>
                    <FormControl>
                      <Slider
                        min={128}
                        max={MAX_MEMORY_MB}
                        step={128}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      Memory allocated (128 MB - {MAX_MEMORY_MB / 1024} GB max)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Port Mappings Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Port Mappings</h3>
                  <PortMappingExplainer />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ serviceName: "", port: 3000 })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Port
                </Button>
              </div>

              {fields.length > 0 && (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex gap-3 items-start p-3 rounded-lg border bg-muted/30"
                    >
                      <FormField
                        control={form.control}
                        name={`ports.${index}.serviceName`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs">Service Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., http, api, db"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`ports.${index}.port`}
                        render={({ field }) => (
                          <FormItem className="w-28">
                            <FormLabel className="text-xs">Port</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="3000"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value, 10) || 0)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="pt-6">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
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
              )}

              {fields.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <Network className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No ports mapped yet. Add a port mapping to expose services.
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Spinner className="mr-2 h-4 w-4" />}
                Create Sandbox
              </Button>
            </div>
          </form>
        </Form>
        </CardContent>
      </Card>
    </div>
  );
}
