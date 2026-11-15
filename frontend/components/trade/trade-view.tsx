'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  acceptTrade, addNote, confirmReceipt, counterTrade, declineTrade, getItems, getOpenOfferCounts, getSession,
  getTrade, getUser, listItems, setHandoffMethod, TradeApiError, withdrawTrade,
} from '@/lib/trade/api';
import { describeFailure, type ActionFailure } from '@/lib/trade/errors';
import { compareValue, totalValue } from '@/lib/trade/format';
import { otherParticipant, termsFor, toTerms } from '@/lib/trade/perspective';
import { OPEN_STATUSES, type HandoffMethod, type Trade, type TradeItem, type TradeUser } from '@/lib/trade/types';
import { cn } from '@/lib/utils';
import { BalanceMeter } from './balance-meter';
import { ArrowLeftIcon } from './icons';
import { ItemRow } from './item-card';
import { NoteField } from './note-field';
import { firstName, TradeBuilder } from './trade-builder';
import { EmptyList, Loading, PageMessage, TradeShell } from './trade-shell';
import { TradeTimeline } from './trade-timeline';

interface Loaded {
  me: TradeUser;
  them: TradeUser;
  trade: Trade;
  items: Map<string, TradeItem>;
  myItems: TradeItem[];
  theirItems: TradeItem[];
  offerCounts: Record<string, number>;
}

type State = { kind: 'loading' } | { kind: 'ready'; data: Loaded } | { kind: 'missing'; message: string };

const UNKNOWN_OUTCOME = 'We couldn’t confirm that action. Reload to check the trade’s current status before trying again.';

async function loadTrade(tradeId: string): Promise<Loaded> {
  const me = await getSession();
  const trade = await getTrade(tradeId);
  const themId = otherParticipant(trade, me.id);
  const referenced = new Set(trade.events.flatMap((e) => ('terms' in e ? [...e.terms.initiatorItemIds, ...e.terms.recipientItemIds] : [])));
  const [them, referencedItems, myItems, theirItems, offerCounts] = await Promise.all([
    getUser(themId), getItems([...referenced]), listItems(me.id), listItems(themId), getOpenOfferCounts(trade.id),
  ]);
  const items = new Map([...referencedItems, ...myItems, ...theirItems].map((item) => [item.id, item]));
  return { me, them, trade, items, myItems, theirItems, offerCounts };
}

function describeStatus(trade: Trade, me: TradeUser, them: TradeUser): { label: string; detail: string; tone: 'action' | 'neutral' | 'closed' } {
  const name = firstName(them);
  const last = [...trade.events].reverse().find((e) => e.type === trade.status);
  const byMe = last && 'authorId' in last && last.authorId === me.id;
  switch (trade.status) {
    case 'proposed':
    case 'countered':
      return trade.turnUserId === me.id
        ? { label: 'Your turn', tone: 'action', detail: `${name} sent ${trade.status === 'countered' ? 'a counter-offer' : 'an offer'}. Accept it, counter, or decline.` }
        : { label: `Waiting for ${name}`, tone: 'neutral', detail: `${name} can accept, counter, or decline. You can withdraw your offer while you wait.` };
    case 'accepted':
      return { label: 'Accepted', tone: 'action', detail: 'Agree on how to hand off the items, then confirm when you’ve received yours.' };
    case 'completed':
      return { label: 'Completed', tone: 'closed', detail: 'You both confirmed you received your items.' };
    case 'declined':
      return { label: 'Declined', tone: 'closed', detail: byMe ? 'You declined this trade.' : `${name} declined this trade.` };
    case 'withdrawn':
      return { label: 'Withdrawn', tone: 'closed', detail: byMe ? 'You withdrew your offer.' : `${name} withdrew their offer.` };
    case 'unavailable':
      return { label: 'Unavailable', tone: 'closed', detail: 'An item in this offer was traded elsewhere or is no longer listed.' };
  }
}

