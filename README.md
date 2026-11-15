# Bartr — AI-Powered Smart Bartering Marketplace

Bartr discovers item bundles across two inventories, with reviewed item values and voluntary agreement. The canonical requirements are in [`specs/001-smart-barter-marketplace/spec.md`](specs/001-smart-barter-marketplace/spec.md). The earlier `docs/specs/001-bundle-matching` draft is superseded.

**Backend storage:** this branch includes `main`'s DynamoDB login/photo valuation updates while preserving the profile frontend. DynamoDB is the default saved-data backend; use the [current single-table schema](specs/001-smart-barter-marketplace/dynamodb-data-model.md). The [earlier login/photo valuation guide](docs/DYNAMODB-LOGIN-VALUATION.md) describes the API flow; its compressed whole-state design predates the current schema.

## Stack and implemented journeys

Next.js, TypeScript, Tailwind and shadcn/ui provide the black-and-cream frontend. FastAPI enforces account identity, private profiles/preferences, listing revisions, one-to-three items per side, same-community/exclusion rules, both members' recommendation gap limits, versioned proposals, private notes, atomic reservations, cancellation and mutual handoff confirmation.

Gemini adapters provide owner-reviewed image/valuation and preference suggestions. DynamoDB stores marketplace records and normalized photo chunks. The optional MongoDB backend and Bedrock/Atlas semantic-search adapters remain available; semantic search is explicitly unavailable with DynamoDB. Live integrations require configuration and have not been authenticated or benchmarked by offline tests. The backend supports exact-text discovery for local testing; it is separate from semantic search, and this profile frontend defers discovery controls.

## Run locally

Requires Python 3.10+ and Node.js 20.19+. From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Create a root `.env` only if it does not exist. For DynamoDB, set `BARTR_STORAGE=dynamodb`, `DYNAMODB_TABLE` to the existing table, `DYNAMODB_PARTITION_KEY=PK`, `DYNAMODB_SORT_KEY=SK`, and `AWS_REGION` to its region; use your configured AWS credential chain. The table must have String `PK` and `SK` keys. See the [current schema](specs/001-smart-barter-marketplace/dynamodb-data-model.md) and [earlier setup guide](docs/DYNAMODB-LOGIN-VALUATION.md#configuration-to-complete-locally). Do not overwrite an existing `.env` when updating your checkout. Environment variables override the root `.env`. To use the optional MongoDB backend instead, set `BARTR_STORAGE=mongo` and `MONGODB_URI`.

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

### Temporary test mode without cloud or AI credentials

Instead of the normal backend command:

```sh
BARTR_STORAGE=memory python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

This explicitly selects temporary, in-process storage. Accounts, items and trades disappear on restart or reload. There is no silent fallback after a database failure. Use one worker in this mode. Do not use it for saved user data.

Open `/home` to register or sign in. The sidebar or mobile navigation opens Inventory and Preferences directly; Account is in the header. Prepare a listing from a photo or manual details, keep it as a private draft, and explicitly publish when ready. Unfinished listing drafts remain separate while switching items within the current session. Saved cookies restore the account on direct visits and refreshes. Anonymous protected visits return to Home; connection failures offer Retry. See the [profile guide](docs/PROFILE.md) for routes and session behavior.

The current frontend phase defers offers and discovery controls. `/trade` is a placeholder; old `/discover` and `/trades` links lead there. Existing backend matching and trading endpoints remain available and retain their consent, reservation, cancellation and handoff rules.

## Live assistance and semantic search

- Set `GEMINI_API_KEY` and a suitable image/search/structured-output `GEMINI_MODEL`. Optional `GEMINI_VALUATION_MODEL` and `GEMINI_EXTRACTION_MODEL` select those stages. Analysis is advisory and saved per item revision; it does not automatically publish or overwrite reviewed facts.
- Configure the AWS credential chain, `AWS_REGION`, and a Titan Text Embeddings V2-compatible `BEDROCK_EMBEDDING_MODEL`. Example model ID to verify in your account: `amazon.titan-embed-text-v2:0`. Dimensions default to 1024; the Atlas index must match.
- Semantic search requires `BARTR_STORAGE=mongo`; it is unavailable with DynamoDB. Create a Vector Search index named `item_embeddings` on collection `search_items` with [the index definition](specs/001-smart-barter-marketplace/contracts/atlas-vector-index.json). Match `BEDROCK_EMBEDDING_DIMENSIONS` if changed.
- Owners select **Index for semantic search** for each current published item. Edits make older projections stale; index the new revision. Backend semantic discovery checks current projections and reports missing/index failures explicitly; its frontend controls are deferred.
- Semantic candidates are assessed against interests and exclusions with Gemini before deterministic bundle validation. Provider/index failures are API errors, distinct from an empty set of compatible trades.

Use server-only environment files. Never commit credentials or put them in `NEXT_PUBLIC_*` settings. Sessions use HTTP-only cookies. Production HTTPS deployments must set `COOKIE_SECURE=true` and exact `WEB_ORIGINS`. Browser mutations use an application header and origin checks. API clients must send `X-Bartr-Request: 1` and a valid session cookie.

## Verify

```sh
source .venv/bin/activate
python -m pytest backend/tests -q
cd frontend
npm run typecheck
npm run build
npm test
npm run test:coverage
npm run test:e2e
npm run test:backend
```

Domain/API/adapter fixtures verify permissions, item publication, all nine bundle shapes, percentage limits, exact revisions, duplicate command handling, overlapping acceptance, cancellations and handoff. See [the implementation plan](specs/001-smart-barter-marketplace/plan.md), [tasks](specs/001-smart-barter-marketplace/tasks.md), and [verification status](docs/VERIFICATION.md).

Engineering changes follow the [AI engineering workflow](docs/ENGINEERING.md), including requirement-linked assignments, independent behavioral review, and evidence labeled by storage and provider mode.

## Structure and limits

- `backend/app/domain.py`: authoritative account, listing and exchange rules.
- `backend/app/api/`: closed schemas and authorized HTTP routes.
- `backend/app/services/`: photo normalization, Gemini and Bedrock/Atlas adapters.
- `backend/app/storage/dynamodb*.py`: normalized DynamoDB records, atomic writes and photo chunks.
- `backend/app/storage/state.py`: optional atomic MongoDB aggregate and explicit temporary test storage.
- `frontend/app/`, `components/ui/`, `lib/`: app views, shadcn components and typed clients.
- `requirements.txt`: one Python dependency file. `specs/`: canonical Spec Kit artifacts. `docs/`: guides and reference reviews.

The DynamoDB adapter uses normalized records and conditional transactional writes; its compatibility layer still reads a consistent snapshot for domain operations. Record and transaction limits are explicit, and existing legacy data needs a reviewed migration. The optional MongoDB adapter keeps marketplace state in a bounded versioned aggregate, with images and search projections separate. Neither storage path establishes unbounded production scale. Search also has an explicit computation limit; it never claims exhaustive global optimality. Larger scale requires aggregate partitioning/transactions and measured search optimization.

No payment, cash supplement, shipping, Solana/NFT, multi-party trade, automated dispute resolution, email/university verification or physical-delivery proof is implemented. The specification's pilot, semantic-quality, screen-reader and concurrent-load targets require their own evaluation; a successful build does not establish them.
