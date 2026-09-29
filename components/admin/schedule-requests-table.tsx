"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  User,
  Server,
  Filter,
  Search,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { SimplePagination, PaginationInfo, usePagination } from "@/components/ui/pagination";

interface ScheduleRequest {
  id: string;
  containerId: string;
  containerName: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: "pending" | "approved" | "denied" | "cancelled" | "expired";
  scheduleType: "once" | "daily" | "weekly" | "custom";
  startTime: string;
  endTime: string | null;
  daysOfWeek: string[] | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  timezone: string;
  reason: string;
  adminNotes: string | null;
  denialReason: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
}

const statusConfig = {
  pending: { className: "bg-amber-500/15 text-amber-600 border-amber-500/20 hover:bg-amber-500/20" },
  approved: { className: "bg-green-500/15 text-green-600 border-green-500/20 hover:bg-green-500/20" },
  denied: { className: "bg-red-500/15 text-red-600 border-red-500/20 hover:bg-red-500/20" },
  cancelled: { className: "bg-gray-500/15 text-gray-600 border-gray-500/20 hover:bg-gray-500/20" },
  expired: { className: "bg-gray-500/15 text-gray-600 border-gray-500/20 hover:bg-gray-500/20" },
} as const;

export function ScheduleRequestsTable() {
  const router = useRouter();
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    request: ScheduleRequest | null;
    action: "approve" | "deny" | null;
  }>({ open: false, request: null, action: null });
  const [adminNotes, setAdminNotes] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch("/api/admin/schedule-requests");
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      toast.error("Failed to load schedule requests");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!reviewDialog.request) return;

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/admin/schedule-requests/${reviewDialog.request.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminNotes }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Schedule request approved");
        setReviewDialog({ open: false, request: null, action: null });
        setAdminNotes("");
        fetchRequests();
        router.refresh();
      } else {
        toast.error(data.error || "Failed to approve request");
      }
    } catch (error) {
      toast.error("Failed to approve request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!reviewDialog.request) return;

    if (!denialReason.trim()) {
      toast.error("Please provide a denial reason");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/admin/schedule-requests/${reviewDialog.request.id}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ denialReason }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Schedule request denied");
        setReviewDialog({ open: false, request: null, action: null });
        setDenialReason("");
        fetchRequests();
        router.refresh();
      } else {
        toast.error(data.error || "Failed to deny request");
      }
    } catch (error) {
      toast.error("Failed to deny request");
    } finally {
      setSubmitting(false);
    }
  };

  const openReviewDialog = (
    request: ScheduleRequest,
    action: "approve" | "deny"
  ) => {
    setReviewDialog({ open: true, request, action });
    setAdminNotes("");
    setDenialReason("");
  };

  const formatDaysOfWeek = (days: string[] | null) => {
    if (!days || days.length === 0) return "N/A";
    const dayAbbreviations: Record<string, string> = {
      monday: "Mon",
      tuesday: "Tue",
      wednesday: "Wed",
      thursday: "Thu",
      friday: "Fri",
      saturday: "Sat",
      sunday: "Sun",
    };
    return days.map((d) => dayAbbreviations[d] || d).join(", ");
  };

  // Filter requests
  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.containerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.reason.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || request.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    totalItems,
    pageSize,
  } = usePagination(filteredRequests, 20);

  // Statistics
  const stats = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    denied: requests.filter((r) => r.status === "denied").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Denied
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.denied}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user, container, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule Requests</CardTitle>
            <CardDescription>
              Review and manage sandbox schedule requests from users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Sandbox</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No schedule requests found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{request.userName}</span>
                            <span className="text-xs text-muted-foreground">
                              {request.userEmail}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {request.containerName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit">
                              {request.scheduleType}
                            </Badge>
                            {request.scheduleType === "weekly" && (
                              <span className="text-xs text-muted-foreground">
                                {formatDaysOfWeek(request.daysOfWeek)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>
                              {request.startTime}
                              {request.endTime && ` - ${request.endTime}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {request.timezone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="text-sm line-clamp-2">
                            {request.reason}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig[request.status].className}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {request.status === "pending" && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openReviewDialog(request, "approve")}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openReviewDialog(request, "deny")}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Deny
                              </Button>
                            </div>
                          )}
                          {request.status === "approved" && request.adminNotes && (
                            <span className="text-xs text-muted-foreground">
                              {request.adminNotes}
                            </span>
                          )}
                          {request.status === "denied" && request.denialReason && (
                            <span className="text-xs text-destructive">
                              {request.denialReason}
                            </span>
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
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setReviewDialog({ open: false, request: null, action: null });
            setAdminNotes("");
            setDenialReason("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === "approve" ? "Approve" : "Deny"} Schedule
              Request
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.action === "approve"
                ? "Confirm that you want to approve this schedule request"
                : "Provide a reason for denying this schedule request"}
            </DialogDescription>
          </DialogHeader>

          {reviewDialog.request && (
            <div className="space-y-4">
              {/* Request Details */}
              <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium">User:</span>{" "}
                    {reviewDialog.request.userName}
                  </div>
                  <div>
                    <span className="font-medium">Sandbox:</span>{" "}
                    {reviewDialog.request.containerName}
                  </div>
                  <div>
                    <span className="font-medium">Schedule Type:</span>{" "}
                    {reviewDialog.request.scheduleType}
                  </div>
                  <div>
                    <span className="font-medium">Time:</span>{" "}
                    {reviewDialog.request.startTime}
                    {reviewDialog.request.endTime &&
                      ` - ${reviewDialog.request.endTime}`}
                  </div>
                  {reviewDialog.request.scheduleType === "weekly" && (
                    <div>
                      <span className="font-medium">Days:</span>{" "}
                      {formatDaysOfWeek(reviewDialog.request.daysOfWeek)}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Timezone:</span>{" "}
                    {reviewDialog.request.timezone}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-sm">Reason:</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {reviewDialog.request.reason}
                  </p>
                </div>
              </div>

              {/* Admin Input */}
              {reviewDialog.action === "approve" ? (
                <div className="space-y-2">
                  <Label htmlFor="adminNotes">Admin Notes (Optional)</Label>
                  <Textarea
                    id="adminNotes"
                    placeholder="Add any notes for the user..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="denialReason">
                    Denial Reason <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="denialReason"
                    placeholder="Explain why this request is being denied..."
                    value={denialReason}
                    onChange={(e) => setDenialReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialog({ open: false, request: null, action: null });
                setAdminNotes("");
                setDenialReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant={reviewDialog.action === "approve" ? "default" : "destructive"}
              onClick={
                reviewDialog.action === "approve" ? handleApprove : handleDeny
              }
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Processing...
                </>
              ) : reviewDialog.action === "approve" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve Request
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Deny Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
