'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Item, Member } from '@/lib/marketplace';
import { MAX_ITEMS_PER_SIDE } from '@/lib/trade/api';
import { describeFailure, type ActionFailure } from '@/lib/trade/errors';
import { compareValue, firstName, formatValue, pluralize, totalValue } from '@/lib/trade/format';
import { sameIds } from '@/lib/trade/perspective';
import { cn } from '@/lib/utils';
import { BalanceMeter } from './balance-meter';
import { SwapIcon } from './icons';
import { ItemRow } from './item-card';
import { ItemPicker } from './item-picker';
import { NoteField, ValueAcknowledgement } from './note-field';

export interface BuilderSubmission {
  mine: string[];
  theirs: string[];
  note: string;
  acknowledged: boolean;
}

interface TradeBuilderProps {
  mode: 'propose' | 'counter';
  them: Member;
  myItems: Item[];
  theirItems: Item[];
  initial: { mine: string[]; theirs: string[] };
  /** The viewer's own value-gap limit (percent). The other member's limit is checked by the server. */
  gapLimit: number;
  onSubmit: (submission: BuilderSubmission) => Promise<void>;
  onCancel?: () => void;
  myEmpty: ReactNode;
  theirEmpty: ReactNode;
  /** Explains why sending is disabled, e.g. in seed-data mode. */
  readOnlyReason?: string;
}

type Side = 'mine' | 'theirs';

export function TradeBuilder({ mode, them, myItems, theirItems, initial, gapLimit, onSubmit, onCancel, myEmpty, theirEmpty, readOnlyReason }: TradeBuilderProps) {
  const [mine, setMine] = useState<Set<string>>(() => new Set(initial.mine));
  const [theirs, setTheirs] = useState<Set<string>>(() => new Set(initial.theirs));
  const [activeSide, setActiveSide] = useState<Side>('theirs');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [note, setNote] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [serverWantsAck, setServerWantsAck] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const theirName = firstName(them.name);

  const myItemsById = useMemo(() => new Map(myItems.map((i) => [i.id, i])), [myItems]);
  const theirItemsById = useMemo(() => new Map(theirItems.map((i) => [i.id, i])), [theirItems]);
  const give = [...mine].flatMap((id) => myItemsById.get(id) ?? []);
  const get = [...theirs].flatMap((id) => theirItemsById.get(id) ?? []);
  const balance = compareValue(totalValue(give), totalValue(get), theirName, gapLimit);
  const hasUnavailable = [...give, ...get].some((item) => item.status !== 'available');
  const showAck = (balance.warning && give.length > 0 && get.length > 0) || serverWantsAck;

  let blockedReason: string | null = null;
  if (myItems.length === 0) blockedReason = 'Publish an item in your inventory to make an offer.';
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
    else if (next.size >= MAX_ITEMS_PER_SIDE) return;
    else next.add(id);
    (side === 'mine' ? setMine : setTheirs)(next);
    setAcknowledged(false);
    const title = (side === 'mine' ? myItemsById : theirItemsById).get(id)?.title ?? 'Item';
    const owner = side === 'mine' ? 'your side' : `${theirName}’s side`;
    setAnnouncement(`${title} ${removing ? 'removed from' : 'added to'} ${owner}. ${pluralize(next.size, 'item')} selected there.`);
  }

  async function send() {
    setSending(true);
    setFailure(null);
    try {
      await onSubmit({ mine: [...mine], theirs: [...theirs], note, acknowledged: showAck && acknowledged });
    } catch (error) {
      const result = describeFailure(error, 'We couldn’t confirm your offer was sent. Reload and check your trades before sending it again.');
      if (result.needsAcknowledgement) setServerWantsAck(true);
      setFailure(result);
      setSending(false);
    }
  }

  const sendLabel = mode === 'propose' ? 'Send offer' : 'Send counter-offer';

  return (
    <div className="grid min-w-0 gap-5">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 lg:hidden" role="group" aria-label="Choose which list to show">
        {(['theirs', 'mine'] as const).map((side) => (
          <Button
            key={side}
            type="button"
            variant="ghost"
            aria-pressed={activeSide === side}
            onClick={() => setActiveSide(side)}
            className={cn(
              'h-auto min-h-10 min-w-0 rounded-md px-3 py-2 text-sm font-medium whitespace-normal',
              activeSide === side ? 'bg-card shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {side === 'theirs' ? `${theirName}’s items (${get.length})` : `Your items (${give.length})`}
          </Button>
        ))}
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-6">
        <ItemPicker
          id="pick-mine"
          heading="Your items"
          description="What you’ll give"
          items={myItems}
          selectedIds={mine}
          onToggle={(id) => toggle('mine', id)}
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
          empty={theirEmpty}
          hiddenOnMobile={activeSide !== 'theirs'}
        />
      </div>

      {/* Reserved for a future assistant that suggests a counter-offer the user can apply and edit. */}

      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 rounded-xl border bg-card p-4 md:bottom-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <dl className="flex min-w-0 flex-wrap items-center gap-4 text-sm tabular-nums">
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
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            {blockedReason && <p id="review-blocked" className="w-full text-xs leading-5 text-muted-foreground sm:w-auto sm:max-w-48 sm:text-right">{blockedReason}</p>}
            {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
            <Button
              className="flex-1 sm:flex-none"
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{mode === 'propose' ? `Review your offer to ${theirName}` : 'Review your counter-offer'}</DialogTitle>
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
          {showAck && (
            <ValueAcknowledgement id="offer-ack" checked={acknowledged} onChange={setAcknowledged} disabled={sending}>
              {balance.give === null || balance.get === null
                ? 'I understand some values are unknown and want to send this offer anyway.'
                : 'I understand the estimated values differ by more than a member’s limit and want to send this offer anyway.'}
            </ValueAcknowledgement>
          )}
          <NoteField
            id="offer-note"
            label={`Note to ${theirName} (optional)`}
            value={note}
            onChange={setNote}
            placeholder={mode === 'counter' ? 'Explain what you changed and why.' : 'Add context, like condition details or when you’re free to meet.'}
            disabled={sending}
          />
          <p className="rounded-lg bg-secondary p-3 text-sm leading-6">
            {mode === 'propose'
              ? `Sending records your agreement to these exact items. ${theirName} can accept, counter, or decline, and you can withdraw while you wait.`
              : `This replaces the current offer and records only your agreement. ${theirName} can accept it, counter again, or decline.`}{' '}
            Nothing is reserved until the other member accepts; then every item on both sides is reserved together.
          </p>
          <div role="status" aria-live="polite" className="text-sm">
            {sending && 'Sending…'}
            {failure && <span className="text-destructive">{failure.message}</span>}
            {readOnlyReason && !failure && <span className="text-muted-foreground">{readOnlyReason}</span>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={sending}>Keep editing</Button>
            </DialogClose>
            {failure?.needsReload ? (
              <Button onClick={() => window.location.reload()}>Reload</Button>
            ) : (
              <Button onClick={send} disabled={sending || Boolean(readOnlyReason) || (showAck && !acknowledged)}>
                {sending ? 'Sending…' : sendLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
