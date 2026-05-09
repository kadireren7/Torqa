/** Lightweight placeholders while motion-heavy chunks load (no client JS). */
export function LandingHeroSkeleton() {
  return (
    <section
      className="relative flex min-h-screen flex-col items-center justify-center bg-black"
      aria-hidden
    >
      <div className="flex flex-col items-center gap-4 px-5">
        <div className="h-6 w-48 animate-pulse rounded-full bg-white/[0.04]" />
        <div className="h-16 w-full max-w-2xl animate-pulse rounded-xl bg-white/[0.03]" />
        <div className="h-6 w-80 animate-pulse rounded-lg bg-white/[0.02]" />
        <div className="mt-4 flex gap-3">
          <div className="h-11 w-36 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-11 w-32 animate-pulse rounded-lg bg-white/[0.03]" />
        </div>
      </div>
    </section>
  );
}

export function LandingPipelineSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8 sm:py-16 lg:py-20" aria-hidden>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted/25 ring-1 ring-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export function LandingDemoSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-6 sm:px-8" aria-hidden>
      <div className="h-52 animate-pulse rounded-2xl bg-muted/25 ring-1 ring-white/[0.04]" />
    </div>
  );
}

export function LandingCtaSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-6 sm:px-8" aria-hidden>
      <div className="h-56 animate-pulse rounded-3xl bg-muted/20 ring-1 ring-white/[0.05]" />
    </div>
  );
}
