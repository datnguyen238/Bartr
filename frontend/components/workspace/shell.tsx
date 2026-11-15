"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/marketplace";
import { useWorkspace } from "./provider";

const publicPaths = ["/", "/sign-in", "/register", "/login"];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { view, hasSession, anonymous, seeded, tab, busy, message, error, loading, run, load, setView, setResults, setMessage } = useWorkspace();
  const pathname = usePathname();
  if (publicPaths.includes(pathname)) return <>{children}</>;
  if (loading)
    return (
      <main className="p-10" role="status">
        Loading Bartr…
      </main>
    );
  if (!hasSession && !seeded)
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-16">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{anonymous ? "Sign in to continue" : "Bartr could not load your data"}</CardTitle>
            <CardDescription>
              {anonymous
                ? "Your profile, inventory, preferences and private trade history are available after sign-in."
                : "Check that the backend is running, then try again. No saved data has been changed."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {anonymous ? (
              <>
                <Button asChild>
                  <Link href={`/sign-in?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/register">Create an account</Link>
                </Button>
              </>
            ) : (
              <Button
                disabled={busy}
                onClick={() => {
                  run(async () => {
                    await load();
                  });
                }}
              >
                Try again
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <a className="text-2xl font-semibold tracking-tight" href="/">
            bartr.
          </a>
          {hasSession && (
            <div className="flex items-center gap-3 text-sm">
              <span>
                {view.profile.name} · {view.profile.community}
              </span>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("auth/logout", "POST", {});
                    setView(null);
                    setResults(null);
                    setMessage("Signed out.");
                    window.location.assign("/");
                  })
                }
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
        {seeded && <p className="mb-5 rounded-lg border bg-secondary p-4 text-sm">Fictional frontend seed data — not a signed-in account, saved inventory, or live AI result. Backend actions are disabled.</p>}
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
        {!seeded && view?.storage === "temporary-memory" && (
          <p className="mb-5 rounded-lg border bg-secondary p-4 text-sm">
            Temporary memory storage is explicitly enabled. Accounts and
            listings are real within this local session, but disappear when the
            backend restarts. Configure MongoDB Atlas for saved data.
          </p>
        )}
        {!seeded && view?.storage === "temporary-json" && (
          <p className="mb-5 rounded-lg border bg-secondary p-4 text-sm">
            Temporary JSON storage is explicitly enabled for local testing.
            Records survive a backend restart, but this single-process file is
            not production storage or DynamoDB. Configure a reviewed database
            adapter before deployment.
          </p>
        )}
        <>
            <nav
              className="mb-7 flex flex-wrap gap-2 border-b pb-4"
              aria-label="Workspace"
            >
              {["inventory", "discover", "trades", "preferences"].map((t) => (
                <Button
                  key={t}
                  variant={tab === t ? "default" : "ghost"}
                  aria-current={tab === t ? "page" : undefined}
                  asChild
                >
                  <Link href={`/${t}`}>{t[0].toUpperCase() + t.slice(1)}</Link>
                </Button>
              ))}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await load();
                    setMessage("Loaded the latest saved state.");
                  })
                }
              >
                Reload saved state
              </Button>
            </nav>
          {children}
        </>
      </main>
    </div>
  );
}
