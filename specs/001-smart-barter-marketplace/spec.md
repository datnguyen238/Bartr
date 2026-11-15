# Feature Specification: Bartr Smart Bartering Marketplace

**Feature Branch**: `main` (existing branch; no branch-creation hook is configured)

**Created**: 2026-11-14

**Status**: Draft — validated for planning

**Input**: User description: "Bartr is an AI-powered, money-free marketplace for college students and young adults. Users publish inventories and interests, discover mutually useful combinations of items across two inventories, review estimated values and explanations, and negotiate or accept voluntary bundle exchanges."

## Clarifications

### Session 2026-11-14

- Q: What should Bartr prioritize when several possible trades meet both members' requirements? → A: Specific-product matches for both members first, then one member, then category-only matches; break ties by smaller value gap.
- Q: Must the owner separately select a successful price estimate? → A: A current successful estimate may be populated automatically after the owner requests it; the owner reviews it and explicitly publishes. A current estimate remains required.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prepare an inventory and trading interests (Priority: P1)

As a member with unused belongings, I want to create a trading profile, publish items with reviewed information, and describe what I want so that other members and Bartr can discover relevant exchanges.

**Why this priority**: Reliable item information and preferences are prerequisites for useful recommendations; a published inventory is independently useful for sharing available belongings.

**Independent Test**: A member creates a profile, lists a chair and calculator, and saves an interest in monitors. Verify the published inventory and saved interests without requiring recommendations or another member to negotiate.

**Acceptance Scenarios**:

1. **Given** a new visitor, **When** they create an account and sign in, **Then** they can save a display name, choose a campus or city trading community, and later return to their own saved profile and inventory.
2. **Given** an authenticated member, **When** they add an item with a title, description, category, condition, at least one image, and a reviewed current AI estimate and confirm publication, **Then** the item becomes available with that member as its owner; an incomplete item remains a draft with the missing information identified.
3. **Given** an uploaded item image, **When** Bartr suggests an identification, attributes, or estimated value, **Then** the owner can review suggestions and correct item details; a current AI estimate is required for publication and may be populated automatically after the owner requests it. Uncertain suggestions are labeled and no suggestion silently replaces owner-confirmed information.
4. **Given** image analysis or valuation is unavailable, **When** the member lists an item, **Then** they can save a private draft without losing their work and retry evaluation before publication.
5. **Given** a member saves "monitor" and "household essentials" as interests and excludes damaged electronics, **When** they revisit or edit their preferences, **Then** the saved specific interests, broad categories, and exclusions remain distinguishable and editable.
6. **Given** an available item, **When** its owner edits it or removes it from trading, **Then** future discovery uses the current details or excludes the removed item; another member cannot edit or remove it.
7. **Given** another signed-in member views a published listing, **When** they inspect the owner and item, **Then** they see only the public trading profile and published item information, while private preferences and negotiations remain inaccessible.
8. **Given** a member using only a keyboard and a screen reader, **When** they create or correct a listing and save preferences, **Then** all controls have understandable names, errors identify the affected fields, and save and publication outcomes are announced.

---

### User Story 2 - Discover and understand useful bundle exchanges (Priority: P1)

As a member seeking something I need, I want Bartr to consider combinations across my inventory and another member's inventory so that I can discover useful trades beyond a single item on each side.

**Why this priority**: Inventory-wide bundle matching is Bartr's defining value and can be demonstrated independently using prepared inventories and preferences.

**Independent Test**: Prepare two members with compatible interests and available items, request recommendations, and inspect the proposed bundles, comparison values, and explanations without submitting an offer.

**Acceptance Scenarios**:

