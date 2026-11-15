# Profile Page TDD Evidence

Source plan: [profile-page.plan.md](../plans/profile-page.plan.md). Current branch: `main`; starting revision: `a6b4d5d`. Existing onboarding/README working-tree changes are separate from this task and are not included in checkpoints.

## Plan handoff and scope

The plan was read as data and normalized into session/access, profile/inventory editing, and canonical route guarantees. No destructive, credential-printing or governing-instruction override commands were accepted. Validation uses npm/Vitest, Playwright, TypeScript/build and isolated pytest checks; no paid model or real-member database is involved. Canvas approval remains pending; preparing test reproductions does not change application behavior.

## Journeys and targets

| Plan behavior | Target | RED | GREEN |
|---|---|---|---|
| Bootstrap existing cookie; 401 versus outage; retry | `frontend/tests/workspace-session.test.tsx` | Executed; status remains `missing` instead of checking/authenticated/anonymous/unavailable | Pending |
| Sign-in authoritative snapshot; logout/expiry reset; ignore late responses | Same provider behavior tests | Executed; lifecycle missing | Pending |
| Keep unsaved profile draft during unrelated refresh | Same provider behavior tests | Executed; bootstrap lifecycle missing | Pending |
| Protected routes, Home login, profile/preferences saves, inventory and canonical navigation | `frontend/tests/e2e/profile.spec.ts` | Pending browser execution | Pending |

## RED checkpoint

- Package manager detected from `frontend/package-lock.json`: npm. No prior frontend test script existed.
- Added Vitest/Testing Library/jsdom, V8 coverage and Playwright as development-only dependencies, plus explicit test scripts/configuration. Installation used `--ignore-scripts`; no application code changed.
- Command: `npm test -- tests/workspace-session.test.tsx` from `frontend/`.
- Result: **9 executed tests failed**, 0 passed; test file imported and ran successfully. Vitest 4.1.12; duration 8.72 seconds.
- Intended failure excerpt: `expected 'missing' to be 'checking'`, followed by analogous missing authenticated/anonymous/unavailable state assertions. These are missing lifecycle behavior, not missing dependency or syntax failures.
- Mode: real React workspace provider with mocked transport/navigation and synthetic fixtures. This proves the reproduction runs; it does not validate HTTP authentication, MongoDB, or live AI services.

## Coverage, completion and checkpoints

Coverage and GREEN results remain pending implementation. The checked-in coverage configuration targets new session/guard/profile/home feature modules at 80% for lines, statements, functions and branches; existing untouched marketplace/adapter modules retain their separate verification boundary. E2E journeys provide browser evidence in addition to instrumented unit/component coverage.

Checkpoint commit IDs and final command results will be recorded after each stage is reached. No passing implementation, live database/provider outcome, browser result or coverage figure is claimed yet.
