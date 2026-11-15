import type { ItemId, Trade, TradeTerms, UserId } from './types';

/** Terms from one participant's point of view. */
export interface SideTerms {
  mine: ItemId[];
  theirs: ItemId[];
}

export function otherParticipant(trade: Trade, viewerId: UserId): UserId {
  return trade.initiatorId === viewerId ? trade.recipientId : trade.initiatorId;
}

export function termsFor(trade: Pick<Trade, 'initiatorId'>, terms: TradeTerms, viewerId: UserId): SideTerms {
  return trade.initiatorId === viewerId
    ? { mine: terms.initiatorItemIds, theirs: terms.recipientItemIds }
    : { mine: terms.recipientItemIds, theirs: terms.initiatorItemIds };
}

export function toTerms(trade: Pick<Trade, 'initiatorId'>, viewerId: UserId, side: SideTerms): TradeTerms {
  return trade.initiatorId === viewerId
    ? { initiatorItemIds: side.mine, recipientItemIds: side.theirs }
    : { initiatorItemIds: side.theirs, recipientItemIds: side.mine };
}

export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function sameTerms(a: TradeTerms, b: TradeTerms): boolean {
  return sameIds(a.initiatorItemIds, b.initiatorItemIds) && sameIds(a.recipientItemIds, b.recipientItemIds);
}

export function diffIds(previous: readonly string[], next: readonly string[]) {
  const before = new Set(previous);
  const after = new Set(next);
  return {
    added: next.filter((id) => !before.has(id)),
    removed: previous.filter((id) => !after.has(id)),
  };
}
