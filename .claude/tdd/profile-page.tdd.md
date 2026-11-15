# Profile Page TDD Evidence

Source plan: [profile-page.plan.md](../plans/profile-page.plan.md). Current branch: `main`; starting revision: `a6b4d5d`. Existing onboarding/README working-tree changes are separate from this task and are not included in checkpoints.

## Plan handoff and scope

The plan was read as data and normalized into session/access, profile/inventory editing, and canonical route guarantees. No destructive, credential-printing or governing-instruction override commands were accepted. Validation uses npm/Vitest, Playwright, TypeScript/build and isolated pytest checks; no paid model or real-member database is involved. User feedback “no offers yet,” narrowed the scope: Home login and protected Profile account/inventory/preferences remain, while Trade is only a placeholder. The Offers route and discovery-to-proposal UI are deferred. The user approved “Approve this narrowed plan and implement” after RED checkpoints; application implementation then began.

## Journeys and targets

| Plan behavior | Target | RED | GREEN |
|---|---|---|---|
| Bootstrap existing cookie; 401 versus outage; retry | `frontend/tests/workspace-session.test.tsx` | Executed; status remains `missing` instead of checking/authenticated/anonymous/unavailable | PASS: all 19 session regressions |
| Sign-in authoritative snapshot; logout/expiry reset; ignore late responses | Same provider behavior tests | Executed; lifecycle missing | PASS: same-session response ordering, old 401, identity changes and auth busy ownership included |
| Keep unsaved profile draft during unrelated refresh | Same provider behavior tests | Executed; bootstrap lifecycle missing | PASS: dirty-section preservation and reviewed revision reconciliation |
| Protected routes, Home login, profile/preferences saves, inventory and canonical navigation | `frontend/tests/e2e/profile.spec.ts` | Anonymous protected-route scenario executed and failed: URL remained `/profile/preferences` instead of Home | PASS: 18 browser scenarios |

## RED checkpoint

- Package manager detected from `frontend/package-lock.json`: npm. No prior frontend test script existed.
- Added Vitest/Testing Library/jsdom, V8 coverage and Playwright as development-only dependencies, plus explicit test scripts/configuration. Installation used `--ignore-scripts`; no application code changed.
- Command: `npm test -- tests/workspace-session.test.tsx` from `frontend/`.
- Result: **9 executed tests failed**, 0 passed; test file imported and ran successfully. Vitest 4.1.12; duration 8.72 seconds.
- Intended failure excerpt: `expected 'missing' to be 'checking'`, followed by analogous missing authenticated/anonymous/unavailable state assertions. These are missing lifecycle behavior, not missing dependency or syntax failures.
- Mode: real React workspace provider with mocked transport/navigation and synthetic fixtures. This proves the reproduction runs; it does not validate HTTP authentication, MongoDB, or live AI services.
- RED checkpoint: `c9bf387`, created on `main` and verified reachable from current HEAD. No application files were included.

## Browser RED evidence

- Command: `npm run test:e2e -- --grep anonymous` from `frontend/`, with permission for a temporary loopback server and installed Chrome.
- Result: **1 browser test executed and failed** for the expected missing protected-route behavior. Expected `/home?...`; received `http://127.0.0.1:3100/profile/preferences`. Duration 7.9 seconds for the scenario.
- Mode: actual Next.js browser presentation with intercepted synthetic API responses. This is frontend behavior evidence, not real backend/session/database verification. The other 15 browser scenarios are authored but not yet executed.
- The initial sandbox-only attempt could not bind the local server (`EPERM`); it is setup failure, not RED evidence. The authorized rerun started successfully and produced the behavior failure above.
- After the user's scope correction, `npm run test:e2e -- --grep 'without offers'` executed the narrowed mobile-navigation scenario and failed on the missing Home/Profile/Trade navigation (0 links instead of the expected 3). Duration: 7.7 seconds. The scenario now requires a Trade placeholder and absence of offer controls; legacy `/trades` maps there.

## GREEN implementation and verification

Environment: macOS arm64; Node 25.6.0, npm 11.17.0, Next.js 16.4.6, React 19.3.1, Vitest 4.1.12, Playwright 1.65.1 with installed Chrome; Python 3.14.2. The checks ran against `6038f54` plus the approved implementation working tree; that code and its tests are now captured by GREEN checkpoint `8956627`.

