---
name: frontend-design
description: Use when designing or substantially reshaping a web interface without a supplied source-of-truth design. Do not use when a Figma node, Code Connect mapping, approved screenshot, or other exact visual spec is the source of truth; use figma-design-to-code instead.
license: Apache-2.0; see LICENSE.txt
---

# Frontend design

Create a coherent interface that belongs to this product, audience, and task. Use this skill for original design and significant visual reinterpretation. When an existing design system or approved visual language is in scope, extend it deliberately rather than replacing it.

This skill may complement `figma-design-to-code` only for decisions the supplied design leaves open, such as responsive reflow or an unspecified empty state. The supplied spec remains the source of truth for every defined detail.

When the user needs to choose among looks rather than ship one, follow `prototype` (UI branch) instead of committing a single direction.

## Ground the direction

Before coding, identify:

- the product or subject, its audience, and the interface's primary job;
- the real content and domain vocabulary the interface must carry;
- existing components, tokens, typography, assets, and layout conventions that constrain the design;
- one coherent aesthetic direction and one signature element that makes sense for the subject.

If the brief leaves essential context open, make a concrete, reversible assumption and state it. Derive the visual language from the subject's materials, tools, culture, and user expectations rather than from a fashionable template.

## Make a compact design plan

Define the smallest useful system before implementation:

- **Palette:** a small set of named colors with clear roles and sufficient contrast.
- **Typography:** intentional display, body, and utility roles; reuse the product's type system when one exists.
- **Composition:** hierarchy, density, rhythm, and responsive behavior expressed as a short layout concept or wireframe.
- **Signature:** one memorable, product-specific interaction, composition, or visual device.
- **Motion:** one orchestrated use where motion improves orientation or meaning; keep the interface still when motion adds no value.

Critique the plan against the brief. Replace any choice that could be transplanted unchanged into a generic product in the same category. Spend visual boldness in one place and keep supporting elements disciplined.

Then read [EXAMPLES.md](EXAMPLES.md) for the repository's stack (shadcn, PrimeVue, or vanilla) before writing markup. Match structure, density, and state coverage from those exemplars; copy a palette only when the brief left color unspecified.

## Build production UI

- Follow the repository's framework, component library, styling system, assets, and conventions.
- Use real domain content. Write interface copy from the user's point of view with stable action names, direct errors, and useful empty states.
- Make structural devices carry information. Numbering, labels, dividers, and decorative motifs must express a real relationship in the content.
- Treat typography and spacing as primary design materials. Precision matters more than added ornament, especially in restrained directions.
- Implement the interaction states implied by the experience: hover, focus, active, disabled, loading, empty, error, and success where relevant.
- Support mobile through wide layouts, keyboard access, readable contrast, and reduced-motion preferences.

## Critique the result

Run the interface and inspect screenshots at representative narrow and wide viewports. Compare the rendered result with the brief and the design plan, then fix hierarchy, overflow, type scale, spacing, contrast, state coverage, and any styling collisions. Remove one non-essential decorative element if it competes with the signature or the user's task.

Completion requires a working, responsive interface, passing repository checks, and visual inspection of the rendered result when the environment supports it. State any viewport, interaction, or browser path that could not be verified.

## Companion skills when present

Load at most one extra companion, and only if it is installed. Skip any that are missing. Do not load taste companions when `figma-design-to-code` owns the task.

- `create-design-md` when the product has a visual language that is not yet written down.
- `baseline-ui` for a polish pass on an existing product surface, not for original visual invention.
- `improve-ui` when auditing an existing surface against its own design evidence.
- `ui-skills-root` only to route to a more specific ui-skills skill.
- Official `shadcn` skill or registry MCP when the repository already uses shadcn/ui.

## Provenance

Adapted from Anthropic's [`frontend-design`](https://github.com/anthropics/skills/tree/main/skills/frontend-design) skill under the Apache License 2.0. This version adds cross-agent portability, repository design-system precedence, stack exemplars, and an explicit boundary with exact-spec implementation.
