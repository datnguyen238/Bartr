# Implementation Plan: Bartr Smart Bartering Marketplace


**DynamoDB update (2026-11-14):** The approved [DynamoDB entity/access-pattern design](dynamodb-data-model.md) supersedes the MongoDB storage choice for the implemented MVP. Planned richer contracts below remain distinguished from the compatibility adapter.
**Branch**: `main` (actual checkout; setup feature identifier: `001-smart-barter-marketplace`) | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-smart-barter-marketplace/spec.md`

## Summary

Build the initial two-person bartering marketplace on the existing Next.js/FastAPI foundation. Gemini suggests reviewed item attributes, comparison values and semantic interpretations; Bedrock Titan embeds item/interests; Atlas provides authoritative records, transactions and semantic candidate search. A deterministic optimizer assembles one-to-three-item bundles on each side, ranks specific-product matches for both participants before one-participant and category-only matches, then compares exact relative value gaps.

Recommendations never create obligations. Immutable offer versions, participant guard writes, item revisions/availability epochs and transactional receipts ensure consent, reservation, cancellation and handoff remain accurate under concurrent actions and interrupted responses. The plan ends at design: application code, infrastructure provisioning, paid calls and `tasks.md` are outside this command.

## Technical Context

**Language/Version**: Python 3.14 baseline (observed locally: 3.14.2), TypeScript 5.9; target supported Node 24 LTS instead of the repository's current Node 20 default. Preserve Next.js 16.4.6, React 19.3.1, Tailwind 4 and the existing lockfile; update runtime pins and verify exact Python SDK versions during implementation.

**Primary Dependencies**: Existing FastAPI 0.163/Pydantic 2, uvicorn, dotenv, pytest/httpx and shadcn UI. Add PyMongo async, google-genai, boto3, pwdlib with Argon2, python-multipart and Pillow. Add Hypothesis and OpenAPI validation for correctness; frontend development dependencies add Playwright, axe and openapi-typescript. All Python dependencies remain in the single root requirements file. [Research](research.md) justifies each addition.

**Storage**: MongoDB Atlas replica set for accounts/sessions, inventories, policy history, proposals, receipts, jobs and capped binary-image documents. Cosmos-style independent writes, Mongo standalones and search-index state are not reservation authorities. Atlas vector index: normalized Titan V2 1,024-dimensional vectors, cosine similarity, model/community/state/owner filters.

**Testing**: pytest/httpx unit and API-contract tests; Hypothesis arithmetic/subset/ranking properties; real Atlas Local transactions/vector integration; deterministic no-network provider adapters; Playwright plus axe and manual keyboard/screen-reader sessions. Independent 40-inventory/20-wording evaluations, a 1,000-listing load run and 20-person usability pilot remain measured release gates.

**Target Platform**: Responsive desktop/mobile browser, including 390 CSS-pixel layout; current stable Chrome/Firefox/Safari/Edge validation, keyboard and screen reader. Linux-hosted FastAPI and Next; macOS local development. Reference recommendation-load environment: four CPU cores and 8 GiB memory, one ASGI process with a bounded matching process pool up to four workers; record actual hardware/results rather than claiming the goal is already met.

**Project Type**: Web application with one same-origin browser API and one durable-job worker process. Native fetch/client state and typed contracts; no separate gateway, Redis, Celery, event bus, or extra identity/object-storage vendor.

**Performance Goals**: SC-005: 95% correct recommendation/no-match outcomes within ten seconds at 1,000 available listings, up to thirty items/member and twenty simultaneous requesting members. Nine-second processing budget, cached reviewed semantic artifacts and no per-candidate provider call. Process-pool admission/queue capacity must accommodate the specified twenty-request load; overload outside that envelope is explicit, never a false no-match.

**Constraints**: Two participants, one-to-three distinct owned physical items/side; same current community; exclusions mandatory; known positive values for automatic recommendations. USD cents and basis-point limits, default 2,000 bps. Manual proposals may be unequal or unknown-valued with warnings. Both participants explicitly consent to the identical current version; agreement reserves every item together. No automatic expiry or unilateral release after a reported handoff.

**Scale/Scope**: Four end-to-end user journeys, all nine bundle shapes, one initial local-community pilot. Live Gemini use is limited to adults 18+ with self-attestation and a supported paid project/region; no date of birth or university verification. Operational pilot targets: 99.5% monthly application availability, restore within four hours, disaster data loss at most one hour; backup capability and restore drill must establish these before hosted rollout.

## Constitution Check

*Gate: evaluated before Phase 0 and re-evaluated after Phase 1 design.*

| Principle | Before research | Post-design evidence and result |
|---|---|---|
| I. Specify User Outcomes | PASS: validated spec and clarified recommendation order | PASS: four journeys trace to the domain model, public/provider contracts, quickstart and nine success outcomes. Defaults remain documented; no payment/shipping/dispute scope added. |
| II. Preserve Trading Integrity | PASS: required ownership, consent and lifecycle invariants identified | PASS: [data-model.md](data-model.md) defines shared guard writes, immutable reviewed versions, item CAS/epochs, intermediate-policy history, atomic reservation/release/completion and durable member-scoped replay receipts. |
| III. Protect Privacy and Access | PASS: data purposes and audiences recorded | PASS: opaque session authority, CSRF/Origin checks, owner/participant queries, private snapshot/image access, sanitized AI payloads and diagnostic exclusions. Provider age/data constraints are explicit in [research R8](research.md#r8--gemini-integration-and-data-boundary). |
| IV. Understandable and Accessible Journeys | PASS: success/failure/accessibility scenarios included | PASS: [matching-and-ui.md](contracts/matching-and-ui.md) defines loading/empty/failure/unresolved states, confirmations, keyboard/focus, screen-reader feedback and responsive review of both bundle sides. |
| V. Verify Behavior and Keep Design Simple | PASS: bounded scope and proportional verification required | PASS: [quickstart.md](quickstart.md) separates existing checks from planned contract/race/provider/E2E evaluations; each new dependency serves a stated capability. One database and a small worker avoid unrelated services. |
| Product/data compatibility and recovery | PASS: foundation has no business data to migrate | PASS: additive API preserves health, versioned bootstrap/indexes precede traffic, retained offer evidence, separate embedding versions, backup/restore rehearsal and trading suspension on restore. |

No constitutional conflict or exception is required. Constitution v1.0.0's unconfirmed ratification date is existing governance metadata; this feature does not amend it. Post-design PASS means the documented design satisfies the principles; implementation still has to pass the specified checks.

## Project Structure

### Documentation (this feature)

```text
specs/001-smart-barter-marketplace/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── openapi.json
    ├── provider-contracts.md
    └── matching-and-ui.md
