import { money, type Item } from '@/lib/marketplace';

/** Total in cents, or null when any value is unknown (unknown is never treated as zero). */
export function totalValue(items: readonly Pick<Item, 'value_minor'>[]): number | null {
  if (items.some((item) => item.value_minor === null)) return null;
  return items.reduce((sum, item) => sum + (item.value_minor ?? 0), 0);
}

export function formatValue(minor: number | null): string {
  return minor === null ? 'Unknown' : money(minor);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export interface Balance {
  give: number | null;
  get: number | null;
  /** Percentage gap, as the backend defines it: |give − get| / max(give, get). */
  gapPercent: number | null;
  summary: string;
  /** True when values are unknown or the gap exceeds the viewer's own limit. */
  warning: boolean;
}

/** Neutral estimated-value comparison. It informs; the backend decides whether a warning applies. */
export function compareValue(give: number | null, get: number | null, theirName: string, gapLimit: number): Balance {
  if (give === null || get === null) {
    return { give, get, gapPercent: null, warning: true, summary: 'Some values are unknown, so the sides can’t be compared.' };
  }
  if (give === 0 && get === 0) return { give, get, gapPercent: null, warning: false, summary: 'Select items to compare estimated value.' };
  const larger = Math.max(give, get);
  const gapPercent = larger === 0 ? 0 : (Math.abs(give - get) / larger) * 100;
  const difference = get - give;
  let summary: string;
  if (gapPercent <= 5) summary = 'Roughly even by estimated value.';
  else if (difference > 0) summary = `You’d receive about ${money(difference)} more in estimated value (${gapPercent.toFixed(1)}% gap).`;
  else summary = `${theirName} would receive about ${money(-difference)} more in estimated value (${gapPercent.toFixed(1)}% gap).`;
  return { give, get, gapPercent, summary, warning: gapPercent > gapLimit };
}

export function firstName(name: string) {
  return name.split(' ')[0] || name;
}
