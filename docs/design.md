# DapUp visual design system (milestone 3)

Futuristic Y2K editorial direction: near-black foundation, layered blue-gray
panels, chrome-silver accents, editorial display type against technical
monospace microtype. Inspired by Y2K editorial atmosphere and metallic
restraint as mood only — no third-party artwork, lettering, or branding is
copied or committed.

## The seven-color base palette

These are the **only** base UI colors. Alpha/transparency variants and
gradients composed from them are allowed; nothing else is (no pure black,
pure white, Tailwind grays, or accent hues).

| Token (`globals.css`) | Hex | Role | Target visual weight |
| --- | ---: | --- | ---: |
| `--dap-ink` | `#0D0C0E` | Near-black foundation | ~31% |
| `--dap-abyss` | `#343851` | Dark blue-gray | ~9% |
| `--dap-steel` | `#4F536F` | Main blue-gray | ~13% |
| `--dap-slate` | `#666C8A` | Mid blue-gray | ~12% |
| `--dap-fog` | `#878D9F` | Light steel blue-gray | ~6% |
| `--dap-chrome` | `#B8BAC3` | Chrome silver | ~12% |
| `--dap-frost` | `#E8E8E7` | Soft white | ~16% |

## Semantic token mapping

All mapping lives in `src/app/globals.css`; components consume only semantic
tokens (`bg-background`, `bg-card`, `text-muted-foreground`, …), so the whole
identity can be retuned in one file.

| Semantic token | Palette source |
| --- | --- |
| Page background (`--background`) | ink |
| Primary foreground (`--foreground`) | frost |
| Elevated surface (`--card`) | abyss 34% over ink (blue-tinted near-black) |
| Popover surface (`--popover`) | abyss 42% over ink |
| Subtle surface (`--muted`) | abyss 26% over ink |
| Strong surface (`--secondary`, `--accent`, `--surface-strong`) | steel |
| Muted foreground (`--muted-foreground`) | chrome |
| Border (`--border`) | slate @ 52% alpha |
| Input (`--input`) | abyss @ 45% alpha |
| Focus ring (`--ring`) | chrome |
| Primary action (`--primary` / fg) | frost / ink |
| Secondary action (`--secondary` / fg) | steel / frost |
| Destructive treatment (`--destructive`) | frost — see below |
| Chrome highlight (`--dap-chrome`, `.chrome-text`, `--gradient-chrome`) | frost→chrome→fog sweep |
| Overlay (`--overlay`) | ink @ 72% alpha |

### Weight strategy

No runtime percentage math. The balance is approximated structurally, and it
follows the reference's core rule: **blue-gray is atmosphere, not surface**.
Panels are near-black with a blue-gray tint; solid steel/slate appears as
atmospheric washes (hero field), small accents (secondary buttons, badges),
and decorative geometry. Contrast comes from oversized soft-white type,
near-black masses, one bold light band (the selected-network panel, frost on
ink-text), and scarce chrome — focus rings, hover borders, metallic rules,
gradient text.

### Destructive/error without red

The palette has no red, so destructive and error affordances rely on shape +
label + contrast, never color alone:

- Destructive buttons (`variant="destructive"`, e.g. Block): 2px solid
  foreground border, uppercase monospace label, inverts to frost-on-ink on
  hover.
- Validation errors: `p[role="alert"]` renders with a hard 2px left bar,
  medium weight, full-contrast text, and is announced via `role="alert"` with
  `aria-invalid`/`aria-describedby` on the field.
- Lifecycle states (pending / connected / ended / disconnected / blocked) pair
  text labels with icons (clock, link, circle-off, ban) and border styles
  (dashed = pending).

## Typography (three levels)

1. **Editorial display — Syne** (`--font-display`, Google Fonts, OFL):
   homepage statements, section openings, page titles. Sized with `clamp()`
   on the hero.
2. **Product UI — Geist** (`--font-sans`, Vercel, OFL): all body copy, forms,
   messages. Legibility first.
3. **Technical microtype — Geist Mono** (`--font-geist-mono`): the
   `.tech-label` utility (11px, +16% tracking, uppercase) for metadata,
   indices, statuses, and decorative annotations (decorative instances are
   `aria-hidden`); also timestamps and result counts.

The `DapUp*` wordmark is a temporary text-only treatment; the owner supplies
a permanent logo later.

## Motifs and utilities

- `.chrome-text` — palette-only multi-stop metallic gradient text.
- `.grid-lines` — thin technical grid (slate @ 14%).
- `.metal-border` — fine metallic gradient border for emphasized panels
  (Connect card, connected-price panel, network explainer).
- `.grain` — subtle palette-derived CSS noise (hero only, never behind
  message text).
- `.tech-label` — technical microtype.
- `.animate-rise` — short mechanical entrance (hero only); a global
  `prefers-reduced-motion` rule collapses all animation/transitions.

Chrome is deliberately scarce: hover/focus emphasis, one gradient headline
moment, thin rules. Forms and conversations carry no decoration.

## Page intensity

- **Homepage** — full editorial: grid-lined hero, oversized Syne headline with
  one chrome sweep, staggered entrance, offset process panels, metallic
  network explainer, mission with editorial opener.
- **Directory** — premium restraint: layered card sidebar, mono result count,
  chrome hover borders on cards, cool-toned initial avatars.
- **Mentor detail** — human/aspirational: prominent portrait ring, editorial
  name, scannable mono section labels, metal-bordered Connect panel.
- **App shell / requests / connections** — calm surfaces, icon+label states,
  admin area labeled as a capability.
- **Messaging** — most restrained: token surfaces only, mono timestamps,
  chrome only via focus ring.
- **Forms / legal** — minimal decoration, comfortable measure, mono date and
  section labels as the only accent.
