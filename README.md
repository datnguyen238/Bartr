# Bartr — AI-Powered Smart Bartering Marketplace

The application supports DynamoDB persistence and temporary JSON storage for local testing. Use [the archived DynamoDB setup and API flow](https://github.com/datnguyen238/Bartr/blob/ba3efe4220286e48ddfec05cbc9fb35da30422b9/docs/DYNAMODB-LOGIN-VALUATION.md) for the existing AWS table, or the JSON instructions below for local synthetic data.

Bartr discovers item bundles across two inventories, with reviewed item values and voluntary agreement. The canonical requirements are in [`specs/001-smart-barter-marketplace/spec.md`](specs/001-smart-barter-marketplace/spec.md).

## Stack and implemented journeys

Next.js, TypeScript, Tailwind and shadcn/ui provide the black-and-cream frontend. FastAPI enforces account identity, private profiles/preferences, listing revisions, one-to-three items per side, marketplace-wide visibility and exclusion rules, both members' recommendation gap limits, versioned proposals, private notes, atomic reservations, cancellation and mutual handoff confirmation.

Gemini provides image estimates that owners must review and accept. DynamoDB stores profiles, listings, sessions and trade records through the approved [entity adapter](specs/001-smart-barter-marketplace/dynamodb-data-model.md). JSON mode supplies single-process local persistence. Discovery uses exact text with DynamoDB or JSON; semantic discovery currently requires the separately configured Bedrock/Gemini/Atlas path. Offline tests do not establish live provider quality or production load capacity.

## Run locally

Requires Python 3.10+ and Node.js 20.19+. From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

For shared accounts, configure the ignored root `.env` for DynamoDB using [the archived setup guide](https://github.com/datnguyen238/Bartr/blob/ba3efe4220286e48ddfec05cbc9fb35da30422b9/docs/DYNAMODB-LOGIN-VALUATION.md). Each teammate needs AWS credentials with access to the same account, region and table. Do not commit or share credentials. Environment variables override the root `.env`. DynamoDB is the default; JSON and memory storage require an additional explicit opt-in for isolated testing.

**Terminal 1 — backend:**

```sh
source .venv/bin/activate
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Already inside `backend/`? Activate `../.venv/bin/activate`, install with `python3 -m pip install -r ../requirements.txt`, and run `python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.

**Terminal 2 — frontend:**

```sh
cd frontend
npm ci
npm run dev
```

Open **http://localhost:3000**. API docs: **http://localhost:8000/docs**. Keep both terminals running. The frontend forwards `/api` requests to port 8000; set `API_BASE_URL` in `frontend/.env.local` and restart if the backend origin differs.

The public landing page is at `/`. After sign-in, the main sidebar provides Home, Profile and Trades; `/discover` contains marketplace discovery, and `/trades` opens the offer workspace. Profile and inventory retain account-scoped session and draft handling.

### Temporary JSON document mode without Atlas or AI credentials

For isolated local testing only, select this mode explicitly:

```sh
BARTR_ALLOW_LOCAL_STORAGE=true BARTR_STORAGE=json BARTR_JSON_PATH=.bartr/bartr.local.json python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

This explicitly selects a local, versioned JSON document. Accounts, sessions, listings, trades and test images survive a backend restart. The file may contain password hashes, sessions, private notes and images, is ignored by Git, and must not be shared or committed. Use exactly one worker/process. There is no silent fallback after a MongoDB or JSON-file failure, and this mode is not production storage.

To populate an empty JSON store with the repository's synthetic live-listing dataset, stop the API and run:

```sh
BARTR_STORAGE=json BARTR_JSON_PATH=.bartr/bartr.local.json \
  .venv/bin/python -m backend.scripts.seed_demo_json
```

Restart the API, then sign in with username `demo-alice` and password `bartr-demo-only`. The landing page and `/discover` will use the normal authenticated `GET /api/me` projection, so available fixtures from all members appear. The command stages a complete database before installation, is a no-op when the same fixture is already present, and refuses to overwrite any other non-empty store. All records and images are synthetic; do not reuse the demo password for a real account.

The expanded fixture gives all ten demo users three available items each (plus the private draft and removed-listing cases). Alice sees eight counterpart members with three matching items each. It includes an unknown-valued available item for manual-offer testing. To try it while preserving an earlier seeded database, use a separate file:

```sh
BARTR_STORAGE=json BARTR_JSON_PATH=.bartr/bartr.multi-items.json \
  .venv/bin/python -m backend.scripts.seed_demo_json
BARTR_ALLOW_LOCAL_STORAGE=true BARTR_STORAGE=json BARTR_JSON_PATH=.bartr/bartr.multi-items.json \
  .venv/bin/python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Stop the previous API before starting the second command. Existing marked databases are not refreshed or reset by the seeder; each retains its accounts, sessions, listing edits and trades.

For a fully ephemeral run, set `BARTR_ALLOW_LOCAL_STORAGE=true BARTR_STORAGE=memory`; its data disappears when the backend restarts. See [the archived JSON storage decision](https://github.com/datnguyen238/Bartr/blob/ba3efe4220286e48ddfec05cbc9fb35da30422b9/docs/JSON-STORAGE.md) for failure/recovery limits. Switching to DynamoDB selects separate records; it does not import local accounts or other data.

Create two accounts in separate browser profiles or an incognito window. Each can save a draft, upload a photo, then publish. Set reciprocal interests under Preferences. For the example, Alice offers a $40 chair and $20 calculator, Brian offers a $65 monitor, and both use the default 20% gap. Select **Find bundle matches** under Discover; DynamoDB and JSON automatically use exact-text matching. You should see the 7.7% gap combination when their interests match.

Review the included items before submitting an offer. Submission consents only for its sender. The other member must accept the exact current terms to reserve items. Counteroffers replace consent. Both members must confirm reported handoff before completion. Cancellation after one reported handoff needs both members' approval. The app records participants' reports, not verified physical delivery.

## Live assistance and semantic search

- Set `GEMINI_API_KEY` and a suitable image/structured-output `GEMINI_MODEL` or `GEMINI_VALUATION_MODEL`. Analyze a saved photo, inspect its provisional estimate and uncertainty, select **Use this estimate**, then explicitly save the listing. The saved analysis ID binds assisted provenance to that item revision; a manually corrected amount is owner-entered. Analysis never automatically publishes or changes the listing value.
- Semantic discovery and indexing currently require MongoDB Atlas. These controls are unavailable with DynamoDB or JSON; manual listing and exact-text matching continue to work.
- Configure the AWS credential chain, `AWS_REGION`, and a Titan Text Embeddings V2-compatible `BEDROCK_EMBEDDING_MODEL`. Example model ID to verify in your account: `amazon.titan-embed-text-v2:0`. Dimensions default to 1024; the Atlas index must match.
- Use MongoDB Atlas storage. Create a Vector Search index named `item_embeddings` on collection `search_items` with [the index definition](specs/001-smart-barter-marketplace/contracts/atlas-vector-index.json). Match `BEDROCK_EMBEDDING_DIMENSIONS` if changed.
- Owners select **Index for semantic search** for each current published item. Edits make older projections stale; index the new revision. Semantic discovery checks current projections and reports missing/index failures explicitly.
- Semantic candidates are assessed against interests and exclusions with Gemini before deterministic bundle validation. If providers/indexes fail, the UI reports failure; it does not claim there are no compatible trades.

Use server-only environment files. Never commit credentials or put them in `NEXT_PUBLIC_*` settings. Sessions use HTTP-only cookies. Production HTTPS deployments must set `COOKIE_SECURE=true` and exact `WEB_ORIGINS`. Browser mutations use an application header and origin checks. API clients must send `X-Bartr-Request: 1` and a valid session cookie.

## Verify

```sh
source .venv/bin/activate
python -m pytest backend/tests -q
cd frontend
npm run typecheck
npm run build
```

Domain/API/adapter fixtures verify permissions, item publication, all nine bundle shapes, percentage limits, exact revisions, duplicate command handling, overlapping acceptance, cancellations and handoff. See [the implementation plan](specs/001-smart-barter-marketplace/plan.md), [tasks](specs/001-smart-barter-marketplace/tasks.md), and [the archived verification record](https://github.com/datnguyen238/Bartr/blob/ba3efe4220286e48ddfec05cbc9fb35da30422b9/docs/VERIFICATION.md) for historical results.

Engineering changes follow the [archived AI engineering workflow](https://github.com/datnguyen238/Bartr/blob/ba3efe4220286e48ddfec05cbc9fb35da30422b9/docs/ENGINEERING.md), including requirement-linked assignments, independent behavioral review, and evidence labeled by storage and provider mode.

## Structure and limits

- `backend/app/domain.py`: authoritative account, listing and exchange rules.
- `backend/app/api/`: closed schemas and authorized HTTP routes.
- `backend/app/services/`: photo normalization, Gemini and Bedrock/Atlas adapters.
- `backend/app/storage/state.py`: atomic MongoDB aggregate plus explicit memory/JSON test storage.
- `backend/app/storage/dynamodb.py`, `dynamodb_records.py`, `dynamodb_images.py`: DynamoDB entity mapping, conditional transactions and authorized image chunks.
- `frontend/app/`, `components/ui/`, `lib/`: app views, shadcn components and typed clients.
- `requirements.txt`: one Python dependency file. `specs/`: canonical Spec Kit artifacts.

DynamoDB uses separate entity records and conditional transactions behind the existing domain boundary. Its compatibility snapshot scans the table with epoch checks and serializes writes; this is a bounded adapter, with explicit transaction/item limits. MongoDB retains its compare-and-swap aggregate, and JSON uses a process lock and atomic file replacement. There is no automatic migration between these stores. Search has an explicit computation limit; measured optimization and throughput evaluation remain required before scaling.

No payment, cash supplement, shipping, Solana/NFT, multi-party trade, automated dispute resolution, email/university verification or physical-delivery proof is implemented. The specification's pilot, semantic-quality, screen-reader and concurrent-load targets require their own evaluation; a successful build does not establish them.
