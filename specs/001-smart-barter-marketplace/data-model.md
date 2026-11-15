# Data Model: Bartr Smart Bartering Marketplace


**DynamoDB update (2026-11-14):** The approved [DynamoDB entity/access-pattern design](dynamodb-data-model.md) supersedes the MongoDB storage choice for the implemented MVP. Planned richer contracts below remain distinguished from the compatibility adapter.
**Date**: 2026-11-14 | **Status**: Phase 1 design

Implements [research decisions R1–R11](research.md). Public representations and commands are defined in [the API contract](contracts/openapi.json); AI payloads and vector indexing follow [provider contracts](contracts/provider-contracts.md). These are planned records, not existing database collections.

## Shared conventions and invariants

Use server-generated UUID strings for public `member_id`, `item_id`, `trade_id`, and related identifiers; identifiers grant no access. Store UTC instants and expose ISO 8601 timestamps. Every mutable public resource has a positive integer `revision`. Existing-resource mutations require its quoted revision in `If-Match`; a successful identical idempotency replay returns its receipt before checking that precondition.

Values use integer USD cents (`amount_cents`) from 1 through 10^12; unknown is null, never zero. Recommendation limits are integer basis points (`max_value_gap_bps`), 0–10,000, default 2,000. Compare gaps using exact integer cross-products: `10000 * abs(x-y) <= limit_bps * max(x,y)`. Round only display percentages. Server validation rejects unknown-valued automatic bundles, duplicate listing IDs, self-trades, cross-community proposals, and bundles outside one to three distinct items per side.

All consequential state is authoritative in MongoDB. Vector indexes, recommendation snapshots, browser state, and background projections cannot establish ownership, consent, availability, or successful completion. Private serializers expose only the authenticated owner's or participant's permitted records. No account credentials, raw sessions, CSRF secrets, or private notes enter public item snapshots or AI inputs.

## Collections, fields, and indexes

### `members`

Fields: `member_id`, `email_normalized`, `password_hash`, `display_name`, `community_id`, `revision`, `preference_revision`, `hard_policy_revision`, `eligibility_guard`, `adult_attested_at`, creation/update timestamps; private `interests`, `exclusions`, and `max_value_gap_bps`.

Each interest has an `interest_id`, explicit `kind` (`specific_product` or `category`), member-confirmed canonical category/product type and optional brand/model constraints, display text, and embedding metadata. Exclusions are member-confirmed conjunctions over catalog category/condition/brand attributes. A phrase that cannot be represented requires correction, rather than becoming an unenforceable stored constraint. Unknown facts necessary to evaluate an exclusion fail closed with an incomplete-information reason.

Unique indexes: `member_id`, `email_normalized`. Index `community_id` for partner lookup. Public projection contains only member ID, display name, and community. Email/hash, full preferences, and age attestation stay private. No date of birth is stored. Catalogs provide versioned community, category, and condition identifiers; changing a catalog never silently changes accepted offer facts.

`revision` changes on member-visible edits; `preference_revision` changes on every preference edit, including interests, exclusions, and recommendation limits, resetting the requester's affected dismissal fingerprints. The Preferences API's `revision` represents this preference revision. `hard_policy_revision` changes only on community/exclusion edits; exclusions therefore advance both revisions. `eligibility_guard` is an internal counter changed by serialization operations and is not itself a public edit. A display-name change does not invalidate offers.

### `member_policy_events`

Fields: `member_id`, `hard_policy_revision`, immutable `community_id` and exclusion snapshot, `catalog_version`, timestamp. Unique `(member_id, hard_policy_revision)`. The initial policy receives an event; a hard-policy edit appends its new snapshot atomically with the member update.

Offers retain the revision examined at creation and the original common community. Subsequent reads and open-trade commands inspect all intervening policies, not merely the latest one. Evaluate exclusions against immutable offered item facts and each community event against the offer's frozen original common community, not the counterpart's current community. Any incompatible intermediate policy permanently invalidates that open offer, even if policies are restored or both members later move to the same different community. Compatible changes and positive-interest edits do not invalidate otherwise eligible manual offers. Keep policy evidence while referenced trade history exists.

### `sessions`

Fields: `session_id`, unique `secret_digest`, nullable `member_id`, creation, absolute expiration, optional revocation timestamp. Authenticated expiration is seven days; anonymous sessions for login/register CSRF protection expire after one hour. Store only a digest of a random 256-bit bearer secret; derive the CSRF token using the secret and server-held secret. Rotate the cookie on successful registration/login and revoke on logout.

TTL index on expiration supports cleanup; authorization checks expiration/revocation directly because TTL cleanup is asynchronous. Cookie and CSRF values are never logged. Anonymous sessions grant no marketplace access; all private routes resolve their actual authenticated member.

