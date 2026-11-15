# Bartr

<!-- impeccable:product-schema 1 -->

## Platform

web

## Sources and Authority

This record captures the existing project documents at the owner's direction. The [constitution](.specify/memory/constitution.md) governs project principles; the [root marketplace specification](specs/001-smart-barter-marketplace/spec.md) defines approved behavior, exchange rules and acceptance targets. Detailed requirements remain in those sources.

Use the [README](README.md), [profile guide](docs/PROFILE.md) and [verification status](docs/VERIFICATION.md) for current implementation and evidence. The earlier [product brief](docs/PRODUCT-BRIEF.md) supplies audience, purpose and existing brand commitments, but its unresolved policies and foundation-only implementation description are superseded. The older `docs/specs/001-bundle-matching` specification is also superseded.

## Users

College students and young adults with belongings they no longer need and other items they want. Common situations include moving, furnishing an apartment, upgrading belongings and exchanging unused possessions. Members trade locally within a self-selected campus or city community.

Their main job is to find a mutually useful exchange, understand what each person gives and receives, negotiate voluntarily and keep an accurate record through handoff.

## Product Purpose

Bartr helps people exchange physical belongings without spending money. It aims to make reuse and access to needed items easier by reducing the browsing, value comparison and negotiation needed to find a reciprocal trade.

Success means members can prepare reviewed inventories and interests, discover worthwhile combinations, understand why a trade was suggested, and reach and complete a voluntary exchange without conflicting commitments. Numerical onboarding, recommendation quality, comprehension, accessibility and performance outcomes in the root specification are evaluation targets, not achieved results.

## Positioning

Bartr considers combinations across both participants' inventories and preferences, including several items on either side. It can find opportunities a strict one-for-one matcher misses, then explain the actual items, estimated values and relevant interests for both people.

Semantic similarity assists discovery. Deterministic eligibility rules decide whether a bundle qualifies; numerical similarity and AI explanations do not establish fairness or consent.

## Operating Context

- Members create an account, choose a campus or city community, prepare item listings and save specific interests, category interests, exclusions and a recommendation value-gap limit.
- Owners review listing information and advisory assistance before publication. A published listing requires a title, description, category, condition and at least one image. Comparison value may remain explicitly unknown.
- The specified exchange workflow covers recommendation review or manual composition, private notes and counteroffers, mutual agreement, reservation, cancellation and participant-reported handoff.
- Physical handoff and any return of belongings are the participants' responsibility. Members may voluntarily share coordination details in private trade notes.
- The current frontend exposes `/home` authentication and protected `/profile`, `/profile/inventory` and `/profile/preferences`. `/trade` is a public placeholder; discovery and offer controls are deferred. Matching and trading endpoints remain implemented in the backend. See the profile guide for current routes and session behavior.
- The existing implementation uses Next.js, TypeScript, Tailwind and shadcn/ui with FastAPI. Gemini provides advisory image, valuation and preference assistance; Bedrock generates embeddings; MongoDB Atlas stores marketplace data and semantic search projections. Startup and configuration belong in the README.

## Capabilities and Constraints

### Exchange eligibility and recommendations

- Exchanges involve exactly two members in the same campus or city community, with one to three distinct physical items per side. Ownership, availability, exclusions, community and bundle limits are hard constraints.
- For automatic recommendations, every incoming item must match at least one of its recipient's interests, all included items must have usable positive comparison values, and both members' value-gap limits must be satisfied. Exclusions override interests.
- The percentage gap is the absolute difference between bundle totals divided by the larger total. Each member's default limit is 20%, adjustable from 0% to 100%. USD is the initial shared comparison currency; values are estimates, not payment amounts.
- Rank eligible recommendations by specific-product matches for both members, then one member, then neither member. Within each priority, smaller percentage gaps rank first. Additional matching items do not raise that priority.
- Recommendations explain what each member gives and receives, individual values and their sources, totals, absolute and percentage differences, and grounded reasons for relevance. Do not invent condition, authenticity, working order or guaranteed fairness.
- Manually composed offers may include unknown values, an imbalance or items beyond positive interests after the applicable warning and explicit review. Hard constraints still apply; no payment is required to balance a trade.

### Member control and trading integrity

