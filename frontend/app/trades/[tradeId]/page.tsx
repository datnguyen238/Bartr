import type { Metadata } from 'next';
import { TradeView } from '@/components/trade/trade-view';

export const metadata: Metadata = { title: 'Trade · Bartr' };

export default async function TradePage({ params, searchParams }: {
  params: Promise<{ tradeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ tradeId }, query] = await Promise.all([params, searchParams]);
  return <TradeView tradeId={tradeId} noteFailed={query.note === 'failed'} />;
}
