'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Item, Member, Trade, View } from '@/lib/marketplace';
import { attachNote, getTrade, loadView, seedEnabled, tradeAction, type TradeActionKind } from '@/lib/trade/api';
import { describeFailure, isSignedOut, type ActionFailure } from '@/lib/trade/errors';
import { compareValue, firstName, totalValue } from '@/lib/trade/format';
import { currentOffer, otherParticipant, sideIds, sideItems, termsFingerprint } from '@/lib/trade/perspective';
import { BalanceMeter } from './balance-meter';
import { ItemRow } from './item-card';
import { NoteField, ValueAcknowledgement } from './note-field';
import { TradeBuilder } from './trade-builder';
import { BackLink, EmptyList, Loading, PageMessage, SignedOutMessage } from './trade-shell';
import { TradeTimeline } from './trade-timeline';

const CLOSED = new Set(['completed', 'declined', 'withdrawn', 'invalidated', 'cancelled']);
const UNKNOWN_OUTCOME = 'We couldn’t confirm that action. Reload to check the trade’s current status before trying again.';
const SEED_NOTICE = 'Seed data mode: actions are disabled and nothing is saved.';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; view: View; trade: Trade }
  | { kind: 'signed-out' }
  | { kind: 'missing'; message: string };

type Tone = 'action' | 'neutral' | 'closed';

function describeStatus(trade: Trade, me: string, them: Member): { label: string; detail: string; tone: Tone } {
  const name = firstName(them.name);
  const offer = currentOffer(trade);
  const myTurn = offer.sender !== me;
  const iHandedOff = trade.handoffs.includes(me);
  switch (trade.status) {
    case 'open':
      return myTurn
        ? { label: 'Your turn', tone: 'action', detail: `${name} sent ${offer.version > 1 ? 'a counter-offer' : 'an offer'}. Accept it, counter, or decline.` }
        : { label: `Waiting for ${name}`, tone: 'neutral', detail: `${name} can accept, counter, or decline. You can withdraw your offer while you wait.` };
    case 'agreed':
      return { label: 'Agreed', tone: 'action', detail: 'Every item is reserved. Arrange to meet up or ship, then report the hand-off.' };
    case 'awaiting_handoff':
      return iHandedOff
        ? { label: `Waiting for ${name}`, tone: 'neutral', detail: `You reported the hand-off. The trade completes when ${name} reports it too.` }
        : { label: 'Your turn', tone: 'action', detail: `${name} reported the hand-off. Report yours once you’ve exchanged items.` };
    case 'completed':
      return { label: 'Completed', tone: 'closed', detail: 'Both of you reported the hand-off.' };
    case 'declined':
      return { label: 'Declined', tone: 'closed', detail: offer.sender === me ? `${name} declined your offer.` : 'You declined this offer.' };
    case 'withdrawn':
      return { label: 'Withdrawn', tone: 'closed', detail: offer.sender === me ? 'You withdrew your offer.' : `${name} withdrew their offer.` };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'closed', detail: 'The agreement was cancelled and all items were released.' };
    case 'invalidated':
      return { label: 'No longer valid', tone: 'closed', detail: trade.reason ?? 'An item or member setting changed, so this offer can’t go ahead.' };
    default:
      return { label: trade.status.replaceAll('_', ' '), tone: 'neutral', detail: '' };
  }
}

