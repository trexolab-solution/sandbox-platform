import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function NewSandboxLoading() {
  return (
    <ScrollArea className="h-full">
      <div className="container max-w-3xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>

        {/* Wizard Card */}
        <Card>
          <CardHeader>
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  {i < 3 && <Skeleton className="h-0.5 w-12 sm:w-24 mx-2" />}
                </div>
              ))}
            </div>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between pt-4 border-t">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
