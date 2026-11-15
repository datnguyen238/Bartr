"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./provider";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { view, hasSession, seeded, busy, message, error, signOut } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link className="text-2xl font-semibold tracking-tight" href="/home">
            bartr.
          </Link>
          {hasSession && (
            <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm">
              <span className="break-words [overflow-wrap:anywhere]">
                {view.profile.name} · {view.profile.community}
              </span>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  try { await signOut(); router.replace("/home"); }
                  catch { /* The provider keeps the session and explains the failure. */ }
                }}
              >
                Sign out
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="py-10">
          <p className="mb-3 text-sm text-muted-foreground">
            Less unused. More possibility.
          </p>
          <h1 className="text-4xl leading-tight tracking-tight sm:text-5xl">
            What you have.
            <br />
            <span className="font-serif italic">What comes next.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
            Discover combinations worth trading. Your items, your preferences,
            your decision.
          </p>
        </div>
        {seeded && <p className="mb-5 rounded-lg border bg-secondary p-4 text-sm">Sample data preview — these accounts and items are fictional. Sign-in and saving are disabled.</p>}
        <div aria-live="polite" role="status">
          {busy && (
            <p className="mb-4 text-sm">
              Working… Your saved data stays in place.
            </p>
          )}
          {message && (
            <p className="mb-5 rounded-lg bg-secondary p-4 text-sm">
              {message}
            </p>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {hasSession && !seeded && view?.storage === "temporary-memory" && (
          <p className="mb-5 rounded-lg border bg-secondary p-4 text-sm">
            This preview uses temporary storage. Accounts and listings
            disappear when the service restarts.
          </p>
        )}
        <>
            <nav
              className="mb-7 flex flex-wrap gap-2 border-b pb-4"
              aria-label="Main navigation"
            >
              {[["/home", "Home"], ["/profile", "Profile"], ["/trade", "Trade"]].map(([href, label]) => {
                const active = pathname === href || (href === "/profile" && pathname.startsWith("/profile/"));
                return (
                <Button
                  key={href}
                  variant={active ? "default" : "ghost"}
                  aria-current={active ? "page" : undefined}
                  asChild
                >
                  <Link href={href}>{label}</Link>
                </Button>
                );
              })}
            </nav>
          {children}
        </>
      </main>
    </div>
  );
}
