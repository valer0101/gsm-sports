# Admin Tournament Creation Wizard — Design Spec

> **Status:** Draft v1
> **Branch:** `feature/admin-tournament-wizard-redesign`
> **Replaces:** `apps/web/src/app/admin/tournaments/new/page.tsx` (existing single-page form, ~789 lines)
> **Goal:** Convert single long form into a focused 4-step wizard with energetic, sporty visual language.

---

## 1. Design Language — "Combat Energy"

The admin panel for a combat-sports platform should feel like a control room before a fight: focused, charged, decisive. Not a generic SaaS dashboard.

### 1.1 Mood
- Aggressive contrast (deep black + signal red), not pastel.
- Sharp corners and thick borders > soft rounded cards.
- Big, confident typography. Numbers and weights look like scoreboards.
- Subtle motion: hover states feel like a punch lands (quick, not bouncy).

### 1.2 Color Palette

We reuse and extend the existing tokens already defined in `apps/web/src/app/globals.css`. The base palette is sport-themed (deep navy + signal red + gold) which fits "Combat Energy" naturally. New tokens are added for surface elevation and borders.

| Token | Hex | Usage |
|---|---|---|
| `--color-background` | `#0F0F1A` | Page background (existing) |
| `--color-surface` | `#1A1A2E` | Cards, form sections (existing) |
| `--color-surface-2` | `#252538` | **NEW** — Inputs, hover surfaces, elevated cards |
| `--color-border` | `#2E2E45` | **NEW** — Default borders |
| `--color-border-strong` | `#43435A` | **NEW** — Hover/active borders |
| `--color-text-primary` | `#FFFFFF` | Headings, primary text (existing) |
| `--color-text-secondary` | `#A0A0B0` | Helper text, labels (existing) |
| `--color-text-muted` | `#6A6A80` | **NEW** — Disabled, placeholders |
| `--color-primary` | `#C8102E` | Primary CTA, active step, errors, "live" (existing — sport red) |
| `--color-primary-hover` | `#E11D3A` | **NEW** — CTA hover |
| `--color-primary-dim` | `rgba(200,16,46,0.12)` | **NEW** — Active backgrounds, focus rings |
| `--color-accent` | `#FFD700` | Gold accent — 1st place, featured badges (existing) |
| `--color-success` | `#22C55E` | Completed steps, confirmed states (existing) |
| `--color-error` | `#EF4444` | Form errors (existing — distinct from primary red) |
| `--color-warning` | `#F59E0B` | Drafts, warnings (existing) |

**Rule:** `--color-primary` (sport red) is sacred. Use only for: primary CTA, current step, "live" indicators, primary brand accents. Form validation errors use `--color-error` (orange-ish red) to visually distinguish from brand red.

**Rule:** Red is sacred. Use only for: primary CTA, current step, destructive actions, "live" indicators. Never decorative.

### 1.3 Typography

- **Display** (step titles, big numbers): `Inter` weight 800, tight tracking (-0.02em), uppercase optional for stat-like values.
- **Body**: `Inter` weight 400/500.
- **Mono** (weight categories like "70 KG", prize amounts): `JetBrains Mono` or `IBM Plex Mono`, weight 600.

Sizes:
- H1 (step title): 32px / 1.1
- H2 (section): 20px / 1.3
- Body: 15px / 1.5
- Label: 12px / 1.4, uppercase, letter-spacing 0.08em
- Mono stat: 18-24px

### 1.4 Spacing & Layout

- Base unit: 4px. Use 4/8/12/16/24/32/48/64.
- Form max-width: **720px** centered. Wizard chrome (header, progress, footer) extends full-width.
- Section gap inside a step: 32px.
- Input height: 48px (chunky, easy to hit).
- Border radius: **6px** for inputs/buttons, **10px** for cards. Not pill-shaped, not sharp.

### 1.5 Components — visual rules

**Buttons**
- Primary CTA: solid red background, white text, weight 600, no shadow.
  Hover: lighter red + 1px translate-y.
  Active: darker red, no translate.
- Secondary: transparent background, 1px white-10% border, white text. Hover: surface-2 background.
- Ghost: text only, secondary color. Hover: primary color.
- Destructive: same as primary but using `--accent-red` always — paired with confirmation.

**Inputs**
- Black-ish surface (`--bg-surface-2`), 1px `--border-default` border, 14px horizontal padding.
- Focus: 1px `--accent-red` border + 3px `--accent-red-dim` glow ring (no default browser focus).
- Error: 1px red border + small red message under, animated slide-in.
- Label sits **above** input, uppercase 12px secondary color.
- Helper text: 13px muted, under input.

