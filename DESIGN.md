---
name: "Bartr"
description: "A focused web workspace in warm cream and ink."
colors:
  canvas: "#f5f3ed"
  ink: "#20211e"
  paper: "#fffefa"
  secondary: "#eaece4"
  secondary-ink: "#33362e"
  muted: "#eeeee7"
  muted-ink: "#65675f"
  accent: "#e7e9e0"
  error: "#b8352c"
  divider: "#dedfd7"
  input-border: "#8e9185"
  focus: "#52634b"
  dark-canvas: "#171915"
  dark-ink: "#f3f3e9"
  dark-paper: "#23251f"
  dark-secondary: "#33372d"
  dark-secondary-ink: "#e0e4d6"
  dark-muted: "#2b2e26"
  dark-muted-ink: "#b3b6a9"
  dark-accent: "#373c30"
  dark-error: "#ffafa4"
  dark-divider: "#42463b"
  dark-input-border: "#757c6a"
  dark-focus: "#c0d3aa"
  dark-rail: "#1e211a"
  dark-error-ink: "#311610"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "2.5rem"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "2rem"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  headline-compact:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1.75rem"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 550
    lineHeight: 1.5
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  navigation:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.5
  feedback:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  control: "0.875rem"
  field: "calc(0.875rem - 2px)"
  navigation: "10px"
  panel: "16px"
  panel-compact: "14px"
  photo: "12px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "7": "1.75rem"
  "8": "2rem"
  "10": "2.5rem"
  "12": "3rem"
  "14": "3.5rem"
  "16": "4rem"
  "20": "5rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  button-destructive:
    backgroundColor: "{colors.error}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "44px"
    width: "100%"
  navigation-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.navigation}"
    rounded: "{rounded.navigation}"
    padding: "12px 14px"
  choice-chip:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.navigation}"
    padding: "4px 8px 4px 14px"
  surface-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "28px"
  listing-readiness:
    textColor: "{colors.muted-ink}"
    typography: "{typography.feedback}"
    padding: "20px 0 0"
---

# Design System: Bartr

## Overview

**Creative North Star: "The Focused Workspace"**

Bartr uses a warm cream canvas, opaque paper surfaces, ink actions and a quiet neutral navigation system. The interface gives content, editable facts and the next useful action a clear hierarchy. Border and tonal changes carry structure; compact system typography and comfortable controls keep the workspace familiar.

Apple’s principles are translated to the web through clear purpose, familiar controls, responsive composition, local feedback and recoverable actions. This is a record of the implemented web system, with no native HIG certification claim. The visual authority is the current source and reviewed captures; product facts remain in [PRODUCT.md](PRODUCT.md), and the chosen surface composition remains in the [surface brief](.impeccable/surfaces/frontend-app-profile-inventory-page-tsx.md).

**Key Characteristics:**

- Cream and ink, with a complete system dark appearance.
- System sans typography with a fixed rem hierarchy.
- Opaque bordered surfaces with restrained rounded corners.
- Comfortable controls and visible keyboard focus.
- Task-local feedback, explicit review and recoverable editing.

The token frontmatter is normative. It extracts the reused values from [global styles](frontend/app/globals.css) and [shared controls](frontend/components/ui/button.tsx). Dark-prefixed colors record the actual system dark appearance. The [sidecar](.impeccable/design.json) adds preview snippets, state treatments and responsive metadata; its synthesized tonal ramps are preview aids, not extra shipping colors.

## Colors

The palette is black-and-cream in character: warm, low-chroma neutrals carry the interface, with green-toned focus and warm red error feedback.

### Primary

Ink is the primary action and heading color; paper provides its light-appearance action text. In dark appearance the primary pair reverses to dark ink on light ink. Primary actions remain visually distinct from the softer secondary and outline variants.

### Neutral

| Role | Light token | Dark token | Application |
| --- | --- | --- | --- |
| Canvas | `canvas` | `dark-canvas` | Page background and input fill |
| Main text | `ink` | `dark-ink` | Body, headings and surface text |
| Content surface | `paper` | `dark-paper` | Panels and compact navigation |
| Soft selection | `secondary` | `dark-secondary` | Selected rows, chips and feedback |
| Secondary action text | `secondary-ink` | `dark-secondary-ink` | Secondary buttons |
| Quiet surface | `muted` | `dark-muted` | Photo area and thumbnails |
| Supporting text | `muted-ink` | `dark-muted-ink` | Hints, descriptions and metadata |
| Hover surface | `accent` | `dark-accent` | Navigation and quiet control hover |
| Divider | `divider` | `dark-divider` | Content boundaries |
| Field stroke | `input-border` | `dark-input-border` | Input and dashed photo boundaries |
| Rail | `muted` | `dark-rail` | Desktop navigation background |

