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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, ShieldCheck, User, Clock, AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SimplePagination, PaginationInfo, usePagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface BannedUser {
  id: string;
  name: string | null;
  email: string;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  prohibitedCommandCount: number | null;
}

interface BannedUsersTableProps {
  users: BannedUser[];
}

export function BannedUsersTable({ users }: BannedUsersTableProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems: paginatedUsers,
    totalItems,
    pageSize,
  } = usePagination(users, 10);

  const handleUnban = async (userId: string) => {
    setIsLoading(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/unban`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to unban user");
      }

      toast.success("User unbanned successfully");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unban user");
    } finally {
      setIsLoading(null);
    }
  };

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            No Banned Users
          </CardTitle>
          <CardDescription>
            All users are in good standing. No users have been banned for prohibited commands.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          Banned Users
        </CardTitle>
        <CardDescription>
          Users banned for executing prohibited commands. They need admin approval to be unbanned.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Violations</TableHead>
              <TableHead>Ban Reason</TableHead>
              <TableHead>Ban Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{user.name || "Unknown"}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {user.prohibitedCommandCount ?? 0} violation{(user.prohibitedCommandCount ?? 0) !== 1 ? "s" : ""}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground max-w-xs truncate">
                    {user.banReason || "No reason specified"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {user.banExpires
                      ? formatDistanceToNow(new Date(user.banExpires), { addSuffix: true })
                      : "Permanent"}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading === user.id}
                      >
                        {isLoading === user.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            Unban
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Unban User</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to unban{" "}
                          <strong>{user.name || user.email}</strong>? They will be able
                          to use the terminal again. Their violation count will be reset.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleUnban(user.id)}>
                          Unban User
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

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
  );
}
