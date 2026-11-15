'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { demoUsers, getDemoUserId, resetDemo, setDemoUser } from '@/lib/trade/api';

/** Page frame for trading views. The demo switcher only exists while the mock API is in use. */
export function TradeShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-5">
            <Link href="/" className="rounded-md text-2xl font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              bartr<span aria-hidden="true">.</span>
            </Link>
            <nav aria-label="Trading">
              <Link href="/trade" className="rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">My trades</Link>
            </nav>
          </div>
          <DemoSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}

function DemoSwitcher() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => setUserId(getDemoUserId()), []);
  if (!userId) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Badge variant="secondary">Demo data</Badge>
      <label htmlFor="demo-user" className="text-muted-foreground">Viewing as</label>
      <select
        id="demo-user"
        value={userId}
        onChange={(event) => { setDemoUser(event.target.value); window.location.reload(); }}
        className="h-8 rounded-md border border-input bg-card px-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {demoUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
      </select>
      <Button variant="ghost" size="sm" onClick={() => { resetDemo(); window.location.assign('/trade'); }}>Reset</Button>
    </div>
  );
}

export function PageMessage({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-6 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      {children && <div className="mt-2 text-sm leading-6 text-muted-foreground">{children}</div>}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return <p role="status" className="py-16 text-center text-sm text-muted-foreground">{label}</p>;
}

export function EmptyList({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center text-sm leading-6 text-muted-foreground">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