### Interaction and state

Focus uses `focus` / `dark-focus`. Error feedback uses `error` / `dark-error`; destructive button text uses `paper` / `dark-error-ink`. The semantic CSS properties in global styles select the correct pair with `prefers-color-scheme: dark`.

Measured samples from this build: supporting text on the cream canvas (5.17:1), supporting text on paper (5.69:1), dark supporting text on the dark panel (7.51:1), body ink on cream (14.58:1), and the input stroke against paper (3.18:1). These are specific pair measurements, not a complete accessibility conformance claim. With `prefers-contrast: more`, supporting text becomes the main foreground and divider strokes use the stronger input stroke.

**The Semantic Contrast Rule.** Use the semantic foreground, surface and state pairs for their intended roles; keep status and error meaning in words as well as color.

## Typography

**Display and body font:** the platform system sans stack recorded in the frontmatter. The same stack serves headings, fields and navigation; no bundled font is required. Weight, size and spacing establish hierarchy without a separate display face.

### Hierarchy

- **Display:** the public Home introduction. It steps down to the headline role below the wide Home composition.
- **Headline:** regular workspace page titles; compact screens use `headline-compact`.
- **Title:** section and panel headings, with a slightly tightened letter spacing.
- **Body:** default reading text and field values. Page descriptions use a relaxed line height (1.6) and a maximum measure (65ch).
- **Label:** field labels and compact emphasis.
- **Control and navigation:** medium-weight labels with enough room to wrap. Main navigation has a distinct regular-width role; compact bottom labels use a smaller size (.6875rem) alongside icons.
- **Feedback:** supporting action messages use the recorded size and relaxed line height. Smaller metadata uses the existing .75rem and .8125rem steps where the source calls for it.

The scale is fixed in rem rather than fluid viewport sizing. Public Home’s display steps from 2.5rem to 2rem below 1024px; workspace titles step from 2rem to 1.75rem below 768px. Headings balance their lines, and text wraps rather than truncating editable facts or long community names.

**The Fixed Rem Rule.** Keep the implemented type hierarchy in rem units, allow wrapping and preserve the user’s text size.

## Layout

The authenticated shell uses a sticky navigation rail (216px) and a flexible main column. Its top bar wraps account actions and community context, and content stays within a maximum width (1400px). Regular content padding is 44px 40px 64px; wide screens from 1280px use 48px 56px 80px. Account and Preferences use a narrower content measure (48rem).

Below 768px, navigation becomes an opaque four-column bottom bar with safe-area padding. The top bar becomes compact, and content uses 28px 20px with bottom room for navigation. At 360px and below, side gutters reduce to 14px. Links retain text labels with their icons; the selected destination is indicated by `aria-current` and a filled background.

Public pages use a horizontal header instead of the authenticated rail. Public Home has named introduction, authentication and example areas. Above 1023px the introduction and example share the left column while authentication occupies the right; at narrower widths the order is introduction, authentication, example within a maximum width (640px). This keeps its reading and sign-in sequence deliberate without repeating a workspace hero.

Inventory has separate list and editor work areas from 1024px: `minmax(260px, .85fr)` and `minmax(0, 1.15fr)`, with a 24px gap. Below that width it shows one pane at a time. Opening an item moves focus to the editor heading and scrolls it into view; Back to inventory restores focus to the list heading. The New item action stays with the screen heading.

Use the recorded spacing steps for controls and form groups. Panels, section dividers and wrapping action rows establish grouping; repeated labels and stacked large promotional headings are unnecessary in the task workspace.

## Elevation & Depth

The system has no decorative or structural card shadows. Opaque canvas, rail, panel, selected-row and field tones create depth, with thin borders defining edges. The temporary-preview disclosure uses a bordered opaque panel. Focus rings are interaction indicators rather than surface elevation.

Color transitions on navigation and inventory rows last 160ms with the browser’s ease timing. Reduced motion changes animation and transition duration to .01ms and disables smooth scrolling. There are no required entrance, parallax or continuous-motion effects.

**The Opaque Surface Rule.** Separate content with opaque surfaces, tonal changes and borders; reserve focus rings for interaction feedback.

## Shapes

The form language is a family of rounded rectangles with thin borders. Panels use the `panel` radius, changing to `panel-compact` on small screens; buttons use `control`, fields use `field`, and navigation, feedback and choice-chip containers use `navigation`. Photo areas use `photo` with a dashed input-colored border. Avatars and numbered preparation steps are circular exceptions tied to their meaning.

