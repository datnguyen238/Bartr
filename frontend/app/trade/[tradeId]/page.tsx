import type { Metadata } from 'next';
import { TradeView } from '@/components/trade/trade-view';

export const metadata: Metadata = { title: 'Trade · Bartr' };

export default async function TradePage({ params }: { params: Promise<{ tradeId: string }> }) {
  const { tradeId } = await params;
  return <TradeView tradeId={tradeId} />;
}
