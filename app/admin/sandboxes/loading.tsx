import { PageTableSkeleton } from "@/components/ui/table-skeleton";

export default function SandboxesLoading() {
  return <PageTableSkeleton rows={8} columns={6} />;
}
