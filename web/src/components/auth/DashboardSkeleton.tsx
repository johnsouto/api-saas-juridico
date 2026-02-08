export function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
            <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="h-9 w-20 animate-pulse rounded bg-zinc-200" />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-4 md:grid-cols-4">
        <aside className="space-y-2 md:col-span-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded border bg-white" />
          ))}
        </aside>

        <main className="space-y-4 md:col-span-3">
          <div className="rounded-md border bg-white p-4">
            <div className="h-5 w-40 animate-pulse rounded bg-zinc-200" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-zinc-100" />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-md border bg-white p-4">
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                <div className="mt-4 h-8 w-20 animate-pulse rounded bg-zinc-100" />
                <div className="mt-3 h-4 w-28 animate-pulse rounded bg-zinc-100" />
              </div>
            ))}
          </div>

          <div className="rounded-md border bg-white p-4">
            <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 grid grid-cols-1 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 w-full animate-pulse rounded bg-zinc-100" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

