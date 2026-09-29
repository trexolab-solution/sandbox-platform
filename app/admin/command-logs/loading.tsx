import { PageTableSkeleton } from "@/components/ui/table-skeleton";

export default function CommandLogsLoading() {
  return <PageTableSkeleton rows={10} columns={5} />;
}
