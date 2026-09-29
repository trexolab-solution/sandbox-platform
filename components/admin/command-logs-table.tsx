"use client";

import { useState } from "react";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Search,
  Terminal,
  ShieldAlert,
  ShieldCheck,
  Server,
  Clock,
} from "lucide-react";
import { SimplePagination, PaginationInfo, usePagination } from "@/components/ui/pagination";

interface CommandLog {
  id: string;
  containerId: string | null;
  userId: string | null;
  command: string;
  blocked: boolean;
  blockReason: string | null;
  riskLevel: string | null;
  category: string | null;
  executedAt: Date;
  userName: string | null;
  userEmail: string | null;
  containerName: string | null;
}

interface CommandLogsTableProps {
  logs: CommandLog[];
  counts: {
    total: number;
    blocked: number;
    allowed: number;
  };
}

const riskColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

export function CommandLogsTable({ logs, counts }: CommandLogsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [blockedFilter, setBlockedFilter] = useState<boolean | null>(null);

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.containerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBlocked = blockedFilter === null || l.blocked === blockedFilter;
    return matchesSearch && matchesBlocked;
  });

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedLogs,
    totalItems,
    pageSize,
  } = usePagination(filteredLogs, 15);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commands</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allowed</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{counts.allowed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{counts.blocked}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={blockedFilter === null ? "secondary" : "outline"}
            size="sm"
            onClick={() => setBlockedFilter(null)}
          >
            All ({counts.total})
          </Button>
          <Button
            variant={blockedFilter === false ? "secondary" : "outline"}
            size="sm"
            onClick={() => setBlockedFilter(false)}
          >
            <ShieldCheck className="h-4 w-4 mr-2 text-green-500" />
            Allowed ({counts.allowed})
          </Button>
          <Button
            variant={blockedFilter === true ? "secondary" : "outline"}
            size="sm"
            onClick={() => setBlockedFilter(true)}
          >
            <ShieldAlert className="h-4 w-4 mr-2 text-red-500" />
            Blocked ({counts.blocked})
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Command</TableHead>
              <TableHead>Container</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No command logs found
                </TableCell>
              </TableRow>
            ) : (
              paginatedLogs.map((log) => (
                <TableRow key={log.id} className={log.blocked ? "bg-red-500/5" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded max-w-[300px] truncate block">
                        {log.command}
                      </code>
                    </div>
                    {log.blocked && log.blockReason && (
                      <p className="text-xs text-red-500 mt-1 ml-6">
                        Blocked: {log.blockReason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.containerName ? (
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{log.containerName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.userName ? (
                      <div>
                        <p className="text-sm">{log.userName}</p>
                        <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.blocked ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="border-0">
                          <ShieldAlert className="h-3 w-3 mr-1" />
                          Blocked
                        </Badge>
                        {log.riskLevel && (
                          <Badge
                            className={`${riskColors[log.riskLevel] || "bg-gray-500"} text-white border-0 text-xs`}
                          >
                            {log.riskLevel}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-0">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Allowed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.category ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.category}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span title={formatDate(log.executedAt)}>
                        {formatTimeAgo(log.executedAt)}
                      </span>
                    </div>
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
    </div>
  );
}
