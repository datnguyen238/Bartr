import type { Item, Offer, Terms, Trade } from '@/lib/marketplace';

/** Terms from one participant's point of view. `left` always belongs to the offer's sender. */
export interface SideItems {
  mine: Item[];
  theirs: Item[];
}

export function sideItems(terms: Terms, viewerId: string): SideItems {
  return terms.left_owner === viewerId ? { mine: terms.left, theirs: terms.right } : { mine: terms.right, theirs: terms.left };
}

export function sideIds(terms: Terms, viewerId: string) {
  const side = sideItems(terms, viewerId);
  return { mine: side.mine.map((i) => i.id), theirs: side.theirs.map((i) => i.id) };
}

export function otherParticipant(trade: Trade, viewerId: string): string {
  return trade.participants.find((id) => id !== viewerId) ?? '';
}

export function currentOffer(trade: Trade): Offer {
  return trade.offers[trade.offers.length - 1];
}

export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export function diffItems(previous: readonly Item[], next: readonly Item[]) {
  const before = new Set(previous.map((i) => i.id));
  const after = new Set(next.map((i) => i.id));
  return {
    added: next.filter((i) => !before.has(i.id)),
    removed: previous.filter((i) => !after.has(i.id)),
  };
}

/** SHA-256 of the agreed terms (participants, item IDs and listing revisions). */
export async function termsFingerprint(trade: Trade): Promise<string> {
  const terms = currentOffer(trade).terms;
  const payload = JSON.stringify({
    trade: trade.id,
    left_owner: terms.left_owner,
    right_owner: terms.right_owner,
    left: terms.left.map((i) => [i.id, i.revision]).sort(),
    right: terms.right.map((i) => [i.id, i.revision]).sort(),
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
