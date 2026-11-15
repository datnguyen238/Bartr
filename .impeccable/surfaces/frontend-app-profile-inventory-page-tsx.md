---
version: 1
slug: "frontend-app-profile-inventory-page-tsx"
primary_target: "frontend/app/profile/inventory/page.tsx"
related_targets: ["frontend/app/home/page.tsx","frontend/app/profile/page.tsx","frontend/app/profile/preferences/page.tsx","frontend/app/trade/page.tsx","frontend/components/workspace/shell.tsx"]
---

# Bartr workspace redesign

Mode: Operate. Scope: Home, protected Account/Inventory/Preferences, Trade preparation, shared navigation and feedback. Address all five archived priority issues. User direction: Apple's design principles translated to the web; preserve Bartr and black-and-cream. Build directly, as previously chosen.

## Direction contract

THESIS: Belongings and the next useful action lead. Replace the repeated welcome hero and stacked administrative forms with a focused personal collection workspace.

OWN-WORLD: Warm cream canvas, clean raised-content surfaces, ink primary actions, quiet neutral navigation, system sans typography, comfortable controls, and one border-based component vocabulary. System appearance, focus and reduced-motion preferences remain respected.

STORY: Members understand money-free local bundle exchanges, prepare a reviewed item with photo or manual entry, retain interrupted drafts, and see exactly what remains before publication. Estimates advise; people decide.

FIRST VIEWPORT: Regular widths have a compact sidebar and an aligned content column. Inventory gives the item list and active editor separate work areas. Compact widths have reachable navigation and show either the list or the focused editor, never an offscreen editing result. The primary action and contextual feedback sit with the task. A listing-readiness checklist is the signature functional detail.

FORM: Personal collection, fourth of seven grounded candidates; seed:e38936d1f189ed27. Apple's familiar, restrained web controls constrain the reference to type, density, palette and readiness feedback. Grid discipline and clear stage comparison strengthen the system; display experiments and decorative transformations are declined because they obscure editing. The user confirmed the focused workspace with inventory list.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Constraints: preserve routes, authentication/privacy, revision checks, exact consent/trade rules and intentionally deferred Trade controls. No invented market evidence. Draft safety must not persist private records into localStorage. Required views: desktop,390px compact,320px minimum, enlarged text, dark preference, keyboard focus and rejected form actions.
