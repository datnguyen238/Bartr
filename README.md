# Bartr — AI-Powered Smart Bartering Marketplace

Bartr discovers item bundles across two inventories, with reviewed item values and voluntary agreement. The canonical requirements are in [`specs/001-smart-barter-marketplace/spec.md`](specs/001-smart-barter-marketplace/spec.md). The earlier `docs/specs/001-bundle-matching` draft is superseded.

## Stack and implemented journeys

Next.js, TypeScript, Tailwind and shadcn/ui provide the black-and-cream frontend. FastAPI enforces account identity, private profiles/preferences, listing revisions, one-to-three items per side, same-community/exclusion rules, both members' recommendation gap limits, versioned proposals, private notes, atomic reservations, cancellation and mutual handoff confirmation.

Gemini adapters provide owner-reviewed image/valuation and preference suggestions. Bedrock generates Titan-compatible text embeddings; MongoDB Atlas stores saved marketplace data and semantic-search projections. Live integrations require configuration and have not been authenticated or benchmarked by offline tests. Exact-text discovery is explicitly selectable for local testing and is not semantic search.

## Run locally

Requires Python 3.10+ and Node.js 20.19+. From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

For saved data, set `MONGODB_URI` in `.env` and leave `BARTR_STORAGE=mongo`. Do not overwrite an existing `.env` when updating your checkout. Environment variables override the root `.env`.

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

### Temporary test mode without Atlas or AI credentials

Instead of the normal backend command:

```sh
BARTR_STORAGE=memory python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

This explicitly selects temporary, in-process storage. Accounts, items and trades disappear on restart or reload. There is no silent fallback after a MongoDB failure. Use one worker in this mode. Do not use it for saved user data.

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

## Structure and limits

- `backend/app/domain.py`: authoritative account, listing and exchange rules.
- `backend/app/api/`: closed schemas and authorized HTTP routes.
- `backend/app/services/`: photo normalization, Gemini and Bedrock/Atlas adapters.
- `backend/app/storage/state.py`: atomic MongoDB aggregate and explicit temporary test storage.
- `frontend/app/`, `components/ui/`, `lib/`: app views, shadcn components and typed clients.
- `requirements.txt`: one Python dependency file. `specs/`: canonical Spec Kit artifacts. `docs/`: guides and reference reviews.

This MVP keeps private marketplace state in one versioned MongoDB aggregate, with images and search projections separate. Compare-and-swap writes atomically update related reservations; state capacity is bounded to stay below MongoDB's document limit. This is not an unbounded production data model. Search also has an explicit computation limit; it never claims exhaustive global optimality. Larger scale requires aggregate partitioning/transactions and measured search optimization.

No payment, cash supplement, shipping, Solana/NFT, multi-party trade, automated dispute resolution, email/university verification or physical-delivery proof is implemented. The specification's pilot, semantic-quality, screen-reader and concurrent-load targets require their own evaluation; a successful build does not establish them.
