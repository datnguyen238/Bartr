# Quickstart and Validation: Bartr Marketplace

This is the Phase 1 validation guide for the planned feature. The current repository runs only the foundation; marketplace routes, Compose, management commands, fixtures, provider adapters and browser tests below must be delivered during implementation. Do not report a planned scenario as passing because its command is documented here. See [plan.md](plan.md), [data-model.md](data-model.md), [HTTP contract](contracts/openapi.json), [provider contracts](contracts/provider-contracts.md), and [matching/UI behavior](contracts/matching-and-ui.md).

## 1. Prerequisites and configuration

Use Python 3.14, Node 24 LTS, Docker Compose and a modern browser. Implementation updates `.nvmrc` from Node 20 and pins a compatible Atlas Local image by digest. Keep Python dependencies in root `requirements.txt`. Existing Python 3.14/Node 25 installations are observations, not a substitute for the documented reproducible Node target.

The implementation must add placeholder-only configuration to the existing example files. Never copy real values into this guide or source control.

| Setting | Fixture/local meaning | Live pilot requirement |
|---|---|---|
| `APP_NAME` | `Bartr` | Same |
| `API_BASE_URL` | `http://127.0.0.1:8000` in frontend server configuration | Private backend origin, never a `NEXT_PUBLIC_*` credential |
| `MONGODB_URI` | Atlas Local loopback connection with `directConnection=true` | TLS Atlas replica-set URI supplied as a secret |
| `MONGODB_DATABASE` | `bartr_dev`; tests use isolated `bartr_test_*` | Separate production database |
| `AI_MODE` | `fixtures` | `live` only when intentionally configured |
| `APP_ORIGIN` | `http://localhost:3000` | Exact public HTTPS origin |
| `SESSION_CSRF_SECRET` / `RATE_LIMIT_HMAC_SECRET` | Locally generated random secrets | Managed persistent secrets; never browser-visible |
| `COOKIE_SECURE` | `false` on loopback only | `true`; host-only `__Host-bartr_session` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Not needed for fixtures | Paid project; explicit stable `gemini-3.8-flash`, verified access |
| `AWS_REGION` / `BEDROCK_EMBEDDING_MODEL` | Not needed for fixtures | Approved region and `amazon.titan-embed-text-v2:0`; normal AWS credential chain |
| `EMBEDDING_DIMENSIONS` / `VECTOR_INDEX_NAME` | `1024` / `items_semantic_v1` | Same versioned embedding space/index |

Fixture mode must refuse outbound Gemini/Bedrock requests even if credentials exist. The live pilot accepts only adults 18+ by self-attestation, uses a supported region and paid Gemini processing for real member content, and sends no private trade notes to providers. No birthday is collected. [Provider eligibility and payload limits](contracts/provider-contracts.md) are delivery prerequisites, not resources provisioned by this plan.

## 2. Current foundation check

These commands are already supported by the foundation, subject to locally installed dependencies:

```sh
cd /Users/phtam/Bartr
source .venv/bin/activate
python -m pytest backend/tests/test_api.py -q
cd frontend
npm run typecheck
npm run build
```

Expected: the two existing backend health/404 tests and frontend checks pass. This proves neither marketplace behavior nor AI integration. Planning changes require document/contract validation; they do not require rerunning an unchanged application build.

## 3. Planned feature setup and startup

After implementation delivers the paths and commands in [plan.md](plan.md), run from the repository root:

```sh
cd /Users/phtam/Bartr
python3.14 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
cp frontend/.env.example frontend/.env.local
docker compose up -d mongodb
python -m backend.app.manage bootstrap
python -m backend.app.manage seed-demo --dataset chair-monitor
```

Populate only local settings/secrets in `.env` before bootstrap. Compose binds loopback and configures the required local replica-set hostname and persistent db/config/search volumes. The management command waits for a writable primary and actual vector-index readiness; a successful ping alone is insufficient. Bootstrap is idempotent and creates validators, unique/TTL/vector indexes, schema/catalog versions and no live member content.

`seed-demo` is fixture-only and refuses nonlocal/production databases. It creates adult synthetic members A/B, reviewed items and compatible interests, plus a third member for denied-access/overlap scenarios. It prints fixture login identifiers/passwords to the interactive local console, never production diagnostics. A owns Chair $40 + Calculator $20; B owns Monitor $65. Both share a canonical community. Image fixtures are synthetic, contain no personal data and have metadata removed.

