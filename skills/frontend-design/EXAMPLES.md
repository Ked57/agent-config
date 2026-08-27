# Frontend design exemplars

Read the section that matches the repository's stack after the design plan and before markup. Product tokens, `DESIGN.md`, and existing primitives outrank every external example.

Use these sources for structure, density, and state coverage. Copy a palette only when the brief left color unspecified.

## Default looks to beat

AI-generated UI currently clusters around three templates: warm cream with a high-contrast serif and terracotta; near-black with one acid-green or vermilion accent; broadsheet hairlines, zero radius, dense columns. They are legitimate when the brief asks for them. Otherwise spend that freedom on a direction that belongs to this product.

## shadcn / React

Prefer the project's `components/ui` primitives. Compose forms with `FieldGroup`, option sets with `ToggleGroup`, and semantic color tokens (`background`, `foreground`, `muted`, `destructive`) rather than one-off hex. If the official `shadcn` skill or registry MCP is installed, use it to search and add components instead of inventing props.

Clone structure from:

- Official blocks: [ui.shadcn.com/blocks](https://ui.shadcn.com/blocks) — sidebar, login, charts, data table.
- Official examples in the shadcn/ui repo (`apps/v4` examples: dashboard, mail, tasks, music).
- [Origin UI](https://www.originui.com) — forms, settings, empty states, tables.
- [Tailark](https://tailark.com) — marketing blocks, only when the surface is marketing.

A settings page is a `Sidebar` or stacked sections plus `FieldGroup`, not a grid of identical cards. A data view is a toolbar, filters, table, pagination, and an empty state with one next action.

## PrimeVue / Vue

Reuse the repository's PrimeVue preset (Aura, Lara, Nora, or a `definePreset` extension) and existing components. Change look through primitive and semantic tokens; one-off utility overrides are last resort.

Clone structure from:

- [Sakai Vue](https://github.com/primefaces/sakai-vue) — canonical open admin density, data table, and form layout.
- [PrimeVue theming](https://v4.primevue.org/theming/styled) — primitive → semantic → component tokens.

A PrimeVue page should look like a token-themed PrimeVue app, not a shadcn card grid restyled with `pt` hacks.

## Vanilla / CSS

Compose with layout primitives (stack, cluster, sidebar, switcher) rather than a page of nested cards. Type, spacing, and states do the work.

Clone structure from:

- [Every Layout](https://every-layout.dev) — composition primitives.
- [Open Props](https://open-props.style) — tokens without a component library.
- [Vercel web interface guidelines](https://github.com/vercel-labs/web-interface-guidelines) — craft and accessibility floor.
- [animations.dev](https://animations.dev) — motion only when the plan called for it.

## Product evidence first

When `DESIGN.md` or a live product surface exists, that evidence is the exemplar. `create-design-md` (if installed) writes that document; this file does not replace it.
