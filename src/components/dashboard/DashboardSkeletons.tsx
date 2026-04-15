import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KPISkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border-none shadow-sm rounded-2xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-[120px] mb-2" />
            <Skeleton className="h-4 w-[180px]" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white">
      <CardHeader>
        <Skeleton className="h-6 w-[200px] mb-2" />
        <Skeleton className="h-4 w-[300px]" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[350px] w-full" />
      </CardContent>
    </Card>
  );
}

export function TableSkeleton() {
  return (
    <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
      <CardContent className="p-0">
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ReconciliationSkeleton() {
  return (
    <Card className="border-none shadow-xl shadow-gray-200/50 rounded-2xl bg-white overflow-hidden">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-[300px] mb-2" />
        <Skeleton className="h-4 w-[200px]" />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </CardContent>
    </Card>
  );
}
