import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <Skeleton className="h-12 w-12 mx-auto rounded-lg" />
          <Skeleton className="h-7 w-40 mx-auto" />
          <Skeleton className="h-4 w-56 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="relative py-4">
            <Skeleton className="h-px w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </CardContent>
      </Card>
    </div>
  );
}
