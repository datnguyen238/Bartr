// Trading domain types. These mirror the contract we expect from the backend.

export type UserId = string;
export type ItemId = string;
export type TradeId = string;

export interface TradeUser {
  id: UserId;
  displayName: string;
  location?: string;
}

export type ItemCondition = 'new' | 'like-new' | 'good' | 'fair' | 'worn';
export type ItemStatus = 'available' | 'traded' | 'removed';

export interface TradeItem {
  id: ItemId;
  ownerId: UserId;
  title: string;
  category: string;
  condition: ItemCondition;
  /** Estimated value in US dollars, as shown on the Landing page. */
  estimatedValue: number;
  imageUrl?: string;
  status: ItemStatus;
}

/** Item IDs on each side of a trade, keyed by participant role. */
export interface TradeTerms {
  initiatorItemIds: ItemId[];
  recipientItemIds: ItemId[];
}

export type TradeStatus =
  | 'proposed'
  | 'countered'
  | 'accepted'
  | 'completed'
  | 'declined'
  | 'withdrawn'
  | 'unavailable';

export type HandoffMethod = 'meetup' | 'ship';

interface EventBase {
  id: string;
  at: string;
}

export type TradeEvent =
  | (EventBase & { type: 'offer' | 'counter'; authorId: UserId; terms: TradeTerms; note?: string })
  | (EventBase & { type: 'note'; authorId: UserId; note: string })
  | (EventBase & { type: 'accepted' | 'declined' | 'withdrawn'; authorId: UserId; note?: string })
  | (EventBase & { type: 'handoff-method'; authorId: UserId; method: HandoffMethod })
  | (EventBase & { type: 'receipt-confirmed'; authorId: UserId })
  | (EventBase & { type: 'completed' })
  | (EventBase & { type: 'unavailable'; reason: string });

export interface TradeReceipt {
  /** SHA-256 of the accepted terms; a future on-chain record can anchor this value. */
  fingerprint: string;
  createdAt: string;
}

export interface Trade {
  id: TradeId;
  initiatorId: UserId;
  recipientId: UserId;
  status: TradeStatus;
  terms: TradeTerms;
  /** Participant who may accept, counter, or decline; null once the trade is no longer open. */
  turnUserId: UserId | null;
  events: TradeEvent[];
  handoffMethod?: HandoffMethod;
  confirmedBy: UserId[];
  receipt?: TradeReceipt;
  createdAt: string;
  /** Version stamp used to reject actions based on stale data. */
  updatedAt: string;
}

export const OPEN_STATUSES: readonly TradeStatus[] = ['proposed', 'countered'];
export const NOTE_MAX_LENGTH = 500;
