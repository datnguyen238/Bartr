# Profile and account pages

The current frontend has three main sections: **Home**, **Profile**, and **Trade**. Open `/home` to sign in with a username and password or select **Create an account**. A successful sign-in loads the saved member from the existing backend session before opening Profile.

| Page | Purpose |
|---|---|
| `/home` | Public welcome, sign-in and registration |
| `/profile` | Read-only username, editable display name and campus/city community |
| `/profile/inventory` | Create/edit listings, attach photos and review publication details |
| `/profile/preferences` | Specific or category interests, exclusions and recommendation gap |
| `/trade` | Placeholder; offers and discovery controls are deferred |

Profile pages check the existing HTTP-only cookie through `/api/me`. An anonymous visit returns to Home with a supported Profile destination. A service outage displays **Session unavailable** and Retry. Fictional frontend seed data never grants access or saves changes; disable `NEXT_PUBLIC_USE_SEED_DATA` to exercise actual accounts.

Account and preference saves preserve the other section's saved fields. Unsaved input survives internal navigation and unrelated listing refreshes. Revision conflicts keep the draft and ask the member to reload/review current values. Confirmed sign-out or session expiry clears private forms and selections; late responses from an earlier session are ignored.

The legacy `/inventory` and `/preferences` URLs redirect into Profile; `/discover` and `/trades` redirect to the Trade placeholder. `/` and `/login` go to Home; `/register` selects registration on Home. Trading APIs remain implemented, but this frontend phase exposes no offer or acceptance controls.

Run the [local startup instructions](../README.md#run-locally) with seed mode disabled. Temporary memory mode creates actual local accounts, cookies and records, which disappear when the backend restarts. It does not establish MongoDB durability or live AI readiness.

Frontend checks from `frontend/`:

```sh
npm test
npm run test:coverage
npm run test:e2e
npm run test:backend
npm run typecheck
npm run build
```

Playwright uses installed Chrome and starts a loopback Next.js server. The primary profile browser suite intercepts synthetic API responses; it checks presentation and routing. `test:backend` starts the repository's Python environment and backend in temporary memory mode, disables live providers, and tests actual local cookies and saved records. Run these browser commands sequentially because Next.js shares a development output directory. Results and remaining readiness limits are labeled separately in [verification status](VERIFICATION.md) and the [TDD evidence](../.claude/tdd/profile-page.tdd.md).
