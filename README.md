# Bartr — AI-Powered Smart Bartering Marketplace

**Backend update:** the owner has switched the login/photo valuation increment to DynamoDB. Use [the DynamoDB setup and API flow](docs/DYNAMODB-LOGIN-VALUATION.md); older Atlas setup sections below describe the previous backend and semantic-search work, not the new DynamoDB configuration.

Bartr discovers item bundles across two inventories, with reviewed item values and voluntary agreement. The canonical requirements are in [`specs/001-smart-barter-marketplace/spec.md`](specs/001-smart-barter-marketplace/spec.md). The earlier `docs/specs/001-bundle-matching` draft is superseded.

## Stack and implemented journeys

Next.js, TypeScript, Tailwind and shadcn/ui provide the black-and-cream frontend. FastAPI enforces account identity, private profiles/preferences, listing revisions, one-to-three items per side, same-community/exclusion rules, both members' recommendation gap limits, versioned proposals, private notes, atomic reservations, cancellation and mutual handoff confirmation.

Gemini adapters provide owner-reviewed image/valuation and preference suggestions. Bedrock generates Titan-compatible text embeddings; MongoDB Atlas stores production-intended marketplace data and semantic-search projections. An explicit JSON document mode supplies single-process local persistence without pretending to be Atlas or DynamoDB. Live integrations require configuration and have not been authenticated or benchmarked by offline tests. Exact-text discovery is explicitly selectable for local testing and is not semantic search.

## Run locally

Requires Python 3.10+ and Node.js 20.19+. From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

The example selects `BARTR_STORAGE=json` and creates `.bartr/bartr.local.json` for temporary local testing. Do not overwrite an existing `.env` when updating your checkout. Environment variables override the root `.env`. For MongoDB Atlas persistence, set `BARTR_STORAGE=mongo` and `MONGODB_URI` instead.

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

Open **http://localhost:3000**. API docs: **http://localhost:8000/docs**. Keep both terminals running. The frontend forwards `/api` requests to port 8000; change `frontend/.env.local` using its `.env.example` and restart/rebuild if the origin differs.

### Temporary JSON document mode without Atlas or AI credentials

The root `.env.example` selects this mode. It can also be selected explicitly:

```sh
BARTR_STORAGE=json BARTR_JSON_PATH=.bartr/bartr.local.json python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

This explicitly selects a local, versioned JSON document. Accounts, sessions, listings, trades and test images survive a backend restart. The file may contain password hashes, sessions, private notes and images, is ignored by Git, and must not be shared or committed. Use exactly one worker/process. There is no silent fallback after a MongoDB or JSON-file failure, and this mode is not production storage.

To populate an empty JSON store with the repository's synthetic live-listing dataset, stop the API and run:

```sh
BARTR_STORAGE=json BARTR_JSON_PATH=.bartr/bartr.local.json \
  .venv/bin/python -m backend.scripts.seed_demo_json
```

Restart the API, then sign in with username `demo-alice` and password `bartr-demo-only`. The landing page and `/discover` will use the normal authenticated `GET /api/me` projection, so only available same-community fixtures appear. The command stages a complete database before installation, is a no-op when the same fixture is already present, and refuses to overwrite any other non-empty store. All records and images are synthetic; do not reuse the demo password for a real account.

For a fully ephemeral run, use `BARTR_STORAGE=memory` instead; its data disappears when the backend restarts. See [the JSON storage decision](docs/JSON-STORAGE.md) for failure/recovery limits and the future DynamoDB adapter boundary.

Create two accounts in separate browser profiles or an incognito window, with the same community. Each can save a draft, upload a photo, then publish. Set reciprocal interests under Preferences. For the example, Alice offers a $40 chair and $20 calculator, Brian offers a $65 monitor, and both use the default 20% gap. Under Discover, uncheck **Semantic discovery** to test exact-text matching without providers. You should see the 7.7% gap combination when their interests match.

Review the included items before submitting an offer. Submission consents only for its sender. The other member must accept the exact current terms to reserve items. Counteroffers replace consent. Both members must confirm reported handoff before completion. Cancellation after one reported handoff needs both members' approval. The app records participants' reports, not verified physical delivery.

## Live assistance and semantic search

- Set `GEMINI_API_KEY` and a suitable image/search/structured-output `GEMINI_MODEL`. Optional `GEMINI_VALUATION_MODEL` and `GEMINI_EXTRACTION_MODEL` select those stages. Analysis is advisory and saved per item revision; it does not automatically publish or overwrite reviewed facts.
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

Domain/API/adapter fixtures verify permissions, item publication, all nine bundle shapes, percentage limits, exact revisions, duplicate command handling, overlapping acceptance, cancellations and handoff. See [the implementation plan](specs/001-smart-barter-marketplace/plan.md), [tasks](specs/001-smart-barter-marketplace/tasks.md), and [verification status](docs/VERIFICATION.md).

Engineering changes follow the [AI engineering workflow](docs/ENGINEERING.md), including requirement-linked assignments, independent behavioral review, and evidence labeled by storage and provider mode.

## Structure and limits

- `backend/app/domain.py`: authoritative account, listing and exchange rules.
- `backend/app/api/`: closed schemas and authorized HTTP routes.
- `backend/app/services/`: photo normalization, Gemini and Bedrock/Atlas adapters.
- `backend/app/storage/state.py`: atomic MongoDB aggregate plus explicit memory/JSON test storage.
- `frontend/app/`, `components/ui/`, `lib/`: app views, shadcn components and typed clients.
- `requirements.txt`: one Python dependency file. `specs/`: canonical Spec Kit artifacts. `docs/`: guides and reference reviews.

This MVP keeps private marketplace state in one bounded versioned aggregate. MongoDB uses compare-and-swap and separate image/search documents; temporary JSON mode uses a process lock and atomic file replacement. Neither shape is directly deployable as one DynamoDB item: a future adapter needs partitioned records, conditional writes and transactions. Search also has an explicit computation limit; it never claims exhaustive global optimality. Larger scale requires aggregate partitioning/transactions and measured search optimization.

No payment, cash supplement, shipping, Solana/NFT, multi-party trade, automated dispute resolution, email/university verification or physical-delivery proof is implemented. The specification's pilot, semantic-quality, screen-reader and concurrent-load targets require their own evaluation; a successful build does not establish them.
