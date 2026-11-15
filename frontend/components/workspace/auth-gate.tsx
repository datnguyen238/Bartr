"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./provider";

export function AuthGate({ children }: { children: ReactNode }) {
  const { sessionStatus, retrySession, busy } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (sessionStatus === "anonymous") router.replace(`/home?next=${encodeURIComponent(pathname)}`);
  }, [sessionStatus, pathname, router]);
  if (sessionStatus === "authenticated") return children;
  if (sessionStatus === "unavailable") return (
    <section className="surface-panel max-w-xl space-y-4">
      <h1 className="screen-title">Session unavailable</h1>
      <p className="text-sm text-muted-foreground">We couldn’t check your account. Try again when the connection is available.</p>
      <Button disabled={busy} onClick={() => void retrySession()}>Retry session</Button>
    </section>
  );
  return <section aria-busy="true" className="max-w-2xl"><p role="status" className="screen-description">{sessionStatus === "checking" ? "Checking your session…" : "Opening sign-in…"}</p><div className="mt-6 space-y-4" aria-hidden="true"><div className="h-8 w-2/3 rounded-lg bg-secondary" /><div className="h-44 rounded-2xl bg-secondary" /></div></section>;
}
