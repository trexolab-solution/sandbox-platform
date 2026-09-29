import { PageTableSkeleton } from "@/components/ui/table-skeleton";

export default function UsersLoading() {
  return <PageTableSkeleton rows={8} columns={5} />;
}
