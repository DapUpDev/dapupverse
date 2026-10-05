---
name: DapUp
description: One calm desk where a student's request, the mentors' cards and the next step lie on white paper.
colors:
  desk: "#eceef2"
  sheet: "#ffffff"
  ink: "#16181d"
  ink-2: "#454a54"
  ink-3: "#5e6470"
  mark: "#d8f04a"
  destructive: "#b42318"
  secondary: "#e2e5ea"
  accent: "#e9ebef"
  muted: "#f2f3f6"
  border: "rgb(22 24 29 / 0.12)"
  input: "rgb(22 24 29 / 0.42)"
  perforation: "rgb(22 24 29 / 0.25)"
  overlay: "rgb(22 24 29 / 0.38)"
typography:
  display:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "clamp(2.6rem, 4.6vw + 0.6rem, 5rem)"
    fontWeight: 640
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  section:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  lede:
    fontFamily: "Geist, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  meta:
    fontFamily: "Geist, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  mark: "3px"
  photo: "4px"
  sheet: "6px"
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  bubble: "1.125rem"
  full: "9999px"
spacing:
  gutter: "16px"
  gutter-sm: "24px"
  gutter-lg: "40px"
  sheet-stack: "12px"
  sheet-pad: "20px"
  sheet-pad-md: "24px"
  sheet-pad-lg: "32px"
  group: "56px"
  section: "96px"
  section-lg: "128px"
components:
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "20px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-primary-lg:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.muted}"
  button-ghost:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.destructive}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-destructive-hover:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.sheet}"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "40px"
  chip-connected:
    backgroundColor: "{colors.mark}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "24px"
  chip-pending:
    textColor: "{colors.ink-2}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "24px"
  chip-ended:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink-2}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "24px"
  chip-blocked:
    textColor: "{colors.destructive}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "24px"
  unread-count:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.sheet}"
    typography: "{typography.meta}"
    rounded: "{rounded.full}"
    padding: "0 6px"
    height: "20px"
  blank:
    backgroundColor: "{colors.mark}"
    textColor: "{colors.ink}"
    rounded: "{rounded.photo}"
    padding: "0 1.5em 0 0.3em"
  id-photo:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.photo}"
    size: "80px"
---

# Design System: DapUp

## Overview

**Creative North Star: "The Desk"**

DapUp is the desk a mentor sits down at. The page is the desk surface, a cool pale grey. Everything a person reads or operates lies on white paper sheets with a small radius and a soft shadow. The ink is graphite. There is one highlighter, and it only marks what is chosen, matched or done. The result is calm, soft and precise: a companion to the essays open in the next tab, never corporate software and never a show.

The system is light only by design; there is no dark theme, and `dark:` styles are tied to a class that is never set. Density is moderate: generous space between groups, tight space inside them, and reading text held to a 65 to 75 character measure. Type does the structural work. Bricolage Grotesque sets headlines and names; Geist sets everything that is read or operated. Colour is almost absent, which is what lets the highlighter and the single red mean something.

Motion is physical and brief. Things move by transform and opacity only, from where they already are, on one critically damped ease (`cubic-bezier(0.16, 1, 0.3, 1)`). A control answers on press, not on release (buttons scale to 0.97 in 150ms). Popups grow from their trigger (scale 0.95 to 1, 150ms) and leave the way they came; the dialog does the same from 0.97 in 200ms; the mobile drawer slides in from the right in 300ms; a sheet that travels, like a mentor card coming to the front of the fan, takes 600ms. Nothing animates in on load and nothing reveals on scroll. A control's colour and focus ring may ease over 150ms; a sheet's shadow changes at once. `prefers-reduced-motion` collapses every transition and animation globally, and `prefers-reduced-transparency` makes the header opaque.

**Key Characteristics:**
- One desk, one level of paper, one highlighter, one red.
- Graphite ink on white sheets; state carried by a text label and a drawn mark.
- Headlines in Bricolage Grotesque with the optical-size axis; everything else in Geist.
- Square ID photos for people who are credentials; round pictures only inside messaging.
- Press feedback and travel from the current position; no entrance animation.

## Colors

A near-monochrome cool palette: pale desk, white paper, graphite ink, with one yellow-green highlighter and one red, each holding a single job.

