---
name: "Bartr"
description: "A compact trading workspace with cream surfaces and dark green text."
colors:
  canvas: "#f6f2e8"
  ink: "#173a2b"
  paper: "#fffdf7"
  secondary: "#e9eadf"
  secondary-ink: "#263e2d"
  muted: "#eeece3"
  muted-ink: "#596b5b"
  accent: "#dfe7d9"
  error: "#a52d23"
  divider: "#d5d7ca"
  input-border: "#829281"
  focus: "#446b4d"
  success: "#365e3d"
  rail: "#173a2b"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(2rem, 3.5vw, 3.5rem)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.875rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline-compact:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.75rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: "12px"
  field: "10px"
  navigation: "10px"
  panel: "14px"
  compact-panel: "12px"
  sheet: "16px"
  auth: "18px"
  photo: "12px"
spacing:
  field: "8px"
  actions: "12px"
  section: "24px"
  panel: "24px"
components:
  button-primary:
    background: "ink"
    color: "paper"
    minHeight: "44px"
    borderRadius: "control"
  button-outline:
    background: "canvas"
    color: "ink"
    minHeight: "44px"
    borderRadius: "control"
  input:
    background: "canvas"
    color: "ink"
    border: "input-border"
    minHeight: "44px"
    borderRadius: "field"
  navigation-active:
    background: "canvas"
    color: "ink"
    borderRadius: "navigation"
  surface-panel:
    background: "paper"
    border: "divider"
    borderRadius: "panel"
---

# Bartr interface

The shipping interface uses cream pages, dark green text and a dark green desktop rail. The appearance stays light when the operating system uses dark mode. The authoritative tokens and responsive rules are in [globals.css](frontend/app/globals.css); this document describes their intended use.

## Typography and surfaces

Use the platform sans-serif stack for application text. The existing Home `Barter.` wordmark retains its locally bundled Handlee font. Workspace headings are 30px on desktop and 28px on mobile. The authentication story uses the system family at a larger size; its mobile heading is 28px, reducing to 26px on the narrowest screens. Body text is 16px, with smaller labels and supporting text where appropriate.

Use paper for a panel that groups a task, muted surfaces for secondary content, and green for the main action. Keep copy factual and brief. Destructive actions and actionable errors use the destructive color; ordinary trade metadata stays neutral. Avoid decorative shadows, repeated introductory copy and unnecessary panels inside panels.

## Application shell

Authenticated pages share the [workspace shell](frontend/components/workspace/shell.tsx). The desktop rail is 216px wide, collapsing to 76px. It contains Home, Profile, Trade and Sign out, with the current page visibly selected. There is no separate account or community top bar.

The content area fills the available width up to 1440px. Desktop gutters are 32px, increasing to 40px on larger screens. Profile panels use the full content width. At widths below 768px, the rail becomes a fixed bottom navigation; content has 16px side gutters and clearance for navigation and device safe areas. The narrowest screens use 14px gutters.

Anonymous pages have no application rail or bottom navigation. Authentication uses a centered, bounded layout rather than inheriting authenticated page spacing.

## Controls and feedback

Use the existing [shadcn components](frontend/components/ui). Buttons and inputs have a minimum 44px touch target. Keep labels visible, preserve keyboard focus styles and use disabled/loading states during a pending action. Fields use consistent 8px label spacing; action groups wrap without overflowing.

Use Select for single choices such as category, condition and value difference. Preferences use a searchable DropdownMenu with the predefined choices. Menus render above dialogs, have readable option spacing and support keyboard selection. Use AlertDialog for consequential confirmations instead of native browser popups.

Inline feedback belongs next to the affected task. Failed requests preserve entered work and provide an actionable message. Do not present provider output as a completed user action. Reduced motion, increased contrast and reduced transparency have dedicated CSS handling.

## Sign in and registration

The active [authentication screen](frontend/components/home/home-screen.tsx) pairs a short dark green story panel with the cream form. Desktop uses two columns; mobile stacks the panels. The form stays bounded within its column, with aligned fields, a full-width submit action and a clear switch between Sign in and Create account.

Sign in requires username and password. Registration adds a display name. Keep validation, pending states and session recovery visible without adding promotional copy or a community field.

## Profile and preferences

The [profile](frontend/components/profile/profile-screen.tsx) groups the name, avatar, counts and Edit profile action above Items and Preferences tabs. On mobile, identity, actions and counts wrap into deliberate rows. Tab panels share the same width and retain keyboard navigation.

[Account editing](frontend/components/profile/account-screen.tsx) shows the username as read-only and permits display-name changes. [Preferences](frontend/components/profile/preferences-screen.tsx) stack Interests and Exclusions, with removable selected chips and a single value-difference selector. Choices stay private. Save is explicit; unsaved changes and reload confirmation remain visible. On wider screens, secondary actions sit left and the save action sits right; mobile actions fit the panel width.

## Items and valuation

The [inventory](frontend/components/inventory/inventory-screen.tsx) uses compact rows with a thumbnail, item name, condition/status, value and grouped actions. Removed items disappear from inventory and its counts; exchanged items remain available in past trade history.

The item editor starts with the photo. Image identification can populate title, category and description; the owner reviews them and chooses the condition. Title spans the form, category and condition share a row when space allows, and description sits below. Identification failure keeps the draft available for manual detail entry.

Estimate price remains a required step before publication. A current successful AI evaluation supplies the value; comparable evidence is preferred, with the supported image-based fallback identified when used. The estimate is advisory, and the value is not an unrestricted manual-price field. Keep price results below item details and retain the explicit Save draft, Publish listing or Save changes action. Publishing automatically starts discovery preparation; no separate Make discoverable action is exposed.

The [modal sheet](frontend/components/ui/modal-sheet.tsx) has a fixed header, a scrolling body, an explicit Close action and mobile safe-area clearance. Closing preserves unfinished work in the current UI session. Focus is contained while open and returns to a suitable control on close.

## Home and trades

Home groups compact item rows by owner in a responsive grid. Rows prioritize images, names, conditions and values; repeated valuation dates and confidence labels stay out of the browse rows. Search, category filters and matching controls sit above the results. Supporting trading guidance is compact and collapsed by default for signed-in members. Opening a listing leads to details and an offer with its owner; the interface does not require browsing a full user directory to start a trade.

The [trade workspace](frontend/components/trade/live-trades.tsx) places the trade selector above the exchange and conversation panels. Desktop aligns those panels side by side; mobile stacks them. Offer items show concise names, conditions, images and values. Status labels are capitalized and avoid redundant offer-version labels in routine presentation.

Agreement, item reservations, cancellation and handoff remain server-authoritative. Each participant reviews the current terms; completion requires both handoff confirmations. Live chat preserves its private participant boundary, sends with Enter, and clears only the successfully sent draft. Connection and submission states stay visible without native popup notifications.

## Verification

Record checks, environments and outstanding limitations in [verification status](docs/VERIFICATION.md). Visual inspection, automated interaction coverage and provider-backed behavior are separate evidence; this document does not imply that every state has been tested against live services.
