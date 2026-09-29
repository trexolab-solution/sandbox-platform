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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  MoreHorizontal,
  Shield,
  ShieldOff,
  Ban,
  CheckCircle,
  Trash2,
  Search,
  UserCog,
  Server,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SimplePagination, PaginationInfo, usePagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sandboxCount: number;
}

interface UsersTableProps {
  users: User[];
  currentUserId: string;
}

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Dialog states
  const [banDialog, setBanDialog] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState<string>("permanent");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedUsers,
    totalItems,
    pageSize,
  } = usePagination(filteredUsers, 10);

  const handleSetRole = async (userId: string, role: "user" | "admin") => {
    // Prevent admin from removing their own admin role
    if (userId === currentUserId && role === "user") {
      toast.error("You cannot remove your own admin privileges");
      return;
    }

    setIsLoading(userId);
    try {
      const result = await authClient.admin.setRole({
        userId,
        role,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast.success(`Role updated to ${role}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    } finally {
      setIsLoading(null);
    }
  };

  const handleBanUser = async () => {
    if (!banDialog.user) return;

    setIsLoading(banDialog.user.id);
    try {
      // Calculate banExpiresIn based on selected duration
      let banExpiresIn: number | undefined;
      if (banDuration !== "permanent") {
        const hours = parseInt(banDuration);
        banExpiresIn = hours * 60 * 60; // Convert hours to seconds
      }

      const result = await authClient.admin.banUser({
        userId: banDialog.user.id,
        banReason: banReason || undefined,
        banExpiresIn,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Revoke all user sessions immediately
      const revokeResult = await authClient.admin.revokeUserSessions({
        userId: banDialog.user.id,
      });

      if (revokeResult.error) {
        console.error("Failed to revoke sessions:", revokeResult.error);
      }

      const durationText = banDuration === "permanent" ? "permanently" : `for ${banDuration} hours`;
      toast.success(`User has been banned ${durationText}`);
      setBanDialog({ open: false, user: null });
      setBanReason("");
      setBanDuration("permanent");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to ban user");
    } finally {
      setIsLoading(null);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    setIsLoading(userId);
    try {
      const result = await authClient.admin.unbanUser({
        userId,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast.success("User has been unbanned");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unban user");
    } finally {
      setIsLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog.user) return;

    setIsLoading(deleteDialog.user.id);
    try {
      const result = await authClient.admin.removeUser({
        userId: deleteDialog.user.id,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast.success("User has been deleted");
      setDeleteDialog({ open: false, user: null });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
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

  return (
    <>
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{filteredUsers.length} users</Badge>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sandboxes</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                <TableRow key={u.id} className={isSelf ? "bg-primary/5" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {u.name}
                          {isSelf && <span className="text-muted-foreground ml-1">(You)</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.role === "admin" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {u.role === "admin" && <Shield className="h-3 w-3 mr-1" />}
                      {u.role || "user"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.banned ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="destructive">
                          <Ban className="h-3 w-3 mr-1" />
                          Banned
                        </Badge>
                        {u.banExpires && (
                          <span className="text-xs text-muted-foreground">
                            Until: {formatDate(u.banExpires)}
                          </span>
                        )}
                      </div>
                    ) : u.emailVerified ? (
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unverified</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Server className="h-3 w-3 text-muted-foreground" />
                      {u.sandboxCount}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isLoading === u.id}
                        >
                          {isLoading === u.id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* Role change - disabled for self if removing admin */}
                        <DropdownMenuItem
                          onClick={() =>
                            handleSetRole(u.id, u.role === "admin" ? "user" : "admin")
                          }
                          disabled={isSelf && u.role === "admin"}
                        >
                          {u.role === "admin" ? (
                            <>
                              <ShieldOff className="h-4 w-4 mr-2" />
                              Remove Admin
                              {isSelf && " (Not allowed)"}
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4 mr-2" />
                              Make Admin
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* Ban actions - disabled for self */}
                        {u.banned ? (
                          <DropdownMenuItem
                            onClick={() => handleUnbanUser(u.id)}
                            disabled={isSelf}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Unban User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => setBanDialog({ open: true, user: u })}
                            disabled={isSelf}
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Ban User
                            {isSelf && " (Not allowed)"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {/* Delete - disabled for self */}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteDialog({ open: true, user: u })}
                          disabled={isSelf}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                          {isSelf && " (Not allowed)"}
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

      {/* Ban Dialog */}
      <Dialog
        open={banDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setBanDialog({ open: false, user: null });
            setBanReason("");
            setBanDuration("permanent");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Ban {banDialog.user?.name} from accessing the platform. They will be logged
              out immediately and all active sessions will be revoked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banDuration">Ban Duration</Label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger id="banDuration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Hour</SelectItem>
                  <SelectItem value="3">3 Hours</SelectItem>
                  <SelectItem value="6">6 Hours</SelectItem>
                  <SelectItem value="12">12 Hours</SelectItem>
                  <SelectItem value="24">24 Hours (1 Day)</SelectItem>
                  <SelectItem value="72">72 Hours (3 Days)</SelectItem>
                  <SelectItem value="168">1 Week</SelectItem>
                  <SelectItem value="336">2 Weeks</SelectItem>
                  <SelectItem value="720">30 Days (1 Month)</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="banReason">Reason (optional)</Label>
              <Textarea
                id="banReason"
                placeholder="Enter reason for ban (e.g., violation of prohibited commands policy)..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBanDialog({ open: false, user: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBanUser}
              disabled={isLoading === banDialog.user?.id}
            >
              {isLoading === banDialog.user?.id && (
                <Spinner className="h-4 w-4 mr-2" />
              )}
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog({ open: false, user: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteDialog.user?.name}? This action
              cannot be undone. All their sandboxes and data will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading === deleteDialog.user?.id && (
                <Spinner className="h-4 w-4 mr-2" />
              )}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
