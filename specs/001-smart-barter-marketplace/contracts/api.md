# API contract

All marketplace routes are under `/api`. Authentication uses an HTTP-only opaque session cookie. No endpoint trusts a caller-supplied owner ID. Mutations require a same-origin request and closed schemas. Conflicts use 409; unauthorized/private records are inaccessible; provider/database failures use actionable 503 responses without raw secrets.

- `POST /auth/register`, `/auth/login`, `/auth/logout`; `GET /me`.
- `GET/PATCH /profile`: own profile and private preferences only; writes require expected revision.

  The current frontend separates Account and Preferences screens but uses this same full-profile write: `expected_revision`, `name`, `community`, `interests`, `exclusions`, and `gap_limit` are all required. A section save supplies the other section's **saved** values, never its unsaved draft. Username is read-only. `/me` restores the authoritative member after authentication; no browser route or fixture grants permission. The profile frontend increment adds no endpoint or persisted-schema changes.
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

The owner switched the requested backend persistence to DynamoDB. See [the current single-table schema](../dynamodb-data-model.md) and [the earlier configuration guide](../../../docs/DYNAMODB-LOGIN-VALUATION.md). Existing account/session and item routes remain; this does not claim conformance with every future route/schema in the planned OpenAPI.

- `BARTR_STORAGE=dynamodb` selects namespaced conditional-write persistence using the configured AWS credential chain and existing string-key table. No table is provisioned and no existing application data is migrated automatically.
- `GET /me` reports `storage=dynamodb` in this mode; the profile frontend retains its existing screens and accepts this storage label.
- `POST /items/{id}/analysis` now makes one schema-constrained Gemini image-assessment request, persists a server-authored `analysis_id`, and binds it to owner/item/image/revision. It returns `estimate_minor` (positive USD cents or null), `uncertainty`, reasons, and owner-reviewable identity suggestions. It does not search online or claim cited market evidence.
- `PATCH /items/{id}` accepts optional `analysis_id`. With the exact saved estimate on the still-current source revision it sets assisted provenance. A corrected estimate is owner-entered; an unrelated or stale analysis ID is rejected. The chosen comparison value, source, date and uncertainty appear in the listing response. Publication stays an explicit owner action.
- `GET /items/{id}` returns a visible listing or 404. Unreviewed analysis is not included for other members. Published value metadata does not grant access to private provider results.
- Offline fixture results and historical live evidence are scoped in [verification status](../../../docs/VERIFICATION.md). Live AWS/Gemini access and table-schema validation are not repeated as part of the profile merge.

# Live trade updates

For FR-015, FR-020 and FR-021, `WS /api/trades/{trade_id}/live` requires an allowed browser Origin and the existing session cookie. Only a trade participant receives the private current trade snapshot. The server rechecks session and participant access, and checks persisted revisions approximately every two seconds; the browser reconnects and replaces only older revisions. Writes remain on the existing authenticated HTTP action endpoint. This bounded polling bridge works across workers sharing the repository; it is not a durable in-memory message queue or a push notification service. Client-sent frames close the read-only connection. Deployment must proxy WebSocket upgrades on the same origin. Disconnects require reconnect; the saved history is the recovery source. Each connection adds repeated repository reads and has not been load tested.