Corner softness does not replace a visible field boundary. Rows use separators and a selected fill within the containing panel; item thumbnails clip their image with rounded corners. The base radius and its field derivative remain in rem, while the explicitly fixed navigation and panel radii follow the source values in frontmatter.

## Components

### Buttons

Comfortable, quiet controls with a clear action hierarchy. Default, small and icon variants have a minimum target height (44px); large buttons use 48px. Default padding is recorded in frontmatter, with smaller horizontal padding when an icon is present. Multiline labels expand rather than clipping.

Primary buttons use the primary pair. Outline buttons use canvas fill and a divider stroke; secondary buttons use the soft selection pair; ghost buttons acquire an accent fill on hover. Destructive actions use the error pair. Hover changes color, active press reduces brightness, and disabled controls reduce opacity. Button keyboard focus uses a ring (3px at 60% focus color) with a 2px canvas offset. Actual destructive or replacement actions are explained locally before confirmation.

### Inputs / Fields

Fields use a strong input stroke, canvas fill and the field radius. Single-line inputs are 44px high, use 16px text and 12px horizontal padding; textareas are vertically resizable with a minimum height (7rem). Focus changes the border to the focus color and adds a ring (2px at 25%). Visible labels remain outside the input; helper and field-error text are connected with `aria-describedby`, and rejected values use `aria-invalid` where implemented.

Keep feedback beside the relevant form or action. Successful progress uses a quiet soft-surface message and `role="status"`; failures use explicit error text and `role="alert"`. Field-specific API errors attach to their associated fields, with a local summary when multiple item facts are rejected. The global keyboard focus outline is 2px with a 4px offset for controls and links without their own focus treatment. A skip link becomes visible on focus.

### Cards / Containers

Opaque panels use a thin divider border, the panel radius and regular padding (28px). Compact padding is 22px 20px, with 16px side padding at the smallest width. Inventory panes have their own padded header and body regions; the outer pane has no extra padding. Use dividers to group secondary actions and optional details within a panel rather than nesting multiple elevated cards.

### Navigation

Regular rail links combine a 20px inline SVG icon with a text label, a 12px gap and a minimum height (48px). The active link uses the primary pair; hover uses the accent surface. Compact navigation uses a 52px minimum link height with the icon above its label and a soft selected background. Public header navigation stays horizontal. Account access remains in the top bar, with its own current-page state.

### Choice chips and filters

Interests and exclusions appear as wrapping soft-surface chips, with a named remove button and no color-only meaning. Adding supports Enter or Add; errors remain under the entry field. Inventory filters use the same secondary/ghost button hierarchy and expose `aria-pressed`. Long entries wrap within the available width.

### Inventory editor and readiness

The photo area leads the editor, followed by item details, a plain-language readiness checklist and adjacent save/publish actions. Attaching the first photo creates a private saved draft when needed; the local result explicitly asks for review before publication. This photo save is not a general autosave of every field. The readiness list names what is added or needed, while publication remains an explicit action.

Unsaved per-item and new-item drafts live in the mounted workspace’s memory, so switching items or routes can retain edits. They clear with session state and do not promise survival across reloads. Latest-saved review leaves the draft unchanged until explicit replacement. Reload and removal actions explain their effect and give a way to keep editing or keep the listing.

Optional assistance is visibly separated from required editing. Preferences uses a disclosure; Inventory labels its assistance section and review output. Suggestions can be applied or dismissed, and unavailable assistance leaves manual entry usable. Do not present an assisted result as an already reviewed fact.

### Wordmark, icons and images

The Bartr wordmark is live text with a muted period. Functional icons are inline stroked SVG; they are hidden from assistive technology when adjacent text supplies the name. User item photos fill or fit their intended thumbnail/editor region. This build introduces no shipping raster assets, stock imagery or asset fonts; the [review captures](.impeccable/review/) are evidence, not product imagery.

## Do's and Don'ts

### Do:

- **Do** use the semantic light and dark pairs, keeping body text and helper text readable on their actual surface.
- **Do** keep controls at least 44px high, let labels wrap and retain visible keyboard focus.
- **Do** keep errors, progress and results beside the action, with field labels and associated help or error text.
- **Do** preserve unsaved item drafts while moving within the mounted workspace and explain explicit replacement or discard actions.
- **Do** keep photo saving, draft saving, readiness and publication visibly distinct; present optional AI output for review.

### Don't:

- **Don’t** add decorative shadows, translucent panels or gradients to the current bordered surface language.
- **Don’t** compress the desktop list and editor into an offscreen editing result on compact screens; use the focused editor and its Back action.
- **Don’t** imply that unsaved drafts survive a reload or session change, or extend their lifetime through browser storage.
- **Don’t** let assistance overwrite reviewed details or make a saved photo appear to publish a listing.
