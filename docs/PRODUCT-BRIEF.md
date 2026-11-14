> Current authority: [root marketplace specification](../specs/001-smart-barter-marketplace/spec.md). This earlier analysis predates the approved three-item limit and 20% default; defer to the root specification, README and implementation plan where they differ.

# Bartr — AI-Powered Smart Bartering Marketplace

Source: the product brief supplied by the owner on November 14, 2026. This direction governs Bartr; Swapify is a reusable reference, not a mandate to import all its features.

## Purpose and audience

Bartr helps people exchange items they no longer need for things they want, without spending money. Initial users are college students and young adults moving, furnishing apartments, upgrading belongings, or exchanging unused items. The intended benefits are reuse, reduced unnecessary spending, and more value from existing possessions.

## Problem

Buying and selling is easier than bartering. Finding an exchange requires browsing, value comparisons, conversations, and negotiation. Strict one-to-one matching misses exchanges that become worthwhile when several items are combined.

## Approved product direction

Users create profiles, list an inventory of items they are willing to trade, and describe desired products or broad categories such as furniture, technology, electronics, and household essentials. Bartr analyzes both inventories and preferences to find mutually useful bundles:

- One item for one item.
- One item for several items.
- Several items for one item.
- Several items for several items.

Suggested exchanges explain relevant preferences and estimated values. Users can negotiate, adjust bundles, accept or decline. AI suggestions never obligate either person to trade.

## Canonical example

User A owns a chair estimated at $40 and a calculator estimated at $20, and wants a monitor. User B owns a monitor estimated at $65 and wants furniture and study supplies.

Bartr should discover and explain:

**Chair + Calculator ($60) ↔ Monitor ($65)**

These values are supplied example inputs, not live market observations. The example does not authorize a global $5 tolerance or a percentage fairness rule. Such policies remain to be decided.

## Approved technology responsibilities

| Technology | Responsibility |
| --- | --- |
| Google Gemini | Analyze images, identify attributes, interpret preferences, assist valuation, explain validated trade recommendations |
| AWS Bedrock | Generate semantic embeddings for relevant inventory and preference retrieval |
| MongoDB Atlas | Store profiles, inventories, preferences and proposals; search the stored embeddings |
| Matching and bundle optimization engine | Find feasible item combinations while respecting both users' preferences and constraints |
| Next.js + TypeScript + Tailwind + shadcn/ui | Accessible interactive frontend, retaining the approved black-and-cream direction |
| FastAPI | Authoritative backend contracts, validation and orchestration |

Bedrock's role in this brief is embeddings, not replacing Gemini with Amazon-generated prices. MongoDB stores and searches externally generated embeddings. The optimizer decides feasible bundles; semantic similarity alone does not establish feasibility or fairness.

## What this brief does not decide

Maximum bundle size, candidate count, value tolerance, valuation-confidence policy, score weights, and exact models remain to be settled. The brief does not add cash balancing, automatic acceptance, Solana/NFTs, NFC, A2A agents, or multi-party cycles to the bundle-matching MVP. Existing Swapify notes on those subjects are reference material and need separate scope decisions for Bartr.

## Current implementation

Bartr has the application foundation and API connectivity check. Gemini, Bedrock embeddings, MongoDB persistence and bundle matching are not connected yet. See the [bundle specification](specs/001-bundle-matching/spec.md), [architecture direction](ARCHITECTURE.md), and [Swapify reuse review](SWAPIFY-REUSE.md).
