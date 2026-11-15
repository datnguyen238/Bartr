# Final DynamoDB schema v1 — implemented compatibility adapter

Approved by the maintainer on 2026-11-14. Supersedes the earlier draft. Scope:
FR-001–007, FR-012, FR-014–027, FR-029–030 and SC-004. No frontend, optimizer,
provider, or public API changes. Existing richer planned contracts remain future work.

## Keys and access patterns

Use existing on-demand `bartr-dev` in `us-east-1`, String PK/SK, **no GSIs**.
Production keys are exactly the approved USER/TRADE/SESSION patterns below.
A constructor-only scope prefix isolates synthetic integration-test records.

| Entity | PK | SK | Access / invariant |
|---|---|---|---|
| Profile | USER#id | PROFILE | Strong GetItem; private credentials retained, public projection stays in domain |
| Preferences | USER#id | PREFERENCES | Strong GetItem, private interests/exclusions/gap and revision |
| Listing | USER#owner | ITEM#id | Strong Query owner partition/item prefix; one record per item |
| Trade | TRADE#id | DETAILS | Strong GetItem; participants/status/current version/revision |
| Offer | TRADE#id | OFFER#0001 | Immutable terms, snapshots, totals and SHA256 terms hash |
| History | TRADE#id | EVENT#timestamp#sequence | Append-only private note or resulting-state event |
| Participant reference | USER#id | TRADE#id | Strong Query; status/time updated atomically with trade |
| Session | SESSION#digest | DETAILS | Strong GetItem; app checks expiry, no raw token |
| Consent | TRADE#id | CONSENT#0001#actor | Append-only consent to exactly one offer version |
| Login claim | LOGIN#normalized-username-hash | DETAILS | Unique create-only owner claim |
| Command receipt | COMMAND#actor-scoped-digest | DETAILS | Immutable fingerprint/trade reference, no TTL |
| Analysis | ANALYSIS#artifact-key | DETAILS | Saved revision/image/owner-bound analysis, no cache |
| Dismissals | USER#id | DISMISSALS | Private existing combination fingerprints |
| Serialization guard | CONTROL#BARTR | DETAILS | Schema version and monotonic epoch, no trading payload |

There is no duplicate authoritative ITEM partition or inventory reference. Locate
an arbitrary item ID through the bounded compatibility snapshot, which is a
paginated Scan filtered by schema/scope. Inventory and participant helper queries
use base-table Query and paginate completely. Availability is always rechecked on
the authoritative owner/item row inside acceptance's transaction.

The adapter maps existing API fields to stored `user_id`, `owner_id`, `item_id`,
`community_id`, `value_cents`, `reserved_trade_id`, `participant_ids`, and
`max_value_gap_bps`, while returning the unchanged current API/domain shape.
Existing username/password authentication is retained; email is not invented.
Existing plain-text preferences retain their meaning; this migration does not
classify them as specific/category or change exclusion interpretation. Structured
preferences in the approved example need a separately coordinated domain/API
change. Existing single image ID remains an image reference; no public URLs are
invented. Maximum bundle size stays three, as the existing optimizer enforces.

## Atomicity and compatibility

The existing domain uses read()/mutate(callback) over a marketplace snapshot.
Preserve it with a strong paginated scan bracketed by strong epoch reads; retry if
the epoch changes. Every business writer must use this adapter. Each transaction
CASes the epoch plus independent versions on every changed record, including item
availability changes that do not advance the existing public item revision.
The shared epoch also protects unchanged read dependencies (policy/community,
username uniqueness, item ownership). This intentionally serializes writes;
it is a bounded hackathon bridge, not evidence of the SC-005 load target.

Run the pure domain callback, derive row changes, then ONE TransactWriteItems
commits item reservations/releases/exchanges, trade details, version-specific
consents, participant references, history and command receipt together. Changed
rows use version CAS; new rows use attribute_not_exists. Immutable offers,
consents, events, claims and receipts cannot be rewritten or deleted. All item
reservations live on the item row; no TTL can release one. Stale approval or one
failed condition aborts the entire transaction. Existing immediate invalidation
of overlapping open proposals is preserved, with no optimizer rule changes.

Reject transactions over 100 actions, individual records over a conservative
350 KiB, or aggregate wire budget over 4 MiB before submission; never split a
business mutation. High invalidation fanout may explicitly hit this bound.
Conditional conflicts retry from a fresh snapshot. Each exact AWS request has a
ClientRequestToken; ambiguous transport/service failures return explicit
COMMIT_UNRESOLVED and instruct reloading/retrying the SAME command ID. Durable
command receipts prevent duplicate effects after AWS's token window.

[Transaction requirements](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).

## Embeddings, environment and migration

Read-only actual DescribeTable previously verified ACTIVE PK/SK and no GSI/LSI/vector index.
The bounded MVP implementation compares Titan V2 embeddings with cosine similarity
in the backend; it does not provision or use a DynamoDB vector index. The local
configuration selects 256 dimensions. It limits a request to 30 community listings
and 40 preference terms and reports capacity or provider failures explicitly.
One isolated Bedrock/DynamoDB smoke test passed after lowering provisional similarity
thresholds; exclusion testing also demonstrated a false positive. The thresholds,
semantic quality and performance are not validated on a representative dataset.
Embeddings are separate rebuildable projections, never authoritative profile,
item, offer or reservation data; imports containing embedded vectors fail rather
than silently discarding them. [SearchVectors requirements](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_SearchVectors.html).

The projection records use `SEMANTIC#ITEM#{id}` or `SEMANTIC#PREFERENCES#{user_id}`
with sort key `DETAILS` and `_schema=bartr-semantic-v1`. They hold vectors with
revision, model and dimensions; preference terms themselves are not stored in the
projection. Conditional writes prevent an older revision from replacing a newer
one. These records are excluded from authoritative snapshots and must be considered
separately during backup, retention, cleanup, model changes and rollback.

No table recreation, indexes, automatic startup migration, or source deletion.
Existing chunked IMAGE keys stay compatible and separate. Their existing
attachment/cleanup race limitations are unchanged. If legacy STATE/0 exists and
new control is absent, return MIGRATION_REQUIRED rather than empty data.
MongoDB remains selectable. For existing data, freeze writers, back up state and
images, export vectors separately, validate users/claims/owners/consents/item
reservations/history/receipts, stage in a separate scope, verify canonical
roundtrip/counts, and publish the control marker last before switching under
freeze. Large imports require a separate resumable offline migrator; the bounded
adapter must not split one mutation to pretend bulk migration succeeded.
Never roll back to a stale source after new commitments without reconciliation.

## Verification and limits

Tests cover normalized restart/queries, immutable history, stale approvals,
competing independent repository instances, atomic conflict/failure, command
replay, cancellation/completion, capacity and ambiguous outcomes. Synthetic live
AWS tests use a unique scope and clean only its exact keys. They must establish
actual read/write/transaction behavior before calling this migration complete;
no production user data is changed. No offline suite proves live durability,
restore, vector quality or the 1000-listing performance target. Independent
behavioral review follows docs/ENGINEERING.md.
