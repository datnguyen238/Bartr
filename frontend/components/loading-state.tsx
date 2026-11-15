export function LoadingState({ label = "Loading Bartr…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-[60vh] max-w-6xl flex-col justify-center px-5 py-16"
    >
      <div className="mb-5 flex items-center gap-3 text-sm text-muted-foreground">
        <span
          aria-hidden="true"
          className="inline-block size-4 animate-spin rounded-full border-2 border-foreground border-t-transparent"
        />
        {label}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-xl border bg-card/60"
          />
        ))}
      </div>
    </div>
  );
}
