# Bartr

Trading items platform. This repository currently contains the application foundation: a FastAPI backend and a Next.js frontend using TypeScript, Tailwind CSS and shadcn/ui, with the black-and-cream theme from Swapify.

## Run locally

Use Python 3.10+ and Node.js 20.19+ (the frontend includes `.nvmrc`). Keep both services running in separate terminals.

**Terminal 1 — backend, from the repository root:**

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

If already in `backend/`, activate `../.venv/bin/activate`, install with `python3 -m pip install -r ../requirements.txt`, then run `python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.

**Terminal 2 — frontend, from the repository root:**

```sh
cd frontend
npm ci
npm run dev
```

Open [the frontend](http://localhost:3000) and select **Check API connection**. Backend documentation is at [localhost:8000/docs](http://localhost:8000/docs); the health endpoint is [localhost:8000/api/health](http://localhost:8000/api/health).

Next.js forwards browser requests under `/api` to FastAPI. To change the API origin, copy `frontend/.env.example` to `frontend/.env.local`, set `API_BASE_URL`, and restart Next.js (rebuild for production). Backend configuration loads the root `.env`; shell variables take precedence. Never put private keys in `NEXT_PUBLIC_*` variables. Environment files are ignored by Git.

## Structure

```text
backend/
  app/
    main.py              Application assembly
    api/routes.py        HTTP routes and response contracts
    core/config.py       Server-only configuration
  tests/                 API verification
frontend/
  app/                   Next.js App Router views and theme
  components/ui/         shadcn/ui components
  lib/                   Typed API and styling helpers
  components.json        shadcn/ui configuration
  package-lock.json      Reproducible frontend dependencies
docs/                    Project scope and developer guides
requirements.txt         One Python dependency file
.agents/ and .specify/    Existing Spec Kit workflow and constitution
```

## Verify

From the repository root, with the Python environment active:

```sh
python -m pytest backend/tests -q
```

From `frontend/`:

```sh
npm run typecheck
npm run build
```

The foundation includes a health contract and an interactive connection check. Listings, trading, valuation, authentication, database persistence, and external integrations are not implemented. No Swapify credentials or demo data have been copied. The [foundation scope and acceptance scenarios](docs/FOUNDATION.md) document what is included. The existing [Bartr constitution](.specify/memory/constitution.md) remains unchanged.
