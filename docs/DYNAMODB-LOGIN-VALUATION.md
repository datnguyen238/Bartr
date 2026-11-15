# DynamoDB setup and landing-page integration

The current implementation uses the approved [DynamoDB schema v1](../specs/001-smart-barter-marketplace/dynamodb-data-model.md). It stores separate profile, preference, listing, session, offer, trade and receipt records. This supersedes the earlier compressed whole-state design and its optional sort key. Scope: FR-001–007, FR-012, FR-014–027 and the existing public API compatibility boundary.

## Configuration

Account-storage safeguard (FR-001–002): DynamoDB is the default. Starting with `BARTR_STORAGE=json` or `memory` now also requires `BARTR_ALLOW_LOCAL_STORAGE=true`; otherwise the backend stops before creating or modifying a local database. This explicit opt-in preserves isolated test workflows and prevents an old JSON `.env` from silently storing team accounts locally. It does not migrate existing accounts. Keep any local JSON file intact until a separately reviewed migration or account recreation is complete.

Use the owner's existing `bartr-dev` table in `us-east-1` with String partition key `PK` and String sort key `SK`. The application creates no tables or indexes. Configure the ignored root `.env` or process environment:

```dotenv
BARTR_STORAGE=dynamodb
AWS_PROFILE=bartr-dev
AWS_REGION=us-east-1
DYNAMODB_TABLE=bartr-dev
DYNAMODB_PARTITION_KEY=PK
DYNAMODB_SORT_KEY=SK
```

Boto3 uses the AWS credential chain; a profile name alone does not supply credentials. If the configured profile is absent, configure it locally or use another valid credential-chain source. Keep access keys out of tracked files and `NEXT_PUBLIC_*` variables. The configured principal needs access for table description, strong reads, paginated Scan/Query, and the conditional transactional writes used by the adapter. See the [transaction API](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html) when defining table permissions.

Production entity keys follow the approved `USER#`, `TRADE#`, `SESSION#` and other schema patterns. `DYNAMODB_NAMESPACE` (default `BARTR_V1`) selects legacy image-chunk keys and legacy-state detection; changing it does not isolate or migrate entity records. A constructor-only `TEST#` scope isolates synthetic integration-test entities.

Install declared dependencies and start the API from the repository root:

```sh
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Run `npm run dev` from `frontend/` and use the existing localhost:3000 frontend. Its server-side `/api` rewrite connects to port 8000. Keep `NEXT_PUBLIC_USE_SEED_DATA` unset or `false` to use saved API records.

For temporary local JSON testing, override storage explicitly:

```sh
BARTR_ALLOW_LOCAL_STORAGE=true BARTR_STORAGE=json BARTR_JSON_PATH=.bartr/bartr.local.json \
  .venv/bin/python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

The [JSON fixture command](../README.md#temporary-json-document-mode-without-atlas-or-ai-credentials) populates only an empty JSON database. It never imports the shared demo account or fixture data into DynamoDB. Switching storage requires signing in to an account that exists in the selected store; records and sessions are not automatically migrated.

## Browser and API flow

1. Register or sign in through `/register` or `/sign-in`. Authentication uses the existing HTTP-only session cookie and same-origin mutation header.
2. The landing page and `/discover` load `GET /api/me`. Its `storage=dynamodb` response uses the same typed frontend shape as JSON, memory and legacy MongoDB. Full-width member cards show public same-community profiles and available listings; private drafts, preferences and unreviewed analysis stay owner-only.
3. Save a draft and upload its photo. JPEG, PNG, WebP and HEIC/HEIF are normalized to JPEG. Authorized `GET /api/images/{id}` follows owner, same-community published listing, and historical-trade participant access.
4. Request photo analysis for the current revision. Gemini returns a saved `analysis_id`, provisional `estimate_minor`, uncertainty and identity suggestions. This is an image-assisted estimate; it does not search current market prices or change the listing.
5. Select **Use this estimate** and explicitly save. The PATCH includes the current revision and selected analysis ID. The exact accepted estimate gets assisted provenance. Editing the amount makes it owner-entered; stale or foreign analysis is rejected. Publishing remains an explicit owner action.
6. Save reciprocal interests, then select **Find bundle matches**. DynamoDB uses exact-text discovery. Atlas semantic indexing/search remains unavailable in this mode. Suggestions do not record consent or reserve items; the existing proposal, acceptance, cancellation and handoff rules apply.

## Consistency and recovery

The adapter preserves the existing domain `read`/`mutate` boundary using strongly read paginated snapshots bracketed by a serialization epoch. One conditional transaction commits changed listings, trade details, consents, history, participant references and receipts together. Conflicts retry from current data; ambiguous commits return `COMMIT_UNRESOLVED` and require reloading or retrying the same command ID.

Transaction, row and image limits are explicit in the [approved model](../specs/001-smart-barter-marketplace/dynamodb-data-model.md). Uploaded normalized JPEGs use transactional chunks up to 300 KiB each with a 3 MiB image ceiling. Native DynamoDB vector search, large-list performance and cross-region conflict handling are outside this adapter's verified scope.

There is no automatic migration, table recreation or source deletion. Legacy whole-state data produces `MIGRATION_REQUIRED`; it must not appear as an empty database. Freeze writers, back up state/images, stage and verify a separately reviewed import before switching persisted datasets. Preserve the old source for recovery and reconcile commitments before rollback.

## Verification

Run the offline application and Moto regressions:

```sh
.venv/bin/python -m pytest backend/tests -q
```

Moto API checks cover authenticated workspace loading, restart sessions, same-community available listings and photos, private analysis, explicit estimate acceptance and stale replay, and exact-text/unsupported-semantic outcomes. Independent adapter tests cover conditional conflict, overlap, replay and transaction failure. These checks make no AWS or Gemini requests. See [verification status](VERIFICATION.md) for exact revisions, commands and results, including historical live evidence.

The separate opt-in live test creates synthetic scoped records in the existing table and cleans only their exact keys. It is not part of offline verification. Current integration work does not automatically execute it, migrate fixture data, provision resources or validate live Gemini quality.