1. **Given** A offers a chair valued at $40 and a calculator valued at $20 and wants a monitor, and B offers a monitor valued at $65 and wants furniture and study supplies in the same community, **When** A requests recommendations, **Then** Bartr includes Chair + Calculator ↔ Monitor, shows totals of $60 and $65 and an approximate 7.7% value gap, and explains how the items fit both members' interests.
2. **Given** prepared inventories with qualifying 1:1, 1:2, 1:3, 2:1, 2:2, 2:3, 3:1, 3:2, and 3:3 opportunities, **When** recommendations are requested for each case, **Then** Bartr can suggest each shape and identifies every distinct item and its owner on both sides.
3. **Given** a member seeks a "desk screen" and another lists a "computer monitor," **When** the items otherwise meet both members' preferences and constraints, **Then** different wording alone does not prevent the exchange from being recommended.
4. **Given** an otherwise attractive exchange includes an excluded category, an item outside the common trading community, or an unavailable item, **When** Bartr generates recommendations, **Then** it excludes that exchange and does not relax the violated constraint to produce results.
5. **Given** a recommended bundle, **When** a member opens it, **Then** they can inspect item descriptions, condition, images, item values and their sources, last-set dates and uncertainty, bundle totals, value difference, and an explanation grounded in the actual listings and both members' shareable interests.
6. **Given** a suggested exchange, **When** a member dismisses it or leaves the page, **Then** neither member has accepted anything and all included items remain available; a dismissed combination stays hidden from that member on subsequent requests until its item details or their preferences change.
7. **Given** an empty inventory, no saved interests, or no qualifying counterpart, **When** a member requests recommendations, **Then** Bartr distinguishes the reason and provides an appropriate next action such as listing an item, adding interests, or adjusting constraints.
8. **Given** recommendation generation fails, **When** the request ends unsuccessfully, **Then** Bartr states that recommendations could not be generated, preserves saved information and existing proposals, and offers retry; it does not report that no compatible trades exist.
9. **Given** an item lacks a usable positive value, **When** Bartr assesses bundles containing it, **Then** it does not present those bundles as value-qualified recommendations and identifies the missing valuation; the listing remains available for a manually composed proposal.
10. **Given** several eligible recommendations, including specific-product matches for both members, for only one member, and category-only matches, **When** Bartr displays them, **Then** they appear in that priority order even if a lower-priority match has a smaller value gap; within each priority, recommendations with smaller percentage value gaps appear first.

---

### User Story 3 - Propose and negotiate a bundle (Priority: P2)

As a member reviewing an opportunity, I want to propose it, discuss it, and adjust the included items so that both participants can agree on an exchange they personally find worthwhile.

**Why this priority**: Negotiation turns a recommendation into a practical exchange without assuming that estimated value determines personal value.

**Independent Test**: Start with a prepared recommendation or manually selected items, submit an offer, and exchange a counteroffer and trade-specific note between two accounts.

**Acceptance Scenarios**:

1. **Given** a recommendation or published items from a compatible member, **When** a member reviews and submits a bundle proposal, **Then** both participants can see who gives and receives each item, the current offer version, and any known or unknown values; the sender consents to that version but no items are reserved yet.
2. **Given** an open proposal, **When** either participant sends a trade-specific note, **Then** only the two participants can read it in the proposal history; when either submits a counteroffer, that offer becomes the current version with only its sender's consent and the earlier version remains visible as superseded.
3. **Given** an earlier version has a participant's consent, **When** a counteroffer replaces it or an included listing's title, description, category, condition, images, or comparison value changes, **Then** earlier consent cannot establish agreement and both participants are told that the terms require renewed review; a listing change invalidates the proposal and requires a fresh offer.
4. **Given** an offer exceeds either member's recommendation value-gap limit or has an unknown value, **When** either participant reviews it, **Then** Bartr displays the imbalance or uncertainty and permits voluntary agreement after explicit confirmation, without requesting money.
5. **Given** an open proposal, including one with a counteroffer, **When** the sender of the current offer version withdraws it or that version's recipient declines it, **Then** the proposal closes with the corresponding reason, cannot later be accepted, and leaves unreserved items available; sender and recipient roles follow the current version rather than the original proposal.
6. **Given** an included item becomes unavailable or an exclusion or community change makes the proposal ineligible, **When** a participant attempts to submit or accept the proposal, **Then** Bartr rejects the action, identifies what changed, and preserves the history for review.
7. **Given** someone outside the two participants, **When** they try to view a proposal, send a note, counteroffer, withdraw, decline, or accept it, **Then** access is denied without disclosing the private contents.

---

### User Story 4 - Agree, hand off, or cancel with clear item status (Priority: P2)

As a participant ready to trade, I want a clear mutual agreement and accurate item availability so that I can coordinate a handoff without committing the same belongings to multiple people.

**Why this priority**: Explicit consent, reservation, and completion protect the usefulness of every negotiated exchange.

