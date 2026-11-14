# Matching and User Journey Contract

This Phase 1 contract defines observable matching and interface behavior for the initial pilot. It accompanies [OpenAPI](openapi.json), [the data model](../data-model.md), [research decisions R6–R11](../research.md), and [the specification](../spec.md). These are design requirements, not implemented or verified application behavior.

## Semantic Readiness and Eligibility

An interest has an explicit kind: `specific_product` or `category`. Categories, communities, and condition values use the versioned reviewed catalog. Product interests may include reviewed product type, brand, and model constraints. Exclusions are member-confirmed structured conjunctions; “damaged electronics” means the confirmed category and condition predicates together. Assistance proposes interpretation; it cannot silently save a different exclusion.

| Semantic state | Meaning and permitted behavior |
|---|---|
| `pending` | Enrichment is queued or running; manual listing and negotiation remain usable. |
| `ready` | Reviewed facts and any required embedding correspond to the current source revision and configured model/rules. |
| `failed` | Assistance failed; retain entered information and expose correction or retry. |
| Stale, derived | A source revision, text hash, or model differs from its artifact; treat that artifact as unavailable until recomputed. |

No raw cosine score establishes a hard exclusion or specific-product tier. Reviewed canonical facts and known synonyms establish exact matches; evaluated, versioned semantic thresholds may establish relevance where exact facts are insufficient. Specific-product constraints must match for that interest to count. Unknown facts needed to prove that an exclusion is satisfied fail closed and produce incomplete-information guidance. Broad-category relevance cannot become a specific-product match through a high similarity score alone.

For each direction of an automatic exchange, every incoming item must match at least one receiver interest. Apply ownership, distinct identity, available state, common community, exclusions, positive USD valuation, and one-to-three-items-per-side constraints before ranking. Exclusions override interests. Each side must be nonempty; self-trades and third participants are rejected. Unknown valuation is not zero. Manual proposals may override positive-interest relevance and recommendation value-gap limits with disclosure, but never hard constraints.

## Value Comparison and Recommendation Order

Store values as integer USD cents and limits as integer basis points. For bundle totals `x,y > 0`, define `gap = abs(x-y) / max(x,y)`. Eligibility requires that gap not exceed either member’s limit, equivalently their smaller limit. At the default 2,000 basis points, compare `abs(x-y) * 10000 <= 2000 * max(x,y)`. Do not use rounded display percentages for eligibility or ordering.

For each participant, a specific-product flag is one if at least one received item matches an explicitly saved specific-product interest; otherwise zero. Order eligible recommendations by:

1. Sum of the two flags, descending: two participants, then one, then neither.
2. Exact percentage value gap, ascending, within that priority.

Extra specific matches or fewer items do not create another priority. Equal priority and gap require no further ordering. Compare two rational gaps by integer cross-products. The chair/calculator versus monitor example totals $60 and $65: the $5 difference is approximately 7.7%, not a payment obligation.

After item-level filtering, enumerate combinations of sizes one, two, and three separately for each direction. All nine bundle shapes remain possible. Thirty items yield 4,525 combinations per side; do not materialize their 20,475,625-pair Cartesian product. Partition combinations by their recipient-specific flag, sort totals, binary-search neighboring totals, and merge increasing-gap streams with a bounded result heap. For tolerance `t < 1`, feasible counterpart totals lie between `(1-t)x` and `x/(1-t)`; at 100%, all positive totals are feasible. These are search bounds, not floating-point acceptance rules.

Return ten recommendations by default, at most twenty. Continue beyond dismissed or stale combinations. Apply the specified ordering across the returned partner results, rather than returning a lower-priority partner merely because their processing finished first.

## Completeness and HTTP Outcomes

