# Bartr MVP verification

Canonical scope: [root feature specification](../specs/001-smart-barter-marketplace/spec.md). Earlier bundle-only drafts are superseded.

## Implemented paths

Account registration/sign-in/out with hashed passwords and opaque sessions; public profiles and private preferences; draft/photo/publication/edit/removal; reviewed Gemini suggestions; revision-bound valuation evidence; Bedrock embedding and Atlas retrieval adapters; deterministic one-to-three item matching with both gap limits; dismissals; manual proposals, notes/counteroffers and exact-version consent; atomic reservations/overlap invalidation; cancellation and two-party handoff.

## Verification in progress

Backend domain, account/API, photo-upload, Gemini adapter/evidence and Bedrock fixtures are exercised offline. Browser checks use explicitly temporary memory storage and fake photo content, with owner-entered example prices. This is not a live valuation or Atlas search validation.

## External and evaluation limitations

- Gemini/Bedrock/Atlas credentials and live vector index access have not been supplied or tested in this repository. Model availability and permissions must be checked in the team's accounts.
- MongoDB compare-and-swap persistence is implemented; actual Atlas restart/concurrent-write verification remains required. The domain's concurrency tests use isolated in-memory storage.
- Exact-text local mode does not meet the semantic-equivalence criteria; the configured semantic adapters need their labeled retrieval evaluation.
- The spec's 20-person pilot, 40-case recommendation quality set, 20 paraphrase cases, screen-reader audit, 1,000-listing/20-request load test and associated numerical targets have not been run and are not claimed achieved.
- An individual document aggregate bounds this prototype's scale. Request contention or capacity failure is reported explicitly instead of falling back to unsaved data.
