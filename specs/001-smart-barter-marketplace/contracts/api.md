# API contract

All marketplace routes are under `/api`. Authentication uses an HTTP-only opaque session cookie. No endpoint trusts a caller-supplied owner ID. Mutations require a same-origin request and closed schemas. Conflicts use 409; unauthorized/private records are inaccessible; provider/database failures use actionable 503 responses without raw secrets.

- `POST /auth/register`, `/auth/login`, `/auth/logout`; `GET /me`. The implemented `GET /me` includes `storage` as `mongodb`, `temporary-memory`, or `temporary-json`; this is operational status, not authorization or durability evidence.
- `GET/PATCH /profile`: own profile and private preferences only; writes require expected revision.
- `GET/POST /items`, `PATCH /items/{id}`: owner-only draft/update, public available-listing discovery, publication requires reviewed fields and image.
- `POST /items/{id}/image`, `GET /images/{id}`: normalized owner upload and audience-checked image read.
- `POST /items/{id}/analysis`: Gemini suggestions for owner review; no silent publication or overwrite.
- `POST /preferences/interpret`: suggestions for review, no direct mutation.
- `POST /items/{id}/embedding`: revision-bound Bedrock indexing.
- `GET /recommendations`, `POST /recommendations/dismiss`: authenticated, reciprocal hard eligibility and both gap limits; explicit missing-input/provider/index failure states.
- `GET/POST /trades`, `GET /trades/{id}`: participants only; manual proposals require explicit warning acknowledgement where needed.
- `POST /trades/{id}/actions`: counter, note, accept, decline, withdraw, cancel, handoff. Expected proposal revision and command ID required. All effects are atomically validated; replay cannot duplicate or re-open state.

OpenAPI is generated from implementation schemas; this artifact captures audience and state invariants. No cash or third participant is accepted.


## Approved DynamoDB login/photo valuation increment

The owner switched the requested backend persistence to DynamoDB. See [the bounded design and configuration](../../../docs/DYNAMODB-LOGIN-VALUATION.md). Existing account/session and item routes remain; this does not claim conformance with every future route/schema in the planned OpenAPI.

- `BARTR_STORAGE=dynamodb` selects namespaced conditional-write persistence using the configured AWS credential chain and existing string-key table. No table is provisioned and no existing application data is migrated automatically.
- `GET /me` reports `storage=dynamodb` in this mode; frontend files/types are intentionally unchanged in this backend-only increment.
- `POST /items/{id}/analysis` now makes one schema-constrained Gemini image-assessment request, persists a server-authored `analysis_id`, and binds it to owner/item/image/revision. It returns `estimate_minor` (positive USD cents or null), `uncertainty`, reasons, and owner-reviewable identity suggestions. It does not search online or claim cited market evidence.
- `PATCH /items/{id}` accepts optional `analysis_id`. With the exact saved estimate on the still-current source revision it sets assisted provenance. A corrected estimate is owner-entered; an unrelated or stale analysis ID is rejected. The chosen comparison value, source, date and uncertainty appear in the listing response. Publication stays an explicit owner action.
- `GET /items/{id}` returns a visible listing or 404. Unreviewed analysis is not included for other members. Published value metadata does not grant access to private provider results.
- Backend tests/fixtures for this increment are authored but NOT RUN. Live AWS/Gemini access and table-schema validation are NOT RUN at the owner's request.