Use separate terminals:

```sh
# Backend — repository root, environment active
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

```sh
# Durable enrichment/invalidation worker — repository root
source .venv/bin/activate
python -m backend.app.worker
```

```sh
# Frontend
cd /Users/phtam/Bartr/frontend
nvm use
npm ci
npm run generate:api
npm run dev
```

Open `http://localhost:3000`; all browser requests use the same-origin `/api` rewrite. Use one hostname consistently so cookies/Origin match. `/api/health` keeps its original contract. `/api/catalog` returns canonical choices. API docs remain at backend `/docs`; generated frontend types must come from the design contract and stay aligned with implementation output.

## 4. Automated validation commands to implement

Commands below are planned acceptance entry points; they must be added with the feature rather than treated as currently available scripts.

```sh
cd /Users/phtam/Bartr
source .venv/bin/activate
python -m pytest backend/tests/unit backend/tests/contracts -q
python -m pytest backend/tests/integration -q
python -m backend.app.manage evaluate --suite bundle-gold --mode fixtures
python -m backend.app.manage evaluate --suite wording-gold --mode fixtures
python -m backend.app.manage benchmark --listings 1000 --max-inventory 30 --concurrency 20 --requests 200
cd frontend
npm run generate:api
npm run typecheck
npm run build
npm run test:e2e
```

Use isolated test databases, deterministic clocks/IDs, synthetic photos and recorded provider-shaped responses. Tests must not fall back to mocks when the real database/index is unavailable: report that integration gate as unavailable/failing. Do not run the gold-data loader or race scenarios against a real-member database. The benchmark seeds its own isolated fixture dataset and records hardware, cold/warm artifacts, request/error counts and latency distribution; 95% must return correct results within ten seconds, not just return quickly with errors.

| Suite | Required evidence |
|---|---|
| Unit/property | Exact cents/bps boundaries at 0/20/100%; all nine shapes; no duplicate IDs; optimized top-result scores agree with exhaustive small fixtures; 2/1/0 ranking despite reversed value gaps. |
| HTTP/schema | Design OpenAPI validates; implemented requests/responses match; no owner-only fields in public profiles/items; cookies/CSRF/Origin and denied access; source/date provenance server-owned; contract-generated types do not drift. |
| Real transactions | Two acceptances sharing an item produce at most one agreement and no partial reservation; accept versus item/policy edits; incompatible policy changed back; reserve/cancel restoration; counteroffer stale consent; note versus closure; final cancel versus handoff; identical and changed-payload replay; interrupted/unknown commit remains reconcilable after restart. |
| Images/jobs | Invalid/oversize decoded images; EXIF removal; historical image access after removal; cleanup/attachment race; worker lease expiry; stale completion fenced by revision/token; manual listing survives assistance failure. |
| Actual vector index | Correct dimensions/model/filter definition, self-vector retrieval, freshness/index lag, moved-community projection lag with authoritative fallback. An ordinary replica set or fake cosine adapter does not prove this suite. |
| Provider fixtures | Schema-valid but false facts/IDs, null/fractional/oversized value, unsafe instructions, safety block, empty output, timeout/throttle, wrong vector length, no hidden network call, malformed explanation fallback. |
| Browser/accessibility | Both accounts through listing/preferences/discovery/preview/counteroffer/accept/cancel/handoff, failed services and unresolved actions; keyboard focus and screen-reader feedback; desktop and 390px without horizontal overflow. Axe supplements manual assistive-technology checks. |

## 5. Observable end-to-end scenarios