**Independent Test**: Use prepared proposals to exercise agreement, overlapping offers, cancellation, and handoff confirmation without needing recommendation generation.

**Acceptance Scenarios**:

1. **Given** one participant has consented to the current offer, **When** the other reviews the exact items and confirms acceptance, **Then** the exchange becomes agreed only if all items remain eligible and available, all included items are reserved together, and both participants see the same agreed terms.
2. **Given** two offers include the same available item, **When** their acceptances overlap, **Then** at most one becomes agreed; the other reports that the item is unavailable, and no subset of its remaining items is reserved.
3. **Given** an acceptance response is interrupted, **When** the participant returns or retries, **Then** Bartr shows the authoritative current outcome or explicitly says it is still unresolved; retrying creates no duplicate agreement or conflicting reservation.
4. **Given** an agreed exchange, **When** an owner tries to remove, edit trading details of, or commit a reserved item elsewhere, **Then** the action is rejected with guidance to resolve the agreement first.
5. **Given** an agreed exchange with no handoff confirmation, **When** either participant confirms cancellation, **Then** the exchange becomes cancelled, both participants can see the reason and status, and all its items become available again.
6. **Given** an agreed exchange, **When** only one participant confirms that handoff occurred, **Then** the status states that the other participant's confirmation is pending and all items remain reserved; neither an elapsed time nor an AI action marks it completed.
7. **Given** both participants have confirmed handoff for the agreed terms, **When** the second confirmation is recorded, **Then** the exchange becomes completed and every included item becomes exchanged and ineligible for further trading.
8. **Given** one participant has reported handoff and the other requests cancellation, **When** only one participant approves reversal, **Then** the exchange remains unresolved with items reserved; only both participants' explicit agreement to cancel releases them.
9. **Given** a pending proposal shares an item with another exchange that is cancelled, **When** the item becomes available again, **Then** the old proposal is not silently reopened; participants must submit a fresh eligible offer.
10. **Given** a participant using a keyboard and a screen reader, **When** they review, accept, cancel, or report handoff, **Then** the effect is explained before confirmation, the action is operable without a pointer, and the resulting status or actionable error is announced.

### Edge Cases

- The same listing cannot appear twice in a bundle or be supplied by anyone other than its recorded owner; separately owned identical products are distinct listings.
- The supported limit is three items on either side. Empty sides, a fourth item, a self-trade, or a third participant are rejected with the applicable limit explained.
- Blank or contradictory preferences produce guidance rather than invented wants. Exclusions take precedence over positive interests.
- Zero, negative, or nonnumeric comparison values are rejected; unknown value is distinct from zero. Totals and percentages are never displayed as fully known when a component is unknown.
- Ambiguous images, conflicting owner information, and low-confidence estimates remain reviewable; claims about condition, authenticity, or working order are not invented.
- Changes to item details or constraints between recommendation display, proposal submission, and final acceptance require current eligibility checks and renewed consent when terms change.
- Simultaneous acceptance and removal or cancellation cannot leave a partial reservation, double commitment, or contradictory user-visible outcome.
- Repeated notes, counteroffers, acceptance, cancellation, or handoff confirmations caused by retries must not duplicate the action or roll back a later state.
- An out-of-date screen must identify a replaced or closed offer instead of accepting stale terms or silently overwriting a newer counteroffer.
- Long-pending proposals create no reservation. Agreed exchanges do not expire automatically; an unresponsive participant after a reported handoff leaves an explicit unresolved state.
- No match, unavailable assistance, and an unresolved action outcome are distinct conditions with different user guidance.

## Requirements *(mandatory)*

### Scope and Exchange Rules

The initial release covers account-backed profiles, published inventories, specific and category-level interests, semantic discovery of two-party bundles, advisory valuation, explanations, private negotiation, mutual agreement, item reservation, and participant-reported completion.

Exchanges contain one to three distinct physical items per participant. There is no cash component, payment obligation, platform credit, or claim that equal estimated value is required for consent. Both participants choose the same campus or city trading community; no exact address or precise location is required. There are no dedicated fields for exact addresses, phone numbers, or precise locations; participants may voluntarily include coordination details in private trade notes.

