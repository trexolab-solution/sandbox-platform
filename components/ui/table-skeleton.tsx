import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface TableSkeletonProps {
  /** Number of rows to show */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Whether to show a search bar */
  showSearch?: boolean;
  /** Whether to show filter buttons */
  showFilters?: boolean;
  /** Whether to show pagination */
  showPagination?: boolean;
  /** Page title */
  title?: boolean;
  /** Description below title */
  description?: boolean;
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  showSearch = true,
  showFilters = true,
  showPagination = true,
  title = true,
  description = true,
}: TableSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      {(title || description) && (
        <div className="space-y-2">
          {title && <Skeleton className="h-8 w-48" />}
          {description && <Skeleton className="h-4 w-96 max-w-full" />}
        </div>
      )}

      {/* Search and Filters */}
      {(showSearch || showFilters) && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {showSearch && <Skeleton className="h-9 w-full sm:w-72" />}
          {showFilters && (
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Header */}
              <thead>
                <tr className="border-b">
                  {[...Array(columns)].map((_, i) => (
                    <th key={i} className="px-4 py-3 text-left">
                      <Skeleton className="h-4 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              {/* Body */}
              <tbody>
                {[...Array(rows)].map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-b last:border-0">
                    {[...Array(columns)].map((_, colIndex) => (
                      <td key={colIndex} className="px-4 py-3">
                        <Skeleton
                          className={`h-4 ${
                            colIndex === 0 ? "w-32" : colIndex === columns - 1 ? "w-20" : "w-24"
                          }`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Full page table loading skeleton with container padding
 */
export function PageTableSkeleton(props: TableSkeletonProps) {
  return (
    <div className="container max-w-7xl mx-auto px-4 md:px-6 py-6">
      <TableSkeleton {...props} />
    </div>
  );
}
