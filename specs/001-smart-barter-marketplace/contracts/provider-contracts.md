# Provider Contracts: Bartr AI Assistance and Semantic Search

**Status**: Phase 1 design, not implemented. See [research decisions R6–R11](../research.md), [data model](../data-model.md), [HTTP contract](openapi.json), and [validation guide](../quickstart.md).

## 1. Boundary and correlation

Only backend adapters call providers. Public requests use authenticated, authorized `/api` endpoints; provider credentials, raw responses, and vendor request identifiers never enter public item responses. Provider output cannot execute tools, publish listings, submit offers, reserve items, change consent, or bypass deterministic eligibility.

Every enrichment job captures `item_id` or private `interest_id`, `source_revision`, normalized `source_hash`, `model_id`, `prompt_version`, and `schema_version`. Item jobs use `source_revision = trading_revision`; preference jobs use the captured preference revision. An adapter binds the response to its original job rather than trusting model-supplied identifiers. Publish results only after a compare-and-set verifies the current source revision, hash, and job lease token. A late response becomes superseded; it cannot overwrite newer reviewed information.

Provider payloads contain the minimum necessary approved item information, sanitized images, and relevant interest labels. Never send account/session identifiers, credentials, contact details, or private trade notes. Treat instructions embedded in descriptions or images as inert listing content.

## 2. Gemini analysis

