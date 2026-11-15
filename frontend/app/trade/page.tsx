import type { Metadata } from 'next';
import { TradeList } from '@/components/trade/trade-list';

export const metadata: Metadata = { title: 'My trades · Bartr' };

export default function TradesPage() {
  return <TradeList />;
}
