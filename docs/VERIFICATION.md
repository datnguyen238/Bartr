# Bartr MVP verification

Profile/trade merge resolution: `caf5b3b` merged with the current `origin/main`, uncommitted merge result; Python 3.12 with in-memory/fixture tests and Node 20.19.0. `.venv/bin/python -m pytest backend/tests/test_trade_live.py backend/tests/test_marketplace.py -q`: 23 passed. Frontend `npm run typecheck` and `npm run build`: passed; `npm test`: 98 passed. Trade navigation uses the incoming session gate and shell while preserving the live trade workspace. Browser, real DynamoDB, provider and independent review evidence were not run. The incoming `@testing-library/jest-dom` package warns it requires Node 22 even though these tests passed on Node 20.

WebSocket follow-up: revision `20b575a` plus uncommitted changes; Python 3.12, Node 20.19.0, temporary single-process memory storage, provider fixtures. `.venv/bin/python -m pytest backend/tests -q` passed (63 passed, 1 live DynamoDB test skipped). An isolated local Next.js 16 webpack development proxy and Uvicorn test using two synthetic accounts, synthetic photos and `/private/tmp/bartr_ws_probe.py` passed message delivery over the WebSocket; servers were stopped afterward. In-process WebSocket coverage checks denied origin/nonparticipant, reconnect, and session revocation while connected. Live DynamoDB, deployed proxy, multi-worker operation, load, browser interaction and independent review remain unverified. Each live connection polls storage approximately every two seconds.

Trade composer alignment: revision `20b575a` plus uncommitted changes; Node 20.19.0, frontend `npm run typecheck` and `git diff --check` passed. The single-line input uses native form submission for Enter; browser interaction and accessibility verification were not run. No storage or providers were exercised.

Chat composer refinement: revision `20b575a` plus uncommitted changes, Node 20.19.0. Frontend `npm run typecheck` and `git diff --check` passed; no storage or provider exercised. Browser and assistive-technology verification were not run. The composer uses the existing shadcn Input and Button; it accepts single-line messages.

Trade visual refinement: revision `20b575a` plus uncommitted changes, Node 20.19.0. `cd frontend && npm run build` passed and `git diff --check` passed; no database or provider used. Browser preview was unavailable because the browser access host could not be reached. Responsive and assistive-technology checks remain unrun.

Trade layout refinement: revision `20b575a` plus uncommitted changes, Node 20.19.0; frontend typecheck and `git diff --check` passed. The separate previous-offers section was removed; superseded terms remain visible as conversation events under FR-016. Browser, responsive and accessibility verification were not run; no database or provider was exercised.

Trade workspace layout: revision `20b575a` plus uncommitted changes, frontend Node 20.19.0; `npm run build` passed before a follow-up counteroffer editing-state fix, and `npm run typecheck` passed after it. Item selection uses keyboard-accessible checkboxes and keeps the existing offer/consent API. Browser, two-account, assistive technology and responsive checks were not run; storage and providers were not exercised by these frontend checks.

Trade live-update follow-up: revision `20b575a` plus uncommitted changes. Python 3.12, temporary memory storage and provider fixtures: `.venv/bin/python -m pytest backend/tests -q` passed (63 passed, 1 live DynamoDB test skipped); after a subsequent socket send optimization `.venv/bin/python -m pytest backend/tests/test_trade_live.py -q` passed. Frontend `npm run typecheck` passed and `npm run build` passed with Node 20.19.0. The initial build under Node 18.17.0 failed its version requirement. Tests exercise participant authorization, origin rejection, saved messages and reconnect using an in-process client. Two-browser behavior, WebSocket upgrades through the Next proxy, session expiry while connected, real DynamoDB and multi-worker delivery, load, accessibility and independent review were not verified. Delivery uses periodic repository reads; notifications are not implemented.

Canonical scope: [root feature specification](../specs/001-smart-barter-marketplace/spec.md). Earlier bundle-only drafts are superseded.

