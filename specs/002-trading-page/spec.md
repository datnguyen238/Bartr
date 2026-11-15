# Feature Specification: Trading page

**Feature Branch**: `Trade_front-end`

**Created**: 2026-11-14 · **Updated**: 2026-11-14 (connected to the marketplace trade API)

**Status**: Draft, front-end implemented against the existing `/api/trades` contract

**Parent requirements**: [Smart barter marketplace spec](../001-smart-barter-marketplace/spec.md), [API contract](../001-smart-barter-marketplace/contracts/api.md), and the `/trades/[id]` row of [matching and UI](../001-smart-barter-marketplace/contracts/matching-and-ui.md).

**Input**: "After picking an item or a profile, the user lands on the Trading page. Side-by-side layout: select items from my list and from the other person's list, optionally add a message, and propose the trade. The two users need a way to negotiate."

## Routes

- `/trades/new?with=<memberId>&item=<itemId>`: compose an offer. `item` preselects one of the other member's items.
- `/trades/<tradeId>`: one trade (participants only).
- `/trades`: the existing list in the shared workspace (owned separately). It should link each trade to `/trades/<tradeId>`.

## Decisions

- **Negotiation happens through structured offers.** A counter-offer replaces the item sets. Notes (the backend `note` action) appear in the same history as offers, so it reads like a conversation. The backend doesn't store a note with a proposal or counter-offer, so an optional note is sent as a follow-up `note` action; if only the note fails, the user is told the offer was saved. Real-time chat is out of scope.
- **No AI in v1.** The builder keeps a place for a future suggested counter-offer that the user applies and edits.
- **The backend is authoritative.** The page uses the shared `command()` helper, which keeps one command ID across retries, and sends `expected_revision` on every action. `STALE_TRADE`, `STALE_ITEM`, closed or unavailable responses show the server's message and a Reload control; nothing is retried with a new command ID.
- **Turn rules come from the current offer.** The recipient of the latest offer can accept, counter, or decline; its sender can withdraw.
- **Value comparison.** Values are integer USD cents. Unknown values stay "Unknown", never $0. The page shows a neutral comparison. When values are unknown or the gap exceeds the viewer's limit, the user must tick an acknowledgement; if the server still answers `CONFIRM_VALUE_WARNING` (for example because of the other member's limit), the acknowledgement appears and the user can resend.
- **Bundle limits.** One to three items per side; a fourth selection is disabled.
- **After acceptance:** every item is reserved. Members coordinate a meet-up or shipping in notes, then each reports the hand-off; two reports complete the trade. Cancelling before any hand-off report releases the items at once; after a report, both members must cancel.
- **Trade receipt.** Agreed and completed trades show a SHA-256 fingerprint of the participants, item IDs and listing revisions, computed in the browser. A server-issued `terms_hash` should replace it before any blockchain anchoring.

## States

| Backend status | Shown as | Actions |
|---|---|---|
| `open`, viewer received the latest offer | Your turn | Accept (with acknowledgement if `value_warning`), Counter-offer, Decline, note |
| `open`, viewer sent the latest offer | Waiting for *name* | Withdraw, note |
| `agreed` | Agreed | Report hand-off, Cancel agreement, note |
| `awaiting_handoff` | Your turn / Waiting for *name* | Report hand-off if not yet reported; cancel or approve cancellation; note |
| `completed` | Completed | read-only, receipt |
| `declined`, `withdrawn`, `cancelled`, `invalidated` | Closed with reason | Start a new trade |

## Acceptance scenarios (browser-checked with two accounts, in-memory backend)

1. Opening `/trades/new` from an item preselects it; Review is disabled until both sides have an item.
2. An offer with an unknown value requires the acknowledgement; it saves with its note and opens `/trades/<id>`.
3. The recipient counters by changing items on both sides; history shows "+ / −" changes; a value gap over the limit requires acknowledgement.
4. Accepting from a stale page shows "Trade changed…" with Reload; after reloading, accepting reserves the items and shows the receipt.
5. Both members report the hand-off and the trade is Completed.
6. Cancelling an agreement with no hand-off report releases the items (Cancelled).
7. At 390px there's no horizontal scrolling, and the lists switch with a toggle.

## Edge cases

- Signed out (401): a sign-in message instead of the page.
- Trading with yourself, or with someone outside your community: blocked with an explanation.
- No published items on either side: empty states with links to Inventory or Discover.
- Seed-data mode (`NEXT_PUBLIC_USE_SEED_DATA=true`): pages render the fixtures and every action is disabled with a notice.

## Known gaps

- The frontend currently has no sign-in screen (the profile workspace was reverted on `main`); testing used API sign-in.
- No automated frontend tests exist in the project yet.
- The `202` unresolved-operation flow in the contract isn't implemented by the backend, so it isn't handled here.