For automatic recommendations, every incoming item must match at least one of the receiving member's stated interests, no exclusion may be violated, and both members' value-gap limits must be satisfied. A manually composed offer may include items beyond positive interests or value-gap limits, with clear disclosure; it must still respect exclusions, community, ownership, availability, and bundle-size constraints.

Eligible recommendations are ranked first by how many participants receive at least one item matching an explicitly saved specific-product interest: both participants first, then one participant, then neither participant (category-only matches). Within each of these three priorities, smaller percentage value gaps rank first. A single specific-product match is sufficient to count a participant in that priority; extra matching items do not create a higher priority. Ranking never overrides eligibility constraints. Recommendations with the same priority and percentage gap have no further required ordering.

The comparison gap is the absolute difference between the two bundle totals divided by the larger total, expressed as a percentage. The default recommendation limit is 20% for each member; each may choose a limit from 0% to 100%. Values use one shared comparison currency, initially USD, solely as estimates.

AI suggestions are advisory and create no consent. Submitting an offer or counteroffer records the sender's consent to that exact version. Only the second participant's acceptance of the unchanged current version can establish agreement and reserve items. A counteroffer replaces earlier consent. Suggested bundles and open offers can overlap; agreed exchanges cannot share items.

Item states are draft, available, reserved, exchanged, and removed. Only available items participate in new offers or recommendations. Owners may publish drafts, edit available items, or remove drafts and available items. Reserved trading details are fixed until the agreement is resolved.

Trade states are open, agreed, awaiting handoff confirmation, completed, declined, withdrawn, invalidated, and cancelled. Valid counteroffers keep the proposal open and retain earlier offers as superseded versions; sender and recipient always refer to the current version. An open proposal becomes invalidated when underlying listing trading details change, hard eligibility constraints cease to be satisfied, or an included item becomes unavailable elsewhere. It never reopens automatically. Agreed exchanges may be cancelled by either participant before any handoff confirmation; afterward, cancellation requires both participants. Completion requires both participants' handoff confirmations. Completed, declined, withdrawn, invalidated, and cancelled trades remain read-only.

Physical handoff and any actual return of belongings are the participants' responsibility. Bartr records reported agreement, cancellation, and completion; it does not verify physical delivery or adjudicate conflicting claims.

### Functional Requirements

