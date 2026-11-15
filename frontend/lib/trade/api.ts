// Trading page data access on top of the shared marketplace client.
//
// The backend is authoritative for ownership, turn order, item availability and value warnings.
// Mutations go through `command()`, which keeps one command ID across retries so an interrupted
// request can't be applied twice. In seed-data mode, reads use the fixtures and writes are refused.
import { createSeedView, seedEnabled } from '@/data/seed';
import { ApiError, api, command, type Trade, type View } from '@/lib/marketplace';

export { ApiError, seedEnabled };

export const MAX_ITEMS_PER_SIDE = 3;
export const NOTE_MAX_LENGTH = 3000;

export type TradeActionKind = 'note' | 'counter' | 'accept' | 'decline' | 'withdraw' | 'cancel' | 'handoff';

function refuseInSeedMode() {
  if (seedEnabled) {
    throw new ApiError('Seed data mode: actions are disabled and nothing is saved. Turn off NEXT_PUBLIC_USE_SEED_DATA to use the backend.', 400, 'SEED_MODE');
  }
}

export function loadView(): Promise<View> {
  return seedEnabled ? Promise.resolve(createSeedView()) : api<View>('me');
}

export async function getTrade(id: string): Promise<Trade> {
  if (seedEnabled) {
    const trade = createSeedView().trades.find((t) => t.id === id);
    if (!trade) throw new ApiError('Trade not found.', 404, 'NOT_FOUND');
    return trade;
  }
  return api<Trade>(`trades/${encodeURIComponent(id)}`);
}

/** Propose a trade. `left` is the viewer's items, `right` the other member's. */
export async function proposeTrade(input: { other: string; left: string[]; right: string[]; acknowledged: boolean }): Promise<Trade> {
  refuseInSeedMode();
  return command<Trade>('trades', input);
}

export async function tradeAction(
  trade: Trade,
  kind: TradeActionKind,
  options: { note?: string; left?: string[]; right?: string[]; acknowledged?: boolean } = {},
): Promise<Trade> {
  refuseInSeedMode();
  return command<Trade>(`trades/${encodeURIComponent(trade.id)}/actions`, {
    kind,
    expected_revision: trade.revision,
    note: options.note ?? '',
    acknowledged: options.acknowledged ?? false,
    ...(options.left ? { left: options.left } : {}),
    ...(options.right ? { right: options.right } : {}),
  });
}

/**
 * Proposals and counter-offers don't carry a note, so an optional note is sent as a follow-up
 * action. The offer itself is already saved, so a failed note is reported, not retried silently.
 */
export async function attachNote(trade: Trade, note: string): Promise<{ trade: Trade; noteSaved: boolean }> {
  if (!note.trim()) return { trade, noteSaved: true };
  try {
    return { trade: await tradeAction(trade, 'note', { note: note.trim() }), noteSaved: true };
  } catch {
    return { trade, noteSaved: false };
  }
}
