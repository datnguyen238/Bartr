# Temporary JSON document storage

**Decision date**: 2026-11-14  
**Status**: approved local-testing deviation requested by the project owner  
**Scope**: FR-001, FR-003, FR-007, FR-019–FR-027; current `GET /api/me` response

## Decision

Add an explicit `BARTR_STORAGE=json` repository mode for temporary local testing. It stores the current bounded marketplace aggregate and test images in one versioned JSON document under `.bartr/` by default. Writes use a process lock, write-and-fsync of a sibling temporary file, and atomic replacement. A failed domain operation or failed file replacement must leave the last complete document authoritative.

This mode is a local document-store fixture, not DynamoDB, Atlas, or production persistence. It is selected explicitly and never becomes a fallback after MongoDB failure. Only one API worker or process may write a JSON database file. Corrupt, incompatible, or unreadable files fail closed with an actionable `503`; they are not reset or silently overwritten.

The public interface adds `storage: "temporary-json"` to `GET /api/me`. The frontend must label this mode as temporary local persistence. All ownership, eligibility, offer-version, reservation, cancellation, and completion rules remain in the existing domain/repository boundary.

An explicit local seed command may stage and install the repository's versioned synthetic fixture into an empty JSON store. It is not an application-startup side effect: the command refuses MongoDB mode and unrelated non-empty stores, and a repeated run against its own marked fixture makes no change. Fixture definitions contain synthetic profiles, preferences and listing facts; generated password hashes and test images exist only in the ignored local database installed from those definitions.

## DynamoDB integration boundary

The application continues to depend on repository operations (`read`, atomic `mutate`, and authorized image storage), not JSON file details. The implemented [DynamoDB adapter](../specs/001-smart-barter-marketplace/dynamodb-data-model.md) preserves those outcomes using separate entity records, version attributes, epoch checks and conditional transactions. JSON mode remains selectable for local fixtures and does not exercise DynamoDB guarantees.

The JSON file is not a DynamoDB import format. DynamoDB limits one item to 400 KB, while the JSON aggregate and images can exceed that. The adapter partitions records behind approved partition/sort keys and stores images as bounded separate chunks. JSON fixtures are not automatically copied to the table. Production throughput, object-storage placement and cross-region conflict handling require separate design and evidence.

These constraints follow the AWS documentation for [optimistic locking and conditional version checks](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/BestPractices_OptimisticLocking.html), [all-or-nothing transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transactions.html), [DynamoDB limits](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Constraints.html), and [vertical partitioning](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-blocks.html). The approved adapter's mapping and limits are application choices; passing JSON tests does not validate them.

## Acceptance and rejected cases

- Starting with `BARTR_STORAGE=json` and no `MONGODB_URI` creates a schema-versioned local document and supports register, sign-in, listing, proposal, agreement, cancellation, and handoff paths.
- Reopening the repository at the same path returns committed accounts, sessions, items, trades, command receipts, valuations, and images.
- A domain exception, invalid JSON value, I/O failure, corrupt file, or unknown schema version never produces a partially committed or silently empty state.
- Draft, reserved, exchanged, and removed listings retain their existing discovery and mutation rules.
- Semantic indexing/discovery remains unavailable in JSON mode and returns the same actionable Atlas-required failure as memory mode; exact-text discovery remains available.
- The optional demo fixture is installed only into an empty JSON store, persists across restart, and remains subject to the same authenticated public/private projection as user-created records. Drafts, removed listings and another community remain undiscoverable.
- Concurrent threads using the one repository instance owned by the API process serialize through its lock. Multiple repository instances, processes, or workers sharing a file are unsupported and must not be used as evidence of real database contention or durability.

## Configuration, recovery, and rollout

`BARTR_JSON_PATH` optionally selects the file; the default is `.bartr/bartr.local.json` at the repository root. The directory is ignored by Git and the database file is created with owner-only permissions where the platform supports them. Do not commit local accounts, password hashes, sessions, images, notes, or trade history.

Run `python -m backend.scripts.seed_demo_json` only while the API is stopped, because JSON mode supports one writer process. The command uses `BARTR_JSON_PATH`, stages the complete synthetic document beside the target, and atomically installs it. The shared demo credential is for local inspection only and is documented in the README; it is not a deployment credential.

The expanded fixture contains three available items per demo user, an unknown-valued available item, a private draft and a removed listing. Existing marked fixture databases remain unchanged on rerun. Use a fresh path such as `.bartr/bartr.multi-items.json` to test the expanded dataset while retaining older local test history, and start the API with that same path.

For recovery, stop the single API process and copy the complete JSON file before inspection or replacement. Deleting it intentionally resets only this temporary mode; it is not recoverable unless the user made a copy. Switching back to `BARTR_STORAGE=mongo` leaves the JSON file unused and performs no automatic migration.

## Verification required

Repository regressions cover initialization, restart persistence, rejected mutations, corrupt/schema-incompatible files, image round trips/deletion, and serialized concurrent mutations. API coverage verifies the reported storage mode and a persisted authenticated journey. Frontend type checking covers the extended response union. This evidence does not establish DynamoDB compatibility, multi-process safety, backup readiness, or hosted durability.