- **FR-001**: Bartr MUST let a person create an account, sign in and out, and return to their saved profile, preferences, inventory, and trade history. Changes and private data MUST be restricted to authorized members. **Acceptance**: Story 1.1, 1.6–1.7; Story 3.7.
- **FR-002**: Members MUST be able to create and edit a public trading profile containing a display name and one campus or city community. Bartr MUST NOT require exact addresses, phone numbers, or precise location, or provide dedicated fields for them in this release. **Acceptance**: Story 1.1, 1.7 and inspection of profile and listing fields.
- **FR-003**: Owners MUST be able to create drafts, publish complete item listings, edit available items, and remove drafts or available items. Each listing MUST identify its owner and include the required information in Story 1.2. **Acceptance**: Story 1.2, 1.6.
- **FR-004**: Bartr MUST offer image-assisted item identification, attribute suggestions, and advisory valuation while keeping owner review and correction in control of published information. **Acceptance**: Story 1.3–1.4.
- **FR-005**: New publication and changes to a published item's value MUST use its current reviewed estimate calculated from at least three distinct, compatible, cited USD comparables of the same price type; private drafts may retain an unknown value. Existing published manual and unknown values remain visible until updated. Bartr MUST show the comparison range, evidence and price basis, identify the value source and last-set time, and label estimation uncertainty. Provider citations do not independently verify the linked page, and estimates do not establish that item descriptions or prices are accurate. **Acceptance**: Story 1.3–1.4; Story 2.5, 2.9.
- **FR-006**: Members MUST be able to save and edit specific product interests, broad category interests, explicit exclusions, and a recommendation value-gap limit. Exclusions MUST take precedence when they conflict with interests. **Acceptance**: Story 1.5; Story 2.4, 2.7.
- **FR-007**: Signed-in members MUST be able to inspect published available listings and their public owner profiles from recommendations and when manually composing an offer. Drafts and removed listings MUST NOT be discoverable. **Acceptance**: Story 1.2, 1.6–1.7; Story 2.5; Story 3.1.
- **FR-008**: Bartr MUST use the meaning of item descriptions and interests to discover compatible exchanges even when wording differs. **Acceptance**: Story 2.3.
- **FR-009**: Bartr MUST evaluate combinations across both members' available inventories and support any combination of one to three distinct items per side, rather than limiting opportunities to one item per member. **Acceptance**: Story 2.1–2.2 and the bundle-size edge case.
- **FR-010**: Automatically recommended bundles MUST satisfy the recommendation eligibility rules, both members' constraints, and the defined value-gap calculation. Recommendations MUST NOT include an unknown-valued item or silently relax a constraint. Eligible recommendations MUST be displayed in the specific-product priority order defined above, with smaller percentage value gaps breaking ties within each priority. **Acceptance**: Story 2.1, 2.4, 2.9–2.10.
- **FR-011**: Each recommendation MUST show what each member gives and receives, individual values and their sources, bundle totals, the absolute and percentage differences, and why the actual items align with both members' interests. It MUST NOT assert unconfirmed item attributes or guaranteed fairness. **Acceptance**: Story 2.1, 2.5; the ambiguous-image edge case.
- **FR-012**: Members MUST be able to inspect and dismiss recommendations without submitting an offer, consenting, or reserving items. A dismissed combination MUST stay hidden from that member until its item details or their preferences change. **Acceptance**: Story 2.5–2.6.
- **FR-013**: Bartr MUST distinguish missing inventory, missing interests, no qualifying exchange, missing valuation, and assistance failure, with an actionable explanation and preserved saved data. **Acceptance**: Story 1.4; Story 2.7–2.9.
- **FR-014**: Members MUST be able to submit a reviewed recommended or manually composed bundle as a proposal to its other item owner. Each submitted version MUST record its exact terms and sender's consent without reserving items. **Acceptance**: Story 3.1.
- **FR-015**: Only the two participants MUST be able to view a proposal's private history, exchange trade-specific notes, or perform the permitted participant actions. **Acceptance**: Story 3.2, 3.7.
- **FR-016**: Either participant MUST be able to submit a replacement bundle as a counteroffer while the proposal is open. Replacing terms MUST preserve history, supersede the earlier version, and clear earlier consents. **Acceptance**: Story 3.2–3.3 and the stale-screen edge case.
- **FR-017**: The sender of the current offer version MUST be able to withdraw it, and that version's recipient MUST be able to decline it, including after counteroffers have changed those roles. Both actions MUST close the proposal without reserving items. **Acceptance**: Story 3.5.
- **FR-018**: Manually composed offers MUST permit unknown or imbalanced values after showing the applicable warning to both participants; neither acceptance nor completion MUST require paying the difference. Hard constraints MUST still be enforced. **Acceptance**: Story 3.4, 3.6.
- **FR-019**: Before proposal submission and agreement, Bartr MUST validate current ownership, distinct item identities, availability, two-party participation, bundle sizes, community, exclusions, and current offer terms. A failed validation MUST name the reason and create no agreement or partial reservation. **Acceptance**: Story 3.3, 3.6; Story 4.1–4.2; the invalid-bundle and concurrent-removal edge cases.
- **FR-020**: Agreement MUST require both participants' explicit consent to the same current version. An included listing's title, description, category, condition, images, or comparison value changing before agreement MUST invalidate the open proposal and require a fresh offer; no earlier consent may carry over. **Acceptance**: Story 3.3; Story 4.1.
- **FR-021**: Establishing agreement MUST reserve all included items together and MUST prevent an item from being reserved by more than one agreement, including overlapping acceptance attempts. **Acceptance**: Story 4.1–4.2.
- **FR-022**: When an item becomes reserved, exchanged, or removed, or an open proposal becomes incompatible with changed constraints, affected open proposals MUST become invalidated with a visible reason. Recommendations MUST be rechecked before they can become proposals. **Acceptance**: Story 1.6; Story 3.6; Story 4.9.
- **FR-023**: Bartr MUST prevent edits to trading details, removal, and other commitments for a reserved item until its agreement is resolved. **Acceptance**: Story 4.4.
- **FR-024**: Either participant MUST be able to cancel an agreement before either reports handoff; cancellation MUST release every included item together and record the result for both participants. **Acceptance**: Story 4.5.
- **FR-025**: Bartr MUST allow each participant to confirm handoff, show whose confirmation is pending, and mark the exchange completed and items exchanged only after both confirm. After the first confirmation, cancellation and release MUST require both participants' explicit approval. **Acceptance**: Story 4.6–4.8.
- **FR-026**: Retried or overlapping trade actions MUST not duplicate actions, overwrite newer terms, reopen closed proposals, create partial item changes, or create conflicting commitments. An interrupted action MUST show the current recorded outcome or an explicit unresolved state with a way to check again. **Acceptance**: Story 4.2–4.3, 4.9; retry and stale-screen edge cases.
- **FR-027**: Both participants MUST be able to revisit their offer history and current agreement, cancellation, and completion status. Status changes and proposal revisions MUST be visible when they return to the trade view. **Acceptance**: Story 3.2–3.6; Story 4.1, 4.5–4.9.
- **FR-028**: Core profile, inventory, preference, recommendation, and trade journeys MUST support keyboard navigation and screen readers, understandable labels, actionable errors, and announced action results. Consequential actions MUST explain their effect before confirmation. **Acceptance**: Story 1.8; Story 4.10, extended to recommendation review and counteroffers.
- **FR-029**: Bartr MUST enforce the state transitions described in Scope and Exchange Rules. Closed trade records MUST be read-only, and an unresolved handoff MUST remain explicit until the prescribed participant confirmations resolve it. **Acceptance**: Story 3.5–3.6; Story 4.4–4.9; repeated-action edge case.
- **FR-030**: Personal information MUST be used and exposed only for the purposes and audiences defined below. Recommendations may explain a preference as a relevant interest but MUST NOT reveal the other member's full private preference record. Operational records MUST exclude item images, private notes, account credentials, and unnecessary personal details. **Acceptance**: Story 1.7; Story 2.5; Story 3.7, including direct attempts to access private records.

