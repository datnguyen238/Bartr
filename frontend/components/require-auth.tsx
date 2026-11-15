"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/loading-state";
import { useMarketplace } from "@/components/marketplace-provider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { view, phase, problem, refresh } = useMarketplace();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (phase === "anonymous") {
      const next = pathname && pathname !== "/" ? pathname : "/discover";
      router.replace(`/sign-in?next=${encodeURIComponent(next)}`);
    }
  }, [phase, pathname, router]);

  if (view) return <>{children}</>;
  if (phase === "loading" || phase === "anonymous") return <LoadingState />;

  return (
    <div className="mx-auto max-w-lg px-5 py-20">
      <div className="rounded-xl border bg-card p-7">
        <p className="caption mb-3">Connection problem</p>
        <h1 className="font-display text-3xl">Bartr could not load your data.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {problem ||
            "Check that the backend is running, then try again. No saved data has been changed."}
        </p>
        <Button
          className="mt-6"
          onClick={() => {
            void refresh().catch(() => undefined);
          }}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
