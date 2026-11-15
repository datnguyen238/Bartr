import type { ReactNode } from 'react';
import type { Item, Member, Offer, Trade } from '@/lib/marketplace';
import { firstName, formatTime } from '@/lib/trade/format';
import { diffItems, sideItems } from '@/lib/trade/perspective';

interface TimelineProps {
  trade: Trade;
  viewerId: string;
  other: Member;
}

type Entry =
  | { kind: 'offer'; at: string; offer: Offer; previous: Offer | null }
  | { kind: 'note'; at: string; sender: string; text: string }
  | { kind: 'outcome'; at: string | null; text: string };

const titles = (items: Item[]) => items.map((i) => i.title || 'Untitled item').join(', ') || 'Nothing';

function outcome(trade: Trade, who: (id: string) => string): string | null {
  const last = trade.offers[trade.offers.length - 1];
  const recipient = trade.participants.find((id) => id !== last.sender) ?? '';
  switch (trade.status) {
    case 'agreed':
    case 'awaiting_handoff':
    case 'completed':
      return `${who(recipient)} accepted offer ${last.version}. All items are reserved.`;
    case 'declined': return `${who(recipient)} declined offer ${last.version}.`;
    case 'withdrawn': return `${who(last.sender)} withdrew offer ${last.version}.`;
    case 'cancelled': return 'The agreement was cancelled and the items were released.';
    case 'invalidated': return `This offer can no longer go ahead${trade.reason ? `: ${trade.reason}` : '.'}`;
    default: return null;
  }
}

export function TradeTimeline({ trade, viewerId, other }: TimelineProps) {
  const who = (id: string) => (id === viewerId ? 'You' : other.name);
  const entries: Entry[] = [
    ...trade.offers.map((offer, index): Entry => ({ kind: 'offer', at: offer.created_at, offer, previous: trade.offers[index - 1] ?? null })),
    ...trade.notes.map((note): Entry => ({ kind: 'note', at: note.created_at, sender: note.sender, text: note.text })),
  ].sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));

  const closing = outcome(trade, who);
  if (closing) entries.push({ kind: 'outcome', at: null, text: closing });
  for (const id of trade.handoffs) entries.push({ kind: 'outcome', at: null, text: `${who(id)} reported the hand-off.` });
  if (trade.status === 'completed') entries.push({ kind: 'outcome', at: null, text: 'Both members reported the hand-off. Trade completed.' });

  return (
    <section aria-labelledby="timeline-heading">
      <h3 id="timeline-heading" className="mb-4 text-lg font-semibold tracking-tight">History</h3>
      <ol className="grid gap-4 border-l pl-5">
        {entries.map((entry, index) => {
          let headline: string;
          let body: ReactNode = null;
          if (entry.kind === 'offer') {
            const { offer, previous } = entry;
            headline = `${who(offer.sender)} ${offer.version === 1 ? 'sent an offer' : `sent counter-offer ${offer.version}`}`;
            const side = sideItems(offer.terms, viewerId);
            let changes: string[] = [];
            if (previous) {
              const before = sideItems(previous.terms, viewerId);
              const mine = diffItems(before.mine, side.mine);
              const theirs = diffItems(before.theirs, side.theirs);
              const theirLabel = `${firstName(other.name)}’s`;
              changes = [
                ...mine.added.map((i) => `+ ${i.title} (yours)`),
                ...mine.removed.map((i) => `− ${i.title} (yours)`),
                ...theirs.added.map((i) => `+ ${i.title} (${theirLabel})`),
                ...theirs.removed.map((i) => `− ${i.title} (${theirLabel})`),
              ];
            }
            body = (
              <div className="mt-2 grid gap-1 text-sm">
                <p><span className="text-muted-foreground">You give:</span> {titles(side.mine)}</p>
                <p><span className="text-muted-foreground">You get:</span> {titles(side.theirs)}</p>
                {changes.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Changes from the previous offer">
                    {changes.map((change) => <li key={change} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{change}</li>)}
                  </ul>
                )}
              </div>
            );
          } else if (entry.kind === 'note') {
            headline = `${who(entry.sender)} added a note`;
            body = (
              <blockquote className={`mt-2 max-w-prose rounded-lg px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${entry.sender === viewerId ? 'bg-primary text-primary-foreground' : 'border bg-card'}`}>
                {entry.text}
              </blockquote>
            );
          } else {
            headline = entry.text;
          }
          return (
            <li key={`${entry.kind}-${index}`} className="relative">
              <span aria-hidden="true" className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-ring" />
              <p className="text-sm font-medium">{headline}</p>
              {entry.at && <p className="text-xs text-muted-foreground"><time dateTime={entry.at}>{formatTime(entry.at)}</time></p>}
              {body}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
