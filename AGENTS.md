# Working on Bartr

Read [the engineering workflow](docs/ENGINEERING.md) and the affected feature artifacts before changing behavior.

- The [constitution](.specify/memory/constitution.md) governs project work. The active feature is resolved through `.specify/feature.json`; the current approved marketplace requirements are in [the root specification](specs/001-smart-barter-marketplace/spec.md).
- Tie each behavior change to requirement IDs, the affected contracts, and observable acceptance outcomes. Record a material design deviation before dependent implementation; reconcile existing code with the requirement rather than silently redefining it.
- Work in bounded increments with named file/module ownership. Coordinate shared interfaces before parallel edits. Carry out authorized work autonomously and raise a missing decision only when it materially blocks correctness.
- Keep ownership, eligibility, offer-version consent, reservations, cancellation, and completion authoritative in the domain/persistence boundary. Provider output remains advisory. The frontend presents the recorded outcome and actionable failures.
- Keep public/private representations explicit and frontend/backend types aligned. The current implemented interface is described in [contracts/api.md](specs/001-smart-barter-marketplace/contracts/api.md); reconcile it with the planned OpenAPI when changing a contract.
- Add meaningful regression coverage for changed behavior and explicit rejected/edge cases. Trading-state changes need stale, replay, overlapping-action and all-or-nothing assertions; interface changes need boundary checks. Run checks proportionate to the change.
- Review behavior, access assumptions, data integrity, failure outcomes, and rollout/recovery impact. An independent reviewer may be a person or another agent; the author resolves findings within the authorized scope.
- Label evidence with revision, command, environment, storage/provider mode, and passed/failed/skipped/not-run status. In-memory and provider-fixture evidence supports only the boundaries it exercises. Track real database, live semantic-quality, accessibility, performance and pilot evidence separately in [verification status](docs/VERIFICATION.md).
- Preserve reviewer ownership of custom checklist markers. Generate new items unchecked; assess or mark them only when explicitly asked by the reviewer. Task tracking and the built-in specification-quality checklist have separate lifecycles.
- Keep secrets, private notes, account/session data and unnecessary personal information out of repository artifacts and diagnostic output. Use synthetic content for fixtures.
- Documentation-only work uses link, command-reference, consistency and whitespace checks. Document actual verification and remaining limitations before handing off.

These instructions implement the existing constitution; they do not amend it or authorize publishing, messaging, provisioning or deployment.
