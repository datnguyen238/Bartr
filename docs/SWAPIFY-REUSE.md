> Current authority: [root marketplace specification](../specs/001-smart-barter-marketplace/spec.md). This earlier analysis predates the approved three-item limit and 20% default; defer to the root specification, README and implementation plan where they differ.

# Swapify reference and Bartr reuse assessment

Reviewed the local `/Users/datnguyen/Desktop/Swapify` implementation on November 14, 2026. The owner-supplied [Bartr brief](PRODUCT-BRIEF.md) defines scope. This review does not copy secrets, databases, uploaded photos, demo identities or prior generated valuation records.

| Existing reference | Useful behavior | Bartr adaptation |
| --- | --- | --- |
| `backend/app/services/images.py` | Content-based JPEG/MPO/PNG/WebP/HEIC decoding, rotation correction, resizing and metadata removal | Reuse image normalization with upload authorization and storage boundaries defined for Bartr |
| `backend/app/services/valuation.py` | Gemini adapter, strict extraction, cited-price validation, timestamps, quota/timeout reporting | Reuse after separating valuation contracts from the demo Store and choosing the approved pricing method |
| `backend/app/domain.py` valuation records | Persist per listing revision and method with no automatic expiry | Store equivalent revision-bound records in MongoDB; do not port SQLite as the final database |
| `backend/app/domain.py` proposal revisions | Exact terms and approvals tied to current item revisions | Apply to proposals containing arrays of items on both sides and prevent overlapping item commitments |
| `backend/app/domain.py` `cycles()` | Deterministic graph traversal for direct and multi-party item cycles | Not the bundle optimizer; build pairwise inventory subset matching for the new requirement |
| `backend/app/agents/` | A2A demo with scripted actors and a small policy | Reference only; the new brief does not require A2A as the initial negotiation implementation |
| `frontend/components/ui/`, theme and typed API helper | Approved Next.js/Tailwind/shadcn foundation and UI states | Already reused in Bartr foundation; build inventory and proposal UI from new contracts |
| `docs/NEGOTIATION-PREFERENCES.md` | Single/multiple inventory handling, user-selected lower value limits, private constraints | Earlier requirements remain useful; exact bundle aggregation and permissions are still decisions to settle |
| Wallet, Solana, NFC and handoff notes | Previous product extensions | Do not import into this MVP without a separate request |

## Important differences

Swapify's current graph places one item on each cycle node. A two-user bundle is instead a pair of item sets with all outgoing items from each set transferred to the opposite participant. A pairwise item graph does not automatically enumerate or validate those sets.

The old demo receives actor names such as Maya and Noor in API requests. Those names are not authentication. Bartr's profile and mutation APIs must derive identity at a trusted boundary before exposing real private user data or committing inventory.

The prior Bedrock adapter is a market-valuation adapter using Mantle and hosted web search. It is not an embedding implementation. For the approved brief, use a dedicated Bedrock embedding adapter and store its vectors in MongoDB Atlas. Do not route embedding work through that valuation endpoint.

The original Swapy reference and the local Swapify implementation are distinct. Swapy's static price-table calculation is not online market evidence. Bartr should retain provenance and uncertainty for whichever valuation method is approved, rather than copy category prices and present them as verified market values.

## Implementation order to review

1. Confirm the pending bundle policies in the [specification](specs/001-bundle-matching/spec.md).
2. Define profile identity, inventory, preference and revision-bound valuation contracts.
3. Connect Gemini analysis and Bedrock embeddings behind separate adapters; use isolated fixtures for failure and quota cases.
4. Store profiles/items/preferences/proposals and compatible vectors in MongoDB Atlas with documented indexes.
5. Retrieve candidate inventories, enforce both participants' constraints, enumerate allowed bundle combinations and rank feasible results.
6. Build review, counterproposal and acceptance flows over exact versioned terms, with atomic conflict handling.
7. Verify the canonical example and all four bundle shapes, then run an end-to-end demo with configured services.
