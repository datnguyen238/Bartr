import type { Metadata } from 'next';
import { TradeComposer } from '@/components/trade/trade-composer';

export const metadata: Metadata = { title: 'New trade · Bartr' };

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// Entry point from an item or member: /trades/new?with=<memberId>&item=<itemId>
export default async function NewTradePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <TradeComposer withUserId={single(params.with)} preselectItemId={single(params.item)} />;
}
