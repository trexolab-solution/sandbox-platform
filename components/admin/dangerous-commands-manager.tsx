"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Filter,
  Download,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Code,
  Lock,
  Server,
  Globe,
  Container,
  Package,
  Zap,
  FileText,
  Eye,
  EyeOff,
  Copy,
  Layers,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { SimplePagination, PaginationInfo, usePagination } from "@/components/ui/pagination";

interface DangerousPattern {
  id: string;
  name: string;
  pattern: string;
  category: string;
  riskLevel: string;
  enabled: boolean;
  isBuiltIn: boolean;
  description?: string;
  examples?: string[];
  createdAt: string;
  updatedAt: string;
}

// Category configuration with icons and colors
const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  privilege_escalation: {
    label: "Privilege Escalation",
    icon: <Lock className="h-3.5 w-3.5" />,
    color: "text-red-500 bg-red-500/10 border-red-500/20",
    description: "Commands that attempt to gain elevated permissions",
  },
  container_escape: {
    label: "Container Escape",
    icon: <Container className="h-3.5 w-3.5" />,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    description: "Commands that try to break out of container isolation",
  },
  dangerous_operations: {
    label: "Dangerous Operations",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    description: "Destructive commands like rm -rf or system shutdown",
  },
  host_probing: {
    label: "Host Probing",
    icon: <Server className="h-3.5 w-3.5" />,
    color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    description: "Commands that probe the host system information",
  },
  network_scanning: {
    label: "Network Scanning",
    icon: <Globe className="h-3.5 w-3.5" />,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    description: "Network scanning and reconnaissance tools",
  },
  package_managers_dangerous: {
    label: "Unsafe Packages",
    icon: <Package className="h-3.5 w-3.5" />,
    color: "text-green-500 bg-green-500/10 border-green-500/20",
    description: "Dangerous package installation patterns",
  },
  custom: {
    label: "Custom",
    icon: <Code className="h-3.5 w-3.5" />,
    color: "text-gray-500 bg-gray-500/10 border-gray-500/20",
    description: "User-defined custom patterns",
  },
};

// Risk level configuration
const RISK_LEVEL_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  critical: {
    label: "Critical",
    color: "bg-red-500 text-white",
    icon: <ShieldAlert className="h-3 w-3" />,
  },
  high: {
    label: "High",
    color: "bg-orange-500 text-white",
    icon: <ShieldX className="h-3 w-3" />,
  },
  medium: {
    label: "Medium",
    color: "bg-yellow-500 text-white",
    icon: <Shield className="h-3 w-3" />,
  },
  low: {
    label: "Low",
    color: "bg-blue-500 text-white",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
};

