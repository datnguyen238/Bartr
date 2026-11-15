# Engineering with AI Agents

This workflow applies to human and agent-authored changes in Bartr. It puts requirement-linked behavior, explicit boundaries, and reproducible evidence ahead of the volume of generated code. The [constitution](../.specify/memory/constitution.md) remains the governing policy; this document records how to apply it without changing product scope.

## Authority and current implementation

Use these sources for distinct purposes:

| Source | Purpose |
|---|---|
| [Constitution](../.specify/memory/constitution.md) | Project principles, data/privacy constraints, verification and governance. |
| [Root feature specification](../specs/001-smart-barter-marketplace/spec.md) and its clarifications | Approved user behavior, exchange rules, scope and measurable outcomes. Resolve the active feature using `.specify/feature.json`. |
| [Plan](../specs/001-smart-barter-marketplace/plan.md), [data model](../specs/001-smart-barter-marketplace/data-model.md), [contracts](../specs/001-smart-barter-marketplace/contracts/openapi.json), and [tasks](../specs/001-smart-barter-marketplace/tasks.md) | Intended design, interfaces and work decomposition. Record deviations and reconcile conflicts with approved requirements before dependent changes. |
| [Implemented interface notes](../specs/001-smart-barter-marketplace/contracts/api.md), actual route/schema code and typed clients | Observed current interface. They do not silently override an approved behavior requirement or prove conformance to the planned contract. |
| [README](../README.md) and [verification status](VERIFICATION.md) | Current startup instructions, implemented paths, available evidence and explicit limitations. |

The current MVP implements real account/password/opaque-session identity and trading journeys. DynamoDB uses the approved [entity/access-pattern adapter](../specs/001-smart-barter-marketplace/dynamodb-data-model.md): epoch-bracketed snapshots and conditional transactions preserve the existing domain interface. Legacy MongoDB uses a bounded versioned aggregate with compare-and-swap updates. Explicit temporary-memory mode loses data on restart; temporary-JSON mode persists a local document through atomic replacement. Both temporary modes are limited to one process; see [the recorded deviation](JSON-STORAGE.md). The earlier plan describes richer guards, receipts and request shapes that remain distinct from the implemented adapter. A reviewer must be able to tell which design a change implements and what evidence supports its guarantees.

`docs/specs/001-bundle-matching` is superseded. [ARCHITECTURE.md](ARCHITECTURE.md) and [PRODUCT-BRIEF.md](PRODUCT-BRIEF.md) contain historical analysis; their earlier open questions and foundation-only descriptions do not replace the root specification or current status. Task markers record assessed progress: unchecked work may already have code, and a checked task still needs supporting evidence. A written plan, generated code, passing offline checks, and achieved release outcomes are different claims.

## Ownership and bounded assignments

| Role | Responsibility |
|---|---|
| Product maintainer | Owns product decisions, acceptance targets, documented scope changes and rollout/risk decisions. |
| Change owner | Defines the bounded assignment, reconciles relevant artifacts, implements it, supplies evidence and resolves review findings. Agent delegation does not remove this ownership. |
| Independent reviewer | Reviews changed behavior, access assumptions, integrity, failure handling and recovery evidence. A person or another agent may perform this review. |
| Release owner | Establishes applicable deployment, migration, recovery and evaluation readiness; records the actual release decision and unresolved limitations. |

Record the responsible person or agent when making an assignment; the change owner coordinates shared files and interfaces. Proceed with authorized reversible work. Ask for a product decision when available requirements genuinely leave materially different outcomes; continue unrelated work while that decision is pending.

A useful assignment contains:

- Outcome and requirement/task references, including the concrete trigger and expected result.
- Included/excluded scope, affected modules, interfaces and any private-data boundary.
- Owned files and dependencies on other assignments; one coordinator for shared contracts.
- Success, rejected, stale, retry and recovery scenarios relevant to the change.
- Applicable evaluation commands or observations, execution mode and known external prerequisites.
- Required artifacts and handoff evidence, including remaining limitations.

An assignment should be small enough to review as one behavior change. Prefer explicit domain rules, closed request/response representations, stable interfaces, typed clients and deterministic examples. Avoid relying on hidden conventions scattered across presentation, providers and persistence. Add a dependency or abstraction only for a requirement-linked need.

## Change and review gates

1. **Requirements ready**: identify the user outcome, relevant FR/SC IDs, allowed state changes, assumptions and acceptance observations. Resolve a scope conflict before implementing behavior that depends on it. Preserve the specific-product-first ranking clarification and advisory valuation/consent boundaries.
2. **Design coherent**: identify the authoritative state and permission boundary, public/private data, contract changes and persistence impact. Explain deviations from the active plan. For a persisted-data or public-contract change, include compatibility and recovery treatment before rollout.
3. **Evidence proportionate**: add a regression assertion for changed behavior or a reproduced failure, cover meaningful edges/rejections, and check affected integration boundaries. Use deterministic clocks/data and synthetic content where practical. A test that only repeats an implementation detail is insufficient evidence of the user outcome.
4. **Independent behavioral review**: for account/access, item/trade state, persistence and provider-boundary changes, obtain a separate review of the affected invariants. Reviewers focus on regressions, security assumptions, data integrity, failure handling and rollout safety. Let available automation handle formatting and type errors. The author resolves material findings and repeats affected checks after a relevant change.
5. **Accurate handoff**: report what changed, why, what was evaluated, the execution modes and limits of that evidence. Mark required failed checks as failures; do not relabel skipped or unrun work as passing. Leave external readiness explicit while continuing independent local work.

