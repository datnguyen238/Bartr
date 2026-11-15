# Feature Specification: Trading page

**Feature Branch**: `Trade_front-end`

**Created**: 2026-11-14

**Status**: Draft (front-end against mock data; backend contract pending)

**Input**: User description: "After picking an item or a profile on the Landing page, the user lands on the Trading page. Side-by-side layout: select items from my list and from the other person's list, optionally add a message, and propose the trade. The two users need a way to negotiate."

## Decisions

- **Negotiation happens through structured offers.** A counter-offer changes the item sets. Every offer, counter-offer, or response can carry a short note (up to 500 characters). The trade timeline shows offers and notes together, so it reads like a conversation. Real-time chat is out of scope.
- **No AI in v1.** The layout keeps a place for a future "suggested counter-offer" that the user applies and edits. AI never sends anything for the user.
- **Turn-based states.** Only the participant whose turn it is can accept, counter, or decline. Only the participant who sent the current offer can withdraw it.
- **Either side can change either list when countering.** The counter screen uses the same two-sided picker.
- **A balance indicator stays neutral.** It shows the total estimated value of each side (estimated values come from the Landing page) and whether the trade is roughly even. It never blocks an offer and never calls an offer unfair.
- **The hackathon scope ends at Completed.** After acceptance, both participants pick a hand-off method (meet up or ship), coordinate through notes, and each confirms they received their items. A trade receipt fingerprint (a SHA-256 hash of the accepted terms) is shown so that a later blockchain record can anchor exactly what was agreed. Shipping or courier integrations are out of scope.

## User Scenarios & Testing

### User Story 1 - Propose a trade (Priority: P1)

From the Landing page, a user opens the Trading page for another user, optionally with one of that user's items preselected. They select items from both lists, review the offer, optionally add a note, and send it.

**Why this priority**: Without proposing, nothing else exists.

**Independent Test**: Open `/trade/new?with=<userId>&item=<itemId>`, select items on both sides, review, send, and land on the trade's page with status "Waiting for <name>".

**Acceptance Scenarios**:

1. **Given** a preselected item, **When** the page loads, **Then** that item is already selected on the other user's side.
2. **Given** either side has no selected items, **When** the user looks at Review, **Then** it is disabled and the reason is stated.
3. **Given** a valid selection, **When** the user opens Review, **Then** they see what they give, what they get, both value totals, and what happens next, before they send.
4. **Given** sending fails, **When** the result is unknown, **Then** the user sees that it could not be confirmed and is told how to check, with no duplicate offer created by retrying.

### User Story 2 - Respond and counter (Priority: P1)

The participant whose turn it is can accept, decline, or counter. Countering opens the two-sided picker prefilled with the current terms. The timeline shows what changed in each revision.

**Independent Test**: As the recipient, counter by removing one item and adding one from the other user's list; as the initiator, see "+ / −" changes in the timeline and accept.

**Acceptance Scenarios**:

1. **Given** it is not my turn, **When** I view the trade, **Then** accept, counter, and decline are unavailable and I can withdraw my offer.
2. **Given** I counter with terms identical to the current ones, **Then** sending is disabled.
3. **Given** the trade changed since I loaded it, **When** I act, **Then** my action is rejected with a message to reload, and nothing is overwritten.

### User Story 3 - Accept to completion (Priority: P2)

After acceptance, both participants see the agreed terms, a receipt fingerprint, a hand-off method choice, and notes for logistics. Each confirms they received their items; when both confirm, the trade is Completed.

**Acceptance Scenarios**:

1. **Given** a trade is accepted, **Then** other open offers that include any of its items become Unavailable.
2. **Given** one participant confirmed receipt, **Then** the other sees that and the trade stays Accepted until they confirm too.

### Edge Cases

- I have no items: their items are shown and proposing is disabled, with a link to add items on my Profile.
- They have no items: show an empty state and a link back to browsing.
- Opening a trade with myself: blocked with an explanation.
- An item that is already traded or removed cannot be selected. An open trade that includes it becomes Unavailable.
- An item that is in other open offers shows "In N other offers" and stays selectable.
- An unknown user or trade: a not-found state with a link back.
- Mobile (under 1024px): one list at a time, switched with a "Their items / Your items" control, plus a sticky summary bar.

## Requirements

### Functional Requirements

- **FR-001**: The page MUST let the viewer select at least one item from each side before reviewing.
- **FR-002**: The page MUST show a review step that states the effect of sending before the offer is committed.
- **FR-003**: Notes MUST be limited to 500 characters, with a visible counter.
- **FR-004**: Actions MUST follow the turn and state rules above. The authoritative check belongs to the backend; the mock API enforces the same rules for development.
- **FR-005**: Every action MUST show pending, success, and failure feedback through a live region.
- **FR-006**: All interactions MUST work by keyboard, with visible focus, labelled controls, and a 390px layout with no horizontal scrolling.

### Key Entities

- **Item**: owner, title, category, condition, estimated value, optional image, status (available, traded, removed).
- **Trade**: initiator, recipient, status (proposed, countered, accepted, completed, declined, withdrawn, unavailable), current terms (each side's item IDs), whose turn it is, timeline events, hand-off method, who confirmed receipt, receipt fingerprint, and a version timestamp for conflict checks.
- **Trade event**: offer, counter, note, accepted, declined, withdrawn, receipt-confirmed, completed, or unavailable, with author, time, optional note, and terms where relevant.

## Assumptions

- Authentication, the Landing page, and the Profile page are built by teammates. Until they exist, the front-end uses a typed mock API in `frontend/lib/trade/` with a clearly labelled demo user switcher.
- Estimated values are in US dollars, one value per item.
- Demo state is kept in the browser's session storage only; no personal data is sent anywhere.
