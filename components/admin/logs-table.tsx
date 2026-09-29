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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FileText,
  User,
  Server,
  Shield,
  Clock,
  Globe,
  Search,
} from "lucide-react";
import { SimplePagination, PaginationInfo, usePagination } from "@/components/ui/pagination";

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
}

interface LogsTableProps {
  logs: AuditLog[];
}

const actionColors: Record<string, string> = {
  create: "bg-green-500",
  update: "bg-blue-500",
  delete: "bg-red-500",
  start: "bg-emerald-500",
  stop: "bg-orange-500",
  login: "bg-purple-500",
  logout: "bg-gray-500",
};

const resourceIcons: Record<string, React.ReactNode> = {
  container: <Server className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  session: <Shield className="h-4 w-4" />,
};

export function LogsTable({ logs }: LogsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ipAddress?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = !actionFilter || log.action === actionFilter;
    return matchesSearch && matchesAction;
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
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const uniqueActions = [...new Set(logs.map((log) => log.action))];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={actionFilter === null ? "secondary" : "outline"}
            size="sm"
            onClick={() => setActionFilter(null)}
          >
            All ({logs.length})
          </Button>
          {uniqueActions.slice(0, 5).map((action) => (
            <Button
              key={action}
              variant={actionFilter === action ? "secondary" : "outline"}
              size="sm"
              onClick={() => setActionFilter(action)}
            >
              <div
                className={`h-2 w-2 rounded-full mr-2 ${actionColors[action] || "bg-gray-500"}`}
              />
              {action}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              paginatedLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {formatDate(log.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.userName ? (
                      <div>
                        <p className="font-medium text-sm">{log.userName}</p>
                        <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${actionColors[log.action] || "bg-gray-500"} text-white border-0 capitalize`}
                    >
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {resourceIcons[log.resourceType] || <FileText className="h-4 w-4" />}
                      <div>
                        <p className="text-sm capitalize">{log.resourceType}</p>
                        {log.resourceId && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {log.resourceId.substring(0, 8)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.ipAddress ? (
                      <div className="flex items-center gap-1 text-muted-foreground text-sm">
                        <Globe className="h-3 w-3" />
                        {log.ipAddress}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
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
