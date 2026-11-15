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

The dated entries below preserve the investigation sequence. Earlier pending and
not-run statuses describe that stage; the completed live reset and final source
verification below record the resulting recovery status.

### Sign-out compatibility repair — 2026-11-15

Root owns the adapter, regression tests and this evidence; a separate agent reviews
immutability and session boundaries. Scope: FR-001, FR-020 and FR-030, existing
`POST /api/auth/logout` contract. An unchanged historical offer may have a hash
from serialization before numeric normalization. Recomputing that derived hash
must not block unrelated writes such as session revocation. Preserve the stored
offer and its hash only when every other serialized field matches. Continue to
reject offer changes/deletion and changes to other immutable entities atomically.
No schema/API change or data rewrite; rollback restores the earlier adapter and
may restore the same compatibility failure. Live affected rows are not inspected.
Evidence at `51ecf77` plus this uncommitted repair, Python 3.12.4, local Moto
DynamoDB emulator with synthetic records and no live providers:

- **Failed before repair (expected regression)**: `.venv/bin/python -m pytest backend/tests/test_dynamodb_api.py -k historical_offer -q` reproduced HTTP 409 `IMMUTABLE_RECORD` (1 failed, 4 deselected).
- **Passed after repair**: `.venv/bin/python -m pytest backend/tests/test_dynamodb.py backend/tests/test_dynamodb_api.py -q` (21 passed, 14.07s). Covers cookie deletion, rejection of replayed revoked sessions, retention of another session and unchanged stored offers; rejected terms, deletion, consent and receipt changes leave all records and the session intact. Existing adapter tests also cover stale approval, command replay, overlapping acceptance and transaction failure.
- **Passed**: independent read-only behavioral review by `assess_restart_evidence`, no material findings; `git diff --check`.
- **Passed on requested retest (2026-11-15)**: same revision, environment and two-file pytest command above (21 passed, 13.36s). The exact pasted patch also passed `git apply --check` and `git apply` against a temporary copy of the HEAD adapter, produced the tested fixed source, and rejected duplicate application. No server service was restarted by this check.
- **Not run**: hosted browser sign-out, live DynamoDB, production row inspection or deployment. The historical-hash fixture reproduces the error but does not identify the actual live mismatching field. Accessibility, load, provider-quality and pilot evidence are unaffected and not established by these checks.

### Shared-write compatibility repair — 2026-11-15

The maintainer subsequently reports HTTP 409 across actions. A second synthetic
case reproduces the same failure when historical consent metadata is omitted by
assembly; it is not evidence of the live mismatching field. Root owns the adapter,
tests and evidence; `assess_restart_evidence` reviews independently. Scope remains
FR-001, FR-020, FR-021 and FR-030 and the existing API contract.

Before each mutation callback, serialize a detached baseline from that same
snapshot. An existing immutable record may be retained only when its serialized
representation is unchanged by the callback, every serialized field matches the
stored record (apart from the already described derived offer hash), and any
additional stored fields are preserved without a write. Missing/rekeyed records,
changed known fields and conflicting login ownership or duplicated offer totals
remain rejected before transaction submission. Retain existing epoch/version CAS,
transaction capacity and retry rules. This supersedes the hash-only comparison;
it does not migrate records, weaken permissions or permit immutable edits. Rollback
restores the prior adapter and may restore the compatibility failure. No deployed
fix or authenticated live success has been established.

Evidence at `51ecf77` plus this uncommitted repair, Python 3.12.4, local Moto
DynamoDB with synthetic accounts/records and no live providers:

- **Failed before shared-path repair (expected regression)**: `.venv/bin/python -m pytest backend/tests/test_dynamodb_api.py -k 'historical_offer and consent_metadata' -q` reproduced the exact 409 `IMMUTABLE_RECORD` on logout and login (2 failed, 8 deselected, 2.08s).
- **Passed**: `.venv/bin/python -m pytest backend/tests/test_dynamodb.py backend/tests/test_dynamodb_api.py -q` (43 passed, 28.71s), followed by `.venv/bin/python -m pytest backend/tests/test_dynamodb.py -k conflicting_records -q` for four subsequently added fail-closed cases (4 passed, 33 deselected, 2.61s). The 47 cases cover historical hash/consent/login metadata, login/register/profile/draft/note/accept/logout, preserved raw history, session/cookie revocation, unchanged alternate sessions, deleted offer/receipt fields, stale/replay/overlap and atomic rejection. Conflicting login ownership, conflicting duplicated offer totals, orphan consent and unknown events submit no transaction and preserve the session.
- **Passed**: independent read-only implementation review by `assess_restart_evidence`, no material implementation findings; its requested four fail-closed regressions were added. `git diff --check` passed.
- **Passed**: temporary repair-installer checks against the original adapter, the prior hash-only patch, and the repaired adapter (idempotent), plus rejection of an unknown source without changing it. The installer checks exact source fingerprints, compiles the result, backs up code and atomically replaces only the adapter; it never accesses account/trade data. Its temporary path is not a repository command or a deployed capability.
- **Live public HTTP checks passed after user-initiated reboot**: frontend GET `/` and GET `/api/health` each returned 200 through valid HTTPS at 20:01–20:02 UTC on 2026-11-15 (13:01–13:02 America/Phoenix). These are reachability checks only; `/api/health` does not establish database/authenticated-write readiness. The user still reports 409 on actions; exact failing request and live stored mismatch remain unconfirmed.
- **Not run**: authenticated hosted write recovery, live database mutation/inspection, browser interaction (browser access unavailable) or deployment of this repair (SSH authentication denied). Reboot did not install code. No claim of live application recovery, provider quality, accessibility, performance or pilot completion follows from these fixtures.

### Deleted profile incident — 2026-11-15

The maintainer subsequently disclosed accidentally deleting a `USER#` item.
A read-only, projected account-reference inspection of the configured DynamoDB
table confirmed a missing PROFILE with retained LOGIN/PREFERENCES references;
it did not retrieve credentials, sessions or private profile fields. Assembly
omits the missing profile, and later serialization cannot reproduce its immutable
login claim, causing otherwise unrelated mutations to reject with 409
`IMMUTABLE_RECORD`. This is a data-integrity failure, separate from the synthetic
serialization-compatibility cases above. Compatibility patches must not bypass
this failure or be represented as recovery of the missing profile.

No DynamoDB records were changed. DescribeTable succeeded and reported Streams
disabled; DescribeContinuousBackups was denied, leaving PITR availability unknown.
Recovery requires an authoritative copy of the exact missing record, checking it
against retained ownership/history and restoring under a controlled writer freeze
with the adapter's epoch/version discipline. Preserve newer trade state; do not
fabricate credentials, consent, profiles or agreement outcomes, and do not replace
the current table with an older table without reconciliation. PITR or backup
restoration must target a separate recovery table before a reviewed record repair.
No recovery table, write or deployment is authorized by this evidence record.

The maintainer clarified that the affected dataset is demo data and explicitly
approved wiping/reseeding all Bartr demo records in `bartr-dev`. Execution remains
pending confirmation that the remote backend has stopped. `assess_restart_evidence` owns the
separate administrative script/tests; root owns integration, documentation and
independent review. FR-001, FR-020–021 and FR-030 remain applicable: the operation
must be explicitly offline with all writers stopped, preserve unrelated/test-scope
records, stage validated fictional data first, save a private complete raw backup
before deletion, and create fresh unique credentials privately. It must not reuse
the local JSON demo password on a deployed service, provision/delete a table, or
claim an administrative multi-batch reset is an atomic business transaction.
Failure after deletion requires continued maintenance and recovery from the private
backup; restart must follow a validated, internally consistent seed.

The prepared command is `.venv/bin/python -m backend.scripts.reset_demo_dynamodb
--confirm-table bartr-dev --writers-stopped --backup /private/path/backup.json
--credentials /private/path/credentials.json` (one shell command; parent directory
must already exist outside the repository). It supports only the existing
`us-east-1` table, writes neither credentials nor records to stdout, and rejects
existing private output paths. Images without unambiguous unscoped ownership are
retained conservatively, as are all protected test-scope and unrelated rows.

Evidence at `51ecf77` plus this uncommitted work, Python 3.12.4:

