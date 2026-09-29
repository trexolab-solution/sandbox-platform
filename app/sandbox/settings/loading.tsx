import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SettingsLoading() {
  return (
    <ScrollArea className="h-full">
      <div className="container max-w-3xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Settings Cards */}
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center justify-between py-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