Use server-only `google-genai` async `models.generate_content`, an explicit configured stable model (`gemini-3.8-flash` initially), JSON MIME output, and the following versioned schema family. The official SDK supports async methods and Pydantic-derived response schemas; application validation remains necessary. [SDK interface](https://github.com/googleapis/python-genai), [structured-output limitations](https://aistudio.google.com/docs/structured-output).

Input binds one draft item revision and one to four authorized `image_id` references. Load image bytes through the backend's authorized storage adapter; never ask Gemini to fetch arbitrary user URLs. Images are already oriented, re-encoded, metadata-stripped, and limited to 4 MiB each under research R3. The request includes only the relevant item text and permitted category/condition identifiers.

Illustrative valid private response:

```json
{
  "schema_version": "analysis.v1",
  "source_revision": 3,
  "image_ids": ["11111111-1111-4111-8111-111111111111"],
  "suggestions": {
    "title": "Wooden desk chair",
    "category_id": "furniture",
    "product_type": "desk_chair",
    "brand": null,
    "model": null,
    "attributes": [{"name": "material", "value": "wood"}]
  },
  "valuation": {
    "estimate_cents": 4000,
    "currency": "USD",
    "uncertainty": "high",
    "reasons": ["Model and physical condition are unconfirmed."]
  },
  "uncertain_fields": ["brand", "model", "condition"]
}
```

All keys are explicit; prohibit additional keys. Suggestions may be null when unknown; category identifiers must belong to the supplied catalog. Bound title/attribute/reason lengths and array counts in application validation. Returned image IDs must be a subset of the input set; revision must equal the bound revision. Uncertainty is a qualitative label, never a calibrated probability.

`estimate_cents` is null or a positive integer, at most 1,000,000,000,000 (10^12), matching the public `Valuation.amount_cents` limit. Null means unknown; zero, negative values, numeric strings, fractions, NaN, infinity, and values above the cap are rejected. A three-item bundle totals at most 3 × 10^12 cents, within exact browser integer arithmetic; ratio comparisons remain server-side exact integer operations. A schema permits a nullable valuation rather than forcing an invented estimate. Do not represent dollars as binary floating-point or infer a current market-price guarantee from model knowledge.

The reviewed public `Valuation.amount_cents` copies an accepted `estimate_cents` exactly; owner-entered values use the same integer-cents representation. Formatting dollars and rounded percentages is presentation only. Bundle totals and percentage comparisons remain deterministic and use exact integer arithmetic.

The HTTP `AnalysisResult` envelope is backend-authored: `analysis_id`, `item_id`, `source_revision`, `status`, `suggestions`, `model`, `prompt_version`, `schema_version`, and `uncertainty_reasons`. Its `suggestions` object permits only the validated title/category/product/brand/model/attribute fields above, plus the candidate `valuation` and `uncertain_fields`; it is not a raw provider response. `model` maps from internal `model_id`. `status=unknown` means a successful analysis found no reliable suggestions; it must not hide a provider failure.

Persist each validated result under its backend-generated `analysis_id`, bound to the authenticated owner, item, source trading revision/hash, image IDs, model/prompt/schema versions, suggested amount and uncertainty, and result time. Applying `ValuationInput` with an `analysis_id` requires that saved record to belong to the current owner/item and still-current source revision; a client cannot manufacture assisted provenance. An unchanged accepted saved estimate becomes `source=assisted` with a backend-set last-set date. A changed estimate or manually entered amount becomes `source=owner`, even when an analysis ID was supplied; null becomes `source=unknown` with null amount/date. The backend owns source/date metadata and rejects client claims for those fields. These rules are enforced while the resulting item update is committed, so a concurrent source edit cannot authorize stale analysis.

Gemini does not assert authenticity, working order, hidden damage, or owner-confirmed condition from an image. It proposes; the owner accepts, changes, or rejects each suggestion before publication. Unknown analysis or valuation never prevents manual listing entry.

## 3. Gemini preference normalization

Input contains member-entered text, the current preference revision, and the permitted catalog. A structured editor may also supply an explicitly selected kind (`specific_product`, `category`, or `exclusion`); plain interpretation text has no preselected kind, so inferred kinds remain suggestions requiring confirmation. Do not send the complete preference record or another member's private preferences.

```json
{
  "schema_version": "normalization.v1",
  "source_revision": 5,
  "entries": [{
    "source_text": "desk screen",
    "kind": "specific_product",
    "product_type": "computer_monitor",
    "category_id": "electronics",
    "brand": null,
    "model": null,
    "exclusion": null,
    "requires_review": true
  }],
  "unrepresented_text": []
}
```

Each entry's `source_text` must be a nonempty exact substring of the original input, at most 200 characters. Validate both substring membership and the length before conversion; do not silently truncate or invent a display label. It becomes the public interest's required `text`. If a phrase cannot fit that bound, put it in `unrepresented_text` and ask the member to shorten or split it. New IDs are backend-generated; the provider cannot assign authoritative interest identities.

For a category interest, product fields are null. For an exclusion, positive-interest fields are null and `exclusion` is a conjunction over supported reviewed fields, for example `{"category_id":"electronics","condition_id":"needs_repair","brand":null}`. The adapter maps private `condition_id` to public `Exclusion.condition`, validates the canonical condition enum, and omits null optional predicates instead of emitting invalid null fields. “Damaged electronics” therefore proposes electronics AND needs_repair, subject to member review. Multiple saved exclusions are separate prohibitions.

A result cannot silently change an explicitly selected kind, invent a catalog ID, or make a contradictory/unrepresentable phrase enforceable. Place unrepresentable phrases in `unrepresented_text` and require correction or manual structured entry. The backend assigns new interest/exclusion IDs and maps validated entries into `InterpretResult.suggested_interests` and `suggested_exclusions`; it returns `requires_member_confirmation=true`. `POST /api/preferences/interpret` accepts only `text` (1–2,000 characters), proposes without saving, and never assumes model-inferred kinds are already member-approved. Only member-confirmed normalized facts influence hard eligibility. Required but unknown item facts fail closed with incomplete-information guidance. Specific-product priority requires matching saved product constraints, not merely a high category similarity score.

## 4. Gemini explanation selection

The matching engine supplies an already eligible, ranked bundle, authoritative item facts, approved relevant interest labels, and the allowed item-to-interest matches. It computes all values and identifies which participants receive specific-product matches. Gemini receives neither complete private preferences nor negotiation text.

Use a constrained response rather than trusting free-form factual prose:

```json
{
  "schema_version": "explanation.v1",
  "reasons": [
    {
      "item_id": "33333333-3333-4333-8333-333333333333",
      "interest_id": "22222222-2222-4222-8222-222222222222",
      "reason_code": "matches_specific_product"
    }
  ]
}
```

Allowed reason codes are `matches_specific_product` and `matches_category`. Each triple must occur in the engine's supplied allowed matches; reject duplicates, invented identifiers, incorrect relation codes, and an empty explanation. Backend templates render the approved labels, item facts, and comparison values. This avoids treating valid identifiers as proof that arbitrary generated prose is truthful. If generation fails, render the engine's verified matches directly. Neither path changes eligibility or recommendation order.

## 5. Titan embedding and freshness

Use Boto3 Bedrock Runtime `InvokeModel`, explicit AWS region, `bedrock:InvokeModel` permission scoped to `amazon.titan-embed-text-v2:0`, and JSON input:

```json
{
  "inputText": "computer monitor; electronics; screen for a desk",
  "dimensions": 1024,
  "normalize": true,
  "embeddingTypes": ["float"]
}
```

The application limits normalized text to 8,000 characters and rejects empty input. Titan additionally enforces its 8,192-token/50,000-character maximum; the character bound does not replace token-limit error handling. Validate the returned `embedding` as exactly 1,024 finite numeric values with nonzero norm; reject wrong dimensions instead of padding/truncating. Persist model, dimensions, normalization setting, source hash/revision and status. Never mix embedding spaces. [Titan model limits](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html), [request/response fields](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-embed-text.html).

Item vectors live at `items.embedding.vector`, with `embedding.model_id`, `dimensions`, `source_revision`, `source_hash`, and `status`. Private interest vectors remain within the corresponding member interests and are not publicly indexed. A changed source invalidates its previous artifact until recomputed; publish completion requires source-revision and lease-token validation.

## 6. Atlas index and retrieval

Named vector index `items_semantic_v1`:

```json
{
  "fields": [
    {"type":"vector","path":"embedding.vector","numDimensions":1024,"similarity":"cosine"},
    {"type":"filter","path":"community_id"},
    {"type":"filter","path":"owner_id"},
    {"type":"filter","path":"state"},
    {"type":"filter","path":"embedding.model_id"}
  ]
}
```

Illustrative query stage; replace the vector marker with 1,024 validated floats:

```json
{
  "$vectorSearch": {
    "index": "items_semantic_v1",
    "path": "embedding.vector",
    "queryVector": "<validated interest vector>",
    "numCandidates": 200,
    "limit": 40,
    "filter": {
      "community_id": {"$eq":"community-campus"},
      "state": {"$eq":"available"},
      "embedding.model_id": {"$eq":"amazon.titan-embed-text-v2:0"}
    }
  }
}
```

This is candidate acceleration, not the final response limit or completeness proof. Exclude self-owned candidates and rehydrate every result from authoritative items and current member records. The owner's current `member.community_id` governs discovery and acceptance; `items.community_id` is a denormalized search projection that can lag after a profile community edit. Enqueue projection/reindex work for that change, and use the authoritative inventory fallback to cover candidates missed by the stale community filter. Recheck ownership, current member communities, state, revisions, embedding freshness, and reviewed exclusions. Neither a matching projection nor its absence proves current community eligibility. Query score never determines consent, hard constraints, or ranking.

Use the complete authoritative pilot inventory and cached-vector exact fallback prescribed in R7/R9 before declaring `no_match`. Missing artifacts or exhausted processing time yield unavailable guidance, not an empty successful search. Verify index readiness and dimensional compatibility before enabling semantic readiness. [Atlas index contract](https://www.mongodb.com/docs/vector-search/indexes/vector-search-type/), [ANN/ENN query semantics](https://www.mongodb.com/docs/vector-search/query/aggregation-stages/vector-search-stage/).

## 7. Deadlines, errors, and eligibility

Application budgets: recommendations 9 seconds total; analysis/normalization/explanation jobs 20 seconds total; each embedding operation 3 seconds total, including at most one transient retry. Configure SDK retries explicitly and disable automatic continuation. Retry only eligible timeout/throttle/transient failures inside the remaining budget; never retry invalid credentials, access denial, invalid input/schema, or unavailable model configuration. Run blocking Boto3 calls in a bounded thread pool. No provider call occurs in a trade transaction or for every candidate bundle.

Typed adapter outcomes are `success`, `assistance_unavailable`, `invalid_provider_output`, `semantic_index_unavailable`, and `superseded`. Public provider/output/index failures return HTTP 503 with the applicable `Error.code`; an exhausted request deadline returns 504. The public error envelope contains `code`, an actionable `message`, `request_id`, and optional sanitized `details`, never a raw provider response or vendor error text. Stale source revisions map to the HTTP contract's 409/412 conflict/precondition handling, not successful application of stale suggestions. Safety-blocked, truncated, missing, malformed, or semantically invalid output is a failure, not an invented result. Preserve reviewed records and support manual entry/retry. Log only sanitized category, duration, model/version, correlation reference, and outcome. See [openapi.json](openapi.json).

The live pilot requires 18+ self-attestation, a supported provider region, and a paid Gemini project for real member content. No birth date or extra approval flow is introduced. Google's terms effective March 23, 2026 impose the age and unpaid-content restrictions; paid processing still permits limited abuse-prevention retention. Do not promise zero provider retention. The chosen model is explicitly stable and supports image input and structured output. [Gemini terms](https://aistudio.google.com/docs/terms), [model capabilities](https://aistudio.google.com/docs/models/gemini-3.8-flash).

## 8. Verification modes

Fixture mode uses synthetic images/text, deterministic normalized vectors, and recorded provider-shaped responses; unexpected outbound network access fails the test. Cover invalid identifiers/facts, null/fractional valuation, malformed schemas, safety blocks, timeouts/throttles, wrong vector length, stale revisions, lease loss, index lag/failure, and prompt-injection content. Fixture success proves contracts and orchestration, not live semantic quality.

One explicitly enabled live smoke uses synthetic nonpersonal content: one Gemini image-plus-structured-output request, one Titan request, and Atlas index-readiness/self-vector retrieval checks. Require configured credentials and an opt-in flag; ordinary tests never invoke it implicitly. Record only sanitized results. Live SC-002/SC-003 labeled quality evaluations and pilot usability criteria remain separate release gates, not conclusions drawn from this connectivity smoke.

