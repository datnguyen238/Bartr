"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { Brand } from "@/components/brand";
import {
  Compass,
  Handshake,
  Package,
  Sliders,
} from "@/components/icons";
import { useMarketplace } from "@/components/marketplace-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/trades", label: "Trades", icon: Handshake },
  { href: "/preferences", label: "Preferences", icon: Sliders },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { view, logout, busy } = useMarketplace();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand href="/discover" />
          <nav aria-label="Marketplace" className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {view && (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm leading-5 font-medium">{view.profile.name}</p>
                <p className="text-xs leading-4 text-muted-foreground">
                  {view.profile.community}
                </p>
              </div>
              <Avatar name={view.profile.name} className="size-9 text-xs" />
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  void logout()
                    .then(() => router.push("/"))
                    .catch(() => undefined);
                }}
              >
                Sign out
              </Button>
            </div>
          )}
        </div>
        <div className="border-t md:hidden">
          <nav
            aria-label="Marketplace"
            className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-3 py-2"
          >
            {navigation.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Bartr records participant reports. It does not verify physical handoff
            or adjudicate disputes.
          </p>
          <p>
            Estimates only · No cash or payment is exchanged ·{" "}
            <Link href="/" className="underline underline-offset-4 hover:text-foreground">
              About Bartr
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