- AI suggestions remain advisory. Owners can correct or reject them; assistance must not silently replace reviewed facts. Show value source, last-set date and assisted uncertainty. Manual entry and negotiation remain possible when assistance is unavailable.
- Viewing or dismissing a recommendation creates no consent or reservation. Open offers do not reserve items or automatically expire.
- Submitting an offer or counteroffer records its sender's consent to that exact version. Agreement requires the other participant's explicit acceptance of the unchanged current terms. Counteroffers supersede earlier consent; changes to an included listing's trading details invalidate an open proposal and require a fresh offer.
- Agreement reserves all included items together. Items cannot be double-committed, and reserved trading details cannot be edited. Stale screens, retries and overlapping actions must preserve the authoritative outcome and avoid partial changes.
- Before any handoff confirmation, either participant can cancel and release all items. After the first confirmation, cancellation requires both participants. Completion requires both handoff confirmations; elapsed time and AI actions cannot complete a trade.
- Closed proposals remain read-only and do not reopen automatically. A disputed or unconfirmed handoff remains explicitly unresolved with items reserved under the specified rules.
- Distinguish missing inventory, missing interests, missing values, no qualifying match, assistance failure and an unresolved action outcome. Preserve saved work and provide an appropriate next action.

### Privacy and release boundaries

- Signed-in members can inspect published available listings and public owner fields. Drafts and full preferences are private to their owner; negotiations, notes and agreement history are private to their two participants. Relevant interests may be summarized in an explanation without exposing the full preference record.
- Public trading profiles contain display name and community. Do not require or add dedicated fields for exact addresses, phone numbers or precise location in this release. Private notes may contain voluntarily supplied coordination details.
- Operational records exclude credentials, images, private note text and unnecessary personal information. Access and trading rules are enforced at the trusted backend boundary.
- Payments, cash supplements, platform credits, shipping management, services, auctions, reviews, multi-party cycles, university eligibility verification, automated dispute adjudication and physical-delivery verification are outside the specified release. No email/university verification is currently implemented. Solana/NFT and external messaging features are not established requirements.
- This prototype has bounded persistence and search capacity. It does not promise exhaustive global optimization or unbounded production scale. Explicit temporary-memory storage loses data on restart; infrastructure failure must not silently switch saved data into temporary storage.

## Brand Commitments

Preserve the name **Bartr** and the existing approved **black-and-cream** direction recorded in the product brief and README. Swapify is historical reference material, not permission to import its features or claims. No additional brand voice or visual system is established by this initialization.

The owner subsequently requested a complete UI redesign following Apple's design principles, translated to the web: clear purpose and hierarchy, familiar controls, comfortable input targets, responsive layouts, local feedback and recoverable actions. The owner confirmed a focused workspace with an inventory list. The implemented visual system is recorded separately in DESIGN.md.

The owner then specified a unified, social-style personal Profile: item management and private preferences on the same page, personal information behind Edit profile, and a focused Add item form that blurs the surrounding view. This changes presentation and navigation, without adding public social metrics or new profile data fields.

## Evidence on Hand

- The [root specification](specs/001-smart-barter-marketplace/spec.md) includes acceptance scenarios, edge cases and measurable pilot targets. It establishes intended behavior rather than proof that those targets have been met.
- The supplied example is a chair valued at $40 plus a calculator at $20 exchanged for a monitor at $65. These are example inputs, not observed market prices, and do not establish a fixed $5 tolerance.
- [Frontend fixtures](frontend/data/seed.ts) are fictional display data. See the [seed-data guide](docs/FRONTEND-SEED-DATA.md); fixtures are not accounts, successful transactions, testimonials or market evidence. The current profile guide takes precedence over older descriptions of available frontend controls.
- [Verification status](docs/VERIFICATION.md) records offline domain/API/provider fixtures, frontend checks and local browser evidence, with storage and provider modes identified. These are existing reported results; this product record adds no application test results.
- Live Gemini, Bedrock and Atlas integrations, actual database restart/contention, labeled semantic quality, the participant pilot, full screen-reader acceptance and load targets remain unverified or not run as documented. Do not turn planned outcomes or fixture results into product claims.

## Product Principles

1. Help both participants find an exchange they personally consider worthwhile; support reciprocal bundles beyond one-for-one swaps.
2. Keep people in control of published facts and exact offer terms. Treat assistance and estimates as advice.
3. Preserve trading integrity through explicit consent, current eligibility checks, atomic commitments and an accurate recoverable outcome.
4. Expose only the information needed by the intended audience, and make consequential interactions understandable and accessible.
5. Distinguish intended scope, implemented behavior and measured evidence. Prefer the simplest design that satisfies the approved requirements.

## Accessibility & Inclusion

Core profile, inventory, preference, recommendation and trade journeys must support keyboard navigation and screen readers, understandable control names, field-specific actionable errors and announced action results. Explain the effects of consequential actions before confirmation. Keep status understandable when an action fails, terms change or handoff remains unresolved.

The specification's full accessibility acceptance remains an evaluation requirement. Existing browser checks do not establish complete screen-reader acceptance or a WCAG conformance claim.