### `items`

Fields: `item_id`, immutable `owner_id`, denormalized `community_id`, title, description, reviewed category/product/brand/model attributes, condition, up to four `image_ids`, valuation, `state`, `revision`, `trading_revision`, `availability_epoch`, nullable `reserved_trade_id`, timestamps, and optional `embedding` metadata. Public item representations group listing details under `facts`, and map the owning member's allowlisted fields to `owner`.

Valuation fields: `amount_cents`, `currency=USD`, source (`assisted`, `owner`, or `unknown`), `last_set_at`, uncertainty reasons, and internal applied-analysis/model/schema references where applicable. Known values require an assisted/owner source and server-set last-set time; `source=unknown` requires amount and date both null. Source/date are never writable client assertions. Publication requires title, description, category, condition, and at least one valid owned image. Non-null values cannot exceed 10^12 cents. Owner-confirmed facts remain separate from unapplied AI suggestions.

`revision` changes on every visible item mutation. `trading_revision` changes when title, description, reviewed attributes/category, condition, images, or valuation changes. `availability_epoch` increases on every state transition, including reserve and release, so availability returning to its prior value cannot revive older offers. An available item has no reservation; a reserved item has exactly one `reserved_trade_id`.

Indexes: unique `item_id`; `(owner_id, state, updated_at)`; `(community_id, state, owner_id)`; reservation pointer for agreement checks. Do not use a unique multikey index over trade arrays as the reservation authority. The current member's `community_id` is authoritative; the item field is only a search projection. Community edits enqueue projection/reindex jobs. Until they finish, whole-community fallback finds members in the current community and loads their available items by owner, discovering newly eligible items missed by stale projection filters and rejecting departed owners' stale hits. Projection lag cannot establish `no_match`.

`embedding` contains `vector`, `model_id`, `dimensions=1024`, normalization setting, source text hash, `source_revision=trading_revision`, status, and completion time. The Atlas vector index uses `embedding.vector` with cosine similarity and filters on community, owner, state, and embedding model. Matching queries exclude images. Index matches are rehydrated from current authoritative items; stale artifacts are not treated as current facts.

Private interest embeddings use the same model space but remain inside private interest records, outside the public item index. Their source is the relevant preference revision and canonical input hash. Model/dimension changes require a distinct artifact version and re-embedding, not mixing vector spaces.

### `item_analyses`