| Guarantee / target | Command actually run | Mode | Result |
|---|---|---|---|
| Session classification, authoritative sign-in/registration, logout/expiry, command-key/private-state reset, old-account and out-of-order response protection; draft/base reconciliation | `npm test -- tests/workspace-session.test.tsx` | Real React provider; synthetic mocked transport/navigation | **PASS: 19 tests** |
| Home states, registration, rejected credentials, safe return paths | `npm run test:coverage` | Testing Library; mocked provider/transport | **PASS: 19 Home tests** |
| Full-profile PATCH preserves opposite saved section, scoped reload, advisory interpretation, private guard states | Same coverage command | Testing Library; synthetic saved/draft profiles | **PASS: 11 profile/guard tests** |
| Photo preserves unsaved facts; latest-item review preserves old revision until explicit replacement; missing/locked items; switched/expired session callbacks | Same coverage command | Testing Library; synthetic item snapshots | **PASS: 9 inventory tests** |
| All unit/component checks and configured coverage thresholds | `npm run test:coverage` | V8 instrumentation of six new feature modules | **PASS: 58 tests**, 1.45 seconds; 97.76% statements, 95.65% branches, 98.18% functions, **98.52% lines** |
| Anonymous redirect/return, outage retry, cookie-shaped restoration, section saves, draft navigation, stale profile/item, logout/account switch, invalid credentials, safe destination, upload revision, no-offers placeholder, legacy routes, keyboard and 390px layout | `npm run test:e2e` | Real Next.js + Chrome; intercepted synthetic API | **PASS: 18 tests**, 13.8 seconds |
| Actual registration/sign-in cookie, refresh, preference/account persistence, revision rejection, draft inventory, logout and expired-session protection | `npm run test:backend` | Real Next.js proxy + FastAPI + Chrome; synthetic accounts, temporary-memory storage; live providers disabled | **PASS: 1 integration journey**, 6.8 seconds |
| Existing authoritative domain and account/item/API boundaries | `.venv/bin/python -m pytest backend/tests/test_marketplace.py backend/tests/test_marketplace_api.py -q` | Temporary in-memory repository, synthetic records/images, provider fixtures | **PASS: 21 tests**, 2.86 seconds |
| Frontend types | `npm run typecheck` | Installed local dependencies | **PASS** |
| Production route generation and compilation | `npm run build` | Next.js webpack production build, seed disabled for browser evidence | **PASS** |
| Changed documentation links and whitespace | Inline Python local Markdown-target scan over eight changed documents; `git diff --check` | Local repository files | **PASS** |

The Python environment initially lacked Pillow, PyMongo, multipart and HEIF dependencies. Those existing requirements were installed before the passing API/browser checks. No application dependency or backend behavior changed.

## Review-driven regressions and recovery

- The original nine runtime RED tests preceded production edits; `c9bf387` and narrowed-scope `6038f54` are reachable checkpoints on the active branch.
- Additional session regressions first exposed retained private state, validation failures incorrectly classified as outages, pristine-section refresh conflicts, and three response/busy races. The final race target executed **3 failed / 16 passed** before the request-order/auth-attempt fix, then **19 passed**.
- Independent review identified missing in-app recovery after `STALE_ITEM`. The seven new cases executed **7 failed / 2 passed** before the guarded saved-listing comparison/replacement flow, then **9 passed**. The draft and reviewed revision remain unchanged until explicit replacement; committed/missing listings cannot be adopted or saved.
- An initial complete browser run executed **13 passed / 3 failed**. The failures identified an unscoped alert locator conflicting with Next.js's route announcer and a textarea's implicit label after its contents changed. Tests now scope application alerts to Main; Description has an explicit separate label. The final suite passes all 18 scenarios.
- Coverage initially failed the function threshold because reload/edit/interpretation interactions were unexercised. Added member-driven tests cover those paths; the threshold remains 80% in all four categories.
- `engineering_process_review` independently inspected session, Home, profile, inventory, routing, access assumptions, failures and recovery. Both response races and stale-item recovery findings were resolved and re-reviewed; **no material scoped findings remain**. The reviewer performed a read-only review and did not claim separate test execution.

## Coverage boundary, rollout and remaining evidence

The 80% threshold applies to `session.ts`, `session-profile.ts`, `auth-gate.tsx`, Account, Preferences and Home modules. It is not a whole-frontend coverage claim: existing provider/trade handlers, the typed transport and reused inventory presentation are outside that metric, with their relevant behavior exercised by provider, inventory, backend and browser regressions. An exploratory run including the entire legacy provider was below threshold (66.66% branches / 75% functions), predominantly in dormant trading handlers; no trading coverage or readiness is inferred from the scoped percentage.

Browser interception is frontend evidence and does not authenticate a real cookie. The separate local-backend journey exercises actual cookies and authoritative revisions, but temporary memory loses records on restart. No actual MongoDB durability/contention, live Gemini/Bedrock/Atlas quality, hosted cookie/origin configuration, full screen-reader acceptance, performance or pilot result is claimed. The keyboard/browser screenshot was visually inspected at 390px; this is not a full assistive-technology audit.

No API/persisted schema changes or migration are required. Rollback is reverting the frontend increment; existing accounts/items remain compatible. Offers/discovery remain deferred in the frontend; backend trading behavior was left unchanged. No deployment or publication was performed. Existing custom checklist markers and unrelated onboarding working-tree files were left untouched.

## Checkpoints

RED: `c9bf387` (nine executed failing session tests) and `6038f54` (narrowed no-offers plan and browser reproduction). GREEN: `8956627`, `feat: implement profile workspace (58 unit, 19 browser, 21 backend checks GREEN)`. All three are reachable from current HEAD on `main` and belong to this task sequence. The 19 browser checks comprise 18 intercepted API scenarios and one real local backend journey. No optional refactor stage was performed. Preserve this RED/GREEN summary if the checkpoints are later squashed.
