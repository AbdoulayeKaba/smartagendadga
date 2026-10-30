export function RolesManagementSkeleton() {
  return (
    <div className="admin-theme animate-pulse space-y-5">
      <div className="h-24 rounded-2xl bg-muted/60" />
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,340px)_1fr]">
        <div className="space-y-3">
          <div className="h-10 rounded-lg bg-muted/60" />
          <div className="h-4 w-2/3 rounded bg-muted/40" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/50" />
          ))}
        </div>
        <div className="space-y-4 rounded-2xl border border-border/50 p-5">
          <div className="h-8 w-1/2 rounded bg-muted/60" />
          <div className="h-16 rounded-xl bg-muted/40" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/40" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/30" />
          ))}
        </div>
      </div>
    </div>
  );
}
