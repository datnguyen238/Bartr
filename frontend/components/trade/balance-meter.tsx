import { formatValue, type Balance } from '@/lib/trade/format';
import { cn } from '@/lib/utils';

/** Neutral estimated-value comparison. It informs; it never blocks an offer on its own. */
export function BalanceMeter({ balance, className }: { balance: Balance; className?: string }) {
  const known = balance.give !== null && balance.get !== null;
  const total = (balance.give ?? 0) + (balance.get ?? 0);
  const givePercent = !known || total === 0 ? 50 : ((balance.give ?? 0) / total) * 100;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>Give {formatValue(balance.give)}</span>
        <span>Get {formatValue(balance.get)}</span>
      </div>
      <div className={cn('flex h-1.5 overflow-hidden rounded-full bg-muted', !known && 'opacity-40')} aria-hidden="true">
        <span className="bg-primary transition-[width]" style={{ width: `${givePercent}%` }} />
        <span className="flex-1 bg-ring/50" />
      </div>
      <p className="text-xs text-muted-foreground">{balance.summary}</p>
    </div>
  );
}