**Radio / Toggle groups** (used for competition type, hand)
- Card-style: each option is a clickable card with icon + title + 1-line description.
- Selected: red border + red-dim background + small red dot top-right.
- Unselected: default border, hover lifts border to strong.
- Layout: horizontal flex on desktop, stack on mobile.

**Chips** (used for weight categories)
- Pill chip with 1px border, 12-14px text, mono font for the number.
- Selected: red filled, black text. Unselected: outline only.
- "Add custom" is a chip with `+` icon, dashed border.

**Cards (containers for prizes, weight category previews)**
- Surface background, 1px border, 10px radius, 16-20px padding.
- "Place 1" badge in corner uses gold/silver/bronze tint for prizes 1/2/3, else neutral.

### 1.6 Iconography
- `lucide-react` (already in shadcn ecosystem).
- 18-20px size, 1.5px stroke. Match text color, never decorative.

### 1.7 Motion
- Step transition: 240ms ease-out, slight slide (12px) + fade.
- Button hover: 120ms.
- Error shake: 240ms 2-cycle, 4px horizontal.
- No bouncy springs. Sharp easings only (`cubic-bezier(0.2, 0, 0, 1)`).

---

## 2. Wizard Shell (shared chrome on every step)

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back to tournaments]              [Save draft]   [Cancel]  │  ← top bar
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   01 ━━━━━ 02 ━━━━━ 03 ━━━━━ 04                                  │  ← progress
│   BASIC    FORMAT  CATEGORIES REGISTRATION                        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    [step content, max-w-720]                     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  [← Previous]                              [Next: Format →]     │  ← sticky footer
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Top Bar
- Height 56px, `--bg-base` background, bottom 1px `--border-default`.
- Left: back link with arrow, secondary color.
- Right: "Save draft" (ghost button, secondary), "Cancel" (ghost, opens confirm modal if dirty).
- Sticky on scroll.

### 2.2 Progress Indicator
- Centered, 64px tall section below top bar, `--bg-surface` background.
- 4 numbered nodes connected by lines.
- Node states:
  - **Done** (`✓` icon, success color filled circle, line after it red-filled)
  - **Current** (red-filled circle with white number, slightly larger, red glow)
  - **Upcoming** (border circle, muted number, dashed line after)
- Click on done step → jumps back. Upcoming steps not clickable.
- Step name under node, uppercase 11px.
- On mobile: collapse to "Step 2 of 4 — FORMAT" + thin bar (red filled, dark unfilled).

### 2.3 Sticky Footer
- Height 72px, `--bg-base`, top 1px border.
- Left: "← Previous" ghost button (hidden on step 1).
- Right: primary red CTA. Label changes per step:
  - Step 1: "Next: Format →"
  - Step 2: "Next: Categories →"
  - Step 3: "Next: Registration →"
  - Step 4: "Create tournament" (no arrow, fills more weight)
- CTA disabled state: 50% opacity, not-allowed cursor, tooltip "Fill required fields".

### 2.4 Save Draft Behavior
- Calls existing `POST /v1/tournaments` with `status: 'draft'`, partial fields allowed.
- Toast confirmation top-right, auto-dismisses after 3s.
- "Saving..." inline spinner replaces button text during request.

### 2.5 Cancel / Leave Guard
- If form is dirty (any field changed), clicking Cancel or browser-back triggers modal: "Discard changes? Your tournament won't be saved."
- Modal: dark overlay, surface card, two buttons "Keep editing" (ghost) + "Discard" (red).

---

## 3. Step 1 — Basic Information

**Goal:** identify what the tournament is and when/where it happens.

### 3.1 Sections (in order)

#### 3.1.1 Hero / Poster Upload
- Full-width drop zone, 16:9 aspect ratio, 200px tall.
- Empty state: dashed border, centered icon (image-plus), text "Drop poster or click to upload", helper "JPG, PNG, WebP — up to 5MB".
- Hover: red dashed border + red-dim background.
- Filled: image preview + small "Replace" + "Remove" buttons in top-right corner overlay.
- Uploading: image preview at 50% opacity + centered spinner + progress %.

#### 3.1.2 Identity (2-column on desktop)
- **Tournament name*** (full width row above the 2-col grid)
  - Big input (56px tall, 18px text). Placeholder: "e.g. Yerevan Open 2026"
  - Below input: live slug preview (muted, mono): `gsm-sports.com/tournaments/yerevan-open-2026`
