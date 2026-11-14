<!--
Sync Impact Report
- Version change: unfilled scaffold -> 1.0.0 (initial project constitution).
- Modified principles:
  - Principle slot 1 -> I. Specify User Outcomes
  - Principle slot 2 -> II. Preserve Trading Integrity
  - Principle slot 3 -> III. Protect Privacy and Access
  - Principle slot 4 -> IV. Make Core Journeys Understandable and Accessible
  - Principle slot 5 -> V. Verify Behavior and Keep Design Simple
- Added sections: Product and Data Constraints; Development Workflow; Governance rules.
- Removed sections: None.
- Follow-up TODOs:
  - TODO(RATIFICATION_DATE): No prior adoption date is recorded. A project maintainer must
    confirm the original adoption date in YYYY-MM-DD format.
- Review note: This report is temporary amendment review material. Remove it before committing
  the amended constitution.
-->

# Bartr Constitution

## Core Principles

### I. Specify User Outcomes

Every feature MUST identify the user need, scope boundaries, and observable acceptance scenarios
before implementation begins. Assumptions that affect behavior, participant obligations, or data
handling MUST be recorded and resolved before dependent implementation. Specifications MUST
describe outcomes independently of implementation choices so that completion can be evaluated
against user needs.

### II. Preserve Trading Integrity

Operations that change items or trades MUST enforce documented ownership or control rules,
participant permissions, and allowed state transitions at the authoritative application boundary.
Operations that can overlap or be retried MUST preserve those invariants and MUST NOT create
conflicting commitments or silently overwrite a participant's changes. Users MUST receive an
accurate outcome, including an explicit unresolved state when completion cannot yet be confirmed.
Participants need to know whether an exchange action took effect.

### III. Protect Privacy and Access

Each category of personal data collected or retained MUST have a documented purpose tied to a
specified capability. Access to private data and privileged operations MUST be authorized at a
trusted boundary; client-side checks alone MUST NOT grant access. Secrets MUST NOT enter source
control or logs. Logs and diagnostics MUST exclude unnecessary personal data and redact sensitive
values. These rules limit exposure while preserving the evidence needed to diagnose failures.

### IV. Make Core Journeys Understandable and Accessible

Core item and trading interactions MUST provide clear labels, status feedback, and actionable
error messages. Consequential actions MUST explain their effect before the user commits. Core
journeys MUST work with the supported platform's assistive technologies and input methods,
including keyboard navigation where applicable. Acceptance scenarios for interface changes MUST
cover the affected success, failure, and accessibility paths so participants can understand and
complete an exchange.

### V. Verify Behavior and Keep Design Simple

Changes MUST include verification proportionate to their impact. Trading-state and access-control
changes MUST exercise successful and rejected operations, plus retry or concurrency behavior when
applicable. Integration contracts MUST be checked where a change crosses a component or service
boundary. Bug fixes MUST include evidence that the reported failure is resolved; recurring logic
failures MUST receive a regression test. Documentation-only changes MAY use document checks.
New dependencies, services, and abstraction layers MUST have a documented need tied to the current
scope. Prefer the simplest design that satisfies the acceptance scenarios.

## Product and Data Constraints

- Bartr's established product purpose is trading items. Feature specifications MUST define the
  exchange rules, participant responsibilities, and item or trade lifecycle relevant to the
  feature before implementation.
- Additional capabilities and external integrations MUST be justified by a specified user need.
  They MUST NOT be inferred as existing product requirements from the trading-platform label.
- Changes to persisted data or public contracts MUST preserve compatibility or document a migration
  and recovery approach before rollout. Destructive transformations MUST identify how affected
  data will be recovered or how an explicitly accepted irreversible change will be handled.
- Technology and infrastructure choices MUST be justified in implementation plans against the
  feature's requirements. This constitution establishes no mandatory framework, database, hosting
  provider, or numerical performance target.

## Development Workflow

1. Specify the user outcome, acceptance scenarios, relevant trading rules, and unresolved
   assumptions. Resolve assumptions that block the next step.
2. Plan the implementation and check it against every core principle. Record affected data,
   interfaces, verification, and any migration or recovery work.
3. Implement in reviewable increments tied to the specified scope. Update the specification and
   plan when intended behavior or constraints change.
4. Before merging a change, review constitution compliance and run the applicable checks. Record
   what was verified, the result, and any remaining limitation. Failed required checks MUST be
   resolved before merge.
5. Before rollout, document configuration or migration steps and recovery procedures when the
   change affects deployment or stored data. Keep relevant product and developer documentation
   consistent with the resulting behavior.

## Governance

This constitution governs Bartr's specifications, plans, implementation, and reviews. Conflicting
project guidance MUST be reconciled with it before dependent implementation proceeds.

Amendments MUST be proposed as a repository change reviewed by a project maintainer. The change
MUST explain the rationale, affected principles or sections, and any transition needed for
existing work. The maintainer MUST record adoption and update the version and last-amended date
in the same change. Preserve the original ratification date once confirmed.

Constitution versions MUST follow semantic versioning: increment MAJOR for incompatible removals
or redefinitions of governance or principles; MINOR for new principles, sections, or materially
expanded guidance; PATCH for clarifications and other changes that do not alter obligations.
This first completed constitution starts at 1.0.0.

Every implementation plan and change review MUST evaluate the applicable principles and record
any conflict. A conflict MUST be resolved by changing the proposal or adopting an explicit
constitutional amendment; an undocumented exception does not waive a rule.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2026-11-14
