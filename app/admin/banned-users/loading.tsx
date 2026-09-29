import { PageTableSkeleton } from "@/components/ui/table-skeleton";

export default function BannedUsersLoading() {
  return <PageTableSkeleton rows={5} columns={5} />;
}
