# Bartr MVP verification

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

Account registration/sign-in/out with hashed passwords and opaque sessions; public profiles and private preferences; draft/photo/publication/edit/removal; reviewed Gemini suggestions; revision-bound valuation evidence; Bedrock embedding and Atlas retrieval adapters; deterministic one-to-three item matching with both gap limits; dismissals; manual proposals, notes/counteroffers and exact-version consent; atomic reservations/overlap invalidation; cancellation and two-party handoff.

## Verification in progress

Backend domain, account/API, photo-upload, Gemini adapter/evidence and Bedrock fixtures are exercised offline. Browser checks use explicitly temporary memory storage and fake photo content, with owner-entered example prices. This is not a live valuation or Atlas search validation.

## External and evaluation limitations

- Gemini/Bedrock/Atlas credentials and live vector index access have not been supplied or tested in this repository. Model availability and permissions must be checked in the team's accounts.
- MongoDB compare-and-swap persistence is implemented; actual Atlas restart/concurrent-write verification remains required. The domain's concurrency tests use isolated in-memory storage.
- Exact-text local mode does not meet the semantic-equivalence criteria; the configured semantic adapters need their labeled retrieval evaluation.
- The spec's 20-person pilot, 40-case recommendation quality set, 20 paraphrase cases, screen-reader audit, 1,000-listing/20-request load test and associated numerical targets have not been run and are not claimed achieved.
- An individual document aggregate bounds this prototype's scale. Request contention or capacity failure is reported explicitly instead of falling back to unsaved data.


## DynamoDB schema v1 — verification update

Revision `a6b4d5d` plus the uncommitted schema and numeric-normalization changes; Python 3.12 project virtual environment. The complete backend suite in temporary memory and Moto fixture modes was run locally. A separate synthetic scoped test against the existing `bartr-dev` table in `us-east-1` passed live read/write, competing acceptance, restart, cancellation, replay, completion and cleanup (provider fixtures; no live Gemini or semantic evaluation): `BARTR_LIVE_DYNAMODB=1 AWS_PROFILE=bartr-dev AWS_REGION=us-east-1 .venv/bin/python -m pytest backend/tests/test_dynamodb_live.py -q` — **1 passed**. An initial sandboxed run failed DNS; an unrestricted first run exposed numeric normalization in offer hashes, fixed before the passing run. This does not prove production load, migration, recovery, or provider quality. The adapter still scans a consistent snapshot for domain operations; the Query helpers are not the primary API access path. Existing legacy data requires a separately reviewed migration.

`.venv/bin/python -m pytest backend/tests -q` — **62 passed, 1 skipped** (live test requires the explicit command above). An earlier run failed in Moto's concurrent in-memory bookkeeping; the fixture now tests overlap sequentially, while the live test exercises simultaneous acceptance.

Follow-up on the same revision and uncommitted working tree: the live scoped DynamoDB test also passed synthetic login, session authentication and logout. Frontend `npm run typecheck` passed. `npm run build` failed because the available Node version is 18.17.0; the project requires Node 20.19 or newer. Browser interaction and live Gemini valuation were not run.

## Earlier DynamoDB login and image valuation increment — historical status

New code selects a namespaced DynamoDB repository, retains profile/password/session identity, normalizes and chunks uploaded JPEGs, requests one Gemini image estimate, and requires explicit revision-bound owner acceptance before the amount appears as an assisted listing value. Fixtures cover conditional-write conflict handling, multi-chunk photo roundtrip/deletion, stale/foreign analysis rejection and corrected-owner-value provenance.

Evidence: source inspection only. App, unit tests, builds, AWS calls, table lookup and Gemini calls are **NOT RUN** under the owner's standing instruction. Previous test totals do not cover this increment. Table name/key schema remain a configuration dependency. The frontend is unchanged. Existing MongoDB data is not migrated. The bounded aggregate/chunk storage design is documented separately and is not claimed scalable or production-verified.