```

`tasks.md` belongs to the later `$speckit-tasks` phase and is not generated here.

### Source Code (repository root)

The foundation paths already exist; the feature modules below are proposed implementation locations, not files created by this planning command.

```text
requirements.txt                     # sole Python dependency declaration
compose.yaml                         # Atlas Local, loopback binding, pinned image
backend/
├── app/
│   ├── main.py                      # preserve app factory/health; add lifespan/client wiring
│   ├── api/
│   │   ├── routes.py                # existing health route
│   │   ├── auth.py, members.py
│   │   ├── items.py, recommendations.py, trades.py
│   │   └── schemas.py               # explicit public/private request/response models
│   ├── core/
│   │   ├── config.py, security.py, database.py
│   │   └── catalogs.py
│   ├── domain/
│   │   ├── money.py, eligibility.py, matching.py
│   │   └── trade_states.py
│   ├── services/
│   │   ├── accounts.py, inventory.py, trading.py
│   │   ├── recommendations.py, commands.py, images.py
│   │   └── enrichment.py
│   ├── integrations/
│   │   ├── gemini.py, bedrock.py, vector_search.py
│   │   └── fixtures.py
│   ├── worker.py                    # leased enrichment/invalidation jobs
│   └── manage.py                    # bootstrap/seed/evaluate/benchmark/provider-smoke
└── tests/
    ├── test_api.py                  # keep foundation checks
    ├── unit/
    ├── contracts/
    ├── integration/
    └── fixtures/
