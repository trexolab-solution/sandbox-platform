"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Server,
  Bug,
  Save,
  RefreshCw,
  Terminal,
  Palette,
  Settings2,
  Upload,
  Globe,
  AlertTriangle,
  Moon,
  Sun,
  Monitor,
  Bell,
  UserPlus,
  ShieldAlert,
  Ban,
  Calendar,
  Container,
  Zap,
  Shield,
  Lock,
  Eye,
  Clock,
  Users,
  Layers,
  Box,
  Image,
  CheckCircle2,
  XCircle,
  Info,
  Coffee,
  Hexagon,
  FileCode,
  Disc,
  Settings,
  Code,
  Gem,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { DEFAULT_SETTINGS, type AppSettingsType } from "@/lib/settings";
import { BASE_IMAGES, RUNTIME_CONFIGS, type RuntimeType } from "@/lib/docker/runtime-images";

type AppSettings = AppSettingsType;

// Runtime icons mapping
const RUNTIME_ICONS: Record<string, React.ReactNode> = {
  java: <Coffee className="h-4 w-4" />,
  nodejs: <Hexagon className="h-4 w-4" />,
  python: <FileCode className="h-4 w-4" />,
  go: <Disc className="h-4 w-4" />,
  rust: <Settings className="h-4 w-4" />,
  php: <Code className="h-4 w-4" />,
  ruby: <Gem className="h-4 w-4" />,
  dotnet: <Box className="h-4 w-4" />,
};

// Base image icons/categories
const IMAGE_CATEGORY_ICONS: Record<string, React.ReactNode> = {
  linux: <Container className="h-4 w-4 text-orange-500" />,
  minimal: <Layers className="h-4 w-4 text-blue-500" />,
  enterprise: <Shield className="h-4 w-4 text-purple-500" />,
};

