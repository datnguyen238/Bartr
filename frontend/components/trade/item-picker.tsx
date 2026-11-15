'use client';

import type { ReactNode } from 'react';
import type { Item } from '@/lib/marketplace';
import { MAX_ITEMS_PER_SIDE } from '@/lib/trade/api';
import { cn } from '@/lib/utils';
import { SelectableItemCard } from './item-card';

interface ItemPickerProps {
  id: string;
  heading: string;
  description: string;
  items: Item[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  empty: ReactNode;
  /** Hidden below the `lg` breakpoint when the other list is active. */
  hiddenOnMobile?: boolean;
}

export function ItemPicker({ id, heading, description, items, selectedIds, onToggle, empty, hiddenOnMobile }: ItemPickerProps) {
  const selectedCount = items.filter((item) => selectedIds.has(item.id)).length;
  const atLimit = selectedCount >= MAX_ITEMS_PER_SIDE;
  return (
    <section aria-labelledby={`${id}-heading`} className={cn('min-w-0', hiddenOnMobile && 'hidden lg:block')}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight">{heading}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {items.length > 0 && (
          <p className="shrink-0 text-right text-sm text-muted-foreground" aria-live="polite">
            {selectedCount} of {MAX_ITEMS_PER_SIDE} max
          </p>
        )}
      </div>
      {items.length === 0 ? (
        empty
      ) : (
        <fieldset>
          <legend className="sr-only">{heading}, choose up to {MAX_ITEMS_PER_SIDE}</legend>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {items.map((item) => (
              <li key={item.id}>
                <SelectableItemCard item={item} selected={selectedIds.has(item.id)} onToggle={onToggle} atLimit={atLimit} />
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </section>
  );
}
