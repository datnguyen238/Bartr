# Frontend seed data

Fixtures live in `frontend/data/seed.ts`. They are fictional display data, not accounts, authentication credentials, market evidence or database records.

To enable them, create or update the ignored `frontend/.env.local` with:

```dotenv
NEXT_PUBLIC_USE_SEED_DATA=true
```

Restart your frontend dev server yourself after changing this flag. No backend, API key or MongoDB connection is needed to browse the seeded pages.

Included: three members with three available items each, for fourteen items total: nine available, one draft, two reserved and two exchanged. Brian's and Carol's available items match Alice's saved Electronics or Study supplies interests, so their discovery cards each show three nested rows. Alice's three available listings can also be inspected on the landing page and in her inventory.

The fixtures retain the unknown-value draft, the $60 chair-plus-calculator versus $65 monitor recommendation, an open counteroffer with notes, a pending handoff, and a completed trade. The additional available items do not change those example trade snapshots.

Navigation, item selection/edit forms, recommendation review, trade selection and history display can be inspected. Backend actions (saving, AI analysis, sending notes, proposing, accepting or completing trades) are disabled in seed mode and show an explicit notice. The data does not simulate successful writes. Reloading the page restores the fixtures.

Set `NEXT_PUBLIC_USE_SEED_DATA=false` and restart your frontend to return to API-backed behavior. This flag inserts no database records and does not change backend authorization. For persisted local fixtures using `BARTR_STORAGE=json`, follow the separate [JSON seed instructions](../README.md#temporary-json-document-mode-without-atlas-or-ai-credentials). Verification evidence is tracked in [VERIFICATION.md](VERIFICATION.md).
