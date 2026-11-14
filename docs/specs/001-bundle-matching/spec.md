> Superseded by [the canonical root specification](../../../specs/001-smart-barter-marketplace/spec.md). Retained only as an earlier draft; its pending-policy notes are no longer authoritative.

# Feature Specification: Inventory Bundle Matching

**Feature Branch**: Not created; documentation is on the current working branch.
**Created**: 2026-11-14
**Status**: Draft — product policies need confirmation before dependent implementation.
**Input**: Owner-supplied Bartr product brief; use Swapify as the implementation reference. See [the source brief](../../PRODUCT-BRIEF.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Describe an inventory and desired items (Priority: P1)

As a participant, I can list multiple items I am willing to trade and describe desired products or categories so recommendations consider my actual inventory and interests.

**Why this priority**: Bundles require owner-specific inventory and preferences.
**Independent Test**: Create two participants with separate inventories and preferences; verify each participant can change only their own data and see what is offered versus wanted.

**Acceptance Scenarios**:
1. **Given** a participant with a chair and a calculator, **When** they list both, **Then** each item retains its own ownership, condition, availability and value provenance.
2. **Given** a preference for monitors, **When** the participant describes it in natural language, **Then** they can review the interpreted preference without an AI silently changing their constraints.
3. **Given** an item belonging to another participant, **When** an unauthorized person attempts to edit it, **Then** the change is rejected.

### User Story 2 - Discover a mutually useful bundle (Priority: P1)

As a participant, I receive feasible combinations from both inventories rather than only isolated item pairs.

**Why this priority**: This is the product's stated innovation.
**Independent Test**: Use the owner's chair/calculator/monitor fixture, with participant constraints explicitly allowing that exchange. Verify it is discovered and explained as $60 versus $65, without treating $5 as a global tolerance.

**Acceptance Scenarios**:
1. **Given** the canonical example and compatible participant constraints, **When** recommendations are requested, **Then** the chair plus calculator can be proposed for the monitor, with individual items and summed estimated values shown.
2. **Given** fixtures for one-to-one, one-to-many, many-to-one and many-to-many trades, **When** feasible combinations are requested, **Then** each supported combination can be represented without duplicating an item or confusing its direction of transfer.
3. **Given** semantically related items that violate a required condition or participant constraint, **When** candidates are retrieved, **Then** those candidates are not presented as feasible just because they are similar.
4. **Given** equivalent wording for an interest, **When** candidate retrieval runs, **Then** relevant items can be found without requiring exact title equality.
5. **Given** a single-item inventory, **When** recommendations are requested, **Then** no nonexistent second item is invented.

### User Story 3 - Review, adjust and decide (Priority: P2)

As a participant, I can inspect an explanation, negotiate a changed bundle and accept or decline exact terms without automatic commitment.

**Why this priority**: Suggestions have value only if users remain in control.
**Independent Test**: Propose a bundle, change one included item, and verify approval of the old terms does not approve the changed bundle.

**Acceptance Scenarios**:
1. **Given** a recommendation, **When** a participant opens it, **Then** the explanation identifies both inventories, preference fit, individual values, total values, and uncertainty without claiming guaranteed market value.
2. **Given** changed items or conditions, **When** a revised proposal is submitted, **Then** earlier approvals cannot authorize the revised terms.
3. **Given** an unavailable or changed item, **When** a participant attempts acceptance, **Then** the authoritative service rejects stale terms and explains what needs review.
4. **Given** an AI recommendation, **When** neither participant accepts, **Then** no trade is committed by AI action.

### Edge Cases

Empty inventories; missing or uncertain valuations; unrelated preferences; no feasible bundle; duplicate items; withdrawn items; concurrent acceptance involving the same item; deleted images; provider quota/timeout failures; vector indexing delay; inconsistent embedding models or dimensions; stale revisions; changed private limits; one participant accepting before the other; declined proposals being retried.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users can maintain their profiles, tradable inventories and desired products/categories.
- **FR-002**: User-provided facts remain distinguishable from AI observations and valuation evidence.
- **FR-003**: Recommendations consider the actual available inventories of both participants.
- **FR-004**: Bundles can represent one-to-one, one-to-many, many-to-one and many-to-many exchanges within explicitly documented supported limits.
- **FR-005**: A candidate must satisfy ownership, availability and participant constraints before being presented as feasible; preference similarity is supporting evidence, not authorization.
- **FR-006**: Explanations must reflect the actual validated bundle and values. Unknown values cannot be silently converted to zero or invented prices.
- **FR-007**: Values remain estimates; the owner-supplied example is a fixture, not market evidence.
- **FR-008**: Participants can review, decline, negotiate or accept exact proposal terms. Changes require new review and cannot inherit approval of different terms.
- **FR-009**: A participant cannot edit another participant's inventory or approve on their behalf. Shared items cannot be committed to conflicting trades.
- **FR-010**: Operational failures produce explicit actionable states; an AI provider failure cannot automatically accept a trade or fabricate matching evidence.
- **FR-011**: Saved valuations and their provenance are retained per relevant item revision without automatic expiry, following the owner's earlier instruction.
- **FR-012**: The following product policies require confirmation before their implementation: acceptable value imbalance and uncertain-value handling; bundle inclusion permissions and limits; ranking/tie-break priorities. No numeric defaults are approved by the example.

### Key Entities

- **Profile**: A participant and their public profile information, separate from authentication credentials.
- **Inventory item**: Owner, description, image reference, category, condition, availability, revision, and associated valuation.
- **Preferences and constraints**: Desired products/categories and participant-approved conditions or negotiation limits, with private limits protected.
- **Valuation**: Item revision, estimated value/range, method, evidence, model/policy and evaluation time.
- **Bundle candidate**: Two participants, distinct outgoing item sets, fit evidence and estimated totals; not a commitment.
- **Trade proposal**: Versioned exact bundle terms, participant decisions and state needed to prevent conflicting commitments.

## Success Criteria *(mandatory)*

- **SC-001**: The canonical chair-plus-calculator-for-monitor fixture is discovered when both participants' constraints permit it; the displayed totals are exactly $60 and $65.
- **SC-002**: Each of the four approved exchange shapes has a passing acceptance fixture.
- **SC-003**: Unauthorized edits, duplicated items, unavailable items, and stale approvals are rejected in acceptance fixtures.
- **SC-004**: Explanations name only included items and trace numerical claims to supplied valuations; missing values remain explicitly unknown.
- **SC-005**: Provider and search failures are visible, and no generated recommendation commits a trade without both participants' decisions on current terms.

## Assumptions and Scope Boundaries

The initial bundle journey is between two participants, as in the owner's example. Multi-party cycles are a separate extension, not a prerequisite for bundle matching. No money changes hands. Existing Swapify wallet/chain/A2A features are not automatically imported. Exact product policies listed in FR-012 must be approved before coding the dependent optimizer or commitment behavior. The current request's implementation-versus-planning scope is pending the owner's response.