### Key Entities

- **Member and trading profile**: Account identity for access and ownership, public display name, and chosen trading community for finding feasible local partners. Account sign-in information is private; only display name and community accompany published listings.
- **Item listing**: A distinct physical item owned by one member, with title, description, category, condition, images, last-reviewed details, and availability state. Published information supports discovery and informed review; draft and removed listings are private to their owner, while reviewed listing snapshots remain visible to participants in their prior trade histories.
- **Trading preferences**: Specific interests, broad interests, exclusions, and permitted recommendation value gap. Used to determine relevance and eligibility; private to the member except for relevant interests summarized in recommendation explanations.
- **Comparison valuation**: A positive estimated item value or explicit unknown value, comparison currency, source, last-set date, and uncertainty when assisted. Used to compare proposed bundles, not to establish a payment or guarantee market value.
- **Bundle recommendation**: Two members, one candidate bundle on each side, the assessed item details, comparison results, grounded explanation, and the requesting member's dismissal state. It is advisory and is visible to its requester until submitted as a proposal.
- **Trade proposal and offer versions**: Two participants, current and superseded item bundles and their reviewed details, value warnings, sender, per-version consents, private notes, and closure reason. Used for negotiation, consent review, and resolving stale actions; visible only to participants. Members may voluntarily include contact or handoff details in private notes for coordination; those details are not extracted into public profiles or recommendation explanations.
- **Agreement and handoff record**: The agreed offer version, reservations, participant handoff confirmations, cancellation approvals, and current or final outcome. Used to prevent conflicting commitments and give both participants an accurate history; visible only to participants.
- **Operational event record**: Action type, time, non-public record references, and success, rejection, or unresolved outcome, used only to diagnose failures. These records are unavailable to other members and contain no private message text, images, credentials, or unnecessary personal details.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of 20 representative first-time participants can create a profile, publish two items, and save one specific and one category interest within 10 minutes without facilitator assistance, using their own prepared photos.
- **SC-002**: In an agreed evaluation set of at least 40 two-member inventory cases with independently identified qualifying trades, Bartr returns at least one qualifying exchange in at least 90% of cases. The set covers every supported bundle shape, including three-item sides, and includes the chair + calculator ↔ monitor example. In all ranking evaluation cases, 100% of displayed recommendations follow the defined specific-product priorities and percentage-value-gap tie-breaker.
- **SC-003**: In at least 20 paired-description cases whose relevance is independently confirmed, at least 90% produce the same eligible trading opportunity despite different wording such as "desk screen" and "computer monitor."
- **SC-004**: Across all evaluated recommendations and acceptance scenarios, 100% respect ownership, availability, exclusions, community, and bundle limits. All simultaneous overlapping-acceptance and retry scenarios finish without duplicate agreements, partial reservations, or double-committed items.
- **SC-005**: With 1,000 available listings, inventories of up to 30 items per member, and 20 members requesting recommendations concurrently, at least 95% of requests show recommendations or a correct no-match outcome within 10 seconds; failed requests are reported as failures.
- **SC-006**: At least 80% of the 20 pilot participants rate a qualifying recommendation as worth considering at 4 or 5 on a five-point scale, and at least 90% correctly identify what they give, what they receive, why it was suggested, and that acceptance is optional.
- **SC-007**: At least 90% of pilot participant pairs can submit a counteroffer, reach mutual agreement, and record both handoff confirmations within five minutes of active interaction after reviewing listings, excluding time waiting for the other participant or conducting the physical handoff.
- **SC-008**: All specified success and rejection journeys for profile creation, listing, preferences, recommendation review, negotiation, acceptance, cancellation, and completion can be completed using only a keyboard; screen-reader evaluation identifies no unlabeled required controls or unannounced errors or status outcomes.
- **SC-009**: Every unauthorized-access scenario denies another member access to drafts, private preference records, proposals, notes, and agreement history, and prevents unauthorized item and trade changes.

