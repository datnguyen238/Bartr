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
    <section className="max-w-xl space-y-4">
      <h2 className="text-2xl font-semibold">Session unavailable</h2>
      <p className="text-sm text-muted-foreground">We couldn’t check your account. Try again when the connection is available.</p>
      <Button disabled={busy} onClick={() => void retrySession()}>Retry session</Button>
    </section>
  );
  return <p role="status">{sessionStatus === "checking" ? "Checking your session…" : "Opening sign-in…"}</p>;
}
