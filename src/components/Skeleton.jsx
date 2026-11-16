function Skeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-blush/60 ${className}`}
    />
  );
}

// Patient directory loading state
export function ListSkeleton({ rows = 5 }) {
  return (
    <div role="status" aria-busy="true" className="space-y-2">
      <span className="sr-only">Loading patients</span>

      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="w-full flex items-center gap-3 bg-white rounded-xl p-4"
        >
          <Skeleton className="h-[42px] w-[42px] rounded-full shrink-0" />

          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>

          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// Appointment loading state
export function AppointmentListSkeleton({ rows = 3, showActions = false }) {
  return (
    <div role="status" aria-busy="true" className="divide-y divide-sand">
      <span className="sr-only">Loading appointments</span>

      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-1">
              <Skeleton className="h-4 w-12" />

              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>

            <Skeleton className="h-6 w-20 rounded-full" />
          </div>

          {showActions && (
            <div className="flex gap-3 mt-4">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
