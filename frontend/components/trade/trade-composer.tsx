'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getOpenOfferCounts, getSession, getUser, listItems, proposeTrade, TradeApiError } from '@/lib/trade/api';
import type { TradeItem, TradeUser } from '@/lib/trade/types';
import { ArrowLeftIcon } from './icons';
import { firstName, TradeBuilder } from './trade-builder';
import { EmptyList, Loading, PageMessage, TradeShell } from './trade-shell';

interface Loaded {
  me: TradeUser;
  them: TradeUser;
  myItems: TradeItem[];
  theirItems: TradeItem[];
  offerCounts: Record<string, number>;
}

type State = { kind: 'loading' } | { kind: 'ready'; data: Loaded } | { kind: 'self' } | { kind: 'missing'; message: string };

export function TradeComposer({ withUserId, preselectItemId }: { withUserId?: string; preselectItemId?: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!withUserId) throw new TradeApiError('not-found', 'Choose someone to trade with from the Landing page.');
        const me = await getSession();
        if (me.id === withUserId) {
          if (!cancelled) setState({ kind: 'self' });
          return;
        }
        const [them, myItems, theirItems, offerCounts] = await Promise.all([
          getUser(withUserId), listItems(me.id), listItems(withUserId), getOpenOfferCounts(),
        ]);
        if (!cancelled) setState({ kind: 'ready', data: { me, them, myItems, theirItems, offerCounts } });
      } catch (error) {
        const message = error instanceof TradeApiError ? error.message : 'We couldn’t load this page. Check your connection and try again.';
        if (!cancelled) setState({ kind: 'missing', message });
      }
    })();
    return () => { cancelled = true; };
  }, [withUserId]);

  const browse = <Button asChild variant="outline"><Link href="/">Back to browsing</Link></Button>;

  if (state.kind === 'loading') return <TradeShell><Loading label="Loading items…" /></TradeShell>;
  if (state.kind === 'self') {
    return <TradeShell><PageMessage title="That’s your own profile" action={browse}>You can’t trade with yourself. Pick someone else’s item to start a trade.</PageMessage></TradeShell>;
  }
  if (state.kind === 'missing') {
    return <TradeShell><PageMessage title="Can’t start this trade" action={browse}>{state.message}</PageMessage></TradeShell>;
  }

  const { me, them, myItems, theirItems, offerCounts } = state.data;
  const preselected = theirItems.find((item) => item.id === preselectItemId && item.status === 'available');

  return (
    <TradeShell>
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <ArrowLeftIcon className="size-4" /> Back to browsing
        </Link>
        <h1 className="mt-4 text-4xl leading-tight tracking-tight sm:text-5xl">
          Trade with <span className="font-serif italic">{them.displayName}</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          {them.location && <>{them.location} · </>}Pick what you’ll give and what you’d like. Values are estimates from each listing.
        </p>
      </div>
      <TradeBuilder
        mode="propose"
        me={me}
        them={them}
        myItems={myItems}
        theirItems={theirItems}
        initial={{ mine: [], theirs: preselected ? [preselected.id] : [] }}
        offerCounts={offerCounts}
        onSubmit={async (side, note) => {
          const trade = await proposeTrade({ recipientId: them.id, terms: { initiatorItemIds: side.mine, recipientItemIds: side.theirs }, note });
          router.push(`/trade/${trade.id}`);
        }}
        myEmpty={
          <EmptyList action={<Button asChild size="sm" variant="outline"><Link href="/profile">Add items on your Profile</Link></Button>}>
            You haven’t listed anything yet. You can look through {firstName(them)}’s items, but you need at least one of your own to make an offer.
          </EmptyList>
        }
        theirEmpty={
          <EmptyList action={<Button asChild size="sm" variant="outline"><Link href="/">Browse other items</Link></Button>}>
            {firstName(them)} hasn’t listed any items yet.
          </EmptyList>
        }
      />
    </TradeShell>
  );
}