- **Sport*** (col 1) — custom dropdown (not native select):
  - Trigger shows sport icon + name.
  - Open: dark dropdown, search at top, list with icons.
- **Format** (col 2) — three card-pills inline:
  - "Single elim" / "Double elim" (default selected, recommended badge) / "Round robin"
  - Each card: 80px tall, icon + name + 1-line description.

#### 3.1.3 Schedule (2-column)
- **Start date*** + time, datetime-local with custom popover calendar.
- **End date** (optional) — shows hint "Leave empty for single-day".
- Validation: end ≥ start. Inline error if violated.

#### 3.1.4 Location (3-column, collapses to 1 on mobile)
- **Country** — country picker (existing component) with flag.
- **City** — text input, autocomplete from previously-used cities (nice-to-have, optional v1).
- **Venue** — text input. Placeholder: "e.g. Karen Demirchyan Arena"

#### 3.1.5 Description (full-width)
- Textarea, 6 rows, monospace-friendly. No rich-text in v1.
- Tabs above for languages: `RU` (active) / `EN` / `HY`. Switching tabs shows respective field.
- Helper: "Russian is the primary language. EN/HY are optional but recommended for international visibility."
- Character counter bottom-right, soft limit 2000.

### 3.2 Validation rules (Step 1)
- Required to advance: `name` (3-300 chars), `sportId`, `startDate`.
- On Next click with errors: shake the form, scroll to first error, focus it, show inline messages.

### 3.3 Empty / Loading / Error states
- Sport dropdown loading: skeleton trigger.
- Sport dropdown error: red border + "Couldn't load sports. Retry" with retry button inside trigger.
- Poster upload error: replace zone with red-tinted error message + retry.

---

## 4. Step 2 — Format Configuration

**Goal:** lock in the rules of competition. This step is highly conditional based on sport/competition type.

### 4.1 Sections

#### 4.1.1 Competition Type
Two big cards side by side, mutually exclusive:

- **SETKA** (bracket tournament)
  - Icon: brackets/tree
  - Subtitle: "Single/double elimination bracket. Multiple matches per athlete."
  - Selected by default.
- **ARMFIGHT** (single-match exhibition)
  - Icon: lightning / hand
  - Subtitle: "One-off match between named athletes. Often title fights."

Cards: 160px tall, large icon top, title 18px, description 13px secondary.

#### 4.1.2 Age Groups (only visible if SETKA)
- Section title: "Age groups"
- Helper: "Choose which age categories compete. Skip to allow all ages."
- 3 toggle chips: `Juniors (under 18)` / `Adults (18-39)` / `Veterans (40+)`
- Selected chip: red-filled. Unselected: outline.
- Below chips: live-preview text "Will create N brackets per weight category" (where N = count of selected age groups).

#### 4.1.3 Hand
- Section title: "Arm-wrestling hand"
- Helper: "Which hand do athletes compete with?"
- 3 cards inline: `Right hand` / `Left hand` / `Both hands`
  - "Both hands" card has expanded helper inside: "Each athlete registers separately for left and right — counted as two entries."

#### 4.1.4 Tournament rules (optional, collapsible)
- Closed by default. "Advanced settings ⌄" toggle.
- When open:
  - Max participants per category (number, ≥2). Helper: "Leave blank for unlimited."
  - Match duration limit (seconds, optional, sport-specific).
  - Tiebreaker rule (dropdown: "Higher seed wins" / "Coin flip" / "Extra round").

### 4.2 Validation
- Required to advance: competition type selected, hand selected.
- If SETKA + zero age groups: warning (not blocker) — "All ages will compete in one bracket. Continue?"

### 4.3 Conditional logic
- If user switches SETKA → ARMFIGHT: collapse age groups section with fade, persist values in case they switch back.
- Step 3 (categories) skip-able if ARMFIGHT? **Decision needed:** for v1, keep step 3 mandatory for both — armfight still has weight categories. Visual stays the same.

---

## 5. Step 3 — Weight Categories

**Goal:** define the divisions. The most spreadsheet-like step — needs to feel fast.

### 5.1 Layout

Two-pane on desktop (≥1024px), stacks on mobile:

- **Left pane (60%): Builder**
- **Right pane (40%): Live Preview** (sticky)

#### 5.1.1 Builder