Record future evidence using the [engineering workflow](ENGINEERING.md#evidence-and-completion-records): revision, scope, exact evaluation, environment, storage/provider mode, result and limitations. Its [evaluation matrix](ENGINEERING.md#evaluation-matrix) defines proportionate checks for each changed domain. This process documentation adds no new execution results to the status below.

## Implemented paths

Backend capabilities include account registration/sign-in/out with hashed passwords and opaque sessions; public profiles and private preferences; draft/photo/publication/edit/removal; reviewed Gemini suggestions; revision-bound valuation evidence; Bedrock embedding and Atlas retrieval adapters; deterministic one-to-three item matching with both gap limits; dismissals; manual proposals, notes/counteroffers and exact-version consent; atomic reservations/overlap invalidation; cancellation and two-party handoff.

The current frontend exposes Home authentication and a unified Profile with in-page Items/Preferences sections, Edit profile and focused item forms. Trade is a public preparation screen; discovery and offers controls remain deferred. The redesign and its evidence are recorded below. See the [profile guide](PROFILE.md), [original profile plan](../.claude/plans/profile-page.plan.md) and [original TDD evidence](../.claude/tdd/profile-page.tdd.md). The backend trading rules remain implemented.

DynamoDB is the default saved-data backend in the combined branch; MongoDB and explicit temporary-memory storage remain available. The DynamoDB schema and image-valuation history imported from `main` is recorded separately below. Historical results describe their labeled revisions and do not certify this merge.

## Verification in progress

Backend domain, account/API, photo-upload, Gemini adapter/evidence and Bedrock fixtures are exercised offline. Browser checks use explicitly temporary memory storage and fake photo content, with owner-entered example prices. This is not a live valuation or Atlas search validation.

## External and evaluation limitations

- Gemini/Bedrock/Atlas credentials and live vector index access have not been supplied or tested in this repository. Model availability and permissions must be checked in the team's accounts.
- MongoDB compare-and-swap persistence is implemented; actual Atlas restart/concurrent-write verification remains required. DynamoDB has the historical scoped evidence below; this does not establish production load or migration/recovery readiness. The domain's isolated tests use temporary memory, and DynamoDB fixtures use Moto.
- Exact-text local mode does not meet the semantic-equivalence criteria; the configured semantic adapters need their labeled retrieval evaluation.
- The spec's 20-person pilot, 40-case recommendation quality set, 20 paraphrase cases, screen-reader audit, 1,000-listing/20-request load test and associated numerical targets have not been run and are not claimed achieved.
- Storage and transaction capacity bound this prototype's scale. The MongoDB adapter uses a bounded document aggregate; DynamoDB uses normalized records with a snapshot compatibility layer. Request contention or capacity failure is reported explicitly instead of falling back to unsaved data.

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

## DynamoDB schema v1 — historical verification imported from main

This record was imported from `main` at `0d5d1cc`; the original revision labels and outcomes below describe that earlier work, not the current merge.

Revision `a6b4d5d` plus the uncommitted schema and numeric-normalization changes; Python 3.12 project virtual environment. The complete backend suite in temporary memory and Moto fixture modes was run locally. A separate synthetic scoped test against the existing `bartr-dev` table in `us-east-1` passed live read/write, competing acceptance, restart, cancellation, replay, completion and cleanup (provider fixtures; no live Gemini or semantic evaluation): `BARTR_LIVE_DYNAMODB=1 AWS_PROFILE=bartr-dev AWS_REGION=us-east-1 .venv/bin/python -m pytest backend/tests/test_dynamodb_live.py -q` — **1 passed**. An initial sandboxed run failed DNS; an unrestricted first run exposed numeric normalization in offer hashes, fixed before the passing run. This does not prove production load, migration, recovery, or provider quality. The adapter still scans a consistent snapshot for domain operations; the Query helpers are not the primary API access path. Existing legacy data requires a separately reviewed migration.

`.venv/bin/python -m pytest backend/tests -q` — **62 passed, 1 skipped** (live test requires the explicit command above). An earlier run failed in Moto's concurrent in-memory bookkeeping; the fixture now tests overlap sequentially, while the live test exercises simultaneous acceptance.

Follow-up on the same revision and uncommitted working tree: the live scoped DynamoDB test also passed synthetic login, session authentication and logout. Frontend `npm run typecheck` passed. `npm run build` failed because the available Node version is 18.17.0; the project requires Node 20.19 or newer. Browser interaction and live Gemini valuation were not run.

## Earlier DynamoDB login and image valuation increment — historical status

New code selects a namespaced DynamoDB repository, retains profile/password/session identity, normalizes and chunks uploaded JPEGs, requests one Gemini image estimate, and requires explicit revision-bound owner acceptance before the amount appears as an assisted listing value. Fixtures cover conditional-write conflict handling, multi-chunk photo roundtrip/deletion, stale/foreign analysis rejection and corrected-owner-value provenance.

Evidence at that earlier checkpoint: source inspection only. App, unit tests, builds, AWS calls, table lookup and Gemini calls were **NOT RUN** under the owner's instruction for that increment. Previous test totals do not cover this increment. Table name/key schema remain a configuration dependency. The frontend is unchanged. Existing MongoDB data is not migrated. The bounded aggregate/chunk storage design is documented separately and is not claimed scalable or production-verified.

## Profile merge with main — 2026-11-14

Change identity: resolution of `main` at `0d5d1cc` into `profile` at `76594a9`, evaluated in the working tree before the merge commit. Scope: preserve profile UI and session/listing behavior (FR-001–003, FR-006, FR-028, FR-030) while retaining main's DynamoDB, image-assessment and privacy changes. All existing profile routes, layouts, visual components, CSS, assets, frontend configuration and package files match the pre-merge profile revision. Frontend differences are limited to storage/analysis response types, optional explicit `analysis_id` forwarding and a regression for consent/revision handling. Backend files match the incoming main revision exactly. Profile ignore rules, plans, test setup and documentation were retained, including files automatically removed by main's earlier reverts.

Environment: macOS, Node 25.6.0 / npm 11.17.0 / Next 16.4.6; project virtual environment Python 3.14.2. Installed declared boto3/Moto and Google GenAI dependencies after initial backend collection failed because the AWS SDK was absent. No application credentials were used for verification. The initial browser run could not bind localhost under restricted permissions; its approved retry passed.

| Evaluation | Mode and outcome |
|---|---|
| `env BARTR_STORAGE=memory BARTR_LIVE_DYNAMODB=0 AWS_EC2_METADATA_DISABLED=true GEMINI_API_KEY= .venv/bin/python -m pytest backend/tests -q -rs` (root) | **62 passed, 1 skipped**, 9.17 s; memory/domain/API, Moto DynamoDB emulator and provider fixtures. The explicitly opted-out live DynamoDB check is the only skip. |
| `npm run typecheck` (`frontend/`) | **Passed**, including a final run after restoring Next-generated configuration changes. |
| `npm test` (`frontend/`) | **91 passed** in 6 files, 3.45 s; Vitest/jsdom and mocked API responses. |
| `BARTR_NEXT_DIST_DIR=.next-build npm run build` (`frontend/`) | **Passed** webpack production compilation, TypeScript and generation of all 14 pages. |
| `npm run test:e2e` (`frontend/`) | **27 passed**, 23.5 s; installed Chrome, synthetic intercepted API fixtures, isolated Next output and port 3100. |
| `npm run test:backend` (`frontend/`) | **1 passed**, 7.9 s; installed Chrome, real local cookie/session/profile/inventory requests against one temporary-memory Uvicorn service on port 8101 and frontend port 3101. Gemini/Bedrock settings empty; providers not invoked. |
| Source and merge review | **Passed** independent review, all profile visual files compared with their pre-merge contents, backend compared with main, conflict-marker/relative-link/whitespace checks. Local and remote main remained `0d5d1cc`. |

The browser test services stopped after verification. Build, coverage and browser-result files remain ignored and are excluded from the merge. This merge evaluation does not repeat historical live AWS tests or establish live Gemini quality, real database migration/recovery, production load, full screen-reader acceptance or deployment readiness.

## Unified Profile and focused forms — 2026-11-14

Requirements: Story 1; FR-001–006, FR-028 and FR-030. Change identity: working tree based on `5732f865ce16c8eb0477363a36b57d1550421652`. The owner specified a social-style Profile with item management and preferences on one page, personal details behind Edit profile, and an Add item form over a blurred surrounding view. The [surface direction](../.impeccable/surfaces/frontend-app-profile-page-tsx.md) records this presentation change. Saved data, API contracts, privacy, revision checks, photo review and explicit publication rules remain unchanged.

Environment: macOS arm64, Node 25.6.0, Python 3.14.2, Next 16.4.6/React 19.3.1, Vitest 4.1.12 and installed Chrome through Playwright 1.65.1. Frontend fixtures use fictional members/items; the local backend journey uses disposable accounts in explicit temporary-memory storage with live providers disabled.

| Evaluation | Result | Evidence boundary |
|---|---|---|
| `npm test` (`frontend/`) | **98 passed** in 6 files | Vitest/jsdom with synthetic API/provider fixtures; includes draft, modal dismissal/focus, save/reload, stale and unavailable-item regressions |
| `npm run test:e2e` (`frontend/`) | **30 passed**, 26.5 s, after the final responsive correction | Real Next.js/Chrome with intercepted API; same-page tabs, profile save, blurred forms, trapped/restored focus, draft retention, authentication, privacy and guarded publication |
| `npm run test:backend` (`frontend/`) | **1 passed**, 8.2 s | Real local Next.js/FastAPI, HTTP-only cookie/session, saved profile/items, revision rejection, logout and expiry; temporary memory, providers disabled |
| `BARTR_NEXT_DIST_DIR=.next-build npm run build`; `npm run typecheck` (`frontend/`) | **Passed** after the final correction; typecheck repeated after restoring generated configuration | Production webpack compilation, TypeScript and generation of 14 pages |
| `BARTR_CAPTURE_REVIEW=1 npx playwright test tests/e2e/responsive-review.spec.ts` (`frontend/`) | **5 passed**, 10.2 s; 30 captures | Profile, both forms, Preferences, Home and Trade at desktop 1440×1000, mobile 390×844, compact 320×760, dark and 200% text settings |
| Independent finish review | Initial **fix**; the single required correction scored **resolved**, final disposition **ship** at that fix's scope | All 30 initial captures/source reviewed; five replacement Profile captures validated. See the [review record](../.impeccable/review/profile-finish-review.md) |
| Documentation and workspace checks | **Passed** | Changed Markdown links, sidecar JSON/schema version, preserved token frontmatter, clean whitespace and restored Next-generated configuration |

The review found item words, comparison values and dates fragmenting at 200% text beside fixed thumbnail/Edit columns. A rendered-text regression reproduced the failure; compact rows now place Edit below the details, and the regression passes across all five responsive settings. Modal captures use the viewport so their fixed backdrop is represented accurately. DESIGN.md and its sidecar describe the unified Profile, three-destination navigation and modal patterns.

Unfinished input stays in the mounted account's memory and clears on logout or expiry; full reload persistence is not claimed. This increment does not establish actual screen-reader acceptance, physical-device behavior, live provider quality, database durability/contention, load or pilot outcomes. No backend persistence migration or deployment occurred. Isolated browser services stopped after their runs; the normal development services were preserved.

## Preferences layout polish — 2026-11-14

Scope: FR-006 and FR-028 presentation, on the same `5732f865ce16c8eb0477363a36b57d1550421652` working tree plus the unified Profile increment above. Embedded Preferences now fills the Profile content width. Interests and Exclusions share equal columns when each has 22rem of room and stack otherwise; longer value guidance remains within 65ch. Existing fields, copy, saving, private drafts and assistance behavior are preserved.

Environment and fixture boundaries match the preceding increment. `npx vitest run tests/profile-screens.test.tsx` passed **24 tests**. `BARTR_CAPTURE_REVIEW=1 npx playwright test tests/e2e/responsive-review.spec.ts tests/e2e/profile.spec.ts -g 'core screens|preferences'` passed **9 browser scenarios**, including preference saves and draft retention. After the final field-alignment adjustment, `BARTR_NEXT_DIST_DIR=.next-build npm run build` and `npm run typecheck` passed; generated Next configuration was restored.

Final isolated Chromium inspection against the production build used intercepted fictional API data at 1440, 1280, 1024, 390 and 320px, plus dark and 200% text settings. All seven states had no horizontal overflow, matched the Profile tab edges and kept paired input tops aligned. The [desktop capture](../.impeccable/review/desktop-preferences.png), [1024px capture](../.impeccable/review/preferences-1024.png) and [1280px capture](../.impeccable/review/preferences-1280.png) record the expansion and stacking. An independent reviewer opened all seven captures and returned **ship**, with no material layout regression in the saved state with assistance collapsed. Live providers, database persistence and full screen-reader acceptance were not reevaluated for this layout-only change. The temporary production inspection service was stopped.
