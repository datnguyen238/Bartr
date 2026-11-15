---
version: 1
slug: "frontend-app-profile-page-tsx"
primary_target: "frontend/app/profile/page.tsx"
related_targets: ["frontend/app/profile/inventory/page.tsx","frontend/app/profile/preferences/page.tsx","frontend/components/profile/profile-screen.tsx"]
---

# Unified personal profile

Mode: Operate. The owner explicitly requested a social-media-style Profile that combines item management and preferences on the same page, personal information behind Edit profile, and an Add item form with a blurred surrounding view. Preserve the current Bartr design system and all existing account, listing, publication, review and privacy rules.

## Direction contract

THESIS: One personal trading home: identity above a collection, with Items and Preferences as in-place sections rather than separate destinations.

OWN-WORLD: Inherit the cream-and-ink palette, system typography, opaque surfaces and comfortable controls. Use a large initial avatar and real item counts as the profile signature. No invented social metrics or unsupported profile fields.

STORY: Members recognize their saved identity, manage belongings, adjust private interests and deliberately open Edit profile for personal information. Adding or editing an item temporarily focuses the task without losing its parent context.

FIRST VIEWPORT: Identity and Edit profile lead; real inventory counts sit beneath, then two labeled tabs and the collection. Add item opens a titled scrollable sheet with an opaque form, dimmed blurred backdrop, clear Close, trapped keyboard focus and focus restoration. Compact widths keep the same content and use a nearly full-height form sheet.

FORM: A scoped extension of the approved focused workspace. The user's explicit profile and blurred-sheet composition is binding; no replacement visual-world selection is required.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Required checks: same-page tabs, edit-info visibility, Add/Edit modal focus and dismissal, preserved session drafts, guarded publication/revision failures, mobile/320px/dark/200% text, reduced motion and reduced transparency. Keep direct protected URLs working and expose only approved profile fields.
