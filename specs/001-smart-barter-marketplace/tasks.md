# Tasks: Bartr Smart Bartering Marketplace

## Phase 1 — Setup and contracts
- [x] T001 Read canonical `specs/001-smart-barter-marketplace/spec.md` and reconcile feature pointer and earlier drafts.
- [x] T002 Write `plan.md`, `research.md`, `data-model.md`, `contracts/api.md` and `quickstart.md`.

## Phase 2 — Foundation
- [ ] T003 Implement atomic MongoDB/test-memory storage in `backend/app/storage/state.py` and server error handling.
- [ ] T004 Add negative, retry, stale and overlapping-action domain tests in `backend/tests/test_marketplace.py` before completing the state machine.

## Phase 3 — US1: Inventory and preferences
- [ ] T005 [US1] Implement real account sessions, profile/preferences and reviewed listing lifecycle in `backend/app/domain.py` and `api/marketplace.py`.
- [ ] T006 [US1] Reuse Swapify image/valuation validation and add owner-reviewed Gemini and Bedrock adapters in `backend/app/services/`.
- [ ] T007 [US1] Build account/inventory/preferences forms with labelled errors and provider failure states in `frontend/app/page.tsx`.

## Phase 4 — US2: Discovery
- [ ] T008 [US2] Implement all nine one-to-three bundle shapes, both percentage limits, reciprocal interests, exclusions, community and dismissals in `backend/app/domain.py`.
- [ ] T009 [US2] Wire revision-checked Atlas retrieval and inspectable recommendation UI in backend services and frontend.

## Phase 5 — US3: Negotiation
- [ ] T010 [US3] Implement versioned proposals, manual-value confirmation, notes, counteroffers and current-sender closure roles in domain/API/UI.

## Phase 6 — US4: Agreement and handoff
- [ ] T011 [US4] Implement atomic agreement/reservations, overlap invalidation, cancellation, two-party handoff and command replay in domain/API/UI.

## Phase 7 — Verification and documentation
- [ ] T012 Verify backend contracts/domain/adapters, frontend typecheck/build, browser journeys, mobile and keyboard behavior; update README and limitations.

Dependencies: T003/T004 precede US1; US1 precedes US2; proposals use the same inventory rules; agreement depends on versioned offers. Adapter fixture tests and UI styling can be performed independently, but no delegated implementation is assumed. Strategy: deliver each journey and keep external-provider readiness distinct from domain correctness. No pilot or performance target is marked achieved without its required evaluation.
