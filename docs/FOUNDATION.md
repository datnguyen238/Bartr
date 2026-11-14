# Bartr foundation

## User outcome and approved scope

Developers can run a separate Python/FastAPI backend and a Next.js frontend using TypeScript, Tailwind CSS and shadcn/ui, following the previously approved Swapify stack. Keep one root Python requirements file and project guides in `docs/`. Preserve the repository's existing Spec Kit and constitution.

Acceptance scenarios:
- Backend startup exposes `/api/health` and OpenAPI documentation.
- Frontend startup displays a responsive black-and-cream starter page with shadcn/ui components.
- Checking the API displays an accessible connected or unavailable state; retry works after a failure.
- The browser uses a same-origin `/api` proxy; backend secrets stay server-side.
- Both root and `backend/` working-directory startup commands work.

## Implementation plan and constitution review

Use `backend/app/main.py` for application assembly, `api/` for routes and response schemas, and `core/` for root environment loading. Use `frontend/app/` for App Router views, `components/ui/` for shadcn components, and `lib/` for API and styling helpers. No database migration is needed because there is no application data yet.

Specify outcomes: the scenarios above define the foundation. Trading integrity: no trading mutations or simulated authentication are introduced. Privacy: the health endpoint returns service metadata only, dotenv files are ignored, and no credentials are copied from Swapify. Accessibility: semantic landmarks, visible focus states, a labelled button and live status feedback. Simplicity: only the dependencies needed for this stack, development and contract verification are installed.

Verification: backend health/404 contracts, frontend TypeScript and production build, and a live request through the Next.js proxy. Failures must be resolved before delivery.

Out of scope: listings, valuation, negotiation, wallets, authentication, database selection, deployment and automatic provider switching. Those require their own approved specifications. The API status checker is developer foundation verification, not a shipped marketplace feature.

## Verification result — November 14, 2026

- Two backend contract tests passed; startup imports also worked from `backend/`.
- Frontend TypeScript checking and production build passed.
- Chrome verified the actual `/api/health` proxy, keyboard button activation, simulated service failure and successful retry, and a 390-pixel mobile layout with no horizontal overflow or page errors.
- Git whitespace checks passed. Local backend and frontend previews run on ports 8000 and 3000 respectively.
- Changes remain local and uncommitted; nothing has been pushed. No live AI or other paid service was called.