### Primary
- **Graphite Ink** (`ink`, #16181d): all primary text, the one filled button of a view, focus rings, the text caret. It is the system's "primary"; there is no brand hue.

### Secondary
- **Highlighter** (`mark`, #d8f04a): the only chromatic voice besides red. It marks what is chosen (the fill-in blanks, a filter chip's value, the checked item in a menu or select, the underline under the current nav item, a ticked choice in a form), what matched (the facts on a mentor card that answered the search) and what is done (the Connected and "Profile complete" chips, the ticked ring on "inbox zero", the success toast's tick). Text on it is always ink. It is also the selection colour.

### Tertiary
- **Red** (`destructive`, #b42318): errors (field errors, invalid field edges, the error toast icon), destructive actions (block, disconnect, remove: red text on paper that fills red on hover) and every unread count (the total beside Messages in the header, the count on a conversation row). Nothing else.

### Neutral
- **Desk** (`desk`, #eceef2): the page ground. Also the translucent header (80% with blur) and the scrollbar track.
- **Paper** (`sheet`, #ffffff): every sheet, popup, field and outline button. Also the text on ink and on red.
- **Ink 2** (`ink-2`, #454a54): secondary text: ledes, descriptions, inactive nav links.
- **Ink 3** (`ink-3`, #5e6470): meta text: timestamps, counts, helper text, placeholders, definition terms. Nothing readable goes lighter than this.
- **Quiet fills** (`muted` #f2f3f6, `accent` #e9ebef, `secondary` #e2e5ea): three steps of pale grey for hover and press on paper, the highlighted menu row, the active conversation row, the user's own message bubble, initials behind a missing photo, skeletons and the Ended chip.
- **Hairline** (`border`, ink at 12%): dividers inside a sheet and the edge of the other person's message bubble.
- **Control edge** (`input`, ink at 42%): the edge of inputs, textareas, selects and checkboxes, dark enough to read as a field against white.
- **Perforation** (`perforation`, ink at 25%): the dashed line between two parts of one sheet, the dashed outline of an empty slot, and the edge of outline buttons and filter chips.
- **Overlay** (`overlay`, ink at 38%): the dimmed desk behind a dialog or drawer.

### Named Rules
**The One Highlighter Rule.** The highlighter means exactly one of: this is chosen, this matched, this is done or connected. It is never a count, never decoration, never a hover colour, never a large background, and its text is always ink.

**The One Red Rule.** Red means an error, a destructive action, or an unread count, wherever that count appears. If something is merely important, it is ink.

**The Label And Mark Rule.** State is never colour alone. Every state carries a text label and a drawn mark: a dashed ring for pending, a ticked ring for connected, a struck ring for ended or read-only, a barred circle for blocked.

## Typography

**Display Font:** Bricolage Grotesque, variable with the optical-size axis (with sans-serif)
**Body Font:** Geist (with sans-serif)

**Character:** A slightly idiosyncratic grotesque set tight and heavy for headlines and names, over a plain, even workhorse for everything read or operated. The contrast is in scale and tracking, not in decoration.

### Hierarchy
- **Display** (640, `clamp(2.6rem, 4.6vw + 0.6rem, 5rem)`, line-height 1, -0.035em): the landing headline only.
- **Headline** (600, 2.25rem rising to 3rem from 640px, line-height 1.05, -0.03em): the one title of a page. The landing page's second-level statement uses the same voice at `clamp(1.9rem, 2.4vw + 1rem, 3rem)`.
- **Section** (600, 1.5rem, -0.025em): a heading over a group of sheets, a dialog title.
- **Title** (600, 1.25rem, tight leading, -0.025em): a person's name on a sheet, an empty-state heading, the wordmark in the header.
- **Lede** (Geist 400, 1.125rem, ink-2): the paragraph under a headline, capped near 34 to 36rem.
- **Body** (Geist 400, 1rem; 0.875rem for secondary copy and inside controls from 768px): reading text, capped at 65ch. Legal text runs at line-height 1.75 on a 40rem sheet, with Geist 600 1.25rem subheadings.
- **Label** (Geist 500, 0.875rem; 0.8125rem in small buttons and filter chips): buttons, field labels, nav links. Sentence case.
- **Meta** (Geist 400, 0.75 to 0.875rem, ink-3): timestamps, counts, helper text, chip labels (500).

A sentence the visitor completes or that tells the product's story (the fill-in sentence, the request-life paragraph on the landing page) is set in the display face at weight 500, 1.25 to 1.75rem, with loose leading (1.6 to 1.75) so inline blanks and chips have room.

### Named Rules
**The Two Voices Rule.** Bricolage Grotesque is for headlines, names and the sentence the visitor completes. Everything else is Geist. No third face, and no monospace for looks.

**The Steady Numbers Rule.** A number that can change (counts, dates, prices, unread totals) uses tabular figures.

**The Plain Label Rule.** Labels are sentence case at normal tracking. No uppercase tracked labels, and the heaviest weight is 600 (640 for the landing headline alone).

## Layout

Every page shares one container (the `page` utility): centred, 80rem maximum, with 16px gutters that grow to 24px at 640px and 40px at 1024px. Pages start 24 to 40px under the 64px sticky header (the landing page 12 to 24px) and end with 96px of desk. A page has one title, set with the `page-title` utility; paper is the `sheet` utility. Reading and form pages narrow inside that container: 48rem for lists of requests and connections, 42rem for profile forms, 40rem for legal text, 26rem for sign-in.

Sheets lie on the desk in a single column or a simple grid; sheets in a list sit 12px apart, groups of sheets 56px apart, and landing-page sections 96 to 128px apart. Padding inside a sheet scales with its importance: 20px for a card, 24 to 32px for a working sheet, up to 64px for the sheet that leads a page. There is more space above a heading than below it.

The landing page's first viewport is the one composed arrangement: a large lead sheet on the left and, from 1024px, a fan of up to three mentor cards on the right, overlapping the sheet's edge by 4.5rem, the two behind rotated about one degree. The fan holds only the mentors who match the sentence (with no match, whoever is here); the rest wait hidden where the last card lies, and the fan shifts by transform so it always starts at the top of the sheet. Below 1024px the fan becomes a plain list of the first two cards. Messaging is a two-pane layout from 1024px and one pane below it, with the conversation sheet filling the window under the header.

### Named Rules
**The One Level Of Paper Rule.** A sheet never sits inside a sheet. Inside a sheet, separate with space, a hairline, or a dashed perforation. A message bubble, a filter chip and a field are flat shapes on paper, not paper: they carry no shadow.

## Elevation & Depth

Depth is literal: paper resting on a desk. There are three shadows and no tonal layering. Shadows are soft, cool (ink at low alpha) and never offset sideways.

### Shadow Vocabulary
- **Paper** (`box-shadow: 0 1px 0 rgb(22 24 29 / 0.04), 0 1px 3px rgb(22 24 29 / 0.09)`): a sheet at rest. The default for every sheet.
- **Sheet** (`box-shadow: 0 1px 0 rgb(22 24 29 / 0.04), 0 2px 4px -1px rgb(22 24 29 / 0.06), 0 22px 44px -22px rgb(22 24 29 / 0.28)`): a lifted sheet. The one sheet that leads a page (the landing lead sheet, a mentor's profile, a profile form, legal text, sign-in), the cards in the landing fan, and a clickable sheet under hover or focus.
- **Pop** (`box-shadow: 0 1px 2px rgb(22 24 29 / 0.08), 0 16px 32px -12px rgb(22 24 29 / 0.28)`): anything floating above the desk: menus, select lists, dialogs, the drawer, toasts. Always paired with a 1px ring of ink at 10%.

### Named Rules
**The Lead Sheet Rule.** At most one sheet per page is lifted at rest; the landing page's fan of cards, stacked over its lead sheet, is the single exception. Everything else rests, and lifts only in answer to hover or focus.

**The One Blur Rule.** The sticky header is the only translucent, blurred surface (desk at 80%, 16px blur), so the page scrolls under it without a divider. Blur is never decoration.

## Shapes

Corners are small and get smaller as things get more paper-like. A sheet has a 6px radius; a photo, a checkbox and a fill-in blank 4px; a highlighter stroke on a chip 3px. Controls are a little rounder than paper so they read as things to press: buttons, fields, filter chips, menus and alerts at 10px, nav links and skeletons at 8px, state chips and menu rows at 6px. Full pills are reserved for counts. Message bubbles are the one soft shape (18px, with the corner nearest the speaker tightened to 6px).

People appear as square ID photos (4px radius, 80px on a card, 96 to 112px on a profile, 96px in the landing page's grid of the group, 48px on a request) because on a card or a form the picture is a credential. Inside messaging, where the person is already known, pictures are round (36 to 40px). Every picture carries a 1px hairline edge, and a missing picture shows ink initials on a quiet fill.

Borders are 1px throughout. A solid hairline divides; a dashed line means a perforation between parts of one sheet, a pending state, or an empty slot waiting to be filled. Icons are Lucide outlines at a 1.75 stroke, 16px in controls and 14px in chips.

## Components

### Buttons
Quiet, flat and exact; they answer the press, not the release.
- **Shape:** gently rounded (10px), 36px high with 14px side padding; small 32px; large 44px with 20px padding and 16px text for a page-level action; square icon buttons at 36 and 32px.
- **Primary:** ink fill, white Geist 500 label. One per view. Hover lightens the fill to 85%.
- **Outline:** paper fill with a perforation-strength edge (ink at 25%); hover fills `muted`. The secondary action.
- **Ghost:** no fill or edge; hover fills ink at 6%. Tertiary actions and icon buttons.
- **Destructive:** paper fill, red label, red edge at 40%; hover fills red with white text.
- **Press / Focus / Disabled:** scales to 0.97 on press over 150ms ease-out (a button that opens a popup does not scale). Focus shows an ink edge plus a 3px ring of ink at 30%. Disabled is 50% opacity.

### Chips
- **State chip:** 24px high, 6px radius, 12px Geist 500, a 14px drawn mark then the label. Pending: dashed edge (ink at 40%), ink-2 text, dashed ring. Connected: highlighter fill, ink text, ticked ring. Ended: `secondary` fill, ink-2 text, struck ring. Blocked: red edge at 40%, red text, barred circle. This one chip is shared wherever a state is shown: requests and connections, the Connected state on a mentor's page, and profile completeness (ticked for complete, dashed for incomplete). Chips may sit inline in a sentence.
- **Filter chip:** the height of the small button beside it (32px), 10px radius, paper fill with an ink-25% edge, clipped into segments: icon and field name in ink-2, "is" in ink-3, the chosen value as a 3px-radius highlighter stroke, and a remove button behind a hairline. Segments fill `muted` on hover and `secondary` on press, and draw their focus ring inside.
- **Count pill:** 20px, fully round, 12px Geist 600, tabular, red with white text. It is used only for unread counts: the total beside Messages in the header and the count on a conversation row.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** paper on the desk.
- **Shadow Strategy:** Paper at rest; Sheet for the lead sheet and for hover or focus of a clickable sheet (see Elevation & Depth).
- **Border:** none. Inside, a hairline or a dashed perforation; actions at the foot of a request sheet sit under a perforation.
- **Internal Padding:** 20px for a card, 24 to 32px for a working sheet, 28 to 64px for a lead sheet.
- **A sheet that is one link:** the link lives on the title and stretches over the whole sheet; hover lifts the sheet and focus lifts it and draws a 2px ink ring around it.
- **Empty states:** a sheet with a 34px drawn mark, a Title, one line of ink-2 text and at most one button. Where a list simply has nothing in it yet, a dashed outline on the desk instead of a sheet.
- **Notes:** an alert is a note, not a sheet: `muted` fill, a hairline edge, 10px radius, ink title and ink-2 text, with one look only. It may lie on the desk or on paper.
- **Facts:** a definition list under a hairline, ink-3 term on the left in an 11rem column and the value on the right, stacked below 640px.
- **Loading:** quiet-fill blocks (`secondary`, 8px radius, a slow opacity pulse) lying where the real content will.

### Inputs / Fields
- **Style:** paper fill, 1px control edge (ink at 42%), 10px radius, 40px high, 16px text (14px from 768px). Textareas grow with their content from 80px. Label above in Geist 500 14px; helper text below in 14px ink-3; fields on one sheet sit 20px apart.
- **Focus:** the edge turns ink and a 3px ring of ink at 15% eases in over 150ms.
- **Error / Disabled:** red edge with a 3px red ring at 20%, and the message below in red with `role="alert"`. Disabled fills `muted` at 60% opacity.
- **Checkbox:** 16px, 4px radius, control edge. In a multi-choice list the label of a ticked option takes a highlighter stroke.
- **Menus and selects:** a paper popup (10px radius, Pop shadow, 4px inner padding) that grows from its trigger. Rows are 6px-radius; the row under the pointer fills `accent`; the chosen row fills highlighter and, when also under the pointer, gains a 1.5px inset ink ring.

### Navigation
- **Header:** sticky, 64px, desk at 80% with blur, no divider. The wordmark is "DapUp" in the Title style. Links are 14px Geist in ink-2, turning ink on hover; the current page is ink at weight 500 with a 3px rounded highlighter underline. The unread count sits beside Messages. Signed-out actions are a small ghost "Sign in" and a small primary "Create account".
- **Mobile:** below 768px the links move into a 18rem paper drawer that slides from the right over the overlay; rows are 16px text that fill `accent` on hover.
- **Footer:** plain text on the desk: the wordmark, one ink-2 line and two underline-on-hover links.
- **Links in text:** ink, underlined at 1px with a 0.2em offset.

### Dialogs and toasts
A dialog is a sheet laid over the dimmed desk: 6px radius, 24 to 32px padding, 28rem maximum, Pop shadow, a Section-style title and a ghost close button. It is used only where the task needs an interruption (sending a request, being asked to sign in first). Toasts are paper with the Pop shadow; success carries a highlighter-filled tick and an error a red mark.

### The Fill-In Sentence
The landing page's signature: a sentence in the display face whose choices are native selects drawn as highlighted text (highlighter fill, 4px radius, a small ink chevron, sized to their content). Hover draws a 2px ink outline; press scales to 0.98. Changing a blank re-deals the fan beside it to the mentors who match, and the facts that matched are highlighted on each card. The status line under the sentence links to the directory with the sentence's choices as its starting filters.

### The Mentor Card
A 20px-padded sheet: an 80px square ID photo, the name as a Title, major and university in ink-2, then a short definition list ("Studied", "Helps with", "Knows") with ink-3 terms in a fixed 5.25rem column. It ends with an "Ask <first name>" affordance and an arrow: primary on the card that leads, outline on the rest. A mentor's price never appears on it.

## Do's and Don'ts

### Do:
- **Do** put everything a person reads or operates on a white sheet (6px radius, Paper shadow) on the desk, and keep the desk itself empty of anything but headings, short ledes and the footer.
- **Do** use the highlighter only for chosen, matched or done, with ink text on it.
- **Do** give every state a text label and a drawn mark (Lucide outline, 1.75 stroke): dashed ring pending, ticked ring connected, struck ring ended, barred circle blocked.
- **Do** keep one primary (ink) button per view; outline for the second action, ghost for the third, destructive for block, disconnect and remove.
- **Do** set headlines, names and the completed sentence in Bricolage Grotesque at 600; set everything else in Geist; keep meta text at ink-3 or darker.
- **Do** separate parts of one sheet with space, a hairline, or a dashed perforation (1px dashed, ink at 25%).
- **Do** move things with transform and opacity only, from where they already are; give press feedback on the press; let popups grow from their trigger and leave the way they came.
- **Do** honour `prefers-reduced-motion` and `prefers-reduced-transparency`; both are handled globally and new work must not bypass them.
- **Do** use tabular figures for any number that can change, and cap reading text at 65 to 75 characters.

### Don't:
- **Don't** put a small label, kicker, eyebrow or index above a heading. The heading stands alone. (Field labels and the terms in a definition list are not kickers.)
- **Don't** use monospace for looks, uppercase tracked labels, or gradient text.
- **Don't** number sections or add decorative arrows, slashes or "scroll" prompts.
- **Don't** put a sheet inside a sheet, or build a page from a row of identical icon cards or metric tiles.
- **Don't** use the highlighter as decoration, as a hover colour or as a large background, and don't use red for emphasis.
- **Don't** show state by colour alone.
- **Don't** animate anything in on load, reveal on scroll, or loop motion; the loading skeleton's pulse and a toast's spinner are the only repeating motion.
- **Don't** use hard offset shadows, a coloured side border thicker than 1px, or blur and glass anywhere but the sticky header.
- **Don't** use emoji or unicode glyphs as icons.
- **Don't** open a dialog where the task needs no interruption.
- **Don't** add a dark theme or `dark:` styles, a second accent colour, or a third typeface.
