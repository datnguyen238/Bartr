'use client';

import { Badge } from '@/components/ui/badge';
import type { Item } from '@/lib/marketplace';
import { formatValue } from '@/lib/trade/format';
import { cn } from '@/lib/utils';
import { CheckIcon } from './icons';

export function ItemThumb({ item, className }: { item: Item; className?: string }) {
  if (item.image_id) {
    return <img src={`/api/images/${encodeURIComponent(item.image_id)}`} alt="" className={cn('size-14 shrink-0 rounded-lg bg-secondary object-cover', className)} />;
  }
  return (
    <span aria-hidden="true" className={cn('grid size-14 shrink-0 place-items-center rounded-lg bg-secondary text-xl font-semibold text-secondary-foreground', className)}>
      {(item.title || '?').charAt(0)}
    </span>
  );
}

const STATUS_LABELS: Partial<Record<Item['status'], string>> = {
  reserved: 'Reserved in another trade',
  exchanged: 'Already traded',
  removed: 'No longer listed',
  draft: 'Not published',
};

function details(item: Item) {
  return [item.category, item.condition, `est. ${formatValue(item.value_minor)}`].filter(Boolean).join(' · ');
}

interface SelectableItemCardProps {
  item: Item;
  selected: boolean;
  onToggle: (id: string) => void;
  /** True when the side already has the maximum number of items. */
  atLimit: boolean;
}

export function SelectableItemCard({ item, selected, onToggle, atLimit }: SelectableItemCardProps) {
  const unavailable = item.status === 'available' ? null : STATUS_LABELS[item.status] ?? 'Unavailable';
  // A selected item stays deselectable even if it became unavailable, so the user can fix the offer.
  const disabled = !selected && (Boolean(unavailable) || atLimit);
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
        <span className="block leading-snug font-medium">{item.title || 'Untitled item'}</span>
        <span id={`${inputId}-meta`} className="mt-1 block text-xs text-muted-foreground">
          {details(item)}
          {unavailable && <span className="sr-only">. {unavailable}</span>}
          {item.value_minor === null && <span className="sr-only">. Value unknown</span>}
        </span>
        {unavailable && (
          <span className="mt-2 flex flex-wrap gap-1" aria-hidden="true">
            <Badge variant="outline">{unavailable}</Badge>
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
export function ItemRow({ item }: { item: Item }) {
  return (
    <li className="flex items-center gap-3">
      <ItemThumb item={item} className="size-10 text-base" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title || 'Untitled item'}</span>
        <span className="block text-xs text-muted-foreground">{details(item)}</span>
      </span>
    </li>
  );
}
