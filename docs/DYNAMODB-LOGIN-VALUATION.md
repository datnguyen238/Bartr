# DynamoDB profile login and photo valuation increment

Owner: Codex. Requested scope: backend only; FR-001–005 and FR-007. User explicitly changed persistence from MongoDB to DynamoDB. No frontend files, deployment, provisioning, live AWS/Gemini requests or executable verification are authorized in this increment.

## Design deviation recorded before implementation

Keep existing username/password registration, opaque HTTP-only sessions, owner checks, revision checks and explicit publication. Add a DynamoDB repository behind the existing domain interface, selected by `BARTR_STORAGE=dynamodb`. Do not create or overwrite a user table, guess credentials, automatically migrate existing table data, or silently fall back to memory. The supplied IAM identity is not an access key or table schema; boto3 uses the user's configured credential chain.

This bounded MVP stores compressed marketplace metadata in one conditional-write record. It has an explicit 300 KiB compressed-state ceiling beneath DynamoDB's 400 KiB item limit; it is not the final scalable schema. Conditional revision replacement preserves the existing all-or-nothing domain boundary. Uploaded normalized JPEGs are stored as namespaced chunks of at most 300 KiB, transactionally, with a 3 MiB normalized-photo ceiling to stay below the 4 MiB transaction limit. Original phone-photo upload limits stay separate. No object-storage vendor is added. Existing table records outside the configured namespace are untouched.

The repository needs the existing table name and string partition-key name; a string sort key is optional. Non-string schemas need a different mapping and are rejected explicitly. Reserved prefixes isolate backend-owned records. Semantic Atlas search is not migrated by this change and must report unavailable on DynamoDB, rather than pretend DynamoDB is Atlas Vector Search.

Use the canonical provider direction: Gemini `models.generate_content` with a closed image/valuation schema and configured stable model, qualitative uncertainty and nullable positive USD integer cents. This is an advisory image estimate, not a search-backed market appraisal. Keep the old grounded-comparables adapter separate. Owner review is required: submitting the exact saved estimate with its bound analysis ID records assisted provenance; a corrected amount is owner-entered. No analysis silently changes or publishes a listing.

## Expected backend journey

Register/sign in → save a draft → upload a photo → request analysis for the current revision → inspect suggestions → PATCH the reviewed amount with its analysis ID → publish the completed listing → GET the listing with image reference, comparison amount, provenance and last-set date. Private analysis remains owner-only. Manual listing remains available after provider failure.

## Configuration and limits

`DYNAMODB_TABLE`, `DYNAMODB_PARTITION_KEY`, optional `DYNAMODB_SORT_KEY`, optional `DYNAMODB_NAMESPACE` (default `BARTR_V1`). Standard AWS region/profile/credential chain. No secrets are written into source or evidence.

AWS limits: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Constraints.html
Gemini SDK/schema: https://ai.google.dev/gemini-api/docs/structured-output

Evidence status: implementation and regression coverage are to be inspected only. Tests, application startup, provider calls and database writes are NOT RUN at the owner's request. Existing MongoDB rows/collections are not migrated or deleted. Table schema and account access require user confirmation before live verification.

## Configuration to complete locally

The Gemini key is stored only in the ignored root `.env`. The selected model follows the approved provider plan (`gemini-3.8-flash`); availability and quota have not been checked. The AWS identity supplied by the owner is not stored as a secret and does not substitute for SDK authentication.

Fill the existing table details in `.env`, without putting credentials in Git:

```dotenv
BARTR_STORAGE=dynamodb
DYNAMODB_TABLE=your-existing-table
DYNAMODB_PARTITION_KEY=your-string-partition-key-name
DYNAMODB_SORT_KEY=
# Leave sort-key name empty only if the table has no sort key.
DYNAMODB_NAMESPACE=BARTR_V1
# AWS_REGION or the region in your configured AWS profile is used.
```

The IAM principal needs `dynamodb:DescribeTable`, `GetItem`, `PutItem`, and `TransactWriteItems` on this table. This code does not provision infrastructure or assume that STS identity success grants DynamoDB access. Changing a populated namespace does not migrate its data; keep the old namespace available for recovery.

## Requests for the owner to test (not executed here)

1. Register via `POST /api/auth/register` with username/password/display name/community, or sign in via `POST /api/auth/login`. Retain the HTTP-only session cookie. Send `X-Bartr-Request: 1` on mutations.
2. `POST /api/items` with draft title, description, category and condition. Preserve the returned item ID and revision.
3. `POST /api/items/{id}/image?expected_revision={revision}` as multipart `file`. Preserve the returned new revision and image ID. The returned image is available through authorized `GET /api/images/{image_id}`.
4. `POST /api/items/{id}/analysis` with `{"expected_revision":2}` using the actual current revision. Inspect `analysis_id`, `estimate_minor`, suggestions and uncertainty. No listing value is silently changed.
5. `PATCH /api/items/{id}` with all reviewed listing fields, the current `expected_revision`, the chosen `value_minor`, `analysis_id`, and `status=available`. If clarification was requested, resolve the facts and analyze the new revision instead of applying a missing value.
6. `GET /api/items/{id}` or `GET /api/items` shows the selected value, image reference, value source/time and uncertainty. The image/analysis itself never establishes authenticity or physical working order.

All actions are still owner/session checked. The frontend login gate and seed behavior are untouched. No frontend files are modified. Live semantic search remains an Atlas-dependent capability and is explicitly unavailable with DynamoDB in this increment.

## Owner-supplied table configuration

The owner confirmed `bartr-dev` in `us-east-1`, string partition key `PK`, string sort key `SK`, and AWS CLI profile `bartr-dev`. The root `.env` is configured accordingly. Reuse this existing table; do not provision a new one. Table ACTIVE status and successful CLI authentication are owner-reported. Backend read/write permissions, photo chunk transactions and all live provider calls remain unverified. Follow [the manual backend test guide](TEST-LOGIN-VALUATION.md) to establish that evidence.
