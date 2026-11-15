import type { ReactNode } from 'react';
import { formatTime } from '@/lib/trade/format';
import { diffIds, termsFor } from '@/lib/trade/perspective';
import type { Trade, TradeEvent, TradeItem, TradeTerms, TradeUser } from '@/lib/trade/types';

interface TimelineProps {
  trade: Trade;
  viewer: TradeUser;
  other: TradeUser;
  items: Map<string, TradeItem>;
}

function names(ids: string[], items: Map<string, TradeItem>) {
  return ids.map((id) => items.get(id)?.title ?? 'Unlisted item').join(', ') || 'Nothing';
}

function headline(event: TradeEvent, who: (id: string) => string): string {
  switch (event.type) {
    case 'offer': return `${who(event.authorId)} sent an offer`;
    case 'counter': return `${who(event.authorId)} sent a counter-offer`;
    case 'note': return `${who(event.authorId)} added a note`;
    case 'accepted': return `${who(event.authorId)} accepted the trade`;
    case 'declined': return `${who(event.authorId)} declined the trade`;
    case 'withdrawn': return `${who(event.authorId)} withdrew the offer`;
    case 'handoff-method': return `${who(event.authorId)} chose ${event.method === 'meetup' ? 'meeting up' : 'shipping'}`;
    case 'receipt-confirmed': {
      const author = who(event.authorId);
      return author === 'You' ? 'You confirmed you received your items' : `${author} confirmed they received their items`;
    }
    case 'completed': return 'Trade completed';
    case 'unavailable': return `Trade closed: ${event.reason}`;
  }
}

export function TradeTimeline({ trade, viewer, other, items }: TimelineProps) {
  const who = (id: string) => (id === viewer.id ? 'You' : other.displayName);
  let previousTerms: TradeTerms | null = null;

  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="mb-4 text-lg font-semibold tracking-tight">History</h2>
      <ol className="grid gap-4 border-l pl-5">
        {trade.events.map((event) => {
          let details: ReactNode = null;
          if (event.type === 'offer' || event.type === 'counter') {
            const side = termsFor(trade, event.terms, viewer.id);
            let changes: string[] = [];
            if (previousTerms) {
              const before = termsFor(trade, previousTerms, viewer.id);
              const mine = diffIds(before.mine, side.mine);
              const theirs = diffIds(before.theirs, side.theirs);
              changes = [
                ...mine.added.map((id) => `+ ${names([id], items)} (yours)`),
                ...mine.removed.map((id) => `− ${names([id], items)} (yours)`),
                ...theirs.added.map((id) => `+ ${names([id], items)} (${other.displayName.split(' ')[0]}’s)`),
                ...theirs.removed.map((id) => `− ${names([id], items)} (${other.displayName.split(' ')[0]}’s)`),
              ];
            }
            previousTerms = event.terms;
            details = (
              <div className="mt-2 grid gap-1 text-sm">
                <p><span className="text-muted-foreground">You give:</span> {names(side.mine, items)}</p>
                <p><span className="text-muted-foreground">You get:</span> {names(side.theirs, items)}</p>
                {changes.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Changes from the previous offer">
                    {changes.map((change) => <li key={change} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{change}</li>)}
                  </ul>
                )}
              </div>
            );
          }
          const note = 'note' in event ? event.note : undefined;
          const authorId = 'authorId' in event ? event.authorId : null;
          return (
            <li key={event.id} className="relative">
              <span aria-hidden="true" className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-ring" />
              <p className="text-sm font-medium">{headline(event, who)}</p>
              <p className="text-xs text-muted-foreground"><time dateTime={event.at}>{formatTime(event.at)}</time></p>
              {details}
              {note && (
                <blockquote className={`mt-2 max-w-prose rounded-lg px-3 py-2 text-sm leading-6 ${authorId === viewer.id ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>
                  {note}
                </blockquote>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
