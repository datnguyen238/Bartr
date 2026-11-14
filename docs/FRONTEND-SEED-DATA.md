# Frontend seed data

Fixtures live in `frontend/data/seed.ts`. They are fictional display data, not accounts, authentication credentials, market evidence or database records.

The local `frontend/.env.local` enables them:

```dotenv
NEXT_PUBLIC_USE_SEED_DATA=true
```

Restart your frontend dev server yourself after changing this flag. No backend, API key or MongoDB connection is needed to browse the seeded pages.

Included: three members; nine items covering available, draft, reserved and exchanged states; an unknown-value draft; the $60 chair-plus-calculator versus $65 monitor recommendation; an open counteroffer with notes; a pending handoff; and a completed trade.

Navigation, item selection/edit forms, recommendation review, trade selection and history display can be inspected. Backend actions (saving, AI analysis, sending notes, proposing, accepting or completing trades) are disabled in seed mode and show an explicit notice. The data does not simulate successful writes. Reloading the page restores the fixtures.

Set `NEXT_PUBLIC_USE_SEED_DATA=false` and restart your frontend to return to empty/live-data behavior. No real backend authorization has been removed, and no records are inserted into Atlas. No application, build or tests were run while creating these fixtures.