Atlas ANN accelerates candidate discovery; it does not prove no exchange exists. Within the measured pilot envelope of 1,000 available listings and up to thirty items per inventory, evaluate the whole authoritative eligible community inventory before declaring `no_match`. Rehydrate search hits, and use current cached semantic artifacts plus authoritative fallback to cover index lag. A member's current `community_id` is authoritative; the item's community field and vector-index filters are projections that can lag a profile edit. Fallback must discover items owned by members who moved into the community despite stale projections, and exclude items whose owners moved out. This exact fallback does not mean that semantic interpretation is infallible or that exhaustive global optimization is promised.

The recommendation processing deadline is nine seconds. Provider calls stay outside this request’s critical path; preparation and recomputation use durable enrichment jobs. A deadline, missing/stale required semantic artifact, or failed index without a complete fallback cannot become an empty successful match result. Above the measured search envelope, fail explicitly rather than silently truncate the inventories.

`POST /api/recommendations` returns the following successful outcomes. Its result and inspection schemas are defined in OpenAPI.

| HTTP/outcome | Required user meaning |
|---|---|
| 200 `ready` | One or more current, eligible, ordered recommendations are available. |
| 200 `no_match` | Complete evaluation found no qualifying, non-dismissed value-qualified exchange; explain that constraints or available inventory may be adjusted. |
| 200 `needs_inventory` | The requester has no available items; offer a path to list one. |
| 200 `needs_interests` | The requester has no positive interests; offer a path to preferences. |
| 200 `needs_valuation` | Missing comparison values prevent otherwise suitable bundles from being value-qualified; identify correction actions without fabricating totals. |
| 503 assistance/index unavailable | Required semantics or index/fallback work could not complete; `error.code` is `assistance_unavailable` or `generation_incomplete`, and saved data remains intact. |
| 504 deadline exceeded | The request exceeded its processing deadline; `error.code=deadline_exceeded` identifies incomplete generation, not absence of compatible trades. |
| 429 | The configured member limit is exceeded; honor `Retry-After` and preserve the current view. |

Missing inventory is checked before missing interests. An unavailable dependency is not a precondition outcome. A successful response contains no unvalidated partial bundle. A working exact fallback may return a complete result despite index lag; an unsuccessful fallback must report failure.

## Freshness, Dismissal, and Submission

Inspection uses `GET /api/recommendations/{recommendation_id}`; dismissal uses `POST /api/recommendations/{recommendation_id}/dismiss`. Both are scoped to the requester. Recommendations are advisory, create no consent, and reserve no item.

A recommendation snapshot fingerprint covers canonical member/item identities, item trading revisions and availability epochs, both preference revisions, and the semantic model/rules versions used. Changed source information requires re-evaluation; never silently submit changed terms from an old recommendation screen. Submission verifies current authoritative ownership, availability, hard policies, and reviewed terms again. Failure identifies the changed item or condition and offers a return to current choices.

Use a separate dismissal signature: requester, canonical item combination and participants, item trading revisions, and the requester’s preference revision. That preference revision advances on interest, exclusion, and recommendation-limit edits. An availability-only reserve/cancel cycle, counterpart preference edit, or model update must not restore an otherwise unchanged dismissed combination. A changed item detail or requester preference permits that combination to return. Distinct listings of identical products remain distinct items; each listing appears at most once per bundle.

Trade commands retain one idempotency key through retries. A 202 unresolved mutation displays an explicit pending outcome and polls `GET /api/operations/{key}` or retries the identical command. A missing visible receipt is not proof of failure. Never repeat the action with a fresh key merely because a response was interrupted.

## Route and State Matrix

