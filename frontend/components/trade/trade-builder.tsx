'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { describeFailure, type ActionFailure } from '@/lib/trade/errors';
import { compareValue, formatValue, pluralize, totalValue } from '@/lib/trade/format';
import { sameIds, type SideTerms } from '@/lib/trade/perspective';
import type { TradeItem, TradeUser } from '@/lib/trade/types';
import { cn } from '@/lib/utils';
import { BalanceMeter } from './balance-meter';
import { SwapIcon } from './icons';
import { ItemRow } from './item-card';
import { ItemPicker } from './item-picker';
import { NoteField } from './note-field';

interface TradeBuilderProps {
  mode: 'propose' | 'counter';
  me: TradeUser;
  them: TradeUser;
  myItems: TradeItem[];
  theirItems: TradeItem[];
  initial: SideTerms;
  offerCounts: Record<string, number>;
  onSubmit: (side: SideTerms, note: string) => Promise<void>;
  onCancel?: () => void;
  myEmpty: ReactNode;
  theirEmpty: ReactNode;
}

type Side = 'mine' | 'theirs';

export function firstName(user: TradeUser) {
  return user.displayName.split(' ')[0];
}

export function TradeBuilder({ mode, them, myItems, theirItems, initial, offerCounts, onSubmit, onCancel, myEmpty, theirEmpty }: TradeBuilderProps) {
  const [mine, setMine] = useState<Set<string>>(() => new Set(initial.mine));
  const [theirs, setTheirs] = useState<Set<string>>(() => new Set(initial.theirs));
  const [activeSide, setActiveSide] = useState<Side>('theirs');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const theirName = firstName(them);

  const myItemsById = useMemo(() => new Map(myItems.map((i) => [i.id, i])), [myItems]);
  const theirItemsById = useMemo(() => new Map(theirItems.map((i) => [i.id, i])), [theirItems]);
  const give = [...mine].flatMap((id) => myItemsById.get(id) ?? []);
  const get = [...theirs].flatMap((id) => theirItemsById.get(id) ?? []);
  const balance = compareValue(totalValue(give), totalValue(get), theirName);
  const hasUnavailable = [...give, ...get].some((item) => item.status !== 'available');

  let blockedReason: string | null = null;
  if (myItems.length === 0) blockedReason = 'Add items to your Profile to make an offer.';
  else if (get.length === 0) blockedReason = `Select at least one of ${theirName}’s items.`;
  else if (give.length === 0) blockedReason = 'Select at least one of your items.';
  else if (hasUnavailable) blockedReason = 'Remove items that are no longer available.';
  else if (mode === 'counter' && sameIds([...mine], initial.mine) && sameIds([...theirs], initial.theirs)) {
    blockedReason = 'Change at least one item to send a counter-offer.';
  }

  function toggle(side: Side, id: string) {
    const current = side === 'mine' ? mine : theirs;
    const next = new Set(current);
    const removing = next.has(id);
    if (removing) next.delete(id);
    else next.add(id);
    (side === 'mine' ? setMine : setTheirs)(next);
    const title = (side === 'mine' ? myItemsById : theirItemsById).get(id)?.title ?? 'Item';
    const owner = side === 'mine' ? 'your side' : `${theirName}’s side`;
    setAnnouncement(`${title} ${removing ? 'removed from' : 'added to'} ${owner}. ${pluralize(next.size, 'item')} selected there.`);
  }

  async function send() {
    setSending(true);
    setFailure(null);
    try {
      await onSubmit({ mine: [...mine], theirs: [...theirs] }, note);
    } catch (error) {
      setFailure(describeFailure(error, 'We couldn’t confirm your offer was sent. Check your trades before sending it again.'));
      setSending(false);
    }
  }

  const sendLabel = mode === 'propose' ? 'Send offer' : 'Send counter-offer';

  return (
    <div className="grid gap-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 lg:hidden" role="group" aria-label="Choose which list to show">
        {(['theirs', 'mine'] as const).map((side) => (
          <button
            key={side}
            type="button"
            aria-pressed={activeSide === side}
            onClick={() => setActiveSide(side)}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              activeSide === side ? 'bg-card shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {side === 'theirs' ? `${theirName}’s items (${get.length})` : `Your items (${give.length})`}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <ItemPicker
          id="pick-mine"
          heading="Your items"
          description="What you’ll give"
          items={myItems}
          selectedIds={mine}
          onToggle={(id) => toggle('mine', id)}
          offerCounts={offerCounts}
          empty={myEmpty}
          hiddenOnMobile={activeSide !== 'mine'}
        />
        <ItemPicker
          id="pick-theirs"
          heading={`${theirName}’s items`}
          description="What you’ll get"
          items={theirItems}
          selectedIds={theirs}
          onToggle={(id) => toggle('theirs', id)}
          offerCounts={offerCounts}
          empty={theirEmpty}
          hiddenOnMobile={activeSide !== 'theirs'}
        />
      </div>

      {/* Reserved for a future assistant that suggests a counter-offer the user can apply and edit. */}

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <dl className="flex items-center gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">You give</dt>
              <dd className="font-medium">{pluralize(give.length, 'item')} · {formatValue(balance.give)}</dd>
            </div>
            <SwapIcon className="size-4 text-muted-foreground" />
            <div>
              <dt className="text-xs text-muted-foreground">You get</dt>
              <dd className="font-medium">{pluralize(get.length, 'item')} · {formatValue(balance.get)}</dd>
            </div>
          </dl>
          <BalanceMeter balance={balance} className="hidden w-64 md:grid" />
          <div className="flex w-full items-center gap-3 sm:w-auto">
            {blockedReason && <p id="review-blocked" className="flex-1 text-xs text-muted-foreground sm:max-w-48 sm:text-right">{blockedReason}</p>}
            {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
            <Button
              className={cn(!blockedReason && 'flex-1 sm:flex-none')}
              disabled={Boolean(blockedReason)}
              aria-describedby={blockedReason ? 'review-blocked' : undefined}
              onClick={() => { setFailure(null); setReviewOpen(true); }}
            >
              Review {mode === 'counter' ? 'counter-offer' : 'offer'}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={reviewOpen} onOpenChange={(open) => { if (!sending) setReviewOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'propose' ? `Review your offer to ${theirName}` : `Review your counter-offer`}</DialogTitle>
            <DialogDescription>Check both sides before you send.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">You give</h3>
              <ul className="grid gap-2">{give.map((item) => <ItemRow key={item.id} item={item} />)}</ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">You get</h3>
              <ul className="grid gap-2">{get.map((item) => <ItemRow key={item.id} item={item} />)}</ul>
            </div>
          </div>
          <BalanceMeter balance={balance} />
          <NoteField
            id="offer-note"
            label={`Note to ${theirName} (optional)`}
            value={note}
            onChange={setNote}
            placeholder="Add context, like condition details or when you’re free to meet."
            disabled={sending}
          />
          <p className="rounded-lg bg-secondary p-3 text-sm leading-6">
            {mode === 'propose'
              ? `${theirName} can accept, counter, or decline. Nothing is final until one of you accepts. You can withdraw this offer while you wait.`
              : `This replaces the current offer. ${theirName} can accept it, counter again, or decline.`}{' '}
            If it’s accepted, these items are marked as traded and other open offers that include them close.
          </p>
          <div role="status" aria-live="polite" className="text-sm">
            {sending && 'Sending…'}
            {failure && <span className="text-destructive">{failure.message}</span>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={sending}>Keep editing</Button>
            </DialogClose>
            {failure?.needsReload ? (
              <Button onClick={() => window.location.reload()}>Reload</Button>
            ) : (
              <Button onClick={send} disabled={sending}>{sending ? 'Sending…' : sendLabel}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