- **Passed**: `.venv/bin/python -m pytest backend/tests/test_demo_dynamodb_reset.py -q` (8 passed, 1.41s), Moto only with synthetic fixture data and no providers. Covers explicit scope/writer gates, binary-safe raw backup, private unique credentials, unrelated/test/image preservation, successful authenticated read/write/logout, preparation/backup/legacy rejection before deletion, exact transaction retry and CLI configuration loading.
- **Passed**: root independent read-only review of the reset script/tests; its requested CLI `.env` configuration correction was implemented and regression-tested. A separate full-fixture staging invocation produced 10 members, 32 items and 30 synthetic images with 10 unique passwords, without touching AWS.
- **Passed**: `.venv/bin/python -m pytest backend/tests/test_dynamodb.py -k deleted_profile -q` (1 passed, 37 deselected, 1.13s), reproducing blocked logout/profile writes for an unrelated member after synthetic PROFILE deletion and asserting no transaction or further record changes.
- **Not run**: live reset/reseed and authenticated live recovery. The remote backend still answered health requests at the last check; no deletion may begin before the writer-stop boundary. A separate local Bartr backend also needs to be paused/stopped for the maintenance window. No DynamoDB records have been changed by this work yet.

The user subsequently directed immediate execution after the public backend
became unavailable (HTTP 502, following the requested service stop). Root paused
the identified local Bartr backend processes and began the explicitly approved
reset. A private verified raw backup was saved before clearing 266 demo records.
The first initialization attempt then encountered DynamoDB throttling. Writers
remain inactive; the original private backup is retained. Retry uses new private
output files, bounded SDK throttling retries and paced writes, without changing
table capacity or provisioning resources. The prepared fixture serializes to 62
authoritative records, allowing initialization through one normal, atomic
repository mutation plus its control action (63 actions total). This bounded
initialization reduces request volume; the complete backup/delete/image/seed
administrative operation is still not a single atomic transaction.

**Completed live demo reset**: The paced retry with standard SDK retries succeeded,
publishing 10 fictional members, 32 items (30 available) and 30 synthetic images.
The original 266-record private backup remains verified and mode 0600; fresh
unique passwords are held only in private files outside the repository. Local
writers were resumed after exact seed verification. Public health subsequently
returned 200 after the remote backend restarted.

Final reset-tool evidence: `.venv/bin/python -m pytest
backend/tests/test_demo_dynamodb_reset.py -q` **passed, 13 tests, 1.70s**, in Moto
with no live providers, including bounded throttling/exhaustion, transaction-size
preflight and no partial authoritative initialization. Root independently reviewed
the changes before the successful live retry. No table, index or throughput
setting was provisioned or changed.

**Passed live authenticated API checks**, revision `51ecf77` plus the uncommitted
reset tooling, actual `bartr-dev` DynamoDB, public valid HTTPS and synthetic seed
accounts: a temporary private-credential probe performed 23 successful assertions
covering two logins, account restore, profile/draft saves, published-image read,
exact-text discovery, offer creation/replay, note, acceptance, both reservations,
cancellation, both releases, both logouts, signed-out rejection and replayed-cookie
rejection. The test trade remains cancelled and all 30 seeded available listings
remain available. The probe prints operation labels/status only. Authenticated
recovery now has real API/database evidence; browser rendering/accessibility,
provider semantic/valuation quality, concurrency/load, and pilot evaluation remain
separate and unrun. Serialization-compatibility source changes above were not
deployed as a remedy for the deleted account; restoring a coherent demo dataset
resolved this incident.

**Final source verification before the requested main-branch push**: base revision
`51ecf77` plus the six recovery files, Python 3.12.4, synthetic Moto DynamoDB and no
live providers. `.venv/bin/python -m pytest backend/tests/test_dynamodb.py
backend/tests/test_dynamodb_api.py backend/tests/test_demo_dynamodb_reset.py -q`
**passed: 61 tests in 34.34s**. Independent read-only publication review found no
blocking behavior, access, integrity, private-data or startup-execution issues.
The reset script executes only through its explicitly confirmed administrative
entry point; updating application code does not reset the database. Whitespace
checks passed. Frontend/generated workspace changes are outside this increment.

Tests cover normalized restart/queries, immutable history, stale approvals,
competing independent repository instances, atomic conflict/failure, command
replay, cancellation/completion, capacity and ambiguous outcomes. Synthetic live
AWS tests use a unique scope and clean only its exact keys. They must establish
actual read/write/transaction behavior before calling this migration complete;
no production user data is changed. No offline suite proves live durability,
restore, vector quality or the 1000-listing performance target. Independent
behavioral review follows the [repository engineering rules](../../AGENTS.md).
