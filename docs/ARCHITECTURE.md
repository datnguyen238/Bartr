> Current authority: [root marketplace specification](../specs/001-smart-barter-marketplace/spec.md). This earlier analysis predates the approved three-item limit and 20% default; defer to the root specification, README and implementation plan where they differ.

# Bartr architecture direction

Status: draft architecture derived from the owner-approved [product direction](PRODUCT-BRIEF.md). No integrations or new product journeys have been implemented by this document.

## Data flow

1. A participant lists an item with photo, condition and accessories; the server verifies ownership and persists an item revision.
2. Gemini extracts observed attributes while preserving user facts separately. The chosen valuation flow records estimated values, uncertainty, provenance and time. Valuations do not automatically expire.
3. A dedicated Bedrock embedding adapter converts the item description and reviewed preference text into vectors. Do this on relevant revisions, not for every page render.
4. MongoDB Atlas stores application records and embeddings. Record embedding model ID, dimensions and item/preference revision; only compare compatible vectors.
5. Atlas vector search retrieves candidate items/owners. Apply availability and authorized scope filters; retrieve reciprocal interest information for candidate participants.
6. The deterministic bundle optimizer considers allowed subsets from both inventories, checks both participants' constraints, computes estimated totals and returns feasible candidates. It must not silently treat semantic score as fairness or make arbitrary cash/value allowances.
7. Gemini can explain a validated candidate using its item IDs, preference-fit facts and calculation output. The model cannot invent items, alter the selected bundle, approve terms or write trade state.
8. The UI displays included items, estimates, uncertainty and user decisions. Proposal revisions and authoritative acceptance recheck ownership, availability and current item versions. Conflicting item commitments must be prevented atomically.

## Responsibilities

| Module | Owns | Does not decide |
| --- | --- | --- |
| Image/attribute analysis | Gemini input/output validation and observed attributes | Ownership or user approval |
| Embeddings | Bedrock model calls and compatible vector metadata | Value fairness or trade eligibility |
| Persistence/search | MongoDB records, indexes and candidate retrieval | Human consent |
| Bundle engine | Item-set generation, constraints, totals and deterministic validation | Unapproved tolerance or scoring policies |
| Proposal domain | Versioned terms, decisions and conflict handling | AI-generated consent |
| Frontend | Inventory/preferences, clear status, bundle review and negotiation UI | Authoritative permissions |

## Provider implementation notes

The [Titan Text Embeddings V2 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-titan-text-embeddings-v2.html) documents a Bedrock Runtime embedding API. It is a candidate, not a selected model: confirm region, account access and desired vector dimensions before implementation. Bedrock generation models and the existing Mantle web-search adapter are not interchangeable with embedding models.

For externally generated embeddings, [MongoDB documents compatible vectors and pre-filters](https://www.mongodb.com/docs/vector-search/query/aggregation-stages/vector-search-stage/?deployment-type=atlas&embedding=byo&interface=driver&language=go). Use the same embedding model/settings for indexed descriptions and preference queries, with index dimensions matching the output. Define filter fields in the index. Do not silently replace Bedrock embeddings with Atlas auto-embedding.

## Decisions required before dependent code

- What makes a bundle's value imbalance acceptable to each participant? How are unknown values and ranges treated?
- Which inventory items may the engine bundle, and what bundle limits are supported?
- Which ranking objectives take precedence, and how are equal candidates ordered?
- Which existing identity system, if any, should authenticate profiles and inventory changes?
- Which Gemini model, Bedrock embedding model/region and Atlas deployment are available to the team?

The example authorizes explaining the $60 versus $65 trade when acceptable to both participants. It does not establish a hardcoded global tolerance. Do not implement arbitrary fairness thresholds while these decisions are open.

## Current state versus target

Current: FastAPI health endpoint, typed Next.js proxy/client, shadcn components and starter page. Target: the inventory-to-bundle pipeline above. Existing local credentials, data and running services from Swapify are not automatically transferred. Scope confirmation is pending before application code changes.
