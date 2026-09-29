import { PageTableSkeleton } from "@/components/ui/table-skeleton";

export default function ScheduleRequestsLoading() {
  return <PageTableSkeleton rows={6} columns={6} />;
}
