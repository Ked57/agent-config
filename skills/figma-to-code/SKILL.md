---
name: figma-to-code
description: >-
  Build or change UI from a Figma link or frame so it matches the design's exact
  values, every linked state included. Use before fetching any Figma node, and
  when delegating such work (name this skill in the delegate's brief).
---

# Figma to code

The design's numbers are the spec. A screenshot shows what exists, not what a value is:
never read a colour, size, weight or gap off an image.

## 1. Inventory, before any code

1. List every linked frame: each breakpoint and each state (validation errors, empty,
   open menu, unsaved changes). Each one is a deliverable; note how the state is reached.
2. Per frame, `get_design_context`. When it returns an outline instead of code, call it on
   each child section, and descend until every section has returned code. An outline is
   not a fetched design.
3. `get_variable_defs` per frame: keep the variable name → value table.
4. `get_screenshot` per frame, for composition only.
5. When a link returns a node that is not the frame it names (another name, size or layer
   type), call `get_metadata` on the page, find the frame by name and size, and fetch it from
   there. Never build a state you could not open from the other frames.

## 2. Map, written down before building

- **Variables → project tokens.** Read the PrimeVue preset and the Tailwind theme and match
  each variable to the token with the same value (a variable may carry a code syntax: use
  it when present). Use that token wherever the design binds the variable. Hard-code a
  value only when no token matches, and list it.
- **Text styles → size, weight and line height, verbatim.** Never round a weight or swap a
  text colour for a nearby shade.
- **Instances → components, by role, not by name.** A kit "Dropdown" is a Select, a
  "Status chip" a Tag; variant properties map to props (severity, outlined, size). Use the
  PrimeVue or local component for every instance; hand-build only when none has that role,
  and list it. Detached or unnamed layers get the same role check.
- **Per section:** padding, gap, fixed sizes and radius from the generated code; for tables
  and lists, row height and cell padding. Where a component's defaults differ, set the
  design's values on that instance (pass-through, `pt`, or classes), not globally.
- **Gaps next to text → check against the parent.** A text layer's box can be shorter than
  its line height (trimmed text), which makes a generated `gap` too big. When a stack holds
  text, its children's line heights plus gaps and padding must equal the parent's height;
  when they do not, derive the gap from sibling positions and line boxes.
- **Widths → how they flex, not the frame's pixels.** The frames are samples of one layout;
  the screen also runs at every width between and beyond them. Generated code gives each
  container the width it has in that frame: turn fill containers and columns into `1fr`,
  `flex-1`, percentages or `max-w-*` (with `min-w-0` where content can grow), and keep
  fixed sizes for what stays fixed at every width (icons, avatars, sidebars, controls). Put
  the breakpoint where the wider layout stops fitting, not at either frame's width.

## 3. Build

Section by section from the map. Every node in the outline is either built or listed as
deliberately left out; breadcrumbs, helper notes, summaries and inline errors are the usual
misses. Build every state frame, not only the default.

- Text the design shows but the data source lacks: derive it from the data when you can,
  otherwise render it as designed and list it as hard-coded. Never drop it.
- Breadcrumb ancestors are links, to the nearest existing route.
- Numbers in columns, phone numbers and times use the design's figures (`tabular-nums`
  when the text style has tabular figures).
- A state's trigger is any change it implies: any edit to a form control, toggles
  included, enters an unsaved-changes state.

## 4. Compare against each frame

After the behaviour pass (`manual-qa`), for each frame at its exact width and in its state:

1. Screenshot the app and look at it beside the frame's `get_screenshot`.
2. Read the rendered DOM (`agent-browser eval`: `getBoundingClientRect`, computed `color`,
   `background-color`, `font-size`, `font-weight`, `line-height`, `padding`, `gap`,
   `border-radius`) for every section root, every text style and every instance, and
   compare with the map and the section code. Check gaps between siblings, not only
   absolute positions.
3. Fix every difference over 1 px and every colour or weight difference, then measure
   again. Stop when a full pass finds none. The page height and the last element's top
   must match the frame within 1 px; trace a drift to the first pair of siblings whose gap
   differs. Never explain a difference away as rounding or Figma's text boxes.
4. Resize through widths no frame shows (about 600, 768, 1024, 1280 and 1920 px): the page
   never scrolls sideways, nothing sticks out of the viewport or overlaps, and nothing
   disappears. A fix here must leave the frames matching.

## Report

Per frame, the differences found and fixed. List hand-built components, variables without a
matching token, and nodes left out.