These are engineering criteria, not a new permission dialog for each edit. Requirements, risk ownership and existing session authorization determine the next action. Publication, external communication and deployment retain their applicable authorization boundaries.

## Evaluation matrix

| Affected area | Required evidence for a behavior change | Limit of current evidence |
|---|---|---|
| Eligibility, inventory and bundle discovery | Relevant domain regressions and affected interface checks; all supported shapes, both participants' constraints, value boundaries, unknowns and the clarified ranking order where touched. | Shape coverage alone does not establish the two/one/no-specific-product ranking or live semantic quality. |
| Offers, reservations, cancellation and handoff | Successful and rejected transitions, changed terms, current-participant roles, duplicate commands, overlapping commitments, no partial reservation/release and interrupted-outcome treatment. | Current domain overlap assertions use temporary in-process storage; real persistent contention needs separate evidence. |
| Accounts, permissions and images | Relevant account/interface/domain coverage; unauthorized viewers, private projections, stale updates, malformed uploads, saved-image/history access and failure paths where affected. | Route tests use real application identity logic with temporary storage; they do not establish hosted cookie/origin configuration or database readiness. |
| Persistence | Existing compare-and-swap regression plus real database concurrent-write, interruption, capacity and restart/recovery evidence for the changed guarantee. | The current repository regression uses a fake collection; it is not an actual MongoDB contention or durability evaluation. |
| Valuation and provider interpretation | Source/citation, schema, provenance, revision, deadline, quota and malformed-output fixtures; manual fallback and rejected evidence. | Adapter fixtures and any SDK-dependent skips do not prove live grounding, model access or estimate quality. |
| Embeddings and semantic discovery | Request/response shape, configured model/dimensions, stale/index/unavailable cases and semantic-to-domain boundary assertions; configured live retrieval and labeled quality evaluation before claiming that readiness. | Mocked embedding calls, stale-index fixtures, exact-text mode and supplied semantic IDs are not live semantic-equivalence evidence. |
| Presentation and typed contracts | Frontend typecheck/build and browser evidence for changed success/failure/permission states; keyboard, responsive and assistive-technology observations for the affected journey. Keep changed server/client shapes aligned. | A production build does not establish browser behavior or screen-reader acceptance; planned browser automation commands are not currently installed scripts. |
| Documentation only | Relative-link, command-reference, authority/claim consistency and whitespace checks. | Documentation checks establish artifact consistency, not application readiness. |

The supported repository-wide commands today are:

```sh
# Repository root, Python environment active
python -m pytest backend/tests -q

# frontend/
npm run typecheck
npm run build
```

For a bounded backend change, select the affected files from `backend/tests/test_marketplace.py`, `test_marketplace_api.py`, `test_state_repository.py`, `test_valuation.py`, `test_embeddings.py`, `test_semantic_search.py` and `test_api.py`. Expand verification when a shared boundary changes, a failure reveals broader impact, or a required repository check applies. Report skipped cases and their causes explicitly. Do not invent an `npm run test:e2e`, management command or contract generator because an older plan describes one; introduce and document such tooling in its own justified change.

Every touched generated-code domain receives relevant regression coverage, including explicit edges and interface checks where applicable. The matrix states the standard for new changes; it does not retroactively certify existing coverage or call every planned target achieved.

## Evidence and completion records

Record these fields with each review result or verification update:

| Field | Required content |
|---|---|
| Change identity | Revision, plus working-tree change description when uncommitted. |
| Scope | FR/SC/task references and the behavior or boundary evaluated. |
| Evaluation | Exact command or reproducible observation and meaningful expected outcome. |
| Environment | Relevant versions, dataset/configuration and whether the state is temporary, a fake database or an actual database. |
| Providers | Fixture, exact-text, or live service mode; identify the model/dimension/index configuration when relevant without exposing credentials. |
| Result | Passed, failed, skipped, or not run, with counts/duration where available. |
| Limits | What the evidence does not establish, missing external prerequisites, and the responsible follow-up. |

Keep summaries near the affected change and current readiness in [VERIFICATION.md](VERIFICATION.md). Do not overwrite earlier evidence or turn an unrun target into a result. Keep output concise and exclude credentials, sessions, private notes, personal photos and unnecessary account data. Use controlled synthetic data for fixtures and provider smoke inputs.

Custom files such as [marketplace.md](../specs/001-smart-barter-marketplace/checklists/marketplace.md) are reviewer-owned tests of requirements writing. Generation leaves items unchecked; only explicit reviewer authorization allows an agent to assess or change those markers. A checked requirement-quality item is not implementation completion. The built-in `checklists/requirements.md` lifecycle and ordinary task tracking remain separate.

## Rollout readiness

Before claiming a hosted or persisted-data capability ready, identify its actual affected deployment, schema/index/model configuration, applicable checks and recovery path. A change that can alter commitments needs evidence that restart, retry and rollback preserve an accurate authoritative outcome. Database restoration must reconcile reservations and agreement history before trading resumes. The bounded aggregate's capacity and contention limits remain explicit until a replacement design is implemented and evaluated.

The labeled semantic evaluations, actual database/index checks, 20-person pilot, screen-reader acceptance and 1,000-listing/20-request performance targets remain separate outcomes described in [VERIFICATION.md](VERIFICATION.md). Offline suites and a successful build do not substitute for these measurements. Record missing credentials, dataset access or live infrastructure as unrun prerequisites; do not attempt provider calls or provision resources merely to make a status line green.