Section A — **Quick presets**
- Section title: "Common weight classes"
- Row of 7-8 preset chips: `50 kg` `60 kg` `70 kg` `80 kg` `90 kg` `100 kg` `110 kg` `+110 kg`
- Click toggles add/remove from list.
- Active chips: red filled with mono number.

Section B — **Custom category**
- Inline form: `[Min kg] - [Max kg]` with `+ Add` button.
- Optional name field for non-standard names ("Heavyweight Pro").
- Validation: min < max, no overlap with existing.

Section C — **Tolerance**
- Slider: 0 → 5 kg, default 0, step 0.1.
- Big mono number on right showing current value: `+1.5 KG`.
- Helper: "Athletes can weigh up to this many kg over their category limit."

Section D — **Per-category gender split**
- Toggle: "Same categories for men and women" (default ON).
- If OFF: the live preview (right pane) splits into M/F columns and each category can be checked per gender.

#### 5.1.2 Live Preview (right pane)

Header: "X categories • Y total brackets"
(Y = X × ageGroups × hands × genders, computed live)

List of category cards, sorted by weight ascending:
- Each card: mono `70 KG` left, range "65.0 – 70.0 kg" middle, hover reveals trash icon right.
- Drag-handle icon allows reordering (manual `sortOrder`).
- Empty state: dotted card "No categories yet. Add from the left."

### 5.2 Validation
- Required to advance: at least 1 category.
- Warn if total brackets > 32 ("Large tournament — consider splitting").

---

## 6. Step 4 — Registration & Prizes

**Goal:** finalize money, deadlines, and rewards. Then preview before creating.

### 6.1 Sections

#### 6.1.1 Registration window
- 2 inputs side by side:
  - **Registration deadline** (datetime-local). Helper: "Last moment athletes can sign up. Defaults to 24h before start."
  - **Registration opens** (boolean toggle): "Open registration immediately on create" — if off, tournament saves as `draft`, registration opens manually later.

#### 6.1.2 Entry Fee
- Toggle group: `Free` (selected by default) / `Paid`
- Free → shows nothing else.
- Paid → reveals:
  - Amount input with suffix `AMD` (mono font, large).
  - "Conditions" textarea (optional). Placeholder: "Refund policy, payment method, deadlines..."

#### 6.1.3 Prizes
- Section title: "Prize pool"
- Empty state card: "Add prizes to motivate participants. Skip if there are none." + `+ Add first prize` red button.
- Filled state: vertical list of prize rows.
- Each prize row:
  - Left: place badge (gold/silver/bronze for 1/2/3, else number-only).
  - Middle: type select (Money / Medal / Trophy / Certificate / Custom).
  - If Money: amount input + `AMD` suffix. Else: description text input.
  - Right: trash icon (hover red).
- Bottom: `+ Add prize` button (full width, dashed border, ghost style).
- Total prize fund (auto-sum of money prizes) shown at top right of section: `Total: 500,000 AMD` (mono, secondary color).

#### 6.1.4 Stream URL (optional)
- Section title: "Live stream"
- Input: URL with helper "YouTube, Twitch, Kick — paste live stream link if you'll broadcast."
- Below: small URL validation indicator (✓ when valid).

#### 6.1.5 Featured flag (only for super-admins — hide if not allowed)
- Toggle: "Feature on homepage"

### 6.2 Final Preview Block

At the bottom of step 4, **before** the create button — a card titled "Review":

```
┌─ TOURNAMENT PREVIEW ─────────────────────────┐
│  [poster thumbnail]  Yerevan Open 2026        │
│                       Armwrestling • SETKA     │
│                       Mar 15, 2026 • Yerevan   │
│                                                │
│  📂 8 weight categories  •  Right hand only    │
│  💰 Free entry  •  500,000 AMD prize pool      │
│  👥 Up to 64 participants                      │
│                                                │
│  [Edit basic info]  [Edit format]  [Edit ...]  │
└────────────────────────────────────────────────┘
```
Edit links jump back to respective steps.

