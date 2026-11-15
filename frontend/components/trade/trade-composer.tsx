'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Item, Member, View } from '@/lib/marketplace';
import { attachNote, loadView, proposeTrade, seedEnabled } from '@/lib/trade/api';
import { isSignedOut } from '@/lib/trade/errors';
import { firstName } from '@/lib/trade/format';
import { TradeBuilder } from './trade-builder';
import { BackLink, EmptyList, Loading, PageMessage, SignedOutMessage } from './trade-shell';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; view: View; them: Member; myItems: Item[]; theirItems: Item[] }
  | { kind: 'signed-out' }
  | { kind: 'problem'; title: string; message: string };

const SEED_NOTICE = 'Seed data mode: sending is disabled and nothing is saved.';

export function TradeComposer({ withUserId, preselectItemId }: { withUserId?: string; preselectItemId?: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const view = await loadView();
        const me = view.profile.id;
        let next: State;
        if (!withUserId) next = { kind: 'problem', title: 'Choose someone to trade with', message: 'Open a trade from an item or a member’s profile.' };
        else if (withUserId === me) next = { kind: 'problem', title: 'That’s you', message: 'You can’t trade with yourself. Pick someone else’s item to start a trade.' };
        else {
          const them = view.members.find((m) => m.id === withUserId);
          next = them
            ? {
                kind: 'ready',
                view,
                them,
                myItems: view.items.filter((i) => i.owner === me && i.status === 'available'),
                theirItems: view.items.filter((i) => i.owner === them.id && i.status === 'available'),
              }
            : { kind: 'problem', title: 'Member not found', message: 'This member is no longer available.' };
        }
        if (!cancelled) setState(next);
      } catch (error) {
        if (cancelled) return;
        setState(isSignedOut(error) ? { kind: 'signed-out' } : { kind: 'problem', title: 'Couldn’t load this page', message: 'Check your connection and reload.' });
      }
    })();
    return () => { cancelled = true; };
  }, [withUserId]);

  const discover = <Button asChild variant="outline"><Link href="/discover">Discover items</Link></Button>;

  if (state.kind === 'loading') return <Loading label="Loading items…" />;
  if (state.kind === 'signed-out') return <SignedOutMessage />;
  if (state.kind === 'problem') return <PageMessage title={state.title} action={discover}>{state.message}</PageMessage>;

  const { view, them, myItems, theirItems } = state;
  const preselected = theirItems.find((item) => item.id === preselectItemId);
  const name = firstName(them.name);

  return (
    <div className="min-w-0 space-y-5">
      <div className="space-y-3">
        <BackLink href="/trades">All trades</BackLink>
        <h1 className="screen-title break-words">Trade with {them.name}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Pick up to three items on each side. Values are estimates from each listing.
        </p>
      </div>
      <TradeBuilder
        mode="propose"
        them={them}
        myItems={myItems}
        theirItems={theirItems}
        initial={{ mine: [], theirs: preselected ? [preselected.id] : [] }}
        gapLimit={view.profile.gap_limit}
        readOnlyReason={seedEnabled ? SEED_NOTICE : undefined}
        onSubmit={async ({ mine, theirs, note, acknowledged }) => {
          const trade = await proposeTrade({ other: them.id, left: mine, right: theirs, acknowledged });
          const { noteSaved } = await attachNote(trade, note);
          router.push(`/trades/${trade.id}${noteSaved ? '' : '?note=failed'}`);
        }}
        myEmpty={
          <EmptyList action={<Button asChild size="sm" variant="outline"><Link href="/inventory">Go to your inventory</Link></Button>}>
            You don’t have any published items. You can look through {name}’s items, but you need at least one of your own to make an offer.
          </EmptyList>
        }
        theirEmpty={<EmptyList action={discover}>{name} doesn’t have any available items right now.</EmptyList>}
      />
    </div>
  );
}
