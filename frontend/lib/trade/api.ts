// Trade API used by the Trading page.
//
// This is an in-browser mock that enforces the same ownership, turn and state rules we expect the
// backend to enforce. When the backend exists, replace these function bodies with `fetch('/api/...')`
// calls; the signatures and error codes are the contract the UI depends on.
import { DEFAULT_DEMO_USER_ID, DEMO_ITEMS, DEMO_USERS } from './mock-data';
import { otherParticipant, sameTerms } from './perspective';
import {
  NOTE_MAX_LENGTH,
  OPEN_STATUSES,
  type HandoffMethod,
  type ItemId,
  type Trade,
  type TradeEvent,
  type TradeId,
  type TradeItem,
  type TradeStatus,
  type TradeTerms,
  type TradeUser,
  type UserId,
} from './types';

export type TradeErrorCode = 'not-found' | 'forbidden' | 'invalid' | 'conflict' | 'unavailable';

export class TradeApiError extends Error {
  constructor(public code: TradeErrorCode, message: string) {
    super(message);
    this.name = 'TradeApiError';
  }
}

interface MockState {
  currentUserId: UserId;
  items: TradeItem[];
  trades: Trade[];
}

const STORAGE_KEY = 'bartr.trade-demo.v1';
const LATENCY_MS = 250;
let state: MockState | null = null;

function freshState(): MockState {
  return { currentUserId: DEFAULT_DEMO_USER_ID, items: structuredClone(DEMO_ITEMS), trades: [] };
}

function load(): MockState {
  if (state) return state;
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    state = saved ? (JSON.parse(saved) as MockState) : freshState();
  } catch {
    state = freshState();
  }
  return state;
}

function save() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Demo persistence is a convenience; the in-memory state still works.
  }
}

async function respond<T>(work: (s: MockState) => T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  const result = work(load());
  save();
  return structuredClone(result);
}

function now() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function findUser(id: UserId): TradeUser {
  const user = DEMO_USERS.find((u) => u.id === id);
  if (!user) throw new TradeApiError('not-found', 'We couldn’t find that person.');
  return user;
}

function findTrade(s: MockState, id: TradeId): Trade {
  const trade = s.trades.find((t) => t.id === id);
  if (!trade || (trade.initiatorId !== s.currentUserId && trade.recipientId !== s.currentUserId)) {
    throw new TradeApiError('not-found', 'We couldn’t find that trade.');
  }
  return trade;
}

function checkVersion(trade: Trade, expectedUpdatedAt: string) {
  if (trade.updatedAt !== expectedUpdatedAt) {
    throw new TradeApiError('conflict', 'This trade changed since you opened it. Reload to see the latest offer.');
  }
}

function checkNote(note?: string): string | undefined {
  const trimmed = note?.trim();
  if (trimmed && trimmed.length > NOTE_MAX_LENGTH) {
    throw new TradeApiError('invalid', `Notes can be up to ${NOTE_MAX_LENGTH} characters.`);
  }
  return trimmed || undefined;
}

function checkTerms(s: MockState, initiatorId: UserId, recipientId: UserId, terms: TradeTerms) {
  if (terms.initiatorItemIds.length === 0 || terms.recipientItemIds.length === 0) {
    throw new TradeApiError('invalid', 'Each side needs at least one item.');
  }
  const check = (ids: ItemId[], ownerId: UserId) => {
    for (const id of ids) {
      const item = s.items.find((i) => i.id === id);
      if (!item || item.ownerId !== ownerId) throw new TradeApiError('invalid', 'One of the selected items doesn’t belong to that side.');
      if (item.status !== 'available') throw new TradeApiError('unavailable', `“${item.title}” is no longer available.`);
    }
  };
  check(terms.initiatorItemIds, initiatorId);
  check(terms.recipientItemIds, recipientId);
}

/** A trade event before the store assigns its id and timestamp (distributes over the union). */
type Unstamped<E> = E extends TradeEvent ? Omit<E, 'id' | 'at'> : never;
type NewEvent = Unstamped<TradeEvent>;

function pushEvent(trade: Trade, event: NewEvent) {
  const at = now();
  trade.events.push({ ...event, id: newId('e'), at } as TradeEvent);
  trade.updatedAt = at;
}