| Route | Audience, main flow, and required states |
|---|---|
| `/sign-in` | Public. Load an anonymous protected session, accept private email/password, and return to the requested local destination after success. Show generic invalid-credential, submitting, unavailable, and throttled states; preserve the intended destination and never disclose whether an account exists. |
| `/register` | Public. Collect private email/password, display name, community, and 18+ self-attestation for the provider-compatible adult pilot; collect no birth date. Show field-specific format/password/required errors and submitting/success/failure states. Explain public versus private profile information. |
| `/inventory` | Signed-in owner. Show drafts, available, reserved, exchanged, and removed states distinctly. Create, review, correct, publish, edit, or remove permitted items. Missing required listing information keeps a draft. Analysis failure preserves manual entry; unknown value may still be published. Reserved trading details cannot be changed. |
| `/items/[id]` | Available published item: signed-in members. Draft/removed listing: owner only; historical reviewed facts are reached through an authorized trade. Show condition, images, value source/date/uncertainty, and public profile. Images follow the same authorization boundary. Show missing/unavailable states without revealing private records. |
| `/preferences` | Signed-in owner. Edit distinct specific-product/category interests, confirmed structured exclusions, and gap limits. Review assisted interpretations before saving; provide manual alternatives and field-level contradictory/unrepresentable-exclusion errors. Explain that existing agreements retain their accepted terms. |
| `/discover` | Signed-in requester. Show loading, ordered recommendations, correct no-match, missing-inventory/interests/valuation, throttled, and unavailable/incomplete states. Each card reveals both bundles and advisory totals, with inspect, dismiss, and compose-proposal actions. Opening/dismissing a result never accepts it. |
| `/trades/[id]` | Two participants only. Show current offer, superseded versions, private notes, exact give/receive bundles, warnings, and current outcome. Open: submit/counteroffer, sender withdrawal, recipient decline/accept. Agreed: reserved items and handoff/cancellation controls. Awaiting confirmation: identify whose confirmation is missing. Closed: read-only outcome/history. Interrupted: explicit unresolved action and check-again control. |

Before submitting a proposal or counteroffer, use `POST /api/trades/preview` to obtain the current reviewed terms and required warnings. Submission binds those reviewed items and `terms_hash`, and requires acknowledgment of every displayed warning. Submitting an offer records its sender’s consent only. A counteroffer replaces current terms and clears earlier consent; withdrawal and decline roles follow the current version. Before acceptance, explicitly show all items given/received and any imbalance or unknown-value warning. Explain that acceptance reserves every item together and requires both participants’ consent to the same terms. A stale offer is replaced visibly with current facts and requires renewed review, never silently accepted.

Cancellation before any reported handoff explains that all reservations will be released and requires confirmation. After a handoff report, cancellation requires explicit approval from both participants. Reporting handoff explains that completion requires both confirmations; one report shows awaiting confirmation and retains reservations. No timer, AI output, or page visit completes the exchange. Concurrent conflicts show the recorded outcome or actionable unavailability, never partial success. No client-side route or disabled control substitutes for API authorization.

## Accessibility and Validation Boundaries

Verify every route at desktop width and 390 CSS pixels with no horizontal page overflow or hidden decisions. Bundle sides, values, warnings, and actions must remain readable without relying on a wide comparison table. Use visible keyboard focus, logical focus order, labeled controls, useful item-image alternatives, and statuses conveyed in text rather than color alone.

All primary flows work without a pointer. Confirmation dialogs identify their purpose, manage keyboard focus, and return focus to the invoking control. Field errors are associated with their inputs and summarized after unsuccessful submission. Announce saved, rejected, loading-complete, unresolved, and changed-offer outcomes to screen readers without repeatedly announcing unchanged polling results. Product text says “This offer changed” and explains the required action; it does not expose revision tokens or internal provider errors.

Acceptance evidence must include all nine bundle shapes; threshold boundaries and rational gap ordering; two/one/no-specific-match priority despite reversed value gaps; unknown values and exclusion facts; index lag with successful fallback versus incomplete failure; dismissed combinations surviving availability-only changes; and stale proposal submission. Browser checks cover both participants through counteroffer, acceptance, cancellation, handoff, denied access, and unresolved retry. Deterministic fixtures prove application rules; live semantic-quality, throughput, and participant-usability targets require their separate release evaluations.
