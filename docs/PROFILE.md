# Profile and account pages

The current frontend has direct navigation to **Home**, **Inventory**, **Preferences**, and **Trade**, with **Account** in the header. Desktop uses a compact sidebar; narrow screens use bottom navigation. Open `/home` to sign in with a username and password or select **Create an account**. A successful sign-in loads the saved member from the existing backend session before opening the requested protected page (Account by default).

| Page | Purpose |
|---|---|
| `/home` | Public welcome, sign-in and registration |
| `/profile` | Read-only username, editable display name and campus/city community |
| `/profile/inventory` | Create/edit listings, attach photos and review publication details |
| `/profile/preferences` | Specific or category interests, exclusions and recommendation gap |
| `/trade` | Placeholder; offers and discovery controls are deferred |

Profile pages check the existing HTTP-only cookie through `/api/me`. An anonymous visit returns to Home with a supported Profile destination. A service outage displays **Session unavailable** and Retry. Fictional frontend seed data never grants access or saves changes; disable `NEXT_PUBLIC_USE_SEED_DATA` to exercise actual accounts.

Account and preference saves preserve the other section's saved fields. Unsaved input survives internal navigation and unrelated listing refreshes. Revision conflicts keep the draft and ask the member to reload/review current values. Confirmed sign-out or session expiry clears private forms and selections; late responses from an earlier session are ignored.

Inventory retains separate unfinished drafts for each listing and for a new item within the mounted account session. New item and Edit restore the appropriate draft; returning to the inventory list does not discard it. On phones, Edit opens a focused editor with **Back to inventory**. Drafts are kept in session memory, not browser persistence, and do not survive a full reload. A listing that becomes reserved, removed or unavailable locks changes while retaining the unsaved draft for review.

Photo attachment is available at the start of preparation. For a new item it first creates a private draft, then attaches the photo. **Save draft** remains separate from **Publish listing**; a readiness checklist identifies the required photo and details. Available listings use **Save changes**. AI suggestions require explicit review; manual preparation works when assistance is unavailable. Search preparation is labeled **Make discoverable** and acts only on the current saved version.

Preferences use removable interest/exclusion entries with Add or Enter and a plain-language value-difference example. The underlying limits, exclusions and percentage calculation are unchanged. Form errors identify their fields and preserve the draft; results appear near the action. Reloading changed Account or Preferences requires an explicit discard choice. A first signed-out visit is normal; actual failed sign-in and expired-session outcomes remain actionable.

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

Playwright uses installed Chrome and starts a loopback Next.js server. The primary profile browser suite intercepts synthetic API responses; it checks presentation and routing. `test:backend` starts the repository's Python environment and backend in temporary memory mode, disables live providers, and tests actual local cookies and saved records. The suites use separate `.next-e2e` and `.next-backend` output directories so they leave the normal development server available. Run the browser commands sequentially for clear evidence. Set `BARTR_CAPTURE_REVIEW=1` with `npm run test:e2e` to save the responsive fixture captures under `.impeccable/review/`. Results and remaining readiness limits are labeled separately in [verification status](VERIFICATION.md) and the [TDD evidence](../.claude/tdd/profile-page.tdd.md).
