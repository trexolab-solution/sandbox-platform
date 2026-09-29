"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Play,
  Square,
  RotateCw,
  Trash2,
  Search,
  Server,
  Cpu,
  HardDrive,
  ExternalLink,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SimplePagination, PaginationInfo, usePagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import Link from "next/link";
import { formatMemory } from "@/lib/config";
import { DeleteSandboxDialog } from "@/components/sandbox/delete-sandbox-dialog";
import { getStatusColor } from "@/lib/types/container";

interface PortMapping {
  id: string;
  serviceName: string;
  internalPort: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Sandbox {
  id: string;
  displayName: string;
  image: string;
  status: string;
  cpuLimit: number;
  memoryLimitMb: number;
  createdAt: Date;
  user: User | null;
  portMappings: PortMapping[];
}

interface SandboxesTableProps {
  sandboxes: Sandbox[];
}

export function SandboxesTable({ sandboxes }: SandboxesTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const filteredSandboxes = sandboxes.filter((s) => {
    const matchesSearch =
      s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.user?.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedSandboxes,
    totalItems,
    pageSize,
  } = usePagination(filteredSandboxes, 10);

  const handleAction = async (sandboxId: string, action: "start" | "stop" | "restart") => {
    setIsLoading(sandboxId);
    try {
      const response = await fetch(`/api/admin/sandboxes/${sandboxId}/${action}`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} sandbox`);
      }

      toast.success(`Sandbox ${action}ed successfully`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} sandbox`);
    } finally {
      setIsLoading(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const statusCounts = sandboxes.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sandboxes or users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={statusFilter === null ? "secondary" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(null)}
          >
            All ({sandboxes.length})
          </Button>
          <Button
            variant={statusFilter === "running" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("running")}
          >
            <div className="h-2 w-2 rounded-full bg-green-500 mr-2" />
            Running ({statusCounts.running || 0})
          </Button>
          <Button
            variant={statusFilter === "stopped" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("stopped")}
          >
            <div className="h-2 w-2 rounded-full bg-gray-500 mr-2" />
            Stopped ({statusCounts.stopped || 0})
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sandbox</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Resources</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSandboxes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No sandboxes found
                </TableCell>
              </TableRow>
            ) : (
              paginatedSandboxes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Server className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{s.displayName}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {s.image}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.user ? (
                      <div>
                        <p className="text-sm">{s.user.name}</p>
                        <p className="text-xs text-muted-foreground">{s.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${getStatusColor(s.status)} text-white border-0 capitalize`}
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1">
                        <Cpu className="h-3 w-3 text-muted-foreground" />
                        {s.cpuLimit}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3 text-muted-foreground" />
                        {formatMemory(s.memoryLimitMb)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(s.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isLoading === s.id}
                        >
                          {isLoading === s.id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/sandbox/${s.id}`} target="_blank">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {s.status === "stopped" && (
                          <DropdownMenuItem onClick={() => handleAction(s.id, "start")}>
                            <Play className="h-4 w-4 mr-2" />
                            Start
                          </DropdownMenuItem>
                        )}
                        {s.status === "running" && (
                          <>
                            <DropdownMenuItem onClick={() => handleAction(s.id, "stop")}>
                              <Square className="h-4 w-4 mr-2" />
                              Stop
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAction(s.id, "restart")}>
                              <RotateCw className="h-4 w-4 mr-2" />
                              Restart
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DeleteSandboxDialog
                          sandboxId={s.id}
                          sandboxName={s.displayName}
                          status={s.status}
                          hasPortMappings={s.portMappings.length > 0}
                          redirectTo={null}
                          isAdmin={true}
                          trigger={
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          }
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
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

    </>
  );
}
