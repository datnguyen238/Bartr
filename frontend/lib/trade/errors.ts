import { ApiError } from '@/lib/marketplace';

export interface ActionFailure {
  message: string;
  /** The outcome is unknown or the trade changed; the user should reload before retrying. */
  needsReload: boolean;
  /** The server wants the value warning acknowledged before it will save. */
  needsAcknowledgement: boolean;
}

const RELOAD_CODES = new Set(['STALE_TRADE', 'STALE_ITEM', 'TRADE_CLOSED', 'ITEM_UNAVAILABLE', 'INVALID_STATE']);

export function describeFailure(error: unknown, unknownOutcome: string): ActionFailure {
  if (error instanceof ApiError) {
    const unknown = error.status === 0 || error.status >= 500;
    return {
      message: error.status === 0 ? unknownOutcome : error.message,
      needsReload: unknown || RELOAD_CODES.has(error.code ?? ''),
      needsAcknowledgement: error.code === 'CONFIRM_VALUE_WARNING',
    };
  }
  return { message: unknownOutcome, needsReload: true, needsAcknowledgement: false };
}

export function isSignedOut(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
