import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Split View */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel */}
        <div className="flex-1 border-r p-4">
          <div className="h-full border rounded-lg bg-card flex items-center justify-center">
            <div className="text-center space-y-3">
              <Skeleton className="h-12 w-12 mx-auto rounded-lg" />
              <Skeleton className="h-5 w-32 mx-auto" />
              <Skeleton className="h-4 w-48 mx-auto" />
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 p-4">
          <div className="h-full border rounded-lg bg-card flex items-center justify-center">
            <div className="text-center space-y-3">
              <Skeleton className="h-12 w-12 mx-auto rounded-lg" />
              <Skeleton className="h-5 w-32 mx-auto" />
              <Skeleton className="h-4 w-48 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
