import { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-server";
import { ScheduleRequestsTable } from "@/components/admin/schedule-requests-table";
import { Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Schedule Requests - Admin",
  description: "Manage sandbox schedule requests and approvals",
};

export default async function ScheduleRequestsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Schedule Requests</h1>
          <p className="text-sm text-muted-foreground">
            Review and manage sandbox scheduling requests from users
          </p>
        </div>
      </div>

      <ScheduleRequestsTable />
    </div>
  );
}