1. **Inventory and privacy**: Sign in as A. Publish Chair and Calculator, save a specific monitor interest, inspect assisted suggestions and manually correct one. Set one valuation unknown, verify publication still works, then restore its positive value. B can see published details and A's public profile but not A's drafts, preferences, notes, age attestation or account email. In a third-account session, direct item/trade/image/operation requests must enforce the same boundary.
2. **Core bundle**: With the worker's fixture artifacts ready, A opens Discover. Chair + Calculator ↔ Monitor appears with $60/$65 totals, $5 absolute difference, about 7.7%, grounded interests and no obligation. Inspecting/dismissing reserves nothing. The same combination stays dismissed after availability-only changes; changing item details or A's preferences permits it to return.
3. **Shapes and chosen ranking**: Load labeled shape/ranking fixtures. Verify 1:1, 1:2, 1:3, 2:1, 2:2, 2:3, 3:1, 3:2 and 3:3. A qualifying both-specific recommendation precedes a one-specific recommendation even with a larger gap; one-specific precedes category-only. Within each tier, exact smaller relative gap wins. Excluded/unavailable/cross-community items never become eligible through ranking.
4. **Correct preconditions and failures**: Empty A inventory gives `needs_inventory`; missing interests gives `needs_interests`; otherwise useful unknown-valued bundles give `needs_valuation`. Complete compatible-artifact search with no feasible exchange gives `no_match`. Disable/fail required semantic artifacts or exhaust the processing deadline: get 503/504 and retry guidance, never successful `no_match`. Index lag alone may succeed if the complete authoritative fallback works.
5. **Negotiation and consent**: A previews and submits the two-item bundle, acknowledging visible warnings. Only A consents. B sends a private note and submits a counteroffer. A's earlier consent is cleared and sender/recipient roles follow B's version. A's attempt to accept the old version gets stale-review guidance. After reviewing the current immutable version, A's acceptance reserves all current items together. A separate item edit before acceptance invalidates the open offer and requires a fresh one.
6. **Conflicts, retries and history**: Submit two overlapping fixture offers concurrently. At most one agrees. An identical retried command key returns its prior recorded outcome; the same key with a different payload conflicts. Simulate a response interruption/unknown commit: UI shows unresolved and checks the same operation key, including after backend restart. No timeout releases items or creates another agreement. Change an exclusion to conflict and then restore it; the affected old offer stays invalidated.
7. **Cancellation and handoff**: Before any handoff report, either participant may confirm cancellation and all reservations release together. Repeat with a new agreement: A reports handoff, so status awaits B and items remain reserved. One participant requesting cancellation cannot release them; both approvals can. In a separate fresh agreement, B's second handoff confirmation marks all items exchanged. Closed records are read-only; no countdown or AI action completes them.
8. **Understandable access**: Repeat primary actions using only a keyboard, then with a screen reader. Verify labels, field-associated errors, focus-managed confirmation dialogs, changed-offer/unresolved announcements and no repeated polling chatter. Check the same decisions at desktop and 390px. Tokens/revisions/provider stack names do not appear as product instructions.

For direct HTTP reproduction, first call `GET /api/auth/session` with a cookie jar, read its CSRF token, and supply that cookie plus exact Origin and `X-CSRF-Token` to register/login and later POST/PATCH/PUT calls. State-changing authenticated commands also require a stable `Idempotency-Key`; existing resource changes require the quoted revision in `If-Match`. Preview terms and acknowledge warnings before sender/recipient consent. See [OpenAPI](contracts/openapi.json) instead of bypassing controls with fake member headers.

## 6. Opt-in live checks and release gates

Use a configured, eligible project and synthetic content only for connectivity smoke:

```sh
python -m backend.app.manage provider-smoke --allow-live
```

This entry point must reject execution without explicit opt-in and live configuration. It performs one Gemini image-plus-JSON request, one Titan embedding request, and an Atlas readiness/self-vector check. It records sanitized success/error categories, never secrets/prompts/private data. It may incur provider charges when intentionally run later; no call is made by this planning workflow.

Connectivity is not semantic accuracy. Before release, independently label at least forty feasible inventory cases (all nine shapes), twenty wording pairs and additional no-match/negative cases. Freeze labels before evaluation. Run the same evaluator with the live adapters explicitly enabled, retaining versioned sanitized results:

```sh
python -m backend.app.manage evaluate --suite bundle-gold --mode live --allow-live
python -m backend.app.manage evaluate --suite wording-gold --mode live --allow-live
```

Meet SC-002/003 independently of fixture success; never relabel after observing failures to inflate results. Include twenty representative adult participants for SC-001/006/007 and the manual assistive-technology checks for SC-008. Release evidence maps outcomes to [the plan's acceptance table](plan.md#verification-and-acceptance-mapping).

Before hosted rollout, verify TLS/secure cookies, exact origins, private service access, managed secrets, transaction/index readiness, paid-provider eligibility, backup configuration and an isolated restore rehearsal. Confirm the operational recovery targets in research R10. Suspend trading during a restore and reconcile reservations, receipts, policy evidence and retained images before reopening. A rollback disables new mutations rather than freeing committed items. No deployment or account provisioning is included in this guide.