export function TradeView({ tradeId, noteFailed }: { tradeId: string; noteFailed?: boolean }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [mode, setMode] = useState<'view' | 'counter'>('view');
  const [announcement, setAnnouncement] = useState(noteFailed ? 'Your offer was sent, but the note couldn’t be saved. Add it again below.' : '');

  const refresh = useCallback(async () => {
    try {
      const [view, trade] = await Promise.all([loadView(), getTrade(tradeId)]);
      setState({ kind: 'ready', view, trade });
    } catch (error) {
      if (isSignedOut(error)) setState({ kind: 'signed-out' });
      else setState({ kind: 'missing', message: error instanceof Error ? error.message : 'We couldn’t load this trade.' });
    }
  }, [tradeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (state.kind === 'loading') return <Loading label="Loading trade…" />;
  if (state.kind === 'signed-out') return <SignedOutMessage />;
  if (state.kind === 'missing') {
    return <PageMessage title="Trade not found" action={<Button asChild variant="outline"><Link href="/trades">All trades</Link></Button>}>{state.message}</PageMessage>;
  }

  const { view, trade } = state;
  const me = view.profile.id;
  const themId = otherParticipant(trade, me);
  const them: Member = view.members.find((m) => m.id === themId) ?? { id: themId, name: 'Member', community: '' };
  const name = firstName(them.name);
  const offer = currentOffer(trade);
  const side = sideItems(offer.terms, me);
  const status = describeStatus(trade, me, them);
  const balance = compareValue(totalValue(side.mine), totalValue(side.theirs), name, view.profile.gap_limit);
  const isOpen = trade.status === 'open';
  const myTurn = isOpen && offer.sender !== me;
  const isAgreed = trade.status === 'agreed' || trade.status === 'awaiting_handoff';
  const readOnly = seedEnabled ? SEED_NOTICE : undefined;

  /** Runs a trade action, then reloads so the page shows the recorded outcome. */
  async function act(kind: TradeActionKind, done: string, options: { note?: string; acknowledged?: boolean } = {}) {
    await tradeAction(trade, kind, options);
    await refresh();
    setAnnouncement(done);
  }

  return (
    <div>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <div className="mb-8">
        <BackLink href="/trades">All trades</BackLink>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h2 className="text-3xl leading-tight tracking-tight sm:text-4xl">
            <span className="text-muted-foreground">Trade with</span> <span className="font-semibold">{them.name}</span>
          </h2>
          <Badge variant={status.tone === 'action' ? 'default' : status.tone === 'closed' ? 'outline' : 'secondary'} className="text-sm">{status.label}</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">{status.detail}</p>
        {noteFailed && (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive">
            Your offer was sent, but the note couldn’t be saved. Add it again from the message box.
          </p>
        )}
        {isAgreed && trade.reason && <p className="mt-3 rounded-lg bg-secondary p-3 text-sm">{trade.reason}</p>}
      </div>

      {mode === 'counter' ? (
        <TradeBuilder
          mode="counter"
          them={them}
          myItems={mergeItems(view.items.filter((i) => i.owner === me && i.status === 'available'), side.mine)}
          theirItems={mergeItems(view.items.filter((i) => i.owner === themId && i.status === 'available'), side.theirs)}
          initial={sideIds(offer.terms, me)}
          gapLimit={view.profile.gap_limit}
          readOnlyReason={readOnly}
          onCancel={() => setMode('view')}
          onSubmit={async ({ mine, theirs, note, acknowledged }) => {
            const countered = await tradeAction(trade, 'counter', { left: mine, right: theirs, acknowledged });
            const { noteSaved } = await attachNote(countered, note);
            setMode('view');
            await refresh();
            setAnnouncement(noteSaved ? `Counter-offer sent. Waiting for ${name}.` : 'Counter-offer sent, but the note couldn’t be saved. Add it again below.');
          }}
          myEmpty={<EmptyList>You don’t have any available items.</EmptyList>}
          theirEmpty={<EmptyList>{name} doesn’t have any available items.</EmptyList>}
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid content-start gap-8">
            <section aria-labelledby="terms-heading" className="rounded-xl border bg-card p-5">
              <h3 id="terms-heading" className="mb-4 text-lg font-semibold tracking-tight">
                {isAgreed || trade.status === 'completed' ? 'Agreed items' : `Current offer · version ${offer.version}`}
              </h3>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold">You give</h4>
                  <ul className="grid gap-3">{side.mine.map((item) => <ItemRow key={item.id} item={item} />)}</ul>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">You get</h4>
                  <ul className="grid gap-3">{side.theirs.map((item) => <ItemRow key={item.id} item={item} />)}</ul>
                </div>
              </div>
              <BalanceMeter balance={balance} className="mt-5" />
            </section>
            <TradeTimeline trade={trade} viewerId={me} other={them} />
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
                    description={`You’ll give ${list(side.mine)} and get ${list(side.theirs)}. Accepting records both of your agreement and reserves every item on both sides together until you hand off or cancel.`}
                    acknowledgement={offer.terms.value_warning ? (offer.terms.left_total_minor === null || offer.terms.right_total_minor === null
                      ? 'I understand some values are unknown and want to accept anyway.'
                      : 'I understand the estimated values differ by more than a member’s limit and want to accept anyway.') : undefined}
                    readOnlyReason={readOnly}
                    onConfirm={({ acknowledged }) => act('accept', 'Trade accepted. All items are reserved.', { acknowledged })}
                  />
                  <Button variant="outline" onClick={() => setMode('counter')}>Counter-offer</Button>
                  <ConfirmAction
                    triggerLabel="Decline"
                    triggerVariant="ghost"
                    title="Decline this offer?"
                    confirmLabel="Decline offer"
                    destructive
                    description={`This closes the trade for both of you. ${name} can start a new one later.`}
                    readOnlyReason={readOnly}
                    onConfirm={() => act('decline', 'Offer declined.')}
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
                    readOnlyReason={readOnly}
                    onConfirm={() => act('withdraw', 'Offer withdrawn.')}
                  />
                </CardContent>
              </Card>
            )}

            {(isAgreed || trade.status === 'completed') && (
              <HandoffPanel trade={trade} me={me} them={them} readOnly={readOnly} act={act} />
            )}

            {!CLOSED.has(trade.status) && (
              <NoteComposer
                label={isAgreed ? `Coordinate with ${name}` : `Message ${name}`}
                placeholder={isAgreed ? 'Agree on a public place and time, or the carrier and who pays postage.' : 'Notes appear in the trade history for both of you.'}
                readOnly={readOnly}
                onSend={(note) => act('note', 'Note sent.', { note })}
              />
            )}

            {CLOSED.has(trade.status) && trade.status !== 'completed' && (
              <Button asChild variant="outline"><Link href={`/trades/new?with=${encodeURIComponent(themId)}`}>Start a new trade with {name}</Link></Button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function list(items: Item[]) {
  return items.map((i) => i.title).join(', ');
}

function mergeItems(listed: Item[], inTrade: Item[]) {
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
  /** When set, the user must tick this acknowledgement before confirming. */
  acknowledgement?: string;
  readOnlyReason?: string;
  onConfirm: (input: { acknowledged: boolean }) => Promise<void>;
}

/** Consequential actions explain their effect in a dialog before anything is sent. */
function ConfirmAction({ triggerLabel, triggerVariant = 'default', title, description, confirmLabel, destructive, acknowledgement, readOnlyReason, onConfirm }: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [forceAck, setForceAck] = useState(false);
  const ackText = acknowledgement ?? (forceAck ? 'I understand the values are unknown or uneven and want to continue.' : undefined);

  async function confirm() {
    setSending(true);
    setFailure(null);
    try {
      await onConfirm({ acknowledged: Boolean(ackText) && acknowledged });
      setOpen(false);
    } catch (error) {
      const result = describeFailure(error, UNKNOWN_OUTCOME);
      if (result.needsAcknowledgement) setForceAck(true);
      setFailure(result);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button variant={triggerVariant} onClick={() => { setFailure(null); setAcknowledged(false); setOpen(true); }}>{triggerLabel}</Button>
      <Dialog open={open} onOpenChange={(next) => { if (!sending) setOpen(next); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="leading-6">{description}</DialogDescription>
          </DialogHeader>
          {ackText && (
            <ValueAcknowledgement id={`ack-${confirmLabel.replace(/\s+/g, '-').toLowerCase()}`} checked={acknowledged} onChange={setAcknowledged} disabled={sending}>
              {ackText}
            </ValueAcknowledgement>
          )}
          <div role="status" aria-live="polite" className="text-sm">
            {sending && 'Sending…'}
            {failure && <span className="text-destructive">{failure.message}</span>}
            {readOnlyReason && !failure && <span className="text-muted-foreground">{readOnlyReason}</span>}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={sending}>Cancel</Button></DialogClose>
            {failure?.needsReload ? (
              <Button onClick={() => window.location.reload()}>Reload</Button>
            ) : (
              <Button
                variant={destructive ? 'destructive' : 'default'}
                onClick={confirm}
                disabled={sending || Boolean(readOnlyReason) || (Boolean(ackText) && !acknowledged)}
              >
                {sending ? 'Sending…' : confirmLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NoteComposer({ label, placeholder, readOnly, onSend }: { label: string; placeholder: string; readOnly?: string; onSend: (note: string) => Promise<void> }) {
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
      <NoteField id="trade-note" label={label} value={note} onChange={setNote} disabled={sending || Boolean(readOnly)} placeholder={placeholder} />
      {failure && <p role="alert" className="text-sm text-destructive">{failure.message}</p>}
      {readOnly && <p className="text-xs text-muted-foreground">{readOnly}</p>}
      <Button type="submit" variant="secondary" disabled={sending || !note.trim() || Boolean(readOnly)}>{sending ? 'Sending…' : 'Send note'}</Button>
    </form>
  );
}

function HandoffPanel({ trade, me, them, readOnly, act }: {
  trade: Trade;
  me: string;
  them: Member;
  readOnly?: string;
  act: (kind: TradeActionKind, done: string) => Promise<void>;
}) {
  const name = firstName(them.name);
  const completed = trade.status === 'completed';
  const iHandedOff = trade.handoffs.includes(me);
  const theyHandedOff = trade.handoffs.includes(them.id);
  const iCancelled = trade.cancellations.includes(me);
  const theyCancelled = trade.cancellations.includes(them.id);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    termsFingerprint(trade).then((value) => { if (!cancelled) setFingerprint(value); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [trade]);

  return (
    <Card className="gap-4 shadow-none">
      <CardHeader><CardTitle>{completed ? 'Trade complete' : 'Hand off the items'}</CardTitle></CardHeader>
      <CardContent className="grid gap-5">
        {!completed && (
          <div className="grid gap-3 text-sm">
            <p className="text-muted-foreground">Meet somewhere public, or agree on shipping in the notes. Report the hand-off once you’ve exchanged items.</p>
            <ul className="grid gap-1">
              <li>You: {iHandedOff ? 'reported the hand-off ✓' : 'not reported yet'}</li>
              <li>{name}: {theyHandedOff ? 'reported the hand-off ✓' : 'not reported yet'}</li>
            </ul>
            {iHandedOff ? (
              <p>You reported the hand-off. Waiting for {name}.</p>
            ) : (
              <ConfirmAction
                triggerLabel="Report hand-off"
                title="Report that the hand-off happened?"
                confirmLabel="Report hand-off"
                description={`Only report this once you’ve exchanged items with ${name}. The trade completes when you both report it.`}
                readOnlyReason={readOnly}
                onConfirm={() => act('handoff', theyHandedOff ? 'Trade completed.' : `Hand-off reported. Waiting for ${name}.`)}
              />
            )}
            {iCancelled ? (
              <p className="text-muted-foreground">You asked to cancel. {name} needs to approve because a hand-off was reported.</p>
            ) : (
              <ConfirmAction
                triggerLabel={theyCancelled ? 'Approve cancellation' : 'Cancel agreement'}
                triggerVariant="ghost"
                title={theyCancelled ? 'Approve cancelling this trade?' : 'Cancel this agreement?'}
                confirmLabel={theyCancelled ? 'Approve cancellation' : 'Cancel agreement'}
                destructive
                description={trade.handoffs.length
                  ? `A hand-off was already reported, so both of you must approve. Items stay reserved until ${theyCancelled ? 'you approve' : `${name} approves too`}.`
                  : 'This cancels the agreement for both of you and releases every reserved item.'}
                readOnlyReason={readOnly}
                onConfirm={() => act('cancel', 'Cancellation recorded.')}
              />
            )}
          </div>
        )}

        <div className="grid gap-1.5 border-t pt-4">
          <p className="text-sm font-medium">Trade receipt</p>
          <p className="text-xs leading-5 text-muted-foreground">
            A fingerprint of exactly which items were agreed. If the items changed, it would change too, so it can be recorded later to prove the terms.
          </p>
          <code className="block rounded-md bg-secondary px-2 py-1.5 font-mono text-xs break-all" aria-label="Receipt fingerprint">
            {fingerprint ?? 'Calculating…'}
          </code>
        </div>
      </CardContent>
    </Card>
  );
}
