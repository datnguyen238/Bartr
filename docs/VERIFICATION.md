# Bartr MVP verification

Canonical scope: [root feature specification](../specs/001-smart-barter-marketplace/spec.md). Earlier bundle-only drafts are superseded.

Record future evidence using the [engineering workflow](ENGINEERING.md#evidence-and-completion-records): revision, scope, exact evaluation, environment, storage/provider mode, result and limitations. Its [evaluation matrix](ENGINEERING.md#evaluation-matrix) defines proportionate checks for each changed domain. This process documentation adds no new execution results to the status below.

## Implemented paths

Backend capabilities include account registration/sign-in/out with hashed passwords and opaque sessions; public profiles and private preferences; draft/photo/publication/edit/removal; reviewed Gemini suggestions; revision-bound valuation evidence; Bedrock embedding and Atlas retrieval adapters; deterministic one-to-three item matching with both gap limits; dismissals; manual proposals, notes/counteroffers and exact-version consent; atomic reservations/overlap invalidation; cancellation and two-party handoff.

The current frontend exposes Home authentication, direct Inventory/Preferences navigation and Account in the header. Trade is a public preparation screen; discovery and offers controls remain deferred. The redesign and its evidence are recorded below. See the [profile guide](PROFILE.md), [original profile plan](../.claude/plans/profile-page.plan.md) and [original TDD evidence](../.claude/tdd/profile-page.tdd.md). The backend trading rules remain implemented.

## Verification in progress

Backend domain, account/API, photo-upload, Gemini adapter/evidence and Bedrock fixtures are exercised offline. Browser checks use explicitly temporary memory storage and fake photo content, with owner-entered example prices. This is not a live valuation or Atlas search validation.

## External and evaluation limitations

- Gemini/Bedrock/Atlas credentials and live vector index access have not been supplied or tested in this repository. Model availability and permissions must be checked in the team's accounts.
- MongoDB compare-and-swap persistence is implemented; actual Atlas restart/concurrent-write verification remains required. The domain's concurrency tests use isolated in-memory storage.
- Exact-text local mode does not meet the semantic-equivalence criteria; the configured semantic adapters need their labeled retrieval evaluation.
- The spec's 20-person pilot, 40-case recommendation quality set, 20 paraphrase cases, screen-reader audit, 1,000-listing/20-request load test and associated numerical targets have not been run and are not claimed achieved.
- An individual document aggregate bounds this prototype's scale. Request contention or capacity failure is reported explicitly instead of falling back to unsaved data.

## Profile frontend increment — 2026-11-14

Requirements: Story 1, FR-001–003, FR-006, FR-028 and FR-030. Evidence identity: GREEN implementation checkpoint `8956627`, tested as the equivalent working tree before commit; RED/GREEN references are indexed in the [TDD report](../.claude/tdd/profile-page.tdd.md). Environment: macOS arm64, Node 25.6.0/npm 11.17.0, Next 16.4.6/React 19.3.1, Vitest 4.1.12, Playwright 1.65.1 with installed Chrome, Python 3.14.2.

| Evaluation | Result | Storage/provider boundary |
|---|---|---|
| `npm run test:coverage` | **Passed: 58 unit/component tests**; six new session/guard/profile/home modules: 98.52% lines, 97.76% statements, 95.65% branches, 98.18% functions | Synthetic transport/provider fixtures; excludes legacy provider/trade/inventory code from percentage |
| `npm run test:e2e` | **Passed: 18 Chrome scenarios**, including keyboard and 390px Profile subpages | Real Next.js, intercepted synthetic API; frontend evidence |
| `npm run test:backend` | **Passed: 1 complete browser journey** with real HTTP-only cookie, revision conflict, saved profile/inventory, logout and expiry | Real local FastAPI/Next.js, synthetic accounts, temporary memory; providers disabled |
| `.venv/bin/python -m pytest backend/tests/test_marketplace.py backend/tests/test_marketplace_api.py -q` | **Passed: 21 existing domain/API tests** | Isolated in-memory repository and synthetic image/provider fixtures |
| `npm run typecheck`; `npm run build` | **Passed** | Local TypeScript and production webpack build |
| Changed local Markdown links; `git diff --check` | **Passed** | Eight changed documents; repository whitespace |

Independent read-only review found same-session response ordering, authentication busy ownership and stale-item recovery gaps. Regression tests reproduced each gap before fixes; re-review closed all findings. The new inventory recovery compares saved facts without silently replacing a draft, and requires explicit replacement before adopting the newer revision.

Actual Atlas persistence/contention, live provider quality, hosted configuration, full screen-reader audit, performance and pilot evaluations remain **not run** for this increment. No deployment occurred; no persistence migration is needed. The frontend rollback path preserves existing saved account/item formats.

## Full frontend redesign — 2026-11-14

Requirements: Story 1; FR-001–006, FR-013, FR-028 and FR-030; preserve existing exchange eligibility, revision, consent and privacy boundaries. Evidence identity: working tree based on `339837c947cc7a802b8cb616e084aa8cdefabb8c`, including the full UI redesign. Environment: macOS arm64, Node 25.6.0, Python 3.14.2, Next 16.4.6, Vitest 4.1.12, installed Chrome.

The owner requested all five prior critique priorities and Apple's design principles, then confirmed a focused workspace with an inventory list. The resulting web interface replaces the repeated hero and nested navigation with a desktop sidebar/mobile navigation, direct task screens, a focused compact editor, separate in-memory listing drafts, photo-first private preparation, explicit publication readiness, plain-language chip preferences and local accessible feedback. Available/removed/reserved updates retain dirty facts and reviewed revisions while locking unavailable listings. No trading-state or persistence contract changed. See the [profile guide](PROFILE.md) and [finish review](../.impeccable/review/finish-review.md).

| Evaluation | Result | Storage/provider boundary |
|---|---|---|
| `npm run test:coverage` | **Passed: 90 unit/component tests**; configured coverage scope 96.1% lines, 93.93% statements, 82.22% branches, 93.1% functions | Synthetic transport/provider fixtures; percentages cover the modules selected by Vitest, not the whole frontend |
| `npm run test:e2e` | **Passed: 27 Chrome scenarios** on the final UI | Real Next.js with intercepted synthetic API; includes authentication/routing, draft restoration, guarded publication, local errors, keyboard interaction and responsive cases |
| `npm run test:backend` | **Passed: 1 complete local journey**, including real cookie/session, revision conflict, saved profile/inventory, logout and expiry | Real FastAPI/Next.js, synthetic accounts, explicit temporary memory; live providers disabled |
| `BARTR_NEXT_DIST_DIR=.next-build npm run build` | **Passed**, including production compilation, TypeScript and static generation | Local production webpack build; isolated output leaves normal dev service available |
| Visual review | **Ship**; all five original priorities resolved; 25 captures opened and validated | Fictional fixture data at 1440×1000, 390×844, 320×760, dark 390px and 200% text; all five core routes |
| Design hook | No deterministic design-quality findings reported on edited UI files | Active automatic hook; no redundant manual detector run |

Initial browser failures were test mismatches with the new chip/field-feedback UI and Next's empty route announcer; the assertions were corrected while preserving their behavioral checks. A subsequent enlarged-text check caught a preview-header overflow; flexible wrapping fixed it, the affected case passed, and the final full 27-scenario suite passed. An independent source review also found dirty-draft availability feedback; that gap was fixed with reserved/removed/missing-item regressions.

Unfinished drafts are account-scoped memory retained across item switching and in-app navigation, not persistence across full reloads. The checks do not establish actual Atlas durability/contention, live AI quality, semantic evaluation, hosted configuration, full screen-reader acceptance, physical-device behavior, load or pilot outcomes. No deployment or backend persistence migration occurred. Browser test services use isolated output directories and are stopped by Playwright after each run.