function requireOpenTurn(s: MockState, trade: Trade) {
  if (!OPEN_STATUSES.includes(trade.status)) throw new TradeApiError('invalid', 'This trade is no longer open.');
  if (trade.turnUserId !== s.currentUserId) throw new TradeApiError('forbidden', 'It’s not your turn to respond.');
}

async function fingerprint(trade: Trade): Promise<string> {
  const payload = JSON.stringify({
    id: trade.id,
    initiatorId: trade.initiatorId,
    recipientId: trade.recipientId,
    initiatorItemIds: [...trade.terms.initiatorItemIds].sort(),
    recipientItemIds: [...trade.terms.recipientItemIds].sort(),
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- Reads -------------------------------------------------------------------------------------

export function getSession(): Promise<TradeUser> {
  return respond((s) => findUser(s.currentUserId));
}

export function getUser(id: UserId): Promise<TradeUser> {
  return respond(() => findUser(id));
}

export function listItems(ownerId: UserId): Promise<TradeItem[]> {
  return respond((s) => s.items.filter((i) => i.ownerId === ownerId && i.status !== 'removed'));
}

/** Items referenced by a trade, including ones that have since become unavailable. */
export function getItems(ids: ItemId[]): Promise<TradeItem[]> {
  return respond((s) => s.items.filter((i) => ids.includes(i.id)));
}

/** Number of other open trades that include each item. */
export function getOpenOfferCounts(excludeTradeId?: TradeId): Promise<Record<ItemId, number>> {
  return respond((s) => {
    const counts: Record<ItemId, number> = {};
    for (const trade of s.trades) {
      if (trade.id === excludeTradeId || !OPEN_STATUSES.includes(trade.status)) continue;
      for (const id of [...trade.terms.initiatorItemIds, ...trade.terms.recipientItemIds]) counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  });
}

export function getTrade(id: TradeId): Promise<Trade> {
  return respond((s) => findTrade(s, id));
}

export function listMyTrades(): Promise<Trade[]> {
  return respond((s) =>
    s.trades
      .filter((t) => t.initiatorId === s.currentUserId || t.recipientId === s.currentUserId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
}

// ---- Mutations ---------------------------------------------------------------------------------

export function proposeTrade(input: { recipientId: UserId; terms: TradeTerms; note?: string }): Promise<Trade> {
  return respond((s) => {
    if (input.recipientId === s.currentUserId) throw new TradeApiError('invalid', 'You can’t trade with yourself.');
    findUser(input.recipientId);
    checkTerms(s, s.currentUserId, input.recipientId, input.terms);
    const note = checkNote(input.note);
    const at = now();
    const trade: Trade = {
      id: newId('t'),
      initiatorId: s.currentUserId,
      recipientId: input.recipientId,
      status: 'proposed',
      terms: structuredClone(input.terms),
      turnUserId: input.recipientId,
      events: [{ id: newId('e'), at, type: 'offer', authorId: s.currentUserId, terms: structuredClone(input.terms), note }],
      confirmedBy: [],
      createdAt: at,
      updatedAt: at,
    };
    s.trades.push(trade);
    return trade;
  });
}

export function counterTrade(id: TradeId, input: { terms: TradeTerms; note?: string; expectedUpdatedAt: string }): Promise<Trade> {
  return respond((s) => {
    const trade = findTrade(s, id);
    checkVersion(trade, input.expectedUpdatedAt);
    requireOpenTurn(s, trade);
    if (sameTerms(trade.terms, input.terms)) throw new TradeApiError('invalid', 'Change at least one item to send a counter-offer.');
    checkTerms(s, trade.initiatorId, trade.recipientId, input.terms);
    const note = checkNote(input.note);
    trade.terms = structuredClone(input.terms);
    trade.status = 'countered';
    trade.turnUserId = otherParticipant(trade, s.currentUserId);
    pushEvent(trade, { type: 'counter', authorId: s.currentUserId, terms: structuredClone(input.terms), note });
    return trade;
  });
}

export async function acceptTrade(id: TradeId, input: { expectedUpdatedAt: string; note?: string }): Promise<Trade> {
  const snapshot = await getTrade(id);
  const receiptFingerprint = await fingerprint(snapshot);
  return respond((s) => {
    const trade = findTrade(s, id);
    checkVersion(trade, input.expectedUpdatedAt);
    requireOpenTurn(s, trade);
    checkTerms(s, trade.initiatorId, trade.recipientId, trade.terms);
    const note = checkNote(input.note);
    const itemIds = [...trade.terms.initiatorItemIds, ...trade.terms.recipientItemIds];
    for (const item of s.items) if (itemIds.includes(item.id)) item.status = 'traded';
    trade.status = 'accepted';
    trade.turnUserId = null;
    trade.receipt = { fingerprint: receiptFingerprint, createdAt: now() };
    pushEvent(trade, { type: 'accepted', authorId: s.currentUserId, note });
    // Other open offers that include any of these items can no longer be fulfilled.
    for (const other of s.trades) {
      if (other.id === trade.id || !OPEN_STATUSES.includes(other.status)) continue;
      const overlaps = [...other.terms.initiatorItemIds, ...other.terms.recipientItemIds].some((i) => itemIds.includes(i));
      if (overlaps) {
        other.status = 'unavailable';
        other.turnUserId = null;
        pushEvent(other, { type: 'unavailable', reason: 'An item in this offer was traded in another deal.' });
      }
    }
    return trade;
  });
}

export function declineTrade(id: TradeId, input: { expectedUpdatedAt: string; note?: string }): Promise<Trade> {
  return respond((s) => {
    const trade = findTrade(s, id);
    checkVersion(trade, input.expectedUpdatedAt);
    requireOpenTurn(s, trade);
    const note = checkNote(input.note);
    trade.status = 'declined';
    trade.turnUserId = null;
    pushEvent(trade, { type: 'declined', authorId: s.currentUserId, note });
    return trade;
  });
}

export function withdrawTrade(id: TradeId, input: { expectedUpdatedAt: string }): Promise<Trade> {
  return respond((s) => {
    const trade = findTrade(s, id);
    checkVersion(trade, input.expectedUpdatedAt);
    if (!OPEN_STATUSES.includes(trade.status)) throw new TradeApiError('invalid', 'This trade is no longer open.');
    if (trade.turnUserId === s.currentUserId) throw new TradeApiError('forbidden', 'You can only withdraw an offer you sent.');
    trade.status = 'withdrawn';
    trade.turnUserId = null;
    pushEvent(trade, { type: 'withdrawn', authorId: s.currentUserId });
    return trade;
  });
}

export function addNote(id: TradeId, input: { note: string }): Promise<Trade> {
  return respond((s) => {
    const trade = findTrade(s, id);
    const notesOpen: readonly TradeStatus[] = [...OPEN_STATUSES, 'accepted'];
    if (!notesOpen.includes(trade.status)) throw new TradeApiError('invalid', 'Notes are closed for this trade.');
    const note = checkNote(input.note);
    if (!note) throw new TradeApiError('invalid', 'Write a note first.');
    pushEvent(trade, { type: 'note', authorId: s.currentUserId, note });
    return trade;
  });
}

export function setHandoffMethod(id: TradeId, input: { method: HandoffMethod }): Promise<Trade> {
  return respond((s) => {
    const trade = findTrade(s, id);
    if (trade.status !== 'accepted') throw new TradeApiError('invalid', 'Choose a hand-off method after the trade is accepted.');
    if (trade.handoffMethod === input.method) return trade;
    trade.handoffMethod = input.method;
    pushEvent(trade, { type: 'handoff-method', authorId: s.currentUserId, method: input.method });
    return trade;
  });
}

export function confirmReceipt(id: TradeId): Promise<Trade> {
  return respond((s) => {
    const trade = findTrade(s, id);
    if (trade.status !== 'accepted') throw new TradeApiError('invalid', 'Only accepted trades can be confirmed.');
    if (trade.confirmedBy.includes(s.currentUserId)) return trade; // Idempotent retry.
    trade.confirmedBy.push(s.currentUserId);
    pushEvent(trade, { type: 'receipt-confirmed', authorId: s.currentUserId });
    if (trade.confirmedBy.length === 2) {
      trade.status = 'completed';
      pushEvent(trade, { type: 'completed' });
    }
    return trade;
  });
}

// ---- Demo helpers (mock only) ------------------------------------------------------------------

export const demoUsers = DEMO_USERS;

export function getDemoUserId(): UserId {
  return load().currentUserId;
}

export function setDemoUser(id: UserId) {
  findUser(id);
  load().currentUserId = id;
  save();
}

export function resetDemo() {
  state = freshState();
  save();
}