export function DangerousCommandsManager() {
  const [patterns, setPatterns] = useState<DangerousPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [enabledFilter, setEnabledFilter] = useState<string>("all");
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    pattern: DangerousPattern | null;
  }>({ open: false, pattern: null });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    pattern: DangerousPattern | null;
  }>({ open: false, pattern: null });
  const [createDialog, setCreateDialog] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [showPatternPreview, setShowPatternPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    pattern: "",
    category: "custom",
    riskLevel: "medium",
    description: "",
    examples: "",
  });

  useEffect(() => {
    fetchPatterns();
  }, []);

  const fetchPatterns = async () => {
    try {
      const response = await fetch("/api/admin/dangerous-commands");
      if (response.ok) {
        const data = await response.json();
        setPatterns(data.patterns);
      }
    } catch (error) {
      toast.error("Failed to load patterns");
    } finally {
      setLoading(false);
    }
  };

  const handleSeedPatterns = async () => {
    setSeedLoading(true);
    try {
      const response = await fetch("/api/admin/dangerous-commands/seed", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok) {
        if (data.seeded) {
          toast.success(`Successfully seeded ${data.count} built-in patterns`);
          fetchPatterns();
        } else {
          toast.info(data.message);
        }
      } else {
        toast.error(data.error || "Failed to seed patterns");
      }
    } catch (error) {
      toast.error("Failed to seed patterns");
    } finally {
      setSeedLoading(false);
    }
  };

  const handleToggle = async (patternId: string) => {
    try {
      const response = await fetch(
        `/api/admin/dangerous-commands/${patternId}/toggle`,
        { method: "POST" }
      );
      const data = await response.json();

      if (response.ok) {
        toast.success(data.enabled ? "Pattern enabled" : "Pattern disabled");
        setPatterns((prev) =>
          prev.map((p) => (p.id === patternId ? { ...p, enabled: data.enabled } : p))
        );
      } else {
        toast.error(data.error || "Failed to toggle pattern");
      }
    } catch (error) {
      toast.error("Failed to toggle pattern");
    }
  };

  const handleCreate = async () => {
    try {
      const examples = formData.examples
        ? formData.examples.split("\n").filter((e) => e.trim())
        : [];

      const response = await fetch("/api/admin/dangerous-commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          examples,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Pattern created successfully");
        setCreateDialog(false);
        resetForm();
        fetchPatterns();
      } else {
        toast.error(data.error || "Failed to create pattern");
      }
    } catch (error) {
      toast.error("Failed to create pattern");
    }
  };

  const handleUpdate = async () => {
    if (!editDialog.pattern) return;

    try {
      const examples = formData.examples
        ? formData.examples.split("\n").filter((e) => e.trim())
        : [];

      const response = await fetch(
        `/api/admin/dangerous-commands/${editDialog.pattern.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            examples,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Pattern updated successfully");
        setEditDialog({ open: false, pattern: null });
        fetchPatterns();
      } else {
        toast.error(data.error || "Failed to update pattern");
      }
    } catch (error) {
      toast.error("Failed to update pattern");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.pattern) return;

    try {
      const response = await fetch(
        `/api/admin/dangerous-commands/${deleteDialog.pattern.id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Pattern deleted successfully");
        setDeleteDialog({ open: false, pattern: null });
        fetchPatterns();
      } else {
        toast.error(data.error || "Failed to delete pattern");
      }
    } catch (error) {
      toast.error("Failed to delete pattern");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      pattern: "",
      category: "custom",
      riskLevel: "medium",
      description: "",
      examples: "",
    });
  };

  const openEditDialog = (pattern: DangerousPattern) => {
    setFormData({
      name: pattern.name,
      pattern: pattern.pattern,
      category: pattern.category,
      riskLevel: pattern.riskLevel,
      description: pattern.description || "",
      examples: pattern.examples?.join("\n") || "",
    });
    setEditDialog({ open: true, pattern });
  };

  const copyPattern = (pattern: string) => {
    navigator.clipboard.writeText(pattern);
    toast.success("Pattern copied to clipboard");
  };

  // Filter patterns
  const filteredPatterns = patterns.filter((pattern) => {
    const matchesSearch =
      pattern.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || pattern.category === categoryFilter;

    const matchesRisk =
      riskFilter === "all" || pattern.riskLevel === riskFilter;

    const matchesEnabled =
      enabledFilter === "all" ||
      (enabledFilter === "enabled" && pattern.enabled) ||
      (enabledFilter === "disabled" && !pattern.enabled);

    return matchesSearch && matchesCategory && matchesRisk && matchesEnabled;
  });

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    totalItems,
    pageSize,
  } = usePagination(filteredPatterns, 15);

  // Statistics
  const stats = {
    total: patterns.length,
    enabled: patterns.filter((p) => p.enabled).length,
    disabled: patterns.filter((p) => !p.enabled).length,
    custom: patterns.filter((p) => !p.isBuiltIn).length,
    builtIn: patterns.filter((p) => p.isBuiltIn).length,
    byCategoryCount: Object.keys(CATEGORY_CONFIG).reduce((acc, cat) => {
      acc[cat] = patterns.filter((p) => p.category === cat).length;
      return acc;
    }, {} as Record<string, number>),
    byRiskCount: Object.keys(RISK_LEVEL_CONFIG).reduce((acc, risk) => {
      acc[risk] = patterns.filter((p) => p.riskLevel === risk).length;
      return acc;
    }, {} as Record<string, number>),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Patterns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.enabled}</p>
                <p className="text-xs text-muted-foreground">Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{stats.disabled}</p>
                <p className="text-xs text-muted-foreground">Disabled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.builtIn}</p>
                <p className="text-xs text-muted-foreground">Built-in</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Code className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{stats.custom}</p>
                <p className="text-xs text-muted-foreground">Custom</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.byRiskCount.critical || 0}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Patterns by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const count = stats.byCategoryCount[key] || 0;
              return (
                <button
                  key={key}
                  onClick={() => setCategoryFilter(categoryFilter === key ? "all" : key)}
                  className={`p-3 rounded-lg border transition-all ${
                    categoryFilter === key
                      ? `${config.color} border-current`
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {config.icon}
                    <span className="text-lg font-bold">{count}</span>
                  </div>
                  <p className="text-xs truncate">{config.label}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patterns by name, regex, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {config.icon}
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risks</SelectItem>
              {Object.entries(RISK_LEVEL_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {config.icon}
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={enabledFilter} onValueChange={setEnabledFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="enabled">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" />
                  Enabled
                </div>
              </SelectItem>
              <SelectItem value="disabled">
                <div className="flex items-center gap-2">
                  <EyeOff className="h-3.5 w-3.5" />
                  Disabled
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => setCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Pattern
          </Button>

          <Button
            onClick={handleSeedPatterns}
            variant="outline"
            disabled={seedLoading}
            className="gap-2"
          >
            {seedLoading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Seed Built-in
          </Button>

          <Button
            onClick={fetchPatterns}
            variant="outline"
            size="icon"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Active Filters */}
      {(searchQuery || categoryFilter !== "all" || riskFilter !== "all" || enabledFilter !== "all") && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: &quot;{searchQuery}&quot;
              <button onClick={() => setSearchQuery("")} className="ml-1 hover:text-destructive">
                <XCircle className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {categoryFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {CATEGORY_CONFIG[categoryFilter]?.label}
              <button onClick={() => setCategoryFilter("all")} className="ml-1 hover:text-destructive">
                <XCircle className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {riskFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {RISK_LEVEL_CONFIG[riskFilter]?.label}
              <button onClick={() => setRiskFilter("all")} className="ml-1 hover:text-destructive">
                <XCircle className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {enabledFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {enabledFilter === "enabled" ? "Enabled" : "Disabled"}
              <button onClick={() => setEnabledFilter("all")} className="ml-1 hover:text-destructive">
                <XCircle className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setCategoryFilter("all");
              setRiskFilter("all");
              setEnabledFilter("all");
            }}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Patterns Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Command Patterns</CardTitle>
              <CardDescription>
                {totalItems} pattern{totalItems !== 1 ? "s" : ""} found
                {filteredPatterns.length !== patterns.length && ` (filtered from ${patterns.length})`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[30%]">Pattern</TableHead>
                  <TableHead className="w-[15%]">Category</TableHead>
                  <TableHead className="w-[10%]">Risk</TableHead>
                  <TableHead className="w-[30%]">Regex</TableHead>
                  <TableHead className="w-[8%]">Status</TableHead>
                  <TableHead className="w-[7%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Shield className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground">No patterns found</p>
                        {patterns.length === 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSeedPatterns}
                            className="mt-2 gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Seed Built-in Patterns
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((pattern) => {
                    const categoryConfig = CATEGORY_CONFIG[pattern.category] || CATEGORY_CONFIG.custom;
                    const riskConfig = RISK_LEVEL_CONFIG[pattern.riskLevel] || RISK_LEVEL_CONFIG.medium;

                    return (
                      <TableRow
                        key={pattern.id}
                        className={!pattern.enabled ? "opacity-60" : undefined}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{pattern.name}</span>
                              {pattern.isBuiltIn && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0">
                                  Built-in
                                </Badge>
                              )}
                            </div>
                            {pattern.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {pattern.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`gap-1 ${categoryConfig.color}`}
                          >
                            {categoryConfig.icon}
                            <span className="hidden lg:inline">{categoryConfig.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`gap-1 ${riskConfig.color}`}>
                            {riskConfig.icon}
                            {riskConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono max-w-[250px] truncate block">
                              {pattern.pattern}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 shrink-0"
                              onClick={() => copyPattern(pattern.pattern)}
                              title="Copy pattern"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={pattern.enabled}
                            onCheckedChange={() => handleToggle(pattern.id)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(pattern)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyPattern(pattern.pattern)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Regex
                              </DropdownMenuItem>
                              {pattern.examples && pattern.examples.length > 0 && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setShowPatternPreview(
                                      showPatternPreview === pattern.id ? null : pattern.id
                                    )
                                  }
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Examples
                                </DropdownMenuItem>
                              )}
                              {!pattern.isBuiltIn && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteDialog({ open: true, pattern })}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <PaginationInfo
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={totalItems}
              />
              <SimplePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialog || editDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialog(false);
            setEditDialog({ open: false, pattern: null });
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editDialog.pattern ? (
                <>
                  <Edit2 className="h-5 w-5" />
                  Edit Pattern
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Create Custom Pattern
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editDialog.pattern
                ? "Update the dangerous command pattern settings. Built-in patterns have limited editing."
                : "Create a new custom regex pattern to block specific commands."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Pattern Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Block crypto miners"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={editDialog.pattern?.isBuiltIn}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  disabled={editDialog.pattern?.isBuiltIn}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {config.icon}
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pattern">Regex Pattern</Label>
              <Input
                id="pattern"
                placeholder="e.g., \\b(xmrig|minerd|cgminer)\\b"
                value={formData.pattern}
                onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                disabled={editDialog.pattern?.isBuiltIn}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use JavaScript regex syntax. Remember to escape special characters with double backslashes.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="riskLevel">Risk Level</Label>
              <Select
                value={formData.riskLevel}
                onValueChange={(value) => setFormData({ ...formData, riskLevel: value })}
              >
                <SelectTrigger id="riskLevel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RISK_LEVEL_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${config.color}`} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this pattern blocks and why..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="examples">Example Commands (one per line)</Label>
              <Textarea
                id="examples"
                placeholder="xmrig --donate-level 1&#10;cgminer -o stratum://pool.com&#10;minerd -a sha256d"
                value={formData.examples}
                onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Add example commands that this pattern should match (for documentation).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialog(false);
                setEditDialog({ open: false, pattern: null });
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editDialog.pattern ? handleUpdate : handleCreate}
              disabled={!formData.name || !formData.pattern}
            >
              {editDialog.pattern ? "Update Pattern" : "Create Pattern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog({ open: false, pattern: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Pattern
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the pattern &quot;{deleteDialog.pattern?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