## Assumptions

- This is one initial marketplace feature spanning inventory through exchange completion. Existing application foundations do not imply that accounts, listing persistence, valuation, or matching already exist; planning must cover these prerequisites.
- Initial exchanges are between exactly two people in the same self-selected campus or city community. One to three items per side is the launch boundary, including larger-than-two combinations; expanding that limit or introducing multi-party cycles is future scope.
- Physical, locally handed-off belongings are in scope. Payments, cash supplements, platform credits, shipping management, services, auctions, reviews, university eligibility verification, and dispute adjudication are outside this release.
- USD is the shared comparison currency for the pilot. The 20% default gap and three-item limit are explicit launch defaults chosen where the brief supplied no threshold or cap. Members may accept an imbalanced manually composed offer; numerical similarity never establishes consent.
- Positive interests are alternatives: an incoming item matching any stated interest is relevant. Every item in an automatic receiving bundle must be relevant; explicit exclusions remain mandatory even for manual offers. Ranking follows the defined specific-product priorities and percentage-value-gap tie-breaker; exhaustive, globally optimal search is not promised.
- Automatic value-qualified recommendations depend on positive comparison values and complete, available listings. Owners can correct assisted data, supply values, or negotiate manually during assistance failures. Recommendation explanations cannot treat uncertain estimates as verified facts.
- Open offers do not reserve items or automatically expire. Agreement reserves them until valid cancellation or mutual completion. If one participant reports handoff and the other is unresponsive or disagrees, the record stays unresolved and items remain reserved; automated dispute resolution is outside scope.
- Owners cannot change a reserved item's trading details. A community or preference change affects new recommendations and open offers, while an existing agreement retains its explicitly accepted terms.
- Trade-specific notes provide the coordination channel and may contain voluntarily shared handoff details. External messaging, push delivery, automatic meeting scheduling, dedicated location-collection fields, and physical-delivery verification are not required.
- Private preference records are not public wish lists. Relevant interests may be summarized to explain recommendations; full preferences, drafts, negotiations, and agreements follow the audiences defined under Key Entities.
- The pilot requires members who supply truthful listing information, suitable item photos, and interests. Useful recommendations depend on counterpart inventory; absence of a qualifying trade is a valid outcome.
- Image assistance, valuation assistance, semantic interpretation, reliable saved member/item/trade records, and access to evaluation participants and labeled inventory cases are delivery dependencies. The user-proposed technology providers and stack are inputs to implementation planning, rather than requirements on user behavior.
- Numerical success thresholds are proposed pilot acceptance targets, not claims about current performance. Evaluation cases must be labeled before measuring outcomes and must include empty inventories, no-match cases, missing estimates, stale terms, conflicting actions, and denied access.

