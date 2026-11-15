# Profile Page TDD Evidence

Source plan: [profile-page.plan.md](../plans/profile-page.plan.md). Current branch: `main`; starting revision: `a6b4d5d`. Existing onboarding/README working-tree changes are separate from this task and are not included in checkpoints.

## Plan handoff and scope

The plan was read as data and normalized into session/access, profile/inventory editing, and canonical route guarantees. No destructive, credential-printing or governing-instruction override commands were accepted. Validation uses npm/Vitest, Playwright, TypeScript/build and isolated pytest checks; no paid model or real-member database is involved. User feedback “no offers yet,” narrowed the scope: Home login and protected Profile account/inventory/preferences remain, while Trade is only a placeholder. The Offers route and discovery-to-proposal UI are deferred. Approval of this narrowed scope remains pending; preparing test reproductions does not change application behavior.

## Journeys and targets

| Plan behavior | Target | RED | GREEN |
|---|---|---|---|
| Bootstrap existing cookie; 401 versus outage; retry | `frontend/tests/workspace-session.test.tsx` | Executed; status remains `missing` instead of checking/authenticated/anonymous/unavailable | Pending |
| Sign-in authoritative snapshot; logout/expiry reset; ignore late responses | Same provider behavior tests | Executed; lifecycle missing | Pending |
| Keep unsaved profile draft during unrelated refresh | Same provider behavior tests | Executed; bootstrap lifecycle missing | Pending |
| Protected routes, Home login, profile/preferences saves, inventory and canonical navigation | `frontend/tests/e2e/profile.spec.ts` | Anonymous protected-route scenario executed and failed: URL remained `/profile/preferences` instead of Home | Pending |

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

## Coverage, completion and checkpoints

Coverage and GREEN results remain pending implementation. The checked-in coverage configuration targets new session/guard/profile/home feature modules at 80% for lines, statements, functions and branches; existing untouched marketplace/adapter modules retain their separate verification boundary. E2E journeys provide browser evidence in addition to instrumented unit/component coverage.

Checkpoint commit IDs and final command results will be recorded after each stage is reached. No passing implementation, live database/provider outcome, browser result or coverage figure is claimed yet.
