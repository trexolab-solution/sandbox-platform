import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ContainerLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header Skeleton */}
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 md:px-6 py-3 border-b shrink-0">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <Skeleton className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 sm:h-6 w-40" />
            <Skeleton className="h-3 w-24 hidden sm:block" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar Skeleton - hidden on mobile */}
        <div className="w-72 border-r shrink-0 hidden lg:block">
          <div className="p-4 space-y-4">
            {/* Resources Card */}
            <Card className="py-0 gap-0">
              <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 space-y-4">
                <Skeleton className="h-3 w-24" />
                {/* Resource items */}
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                ))}
                {/* Network stats */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>

            {/* Runtimes Card */}
            <Card className="py-0 gap-0">
              <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-4" />
                </div>
              </CardHeader>
            </Card>

            {/* Port Mappings Card */}
            <Card className="py-0 gap-0">
              <CardHeader className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-4 w-4" />
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* File Manager Area Skeleton */}
        <div className="flex-1 min-w-0 min-h-0 p-3 sm:p-4 md:p-6">
          <div className="h-full border rounded-lg overflow-hidden bg-card">
            {/* File Manager Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>

            {/* File List */}
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded-lg"
                >
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16 ml-auto" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