export function SettingsForm() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState("resources");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setOriginalSettings(data);
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (key: keyof AppSettings, value: number | boolean | string | string[]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error("Failed to save settings");

      const data = await response.json();
      setSettings(data);
      setOriginalSettings(data);
      setHasChanges(false);
      toast.success("Settings saved successfully");
      router.refresh();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setHasChanges(false);
  };

  const formatMemory = (mb: number) => {
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
  };

  const toggleBaseImage = (imageValue: string) => {
    const current = settings.enabledBaseImages || [];
    const newImages = current.includes(imageValue)
      ? current.filter((v) => v !== imageValue)
      : [...current, imageValue];
    handleChange("enabledBaseImages", newImages);
  };

  const toggleRuntime = (runtimeId: string) => {
    const current = settings.enabledRuntimes || [];
    const newRuntimes = current.includes(runtimeId)
      ? current.filter((v) => v !== runtimeId)
      : [...current, runtimeId];
    handleChange("enabledRuntimes", newRuntimes);
  };

  const selectAllBaseImages = () => {
    handleChange("enabledBaseImages", BASE_IMAGES.map((img) => img.value));
  };

  const deselectAllBaseImages = () => {
    handleChange("enabledBaseImages", []);
  };

  const selectAllRuntimes = () => {
    handleChange("enabledRuntimes", Object.keys(RUNTIME_CONFIGS));
  };

  const deselectAllRuntimes = () => {
    handleChange("enabledRuntimes", []);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with save/reset buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Platform Settings</h2>
          <p className="text-muted-foreground">
            Configure resources, security, features, and notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-500">
              Unsaved changes
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="resources" className="gap-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">Resources</span>
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-2">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Images</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
        </TabsList>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-6">
          {/* Resource Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-blue-500" />
                Resource Limits
              </CardTitle>
              <CardDescription>
                Define maximum and default resource allocations for user sandboxes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* CPU */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-blue-500" />
                    <h4 className="font-medium">CPU Cores</h4>
                  </div>
                  <Badge variant="outline">
                    Default: {settings.defaultCpuCores} / Max: {settings.maxCpuCores}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Maximum Allowed</Label>
                      <span className="font-mono text-sm font-medium">{settings.maxCpuCores} cores</span>
                    </div>
                    <Slider
                      value={[settings.maxCpuCores]}
                      onValueChange={([v]) => handleChange("maxCpuCores", v)}
                      min={1}
                      max={16}
                      step={1}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Default Value</Label>
                      <span className="font-mono text-sm font-medium">{settings.defaultCpuCores} cores</span>
                    </div>
                    <Slider
                      value={[settings.defaultCpuCores]}
                      onValueChange={([v]) => handleChange("defaultCpuCores", Math.min(v, settings.maxCpuCores))}
                      min={1}
                      max={settings.maxCpuCores}
                      step={1}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Memory */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="h-4 w-4 text-purple-500" />
                    <h4 className="font-medium">Memory (RAM)</h4>
                  </div>
                  <Badge variant="outline">
                    Default: {formatMemory(settings.defaultMemoryMb)} / Max: {formatMemory(settings.maxMemoryMb)}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Maximum Allowed</Label>
                      <span className="font-mono text-sm font-medium">{formatMemory(settings.maxMemoryMb)}</span>
                    </div>
                    <Slider
                      value={[settings.maxMemoryMb]}
                      onValueChange={([v]) => handleChange("maxMemoryMb", v)}
                      min={256}
                      max={16384}
                      step={256}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Default Value</Label>
                      <span className="font-mono text-sm font-medium">{formatMemory(settings.defaultMemoryMb)}</span>
                    </div>
                    <Slider
                      value={[settings.defaultMemoryMb]}
                      onValueChange={([v]) => handleChange("defaultMemoryMb", Math.min(v, settings.maxMemoryMb))}
                      min={256}
                      max={settings.maxMemoryMb}
                      step={256}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Disk */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-green-500" />
                    <h4 className="font-medium">Disk Storage</h4>
                  </div>
                  <Badge variant="outline">
                    Default: {formatMemory(settings.defaultDiskMb)} / Max: {formatMemory(settings.maxDiskMb)}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Maximum Allowed</Label>
                      <span className="font-mono text-sm font-medium">{formatMemory(settings.maxDiskMb)}</span>
                    </div>
                    <Slider
                      value={[settings.maxDiskMb]}
                      onValueChange={([v]) => handleChange("maxDiskMb", v)}
                      min={512}
                      max={20480}
                      step={512}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Default Value</Label>
                      <span className="font-mono text-sm font-medium">{formatMemory(settings.defaultDiskMb)}</span>
                    </div>
                    <Slider
                      value={[settings.defaultDiskMb]}
                      onValueChange={([v]) => handleChange("defaultDiskMb", Math.min(v, settings.maxDiskMb))}
                      min={256}
                      max={settings.maxDiskMb}
                      step={256}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Container Limits */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Container className="h-4 w-4 text-orange-500" />
                    <h4 className="font-medium">Container Limits</h4>
                  </div>
                  <Badge variant="outline">{settings.maxContainersPerUser} per user</Badge>
                </div>
                <div className="max-w-md space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Maximum Containers per User</Label>
                    <span className="font-mono text-sm font-medium">{settings.maxContainersPerUser}</span>
                  </div>
                  <Slider
                    value={[settings.maxContainersPerUser]}
                    onValueChange={([v]) => handleChange("maxContainersPerUser", v)}
                    min={1}
                    max={50}
                    step={1}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Container Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Container Features
              </CardTitle>
              <CardDescription>
                Enable or disable features available inside user containers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-500" />
                      <Label className="font-medium">Network Access</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Allow containers to access the internet
                    </p>
                  </div>
                  <Switch
                    checked={settings.networkAccessEnabled}
                    onCheckedChange={(v) => handleChange("networkAccessEnabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-green-500" />
                      <Label className="font-medium">File Upload</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Allow users to upload files
                    </p>
                  </div>
                  <Switch
                    checked={settings.fileUploadEnabled}
                    onCheckedChange={(v) => handleChange("fileUploadEnabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      <Label className="font-medium">Sudo Access</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Allow sudo commands in containers
                    </p>
                  </div>
                  <Switch
                    checked={settings.sudoEnabled}
                    onCheckedChange={(v) => handleChange("sudoEnabled", v)}
                  />
                </div>

                {settings.fileUploadEnabled && (
                  <div className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-green-500" />
                      <Label className="font-medium">Max Upload Size</Label>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[settings.maxFileUploadSizeMb]}
                        onValueChange={([v]) => handleChange("maxFileUploadSizeMb", v)}
                        min={1}
                        max={500}
                        step={1}
                        className="flex-1"
                      />
                      <span className="font-mono text-sm w-16 text-right">{settings.maxFileUploadSizeMb} MB</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Terminal Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Terminal Settings
              </CardTitle>
              <CardDescription>
                Configure terminal appearance and behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Scrollback Lines</Label>
                    <span className="font-mono text-sm font-medium">{settings.terminalScrollback.toLocaleString()}</span>
                  </div>
                  <Slider
                    value={[settings.terminalScrollback]}
                    onValueChange={([v]) => handleChange("terminalScrollback", v)}
                    min={100}
                    max={50000}
                    step={100}
                  />
                  <p className="text-xs text-muted-foreground">Number of lines to keep in terminal history</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Font Size</Label>
                    <span className="font-mono text-sm font-medium">{settings.terminalFontSize}px</span>
                  </div>
                  <Slider
                    value={[settings.terminalFontSize]}
                    onValueChange={([v]) => handleChange("terminalFontSize", v)}
                    min={10}
                    max={24}
                    step={1}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-6">
          {/* Base Images */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-500" />
                    Base Images
                  </CardTitle>
                  <CardDescription>
                    Select which base Linux images are available for sandbox creation
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {(settings.enabledBaseImages || []).length} / {BASE_IMAGES.length} enabled
                  </Badge>
                  <Button variant="outline" size="sm" onClick={selectAllBaseImages}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAllBaseImages}>
                    Deselect All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {BASE_IMAGES.map((image) => {
                  const isEnabled = (settings.enabledBaseImages || []).includes(image.value);
                  return (
                    <div
                      key={image.value}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        isEnabled
                          ? "bg-primary/5 border-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleBaseImage(image.value)}
                    >
                      <Checkbox
                        checked={isEnabled}
                        onCheckedChange={() => toggleBaseImage(image.value)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {IMAGE_CATEGORY_ICONS[image.category]}
                          <span className="font-medium text-sm">{image.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {image.description}
                        </p>
                        <code className="text-xs text-muted-foreground mt-1 block">
                          {image.value}
                        </code>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Runtime Environments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-green-500" />
                    Runtime Environments
                  </CardTitle>
                  <CardDescription>
                    Select which programming language runtimes users can install in their sandboxes
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {(settings.enabledRuntimes || []).length} / {Object.keys(RUNTIME_CONFIGS).length} enabled
                  </Badge>
                  <Button variant="outline" size="sm" onClick={selectAllRuntimes}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAllRuntimes}>
                    Deselect All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(RUNTIME_CONFIGS).map(([id, config]) => {
                  const isEnabled = (settings.enabledRuntimes || []).includes(id);
                  const versionCount = config.versions.length;
                  return (
                    <div
                      key={id}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        isEnabled
                          ? "bg-primary/5 border-primary/30"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleRuntime(id)}
                    >
                      <Checkbox
                        checked={isEnabled}
                        onCheckedChange={() => toggleRuntime(id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {RUNTIME_ICONS[id]}
                          <span className="font-medium text-sm">{config.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {config.description}
                        </p>
                        <div className="flex items-center gap-1 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {versionCount} version{versionCount !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {config.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Image Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-yellow-500" />
                Image Security
              </CardTitle>
              <CardDescription>
                Control how images are validated during sandbox creation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    <Label className="font-medium">Restrict to Allowed Images Only</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Only allow sandbox creation with pre-approved images from the lists above
                  </p>
                </div>
                <Switch
                  checked={settings.allowedImagesOnly}
                  onCheckedChange={(v) => handleChange("allowedImagesOnly", v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          {/* Internet Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                Internet Access Control
              </CardTitle>
              <CardDescription>
                Configure how internet access is managed for sandboxes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-green-500" />
                      <Label className="font-medium">Global Internet</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Master switch for all internet access
                    </p>
                  </div>
                  <Switch
                    checked={settings.globalInternetEnabled}
                    onCheckedChange={(v) => handleChange("globalInternetEnabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Container className="h-4 w-4 text-blue-500" />
                      <Label className="font-medium">Default Internet</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      New containers get internet by default
                    </p>
                  </div>
                  <Switch
                    checked={settings.defaultInternetAccess}
                    onCheckedChange={(v) => handleChange("defaultInternetAccess", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      <Label className="font-medium">Allow Requests</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Users can request internet access
                    </p>
                  </div>
                  <Switch
                    checked={settings.internetRequestsEnabled}
                    onCheckedChange={(v) => handleChange("internetRequestsEnabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <Label className="font-medium">Auto-Revoke on Stop</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Revoke internet when container stops
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoRevokeInternetOnStop}
                    onCheckedChange={(v) => handleChange("autoRevokeInternetOnStop", v)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Max Approval Duration</Label>
                    <span className="font-mono text-sm font-medium">{settings.maxInternetDurationMinutes} min</span>
                  </div>
                  <Slider
                    value={[settings.maxInternetDurationMinutes]}
                    onValueChange={([v]) => handleChange("maxInternetDurationMinutes", v)}
                    min={15}
                    max={1440}
                    step={15}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Default Approval Duration</Label>
                    <span className="font-mono text-sm font-medium">{settings.defaultInternetDurationMinutes} min</span>
                  </div>
                  <Slider
                    value={[settings.defaultInternetDurationMinutes]}
                    onValueChange={([v]) => handleChange("defaultInternetDurationMinutes", v)}
                    min={15}
                    max={settings.maxInternetDurationMinutes}
                    step={15}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Command Filtering */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-red-500" />
                Command Filtering
              </CardTitle>
              <CardDescription>
                Block dangerous commands and operations in sandboxes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    <Label className="font-medium">Enable Command Filtering</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Master switch for all command interception and filtering
                  </p>
                </div>
                <Switch
                  checked={settings.commandFilteringEnabled}
                  onCheckedChange={(v) => handleChange("commandFilteringEnabled", v)}
                />
              </div>

              {settings.commandFilteringEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-red-500" />
                      <Label className="text-sm">Privilege Escalation</Label>
                    </div>
                    <Switch
                      checked={settings.blockPrivilegeEscalation}
                      onCheckedChange={(v) => handleChange("blockPrivilegeEscalation", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-orange-500" />
                      <Label className="text-sm">Host Probing</Label>
                    </div>
                    <Switch
                      checked={settings.blockHostProbing}
                      onCheckedChange={(v) => handleChange("blockHostProbing", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-500" />
                      <Label className="text-sm">Network Scanning</Label>
                    </div>
                    <Switch
                      checked={settings.blockNetworkScanning}
                      onCheckedChange={(v) => handleChange("blockNetworkScanning", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Container className="h-4 w-4 text-purple-500" />
                      <Label className="text-sm">Container Escape</Label>
                    </div>
                    <Switch
                      checked={settings.blockContainerEscape}
                      onCheckedChange={(v) => handleChange("blockContainerEscape", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <Label className="text-sm">Dangerous Operations</Label>
                    </div>
                    <Switch
                      checked={settings.blockDangerousOperations}
                      onCheckedChange={(v) => handleChange("blockDangerousOperations", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <Label className="text-sm">Unsafe Package Install</Label>
                    </div>
                    <Switch
                      checked={settings.blockUnsafePackageInstall}
                      onCheckedChange={(v) => handleChange("blockUnsafePackageInstall", v)}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <Label className="font-medium">Log All Commands</Label>
                    <Badge variant="outline" className="text-xs">Verbose</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Log even allowed commands (high disk usage)
                  </p>
                </div>
                <Switch
                  checked={settings.logAllCommands}
                  onCheckedChange={(v) => handleChange("logAllCommands", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Auto-Block Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-red-500" />
                Auto-Block Settings
              </CardTitle>
              <CardDescription>
                Automatically block users who repeatedly violate security policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Violation Threshold</Label>
                    <span className="font-mono text-sm font-medium">{settings.prohibitedCommandBlockThreshold}</span>
                  </div>
                  <Slider
                    value={[settings.prohibitedCommandBlockThreshold]}
                    onValueChange={([v]) => handleChange("prohibitedCommandBlockThreshold", v)}
                    min={1}
                    max={20}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Block after X violations</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Time Window</Label>
                    <span className="font-mono text-sm font-medium">{settings.prohibitedCommandWindowHours}h</span>
                  </div>
                  <Slider
                    value={[settings.prohibitedCommandWindowHours]}
                    onValueChange={([v]) => handleChange("prohibitedCommandWindowHours", v)}
                    min={1}
                    max={168}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Violation counting window</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Block Duration</Label>
                    <span className="font-mono text-sm font-medium">
                      {settings.blockDurationHours === 0 ? "Permanent" : `${settings.blockDurationHours}h`}
                    </span>
                  </div>
                  <Slider
                    value={[settings.blockDurationHours]}
                    onValueChange={([v]) => handleChange("blockDurationHours", v)}
                    min={0}
                    max={720}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">0 = permanent ban</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-yellow-500" />
                Security Alerts
              </CardTitle>
              <CardDescription>
                Configure when security alerts are generated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="font-medium">Alert on Blocked Command</Label>
                    <p className="text-sm text-muted-foreground">
                      Create alert when commands are blocked
                    </p>
                  </div>
                  <Switch
                    checked={settings.alertOnBlockedCommand}
                    onCheckedChange={(v) => handleChange("alertOnBlockedCommand", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="font-medium">Alert on Resource Spike</Label>
                    <p className="text-sm text-muted-foreground">
                      Create alert on resource abuse
                    </p>
                  </div>
                  <Switch
                    checked={settings.alertOnResourceSpike}
                    onCheckedChange={(v) => handleChange("alertOnResourceSpike", v)}
                  />
                </div>
              </div>

              {settings.alertOnResourceSpike && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">CPU Alert Threshold</Label>
                      <span className="font-mono text-sm font-medium">{settings.resourceSpikeThresholdCpu}%</span>
                    </div>
                    <Slider
                      value={[settings.resourceSpikeThresholdCpu]}
                      onValueChange={([v]) => handleChange("resourceSpikeThresholdCpu", v)}
                      min={50}
                      max={100}
                      step={5}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Memory Alert Threshold</Label>
                      <span className="font-mono text-sm font-medium">{settings.resourceSpikeThresholdMemory}%</span>
                    </div>
                    <Slider
                      value={[settings.resourceSpikeThresholdMemory]}
                      onValueChange={([v]) => handleChange("resourceSpikeThresholdMemory", v)}
                      min={50}
                      max={100}
                      step={5}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-500" />
                Telegram Notifications
              </CardTitle>
              <CardDescription>
                Control which events trigger Telegram notifications to the admin chat
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-blue-500" />
                      <Label className="font-medium">New User Registration</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When a new user signs up
                    </p>
                  </div>
                  <Switch
                    checked={settings.telegramNotifyNewUser}
                    onCheckedChange={(v) => handleChange("telegramNotifyNewUser", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-green-500" />
                      <Label className="font-medium">Internet Access Requests</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When users request internet access
                    </p>
                  </div>
                  <Switch
                    checked={settings.telegramNotifyInternetRequest}
                    onCheckedChange={(v) => handleChange("telegramNotifyInternetRequest", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-500" />
                      <Label className="font-medium">Schedule Requests</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When users request scheduled access
                    </p>
                  </div>
                  <Switch
                    checked={settings.telegramNotifyScheduleRequest}
                    onCheckedChange={(v) => handleChange("telegramNotifyScheduleRequest", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                      <Label className="font-medium">Security Alerts</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Security alerts and violations
                    </p>
                  </div>
                  <Switch
                    checked={settings.telegramNotifySecurityAlert}
                    onCheckedChange={(v) => handleChange("telegramNotifySecurityAlert", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <Label className="font-medium">Blocked Commands</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When dangerous commands are blocked
                    </p>
                  </div>
                  <Switch
                    checked={settings.telegramNotifyBlockedCommand}
                    onCheckedChange={(v) => handleChange("telegramNotifyBlockedCommand", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-red-600" />
                      <Label className="font-medium">User Auto-Banned</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When users are automatically banned
                    </p>
                  </div>
                  <Switch
                    checked={settings.telegramNotifyUserBanned}
                    onCheckedChange={(v) => handleChange("telegramNotifyUserBanned", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-yellow-500" />
                      <Label className="font-medium">Bug Reports</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When users submit bug reports
                    </p>
                  </div>
                  <Switch
                    checked={settings.telegramNotifyBugReport}
                    onCheckedChange={(v) => handleChange("telegramNotifyBugReport", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Container className="h-4 w-4 text-cyan-500" />
                      <Label className="font-medium">Sandbox Events</Label>
                      <Badge variant="outline" className="text-xs">Verbose</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sandbox create/start/stop/delete events
                    </p>
                  </div>
                  <Switch
                    checked={settings.telegramNotifySandboxEvents}
                    onCheckedChange={(v) => handleChange("telegramNotifySandboxEvents", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-indigo-500" />
                      <Label className="font-medium">System Events</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      General system events
                    </p>
                  </div>
                  <Switch
                    checked={settings.telegramNotifySystemEvents}
                    onCheckedChange={(v) => handleChange("telegramNotifySystemEvents", v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          {/* Feature Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Feature Toggles
              </CardTitle>
              <CardDescription>
                Enable or disable platform features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <Label className="font-medium">Bug Report Button</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Show bug report button for users
                    </p>
                  </div>
                  <Switch
                    checked={settings.bugReportEnabled}
                    onCheckedChange={(v) => handleChange("bugReportEnabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-green-500" />
                      <Label className="font-medium">New User Registration</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Allow new users to register
                    </p>
                  </div>
                  <Switch
                    checked={settings.newUserRegistrationEnabled}
                    onCheckedChange={(v) => handleChange("newUserRegistrationEnabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-yellow-500/5 border-yellow-500/30">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <Label className="font-medium">Maintenance Mode</Label>
                      {settings.maintenanceMode && (
                        <Badge variant="destructive" className="text-xs">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Block user access for maintenance
                    </p>
                  </div>
                  <Switch
                    checked={settings.maintenanceMode}
                    onCheckedChange={(v) => handleChange("maintenanceMode", v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Authentication Providers
              </CardTitle>
              <CardDescription>
                Configure which authentication methods are available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-[#4285F4] flex items-center justify-center">
                        <span className="text-white text-xs font-bold">G</span>
                      </div>
                      <Label className="font-medium">Google OAuth</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sign in with Google accounts
                    </p>
                  </div>
                  <Switch
                    checked={settings.googleAuthEnabled}
                    onCheckedChange={(v) => handleChange("googleAuthEnabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-black flex items-center justify-center">
                        <span className="text-white text-xs font-bold">G</span>
                      </div>
                      <Label className="font-medium">GitHub OAuth</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sign in with GitHub accounts
                    </p>
                  </div>
                  <Switch
                    checked={settings.githubAuthEnabled}
                    onCheckedChange={(v) => handleChange("githubAuthEnabled", v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Configure default appearance settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border max-w-md">
                <div className="space-y-0.5">
                  <Label className="font-medium">Default Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Default theme for new users
                  </p>
                </div>
                <Select
                  value={settings.defaultTheme}
                  onValueChange={(v) => handleChange("defaultTheme", v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Session Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Session & Timeout
              </CardTitle>
              <CardDescription>
                Configure session and timeout settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Container Timeout</Label>
                    <span className="font-mono text-sm font-medium">{settings.containerTimeoutMinutes} min</span>
                  </div>
                  <Slider
                    value={[settings.containerTimeoutMinutes]}
                    onValueChange={([v]) => handleChange("containerTimeoutMinutes", v)}
                    min={5}
                    max={480}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">Idle timeout before container stops</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Max Sessions per User</Label>
                    <span className="font-mono text-sm font-medium">{settings.maxSessionsPerUser}</span>
                  </div>
                  <Slider
                    value={[settings.maxSessionsPerUser]}
                    onValueChange={([v]) => handleChange("maxSessionsPerUser", v)}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Maximum concurrent sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating save bar for mobile */}
      {hasChanges && (
        <div className="fixed bottom-4 left-4 right-4 md:hidden bg-background/95 backdrop-blur-sm p-4 rounded-lg border shadow-lg flex items-center justify-between gap-2 z-50">
          <Badge variant="outline" className="text-yellow-600 border-yellow-500">
            Unsaved changes
          </Badge>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4 mr-1" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
