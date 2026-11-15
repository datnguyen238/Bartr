'use client';

import { Badge } from '@/components/ui/badge';
import { CONDITION_LABELS, formatValue } from '@/lib/trade/format';
import type { TradeItem } from '@/lib/trade/types';
import { cn } from '@/lib/utils';
import { CheckIcon } from './icons';

export function ItemThumb({ item, className }: { item: TradeItem; className?: string }) {
  if (item.imageUrl) {
    return <img src={item.imageUrl} alt="" className={cn('size-14 shrink-0 rounded-lg object-cover', className)} />;
  }
  return (
    <span aria-hidden="true" className={cn('grid size-14 shrink-0 place-items-center rounded-lg bg-secondary font-serif text-xl text-secondary-foreground italic', className)}>
      {item.title.charAt(0)}
    </span>
  );
}

function statusLabel(item: TradeItem): string | null {
  if (item.status === 'traded') return 'Already traded';
  if (item.status === 'removed') return 'No longer listed';
  return null;
}

interface SelectableItemCardProps {
  item: TradeItem;
  selected: boolean;
  onToggle: (id: string) => void;
  /** Number of other open offers that include this item. */
  otherOffers?: number;
}

export function SelectableItemCard({ item, selected, onToggle, otherOffers = 0 }: SelectableItemCardProps) {
  const unavailable = statusLabel(item);
  // A selected item that became unavailable stays deselectable so the user can fix the offer.
  const disabled = Boolean(unavailable) && !selected;
  const inputId = `item-${item.id}`;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'relative flex h-full cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-ring/70',
        'has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50',
        selected && 'border-primary bg-secondary/50',
        disabled && 'cursor-not-allowed opacity-60 hover:border-border',
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        className="sr-only"
        checked={selected}
        disabled={disabled}
        onChange={() => onToggle(item.id)}
        aria-describedby={`${inputId}-meta`}
      />
      <ItemThumb item={item} />
      <span className="min-w-0 flex-1">
        <span className="block leading-snug font-medium">{item.title}</span>
        <span id={`${inputId}-meta`} className="mt-1 block text-xs text-muted-foreground">
          {item.category} · {CONDITION_LABELS[item.condition]} · est. {formatValue(item.estimatedValue)}
          {unavailable && <span className="sr-only">. {unavailable}</span>}
          {!unavailable && otherOffers > 0 && <span className="sr-only">. In {otherOffers} other open {otherOffers === 1 ? 'offer' : 'offers'}</span>}
        </span>
        {(unavailable || otherOffers > 0) && (
          <span className="mt-2 flex flex-wrap gap-1" aria-hidden="true">
            {unavailable ? <Badge variant="outline">{unavailable}</Badge> : <Badge variant="secondary">In {otherOffers} other {otherOffers === 1 ? 'offer' : 'offers'}</Badge>}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
        )}
      >
        {selected && <CheckIcon className="size-3" />}
      </span>
    </label>
  );
}

/** Compact, read-only item line for reviews and trade summaries. */
export function ItemRow({ item }: { item: TradeItem }) {
  const unavailable = item.status === 'removed' ? 'No longer listed' : null;
  return (
    <li className="flex items-center gap-3">
      <ItemThumb item={item} className="size-10 text-base" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className="block text-xs text-muted-foreground">
          {CONDITION_LABELS[item.condition]} · est. {formatValue(item.estimatedValue)}
          {unavailable && ` · ${unavailable}`}
        </span>
      </span>
    </li>
  );
}
