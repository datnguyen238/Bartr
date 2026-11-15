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