export function TradeView({ tradeId }: { tradeId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [mode, setMode] = useState<'view' | 'counter'>('view');
  const [announcement, setAnnouncement] = useState('');

  const refresh = useCallback(async () => {
    try {
      setState({ kind: 'ready', data: await loadTrade(tradeId) });
    } catch (error) {
      setState({ kind: 'missing', message: error instanceof TradeApiError ? error.message : 'We couldn’t load this trade. Check your connection and try again.' });
    }
  }, [tradeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (state.kind === 'loading') return <TradeShell><Loading label="Loading trade…" /></TradeShell>;
  if (state.kind === 'missing') {
    return (
      <TradeShell>
        <PageMessage title="Trade not found" action={<Button asChild variant="outline"><Link href="/trade">Go to my trades</Link></Button>}>{state.message}</PageMessage>
      </TradeShell>
    );
  }

  const { me, them, trade, items, myItems, theirItems, offerCounts } = state.data;
  const status = describeStatus(trade, me, them);
  const side = termsFor(trade, trade.terms, me.id);
  const lookup = (ids: string[]) => ids.flatMap((id) => items.get(id) ?? []);
  const give = lookup(side.mine);
  const get = lookup(side.theirs);
  const isOpen = OPEN_STATUSES.includes(trade.status);
  const myTurn = isOpen && trade.turnUserId === me.id;
  const name = firstName(them);

  /** Runs a trade mutation, then reloads so the page reflects the authoritative state. */
  async function act(run: () => Promise<unknown>, done: string) {
    await run();
    await refresh();
    setAnnouncement(done);
  }

  const version = { expectedUpdatedAt: trade.updatedAt };

  return (
    <TradeShell>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <div className="mb-8">
        <Link href="/trade" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <ArrowLeftIcon className="size-4" /> My trades
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl leading-tight tracking-tight sm:text-5xl">
            Trade with <span className="font-serif italic">{them.displayName}</span>
          </h1>
          <Badge variant={status.tone === 'action' ? 'default' : status.tone === 'closed' ? 'outline' : 'secondary'} className="text-sm">{status.label}</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">{status.detail}</p>
      </div>

      {mode === 'counter' ? (
        <TradeBuilder
          mode="counter"
          me={me}
          them={them}
          myItems={mergeItems(myItems, give)}
          theirItems={mergeItems(theirItems, get)}
          initial={side}
          offerCounts={offerCounts}
          onCancel={() => setMode('view')}
          onSubmit={async (next, note) => {
            await counterTrade(trade.id, { terms: toTerms(trade, me.id, next), note, ...version });
            setMode('view');
            await refresh();
            setAnnouncement(`Counter-offer sent. Waiting for ${name}.`);
          }}
          myEmpty={<EmptyList>You don’t have any items listed.</EmptyList>}
          theirEmpty={<EmptyList>{name} doesn’t have any items listed.</EmptyList>}
        />
      ) : (
        <div className="grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid content-start gap-8">
            <section aria-labelledby="terms-heading" className="rounded-xl border bg-card p-5">
              <h2 id="terms-heading" className="mb-4 text-lg font-semibold tracking-tight">
                {trade.status === 'accepted' || trade.status === 'completed' ? 'Agreed items' : 'Current offer'}
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">You give</h3>
                  <ul className="grid gap-3">{give.map((item) => <ItemRow key={item.id} item={item} />)}</ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">You get</h3>
                  <ul className="grid gap-3">{get.map((item) => <ItemRow key={item.id} item={item} />)}</ul>
                </div>
              </div>
              <BalanceMeter balance={compareValue(totalValue(give), totalValue(get), name)} className="mt-5" />
            </section>
            <TradeTimeline trade={trade} viewer={me} other={them} items={items} />
          </div>

          <aside className="grid content-start gap-4" aria-label="Trade actions">
            {myTurn && (
              <Card className="gap-4 shadow-none">
                <CardHeader><CardTitle>Respond to {name}</CardTitle></CardHeader>
                <CardContent className="grid gap-2">
                  <ConfirmAction
                    triggerLabel="Accept trade"
                    title="Accept this trade?"
                    confirmLabel="Accept trade"
                    description={`You’ll give ${give.map((i) => i.title).join(', ')} and get ${get.map((i) => i.title).join(', ')}. All of these items will be marked as traded, and other open offers that include them will close. You can’t undo this in the app.`}
                    noteLabel={`Note to ${name} (optional)`}
                    onConfirm={(note) => act(() => acceptTrade(trade.id, { ...version, note }), 'Trade accepted.')}
                  />
                  <Button variant="outline" onClick={() => setMode('counter')}>Counter-offer</Button>
                  <ConfirmAction
                    triggerLabel="Decline"
                    triggerVariant="ghost"
                    title="Decline this trade?"
                    confirmLabel="Decline trade"
                    destructive
                    description={`This closes the trade for both of you. ${name} can start a new one later.`}
                    noteLabel="Reason (optional)"
                    onConfirm={(note) => act(() => declineTrade(trade.id, { ...version, note }), 'Trade declined.')}
                  />
                </CardContent>
              </Card>
            )}

            {isOpen && !myTurn && (
              <Card className="gap-4 shadow-none">
                <CardHeader><CardTitle>Waiting for {name}</CardTitle></CardHeader>
                <CardContent className="grid gap-2">
                  <ConfirmAction
                    triggerLabel="Withdraw offer"
                    triggerVariant="outline"
                    title="Withdraw your offer?"
                    confirmLabel="Withdraw offer"
                    destructive
                    description={`This closes the trade. ${name} will no longer be able to accept it.`}
                    onConfirm={() => act(() => withdrawTrade(trade.id, version), 'Offer withdrawn.')}
                  />
                </CardContent>
              </Card>
            )}

            {(trade.status === 'accepted' || trade.status === 'completed') && (
              <HandoffPanel trade={trade} me={me} them={them} onAct={act} />
            )}

            {(isOpen || trade.status === 'accepted') && (
              <NoteComposer
                label={trade.status === 'accepted' ? `Coordinate with ${name}` : `Message ${name}`}
                onSend={(note) => act(() => addNote(trade.id, { note }), 'Note sent.')}
              />
            )}

            {!isOpen && trade.status !== 'accepted' && (
              <Button asChild variant="outline"><Link href={`/trade/new?with=${them.id}`}>Start a new trade with {name}</Link></Button>
            )}
          </aside>
        </div>
      )}
    </TradeShell>
  );
}

function mergeItems(listed: TradeItem[], inTrade: TradeItem[]) {
  const ids = new Set(listed.map((i) => i.id));
  return [...listed, ...inTrade.filter((i) => !ids.has(i.id))];
}

interface ConfirmActionProps {
  triggerLabel: string;
  triggerVariant?: 'default' | 'outline' | 'ghost';
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  noteLabel?: string;
  onConfirm: (note?: string) => Promise<void>;
}

/** Consequential actions explain their effect in a dialog before anything is sent. */
function ConfirmAction({ triggerLabel, triggerVariant = 'default', title, description, confirmLabel, destructive, noteLabel, onConfirm }: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<ActionFailure | null>(null);

  async function confirm() {
    setSending(true);
    setFailure(null);
    try {
      await onConfirm(note || undefined);
      setOpen(false);
    } catch (error) {
      setFailure(describeFailure(error, UNKNOWN_OUTCOME));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button variant={triggerVariant} onClick={() => { setFailure(null); setOpen(true); }}>{triggerLabel}</Button>
      <Dialog open={open} onOpenChange={(next) => { if (!sending) setOpen(next); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="leading-6">{description}</DialogDescription>
          </DialogHeader>
          {noteLabel && <NoteField id={`note-${confirmLabel.replace(/\s+/g, '-').toLowerCase()}`} label={noteLabel} value={note} onChange={setNote} disabled={sending} />}
          <div role="status" aria-live="polite" className="text-sm">
            {sending && 'Sending…'}
            {failure && <span className="text-destructive">{failure.message}</span>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={sending}>Cancel</Button></DialogClose>
            {failure?.needsReload ? (
              <Button onClick={() => window.location.reload()}>Reload</Button>
            ) : (
              <Button variant={destructive ? 'destructive' : 'default'} onClick={confirm} disabled={sending}>{sending ? 'Sending…' : confirmLabel}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NoteComposer({ label, onSend }: { label: string; onSend: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<ActionFailure | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    setSending(true);
    setFailure(null);
    try {
      await onSend(note);
      setNote('');
    } catch (error) {
      setFailure(describeFailure(error, 'We couldn’t confirm your note was sent. Reload to check before sending it again.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className="grid gap-2 rounded-xl border bg-card p-4">
      <NoteField id="trade-note" label={label} value={note} onChange={setNote} disabled={sending} placeholder="Notes appear in the trade history for both of you." />
      {failure && <p role="alert" className="text-sm text-destructive">{failure.message}</p>}
      <Button type="submit" variant="secondary" disabled={sending || !note.trim()}>{sending ? 'Sending…' : 'Send note'}</Button>
    </form>
  );
}

const HANDOFF_OPTIONS: { value: HandoffMethod; label: string; hint: string }[] = [
  { value: 'meetup', label: 'Meet up', hint: 'Agree on a public place and time in the notes.' },
  { value: 'ship', label: 'Ship', hint: 'Agree on the carrier and who pays postage in the notes.' },
];

function HandoffPanel({ trade, me, them, onAct }: {
  trade: Trade; me: TradeUser; them: TradeUser; onAct: (run: () => Promise<unknown>, done: string) => Promise<void>;
}) {
  const name = firstName(them);
  const [failure, setFailure] = useState<string | null>(null);
  const completed = trade.status === 'completed';
  const iConfirmed = trade.confirmedBy.includes(me.id);
  const theyConfirmed = trade.confirmedBy.includes(them.id);

  async function choose(method: HandoffMethod) {
    setFailure(null);
    try {
      await onAct(() => setHandoffMethod(trade.id, { method }), `Hand-off method set to ${method === 'meetup' ? 'meet up' : 'ship'}.`);
    } catch (error) {
      setFailure(describeFailure(error, UNKNOWN_OUTCOME).message);
    }
  }

  return (
    <Card className="gap-4 shadow-none">
      <CardHeader><CardTitle>{completed ? 'Trade complete' : 'Hand off the items'}</CardTitle></CardHeader>
      <CardContent className="grid gap-5">
        {!completed && (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">How will you exchange?</legend>
            <div className="grid grid-cols-2 gap-2">
              {HANDOFF_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'cursor-pointer rounded-lg border p-3 text-sm font-medium has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50',
                    trade.handoffMethod === option.value && 'border-primary bg-secondary/60',
                  )}
                >
                  <input type="radio" name="handoff" className="sr-only" value={option.value} checked={trade.handoffMethod === option.value} onChange={() => choose(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {HANDOFF_OPTIONS.find((o) => o.value === trade.handoffMethod)?.hint ?? 'Either of you can choose. Use notes to work out the details.'}
            </p>
            {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          </fieldset>
        )}

        {!completed && (
          <div className="grid gap-2 text-sm">
            <ul className="grid gap-1 text-muted-foreground">
              <li>You: {iConfirmed ? 'received items ✓' : 'not confirmed yet'}</li>
              <li>{name}: {theyConfirmed ? 'received items ✓' : 'not confirmed yet'}</li>
            </ul>
            {iConfirmed ? (
              <p className="text-sm">You confirmed. Waiting for {name} to confirm.</p>
            ) : (
              <ConfirmAction
                triggerLabel="I received my items"
                title={`Confirm you received ${name}’s items?`}
                confirmLabel="Confirm receipt"
                description={`Only confirm once you have ${name}’s items in hand. When you both confirm, the trade is marked complete.`}
                onConfirm={() => onAct(() => confirmReceipt(trade.id), theyConfirmed ? 'Trade completed.' : `Receipt confirmed. Waiting for ${name}.`)}
              />
            )}
          </div>
        )}

        {trade.receipt && (
          <div className="grid gap-1.5 border-t pt-4">
            <p className="text-sm font-medium">Trade receipt</p>
            <p className="text-xs leading-5 text-muted-foreground">
              A fingerprint of exactly what was agreed. If the items changed, it would change too, so it can be recorded later to prove the terms.
            </p>
            <code className="block rounded-md bg-secondary px-2 py-1.5 font-mono text-xs break-all" aria-label="Receipt fingerprint">
              {trade.receipt.fingerprint}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

