'use client';

import type { ReactNode } from 'react';
import type { TradeItem } from '@/lib/trade/types';
import { cn } from '@/lib/utils';
import { SelectableItemCard } from './item-card';

interface ItemPickerProps {
  id: string;
  heading: string;
  description: string;
  items: TradeItem[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  offerCounts: Record<string, number>;
  empty: ReactNode;
  /** Hidden below the `lg` breakpoint when the other list is active. */
  hiddenOnMobile?: boolean;
}

export function ItemPicker({ id, heading, description, items, selectedIds, onToggle, offerCounts, empty, hiddenOnMobile }: ItemPickerProps) {
  const selectedCount = items.filter((item) => selectedIds.has(item.id)).length;
  return (
    <section aria-labelledby={`${id}-heading`} className={cn('min-w-0', hiddenOnMobile && 'hidden lg:block')}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight">{heading}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {items.length > 0 && <p className="shrink-0 text-sm text-muted-foreground">{selectedCount} of {items.length} selected</p>}
      </div>
      {items.length === 0 ? (
        empty
      ) : (
        <fieldset>
          <legend className="sr-only">{heading}</legend>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {items.map((item) => (
              <li key={item.id}>
                <SelectableItemCard item={item} selected={selectedIds.has(item.id)} onToggle={onToggle} otherOffers={offerCounts[item.id] ?? 0} />
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </section>
  );
}