### 6.3 Submit
- Footer CTA: "Create tournament" — full red, weight 700.
- Loading: "Creating..." + spinner. Disable other actions.
- Success: confetti-free toast (we're not bouncy) "Tournament created" → redirect to tournament detail page.
- Failure: inline error block at top of step 4 with details + "Try again" button. Does not lose progress.

---

## 7. Mobile Behavior (≤768px)

- Top bar: only back arrow + step counter. Save/Cancel become a `⋮` menu.
- Progress: thin bar instead of nodes, label "Step 2 / 4 — FORMAT" above.
- Sticky footer collapses to single full-width primary CTA. "Previous" becomes a small back-arrow icon in top bar.
- All 2-column grids collapse to 1.
- Step 3 right pane preview becomes a collapsible "Show preview ⌄" section above the builder.
- Touch targets minimum 44px.

---

## 8. Accessibility

- All inputs have `<label>` (visible or `aria-label`).
- Step changes announced via `aria-live="polite"` ("Step 2 of 4: Format").
- Focus management: on step change, focus moves to step heading.
- Keyboard: `Tab` through fields, `Enter` on focused primary CTA advances step (not in textareas).
- Error messages linked via `aria-describedby`.
- Color is never the only signal: errors have icon + text, not just red.
- Contrast: all text ≥ AA on background.

---

## 9. State Management

- Single Zustand store scoped to this wizard: `useTournamentWizardStore`.
- Persists to `sessionStorage` so refresh doesn't lose data (only the current draft, cleared on submit success or explicit cancel).
- Shape:
  ```ts
  {
    currentStep: 1 | 2 | 3 | 4,
    completedSteps: Set<number>,
    data: Partial<CreateTournamentDto>,
    isDirty: boolean,
    isSavingDraft: boolean,
    isSubmitting: boolean,
    errors: Record<string, string>,
    setField: (key, value) => void,
    goToStep: (n) => void,
    saveDraft: () => Promise<void>,
    submit: () => Promise<Tournament>,
  }
  ```

---

## 10. File Structure (proposed)

```
apps/web/src/app/admin/tournaments/new/
├── page.tsx                          # entry, renders <TournamentWizard />
├── _components/
│   ├── TournamentWizard.tsx          # shell (top bar + progress + footer + step renderer)
│   ├── WizardProgress.tsx
│   ├── WizardFooter.tsx
│   ├── steps/
│   │   ├── Step1Basic.tsx
│   │   ├── Step2Format.tsx
│   │   ├── Step3Categories.tsx
│   │   └── Step4Registration.tsx
│   ├── fields/                       # design-system primitives
│   │   ├── TextInput.tsx
│   │   ├── DateTimeInput.tsx
│   │   ├── SelectableCard.tsx
│   │   ├── ChipToggle.tsx
│   │   ├── PosterUpload.tsx
│   │   └── ...
│   └── PreviewCard.tsx               # final review block
├── _store/
│   └── useTournamentWizardStore.ts
└── _design/                          # ⚠ TEMPORARY playground for design iteration
    └── playground.tsx                # delete before merge
```

---

## 11. Out of scope for v1

- Bulk import categories from CSV.
- AI-suggested categories from sport/level.
- Template tournaments ("clone last year").
- Co-organizers / multi-admin assignment.
- Sponsor logos block.
- Push to social media on create.

These will live in a follow-up doc when prioritized.

---

## 12. Decisions (locked)

1. **Slug**: auto-generated from name on the fly. Below the name input, render a muted preview line `gsm-sports.com/tournaments/<slug>` with a small `✏ Edit slug` link. Clicking it reveals the slug as an editable input; on blur, validates uniqueness via `GET /v1/tournaments/check-slug?slug=...` (debounced 400ms). Slug rules: lowercase, latin letters / numbers / dashes only, 3–80 chars.
2. **Poster crop**: trust the upload as-is. Display in a 16:9 frame with `object-cover`. No client-side cropping in v1.
3. **Multilingual name fields**: single `name` field in step 1. The backend accepts `nameRu/En/Hy` separately, but for create-flow we send the same value to all three (or only `name` + `nameRu` based on locale). Multilingual editing happens on the tournament edit page post-create.
4. **Draft auto-save**: manual only — "Save draft" button in top bar. No background auto-save (avoids leaking abandoned tournaments and confusing organizers).
5. **Permissions**: page guarded by `JwtAuthGuard` + role check (`organizer` OR `admin`). Non-organizers redirected to `/admin` with toast "Only organizers can create tournaments." Backend already enforces this on `POST /v1/tournaments`; we mirror it in middleware so the page itself is gated.

---

## 13. Next steps after this doc is approved

1. Read this doc, mark sections to change/remove.
2. Build Step 1 in `_design/playground.tsx` with mock data only — visual review.
3. Iterate visuals until approved.
4. Extract design primitives to `_components/fields/`.
5. Build steps 2, 3, 4 in same style.
6. Wire Zustand store + React Query mutation.
7. Replace existing `page.tsx`, delete `_design/`.
8. Add tests (vitest) for store logic and validation rules.
