import { TradeApiError } from './api';

export interface ActionFailure {
  message: string;
  /** True when the outcome is unknown or stale and the user should reload before retrying. */
  needsReload: boolean;
}

export function describeFailure(error: unknown, unknownOutcome: string): ActionFailure {
  if (error instanceof TradeApiError) {
    return { message: error.message, needsReload: error.code === 'conflict' || error.code === 'unavailable' };
  }
  return { message: unknownOutcome, needsReload: true };
}
