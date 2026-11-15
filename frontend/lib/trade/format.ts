import type { ItemCondition, TradeItem } from './types';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function formatValue(value: number): string {
  return currency.format(value);
}

export function totalValue(items: readonly TradeItem[]): number {
  return items.reduce((sum, item) => sum + item.estimatedValue, 0);
}

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: 'New',
  'like-new': 'Like new',
  good: 'Good',
  fair: 'Fair',
  worn: 'Well used',
};

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export interface Balance {
  give: number;
  get: number;
  /** Positive when the viewer receives more estimated value. */
  difference: number;
  summary: string;
}

/** Neutral comparison of estimated value; never judges whether a trade is fair. */
export function compareValue(give: number, get: number, theirName: string): Balance {
  const difference = get - give;
  const larger = Math.max(give, get);
  let summary: string;
  if (give === 0 && get === 0) summary = 'Select items to compare estimated value.';
  else if (Math.abs(difference) <= Math.max(5, larger * 0.15)) summary = 'Roughly even by estimated value.';
  else if (difference > 0) summary = `You'd receive about ${formatValue(difference)} more in estimated value.`;
  else summary = `${theirName} would receive about ${formatValue(-difference)} more in estimated value.`;
  return { give, get, difference, summary };
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
