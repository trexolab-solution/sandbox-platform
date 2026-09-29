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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  PlayCircle,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  Download,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SimplePagination, PaginationInfo, usePagination } from "@/components/ui/pagination";
import { formatDistanceToNow } from "date-fns";

interface BugReport {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  pageUrl: string | null;
  userAgent: string | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

interface BugReportsTableProps {
  reports: BugReport[];
}

const statusConfig = {
  open: { label: "Open", color: "bg-yellow-500", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-500", icon: PlayCircle },
  resolved: { label: "Resolved", color: "bg-green-500", icon: CheckCircle },
  closed: { label: "Closed", color: "bg-gray-500", icon: XCircle },
  wont_fix: { label: "Won't Fix", color: "bg-gray-400", icon: XCircle },
};

const priorityConfig = {
  low: { label: "Low", color: "bg-gray-500" },
  medium: { label: "Medium", color: "bg-yellow-500" },
  high: { label: "High", color: "bg-orange-500" },
  critical: { label: "Critical", color: "bg-red-500" },
};

const categoryConfig = {
  ui: { label: "UI", color: "bg-purple-500" },
  functionality: { label: "Functionality", color: "bg-blue-500" },
  performance: { label: "Performance", color: "bg-orange-500" },
  security: { label: "Security", color: "bg-red-500" },
  other: { label: "Other", color: "bg-gray-500" },
};

export function BugReportsTable({ reports }: BugReportsTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    status: "",
    priority: "",
    adminNotes: "",
  });

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || report.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedReports,
    totalItems,
    pageSize,
  } = usePagination(filteredReports, 10);

  const handleView = (report: BugReport) => {
    setSelectedReport(report);
    setViewDialogOpen(true);
  };

  const handleEdit = (report: BugReport) => {
    setSelectedReport(report);
    setEditForm({
      status: report.status,
      priority: report.priority,
      adminNotes: report.adminNotes || "",
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (report: BugReport) => {
    setSelectedReport(report);
    setDeleteDialogOpen(true);
  };

  const confirmEdit = async () => {
    if (!selectedReport) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/bug-reports/${selectedReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) throw new Error("Failed to update bug report");

      toast.success("Bug report updated");
      setEditDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to update bug report");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedReport) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/bug-reports/${selectedReport.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete bug report");

      toast.success("Bug report deleted");
      setDeleteDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete bug report");
    } finally {
      setIsLoading(false);
    }
  };

  const quickStatusChange = async (report: BugReport, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/bug-reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      toast.success(`Status changed to ${statusConfig[newStatus as keyof typeof statusConfig]?.label}`);
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleExport = () => {
    const includeResolved = statusFilter === "all" || statusFilter === "resolved";
    const url = `/api/admin/bug-reports/export?format=markdown&status=${statusFilter}&includeResolved=${includeResolved}`;
    window.open(url, "_blank");
    toast.success("Exporting bug reports...");
  };

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No bug reports found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedReports.map((report) => {
                const status = statusConfig[report.status as keyof typeof statusConfig];
                const priority = priorityConfig[report.priority as keyof typeof priorityConfig];
                const category = categoryConfig[report.category as keyof typeof categoryConfig];

                return (
                  <TableRow key={report.id}>
                    <TableCell className="max-w-[300px]">
                      <div className="font-medium truncate">{report.title}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {report.description.slice(0, 100)}...
                      </div>
                    </TableCell>
                    <TableCell>
                      {report.userName ? (
                        <div>
                          <div className="font-medium">{report.userName}</div>
                          <div className="text-sm text-muted-foreground">{report.userEmail}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Anonymous</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${category.color} text-white border-0`}>
                        {category.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${priority.color} text-white border-0`}>
                        {priority.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${status.color} text-white border-0`}>
                        <status.icon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleView(report)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(report)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Edit / Update
                          </DropdownMenuItem>
                          {report.pageUrl && (
                            <DropdownMenuItem asChild>
                              <a href={report.pageUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Page
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Quick Status
                          </DropdownMenuLabel>
                          {report.status !== "in_progress" && (
                            <DropdownMenuItem onClick={() => quickStatusChange(report, "in_progress")}>
                              <PlayCircle className="mr-2 h-4 w-4 text-blue-500" />
                              Mark In Progress
                            </DropdownMenuItem>
                          )}
                          {report.status !== "resolved" && (
                            <DropdownMenuItem onClick={() => quickStatusChange(report, "resolved")}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                              Mark Resolved
                            </DropdownMenuItem>
                          )}
                          {report.status !== "closed" && (
                            <DropdownMenuItem onClick={() => quickStatusChange(report, "closed")}>
                              <XCircle className="mr-2 h-4 w-4 text-gray-500" />
                              Close
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(report)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
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
        <div className="flex items-center justify-between mt-4">
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

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden p-0">
          <ScrollArea className="max-h-[80vh] p-6">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
            <DialogDescription>
              Submitted {selectedReport && formatDistanceToNow(new Date(selectedReport.createdAt), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge className={`${categoryConfig[selectedReport.category as keyof typeof categoryConfig]?.color} text-white`}>
                  {categoryConfig[selectedReport.category as keyof typeof categoryConfig]?.label}
                </Badge>
                <Badge className={`${priorityConfig[selectedReport.priority as keyof typeof priorityConfig]?.color} text-white`}>
                  {priorityConfig[selectedReport.priority as keyof typeof priorityConfig]?.label}
                </Badge>
                <Badge className={`${statusConfig[selectedReport.status as keyof typeof statusConfig]?.color} text-white`}>
                  {statusConfig[selectedReport.status as keyof typeof statusConfig]?.label}
                </Badge>
              </div>

              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selectedReport.description}</p>
              </div>

              {selectedReport.pageUrl && (
                <div>
                  <Label className="text-muted-foreground">Page URL</Label>
                  <p className="mt-1 text-sm">
                    <a href={selectedReport.pageUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {selectedReport.pageUrl}
                    </a>
                  </p>
                </div>
              )}

              {selectedReport.userAgent && (
                <div>
                  <Label className="text-muted-foreground">User Agent</Label>
                  <p className="mt-1 text-xs font-mono text-muted-foreground break-all">
                    {selectedReport.userAgent}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Reporter</Label>
                <p className="mt-1 text-sm">
                  {selectedReport.userName ? (
                    <>
                      {selectedReport.userName} ({selectedReport.userEmail})
                    </>
                  ) : (
                    "Anonymous"
                  )}
                </p>
              </div>

              {selectedReport.adminNotes && (
                <div>
                  <Label className="text-muted-foreground">Admin Notes</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                    {selectedReport.adminNotes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => { setViewDialogOpen(false); handleEdit(selectedReport!); }}>
              Edit
            </Button>
          </DialogFooter>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Bug Report</DialogTitle>
            <DialogDescription>
              Update the status and add notes for this bug report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Admin Notes</Label>
              <Textarea
                value={editForm.adminNotes}
                onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })}
                placeholder="Add internal notes about this bug report..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={confirmEdit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bug Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bug report? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