frontend/
├── app/
│   ├── page.tsx, layout.tsx, globals.css
│   ├── sign-in/, register/, inventory/, preferences/, discover/
│   ├── items/[id]/, trades/[id]/
├── components/
│   ├── ui/                          # existing primitives
│   └── marketplace/                 # listing/bundle/review/status forms
├── lib/
│   ├── api.ts, api-types.ts          # existing helper extended; generated contract types
│   └── commands.ts                  # CSRF, If-Match, stable retry keys/reconciliation
├── tests/e2e/
└── playwright.config.ts
```

**Structure Decision**: Keep the existing split application and same-origin `/api` rewrite. FastAPI owns business authorization and transactions; Next owns presentation. Pure domain modules isolate arithmetic/eligibility from SDKs. Services use explicit collections and command helpers rather than adding a generic repository/ODM layer. The provider adapters exist because fixture/live contract parity is required, not to enable automatic vendor switching.

## Design and Delivery Boundaries

### Phase 0 resolution

[research.md](research.md) resolves runtime/client compatibility, sessions, storage, transaction serialization, retry receipts, semantic constraints, optimization, provider contracts, operational budgets and verification. Decisions cite primary documentation; mathematical/transaction protocols are labeled as application choices. No unresolved clarification blocks task generation.

### Phase 1 authoritative records and commands

[data-model.md](data-model.md) is the persistence/invariant design. The API in [contracts/openapi.json](contracts/openapi.json) contains 36 operations on 31 paths and 49 component schemas. Preserve `GET /api/health`; add account/profile/preferences, item/image/analysis, recommendation, trade/offer/note/action and member-scoped operation endpoints.

Use UUID identifiers, revision ETags and required `If-Match` for edits/actions on existing resources. Authenticated state-changing commands carry one member-scoped `Idempotency-Key`; replays resolve receipts before stale preconditions. Pure preview/recommendation/interpretation queries use CSRF/Origin but do not commit trade state. Absent or private resources return no private content. Schema values are transport shapes, not an authorization mechanism.

Offer preview revalidates selected item revisions and returns give/receive snapshots, values, warnings and `terms_hash`. Sender submission and recipient acceptance revalidate current facts and require the current warnings to be acknowledged. Invalid source facts require renewed review. Preview itself creates no consent.

All business mutations re-read inside a bounded Mongo transaction. Proposal creation and every open-trade command write shared participant guards; item edits/removal touch their owner's guard; hard-policy changes touch their member guard and append immutable policy snapshots. Notes and close actions therefore cannot bypass effective invalidation. Conditional item writes and one trade revision serialize conflicting state transitions. Effective invalidation checks historical policy/revision/availability evidence immediately, comparing community changes against the offer's original common community; a background projection cannot authorize a stale offer. Agreed/awaiting-handoff commands use trade CAS because later preferences do not change accepted terms.

Only all-or-nothing agreement, valid cancellation or mutual handoff completion changes commitments. A timeout cannot create a successful or cancelled result. Unknown commit means 202 unresolved with a stable operation key, not retrying a new command.

### Semantic preparation and matching

[provider-contracts.md](contracts/provider-contracts.md) fixes supported payloads, privacy boundaries, source-revision fencing and provider error categories. Images are reviewed before publication; embeddings and interpreted facts are prepared outside recommendation/transaction callbacks. A worker can resume unfinished jobs after restart.

[matching-and-ui.md](contracts/matching-and-ui.md) specifies the bounded subset search, exact gap arithmetic, specific-product tiers, whole-pilot fallback, source freshness and separate dismissal signature. Search-index availability/community fields may lag; current members/items govern eligibility. No-match requires complete evaluation; incomplete dependencies/budget return an actionable failure.

### Implementation sequence for task decomposition

1. Bootstrap config, catalogs, real replica-set indexes, opaque sessions, CSRF/authorization, receipts and typed API errors; preserve the health path.
2. Deliver profile/preferences and reviewed inventory/image management with manual fallbacks and permission checks.
3. Add provider adapters, durable enrichment, semantic fixtures/index contracts and deterministic bundle/ranking evaluation.
4. Add immutable offers, guarded transactions, notes, cancellation/handoff and operation reconciliation before enabling acceptance in the UI.
5. Complete browser journeys and release evidence: semantic quality, races/retries, accessibility, load, backup/restore and participant usability.

These are dependency boundaries for `$speckit-tasks`, not implementation tasks or a generated task checklist.

### Compatibility, rollout and recovery

The current app stores no business records. Bootstrap new versioned collections/indexes/catalogs rather than migrate invented legacy users. Preserve `/api/health` and its response; expose business routes only after schema/index readiness. Keep sample/demo records restricted to nonproduction fixture environments.

Release database/index bootstrap and backward-compatible API before UI features. A model/dimension change creates new versioned artifacts/indexes and passes the labeled evaluation before switching readers. Older artifacts are retained until rollback is safe. Keep additive API fields optional where possible; incompatible changes require a new version and migration guide.

A hosted pilot uses TLS, private database access, managed credentials, real backup capability and a rehearsed restore. Restore to an isolated target, verify referenced images/policy/receipts, reconcile every reservation against its agreement, and reopen trading only after consistency checks. Rollback disables new mutations and restores compatible application/configuration; it must never release accepted items merely because code was rolled back.

## Verification and Acceptance Mapping

| Evidence | Requirements / outcomes |
|---|---|
| Account/profile, ownership, session/CSRF, private projections | FR-001–003, FR-015, FR-030; SC-001, SC-009 |
| Reviewed image/valuation/manual path and source fencing | FR-004–007, FR-013; Story 1/2 failures |
| Semantic readiness, all nine shapes, exact boundary gaps and specific-product-first order | FR-008–012; SC-002, SC-003, Story 2.10 |
| Preview/offer versions, warnings, counteroffers and role changes | FR-014–020, FR-027; SC-007 |
| Real concurrent acceptance, item/policy changes, restoration, retries, notes-vs-close and handoff/cancel races | FR-019–026, FR-029; SC-004 |
| Desktop/390px, keyboard, screen reader, announced errors/unresolved status | FR-028; SC-008 |
| 200-request load on recorded reference environment and independently labeled/pilot evaluations | SC-005, SC-006 plus semantic/flow outcomes |

[quickstart.md](quickstart.md) distinguishes commands already available from the validation commands to add during implementation. No live model, Atlas cluster, backup or deployment was provisioned or tested while producing this plan.

## Complexity Tracking

No constitution violations or waived gates. The guard/policy history, item epochs, receipts and leased jobs are necessary to satisfy the specified concurrency, permanence and recovery semantics. Every other infrastructure addition is deferred until evidence requires it.
