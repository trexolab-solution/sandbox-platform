import { PageTableSkeleton } from "@/components/ui/table-skeleton";

export default function SecurityAlertsLoading() {
  return <PageTableSkeleton rows={6} columns={5} />;
}
