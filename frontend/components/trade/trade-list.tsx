'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { demoUsers, getSession, listMyTrades } from '@/lib/trade/api';
import { formatTime } from '@/lib/trade/format';
import { otherParticipant } from '@/lib/trade/perspective';
import { OPEN_STATUSES, type Trade, type TradeUser } from '@/lib/trade/types';
import { EmptyList, Loading, TradeShell } from './trade-shell';

const STATUS_LABELS: Record<Trade['status'], string> = {
  proposed: 'Offer sent', countered: 'Countered', accepted: 'Accepted', completed: 'Completed',
  declined: 'Declined', withdrawn: 'Withdrawn', unavailable: 'Unavailable',
};

/** Minimal list of the viewer's trades so the demo flow can be revisited. */
export function TradeList() {
  const [data, setData] = useState<{ me: TradeUser; trades: Trade[] } | null>(null);

  useEffect(() => {
    void (async () => setData({ me: await getSession(), trades: await listMyTrades() }))();
  }, []);

  if (!data) return <TradeShell><Loading label="Loading your trades…" /></TradeShell>;
  const others = demoUsers.filter((u) => u.id !== data.me.id);
  const nameOf = (id: string) => demoUsers.find((u) => u.id === id)?.displayName ?? 'Someone';

  return (
    <TradeShell>
      <h1 className="text-4xl tracking-tight sm:text-5xl"><span className="font-semibold">My trades</span></h1>
      <div className="mt-8 grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="trades-heading">
          <h2 id="trades-heading" className="sr-only">Trades</h2>
          {data.trades.length === 0 ? (
            <EmptyList>No trades yet. Start one from someone’s items.</EmptyList>
          ) : (
            <ul className="grid gap-2">
              {data.trades.map((trade) => {
                const yourTurn = OPEN_STATUSES.includes(trade.status) && trade.turnUserId === data.me.id;
                return (
                  <li key={trade.id}>
                    <Link href={`/trade/${trade.id}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 outline-none hover:border-ring/70 focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      <span>
                        <span className="block font-medium">Trade with {nameOf(otherParticipant(trade, data.me.id))}</span>
                        <span className="block text-xs text-muted-foreground">Updated {formatTime(trade.updatedAt)}</span>
                      </span>
                      <Badge variant={yourTurn ? 'default' : 'secondary'}>{yourTurn ? 'Your turn' : STATUS_LABELS[trade.status]}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside className="grid content-start gap-2 rounded-xl border border-dashed p-4" aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="text-sm font-semibold">Start a demo trade</h2>
          <p className="text-xs leading-5 text-muted-foreground">Stands in for the Landing page until it links here.</p>
          {others.map((user) => (
            <Button key={user.id} asChild variant="outline" size="sm">
              <Link href={`/trade/new?with=${user.id}`}>Trade with {user.displayName}</Link>
            </Button>
          ))}
        </aside>
      </div>
    </TradeShell>
  );
}