Fields: unique `analysis_id`, `owner_id`, `item_id`, `source_revision` (the analyzed item's trading revision), canonical `source_hash`, model/prompt/schema versions, validated attribute suggestions, nullable positive `estimate_cents`, uncertainty reasons, result status, and generation time. Index `(owner_id, item_id, source_revision)`; only the owner can read/review the artifact. Store validated suggestions and provenance, not raw prompts, provider responses, or duplicate image bytes. The public analysis response returns this persisted ID and its allowlisted result fields. Provider work precedes a bounded transaction that publishes the result and its command receipt together; no transaction contains a provider call.

`ValuationInput` contains amount and optional `analysis_id`; the backend obtains provenance from the saved artifact. Applying its unchanged stored estimate requires matching owner, item, current pre-edit trading revision, and current source hash. An edited/manual positive amount is owner-entered; null produces unknown amount/date. The backend sets `last_set_at` when a known value is applied. A stale or foreign analysis cannot claim assisted provenance or overwrite newer facts; stale source requires renewed review. Retain applied evidence with the item's/trade's reviewed history. A later unrelated edit does not invent a new valuation date or convert an existing unchanged saved value into a fresh AI estimate.

### `images`

Fields: `image_id`, `owner_id`, sanitized BSON bytes, content type, byte count, decoded dimensions, content digest, creation time, reference count, and attachment/cleanup state. Each image document contains at most 4 MiB; raw uploads are at most 8 MiB and 20 megapixels. Only decoded JPEG/PNG/WebP content is accepted, oriented and re-encoded with metadata stripped before storage.

Unique `image_id`; indexes on owner and orphan-cleanup eligibility. Image bytes are never embedded into item or offer documents. Current item and immutable offer references retain access evidence. Reference changes update the image document in the same transaction as the referring record, serializing attachment against cleanup. An image with zero references and no attachment for 24 hours may be conditionally removed; a TTL index must not independently erase retained history.

Serving requires an authenticated owner, a discoverable published listing, or participation in a trade snapshot referencing that image. A removed listing does not expose its images generally or erase prior participants' reviewed images. Cleanup cannot delete a concurrently attached or historical image.

### `trades` and `offer_versions`

`trades` fields: `trade_id`, exactly two sorted distinct `participant_ids`, `revision`, `state`, `current_offer_version`, current consent member IDs, nullable agreed version, reserved item IDs, per-participant handoff timestamps, per-participant cancellation approvals, closure reason/time, and creation/update timestamps. Unique `trade_id`; indexes `(participant_ids, state, updated_at)` and involved item references for projection lookup.

`offer_versions` fields: `trade_id`, monotonically increasing `offer_version`, sender/recipient IDs, frozen `common_community_id`, immutable give/receive item snapshots, each item's `trading_revision` and `availability_epoch`, examined member policy revisions, known totals or unknown flags, percentage-gap evidence, warnings, `terms_hash`, sender's explicit warning acknowledgments and consent time. Unique `(trade_id, offer_version)`; indexes on referenced item IDs and participants for invalidation work. Snapshots contain reviewed facts and image IDs, never private preferences or bytes. Public `Offer.version` maps to the stored offer version; `Trade.current_offer_version` remains explicit.

The pure preview supplies `terms_hash` over canonical side-specific reviewed item facts, revisions/epochs, valuations, hard-policy revision evidence, and required warnings. Submission/replacement recomputes that hash and rejects stale reviewed terms. Acceptance compares it with the unchanged current immutable offer and separately rechecks policy compatibility; compatible policy drift does not rewrite an existing offer's hash. Merely requesting a preview creates no persisted offer, consent, or reservation.

Terms are immutable after submission. A replacement retains the older version as superseded, assigns sender/recipient using the new version, and resets current consent to that sender only. Agreement references the same current version accepted by both participants; no separate agreement collection duplicates reservation authority. Manual proposals may exceed soft positive interests or value-gap preferences, with explicit warnings, but cannot violate hard exclusions, community, ownership, size, or availability.

### `trade_history`

Append-only entries contain `entry_id`, `trade_id`, kind, actor member ID, offer version, resulting trade revision, time, and, only for note entries, private note text. Index `(trade_id, created_at, entry_id)`. Both participants may read; no other member may access it. Notes and state events stay outside unbounded arrays in the trade document. GET trade history partitions this collection into `notes` and state `events`, alongside independently stored `offers`; note projections map entry/actor/text to `note_id`/`sender_id`/`text`. A note command conditionally touches the trade revision/state so it cannot append to a concurrently closed record. Notes may contain voluntarily shared coordination details; AI and public serializers exclude them.

### `recommendations` and `recommendation_dismissals`

Requester-private recommendation snapshots identify two members, item sets and reviewed revisions, policy/preference source revisions, valuations, interest-match evidence, number of recipients with a specific-product match (2, 1, or 0), explanation facts, and generation time. They never carry consent or reservation. Each response ranks eligible results by that recipient count descending, then exact relative value gap ascending; equal remaining ties have no required order.

Dismissals use unique `(requester_id, combination_fingerprint)`, with sorted side-specific item IDs and item trading revisions plus the requester's preference revision. This hides the same reviewed combination until its relevant details or requester preferences change. Pending semantic artifacts and incomplete whole-community evaluation return unavailable, not a false `no_match`. Before submission, recheck current facts regardless of snapshot freshness.

### `command_receipts`

Fields: `member_id`, `idempotency_key`, request digest, action/target references, recorded HTTP outcome and minimal response/resource references, resulting revisions, and timestamps. Unique `(member_id, idempotency_key)`, across endpoints. The digest covers method, canonical path, body, and expected revision. Image-upload digests additionally include the uploaded content digest. Authentication/CSRF validation precedes receipt lookup; an authorized identical replay returns the prior result before reevaluating `If-Match`. Different content under the same key is a conflict.

Receipt and domain effects commit in one transaction. Keep trade-action receipts with history; do not expire keys while a replay could duplicate retained effects. A visible receipt establishes a recorded result. No visible receipt during reconciliation means **unresolved**, not failure or permission to generate a new key. Operation reads are member-scoped and do not disclose another member's command existence.

### `jobs`, `operational_events`, and `rate_limit_buckets`

Durable `jobs` contain type (enrichment/invalidation/community projection), target/source revision, model/config version, state, attempt count, next-attempt time, lease owner/token/expiration, progress cursor, and sanitized failure category. Unique logical work key prevents duplicate scheduling; indexes support due pending work and expired leases. Claim with an atomic conditional write; each claim advances its fencing token. Completion verifies token and target source revision before publishing. A late worker cannot overwrite newer facts. Expired leases are reclaimable; retries/backoff are bounded and final failure is visible. No AI work runs inside a trade transaction.

Operational events contain opaque correlation/operation references, event type, timestamps, duration, and sanitized outcome; expire after 30 days. Exclude prompts, images, descriptions, notes, credentials, raw email/IP, and session/CSRF tokens. Rate buckets use unique `(scope_digest, action, window)` with atomic counters and purpose-specific expiration. Network scopes use HMAC digests. Default limits and retry budgets follow R10; counters are shared across application workers, not process-local.

## Allowed lifecycle transitions

| Record | Transition | Required condition/effect |
|---|---|---|
| Item | draft → available | Owner confirms complete reviewed listing. |
| Item | draft/available → removed | Owner command; reserved items reject removal. |
| Item | available → reserved | Entire current offer mutually agreed in one transaction. |
| Item | reserved → available | Valid agreement cancellation releases every item together. |
| Item | reserved → exchanged | Both participants confirm handoff; every item changes together. |
| Trade | open → open | Counteroffer supersedes version and resets consent; permitted notes preserve terms. |
| Trade | open → agreed | Recipient accepts unchanged current offer; all guards and reservations succeed. |
| Trade | open → withdrawn/declined | Current sender withdraws or current recipient declines. |
| Trade | open → invalidated | Reviewed item evidence changed or any intervening hard policy became incompatible. |
| Trade | agreed → cancelled | Either participant cancels before any handoff confirmation. |
| Trade | agreed → awaiting handoff confirmation | First participant confirms; all items remain reserved. |
| Trade | awaiting handoff confirmation → completed/cancelled | Both handoff confirmations complete it; both cancellation approvals cancel it. |

Completed, cancelled, declined, withdrawn, and invalidated trades are read-only. No timeout, AI suggestion, preference change, or projection worker completes an agreement. After one handoff report, unilateral cancellation leaves an explicit unresolved trade with items reserved. Existing agreements retain accepted policies and snapshots despite later profile edits.

## Mutation transaction and reconciliation protocol

1. Authenticate, authorize the target, validate CSRF/origin and command shape, and compute the request digest. Resolve a matching receipt first. For a new command, enforce the expected resource revision; construct all provider-independent validated inputs before opening a bounded transaction.
2. Inside the transaction, recheck/insert the unique member-scoped receipt, then conditionally write shared serialization boundaries. Proposal submission and every command on an open trade—including replacement, acceptance, notes, withdrawal, and decline—increment both participant guards in member-ID order before validating effective history. A hard-policy mutation increments its changing member's guard. Item edits/removal also touch their owner's guard. These shared writes serialize open-trade actions against both policy-only invalidation and item edits/removal; a note or closure cannot bypass an already-invalidated read-only boundary. Every trade mutation conditionally writes its revision/state. For agreed/awaiting-confirmation trades, later policies do not alter accepted terms, so trade CAS suffices without participant-policy guards.
3. Read current policies and relevant immutable policy/item history after guard acquisition. For an open trade, establish that its current offer remains effectively open before applying any command, including a note or counteroffer. Validate exact offer version, participant roles, current consents, owned distinct items, item trading revisions/epochs, frozen original community, and exclusions. A known business rejection may record its rejected command outcome without applying domain changes. Effective invalidation is derived immediately; a durable projection job can materialize the closed status later, but cannot reopen it.
4. Acceptance conditionally updates all included available item documents with matching owner/revision/epoch to reserved by this trade. Update trade state/consents, append private history, record invalidation work, and complete the receipt in the same transaction. Any item failure aborts all reservations. Other overlapping offers observe changed epochs and become invalidated; do not fan out unbounded updates inside the acceptance transaction.
5. Cancellation and completion similarly validate current state and participant confirmations, conditionally transition every reserved item belonging to this agreement, append history, and commit their receipt together. Concurrent final actions serialize on the trade document; one valid terminal result wins. Use sequential database operations, snapshot reads, majority writes, and retry-safe callbacks without external effects.
6. If commit certainty is lost, return the contract's 202 unresolved operation reference. Retain the same key for polling or an identical retry. An absent receipt remains unresolved until retry/reconciliation establishes an outcome. Receipt uniqueness and shared conditional writes prevent a second effect, including after a process restart. Never infer cancellation or release from a client timeout.

## Compatibility and verification boundaries

Initialize collections, indexes, catalogs, and schema versions before serving the feature. Preserve the existing health contract and additive API paths. Schema changes require versioned migration/recovery instructions; introducing a new embedding model reindexes separately. Backup restore must suspend trading until reservations, receipts, policy evidence, and history reconcile.

Use real replica-set transactions to verify overlapping acceptance, accept-versus-policy/item edits, reserve/cancel restoration, stale versions, note-versus-close, duplicate commands, and uncertain commits. Use Atlas Local for actual vector-index behavior; fixture cosine matching is not index-contract evidence. Validate image attachment/cleanup races, history authorization, lease expiry/stale completion, cents/basis-point boundary arithmetic, all nine bundle shapes, and clarified ranking against [the quickstart scenarios](quickstart.md).
