---
name: figma-design-to-code
description: Use when implementing, porting, or rebuilding a supplied Figma node in an existing application. Requires structured context for the exact node, a visual reference, reuse of the application's components and tokens, and rendered comparison before completion. Do not use for writing designs into Figma.
---

# Figma design to code

Implement the supplied Figma design faithfully in the target application's real stack. Figma defines the visual and interaction intent; the repository defines the implementation architecture.

Use `frontend-design` alongside this skill only for gaps the source design leaves open. Product-specific invention must not override a defined Figma detail or the application's established design system.

## Establish the exact source

Resolve the exact target node before coding. A file-only link or ambiguous selection is insufficient; ask for a node-specific link or selection when the target cannot be determined safely.

Use the available Figma integration to obtain structured design context for that node before editing code. Capture or retain a screenshot of the same node as the visual reference. Metadata or a screenshot alone does not replace structured context, and generated reference code is evidence about the design rather than code to paste unchanged.

If structured context is unavailable after following the integration's documented recovery path, report the blocker. Do not silently reconstruct the screen from a screenshot while presenting it as a faithful implementation.

## Inspect the application

Before implementation, identify the target framework, routing and data patterns, styling system, component library, design tokens, typography, asset conventions, and relevant verification commands. Inspect the nearest existing screens and components.

Build a mapping from Figma elements to repository primitives. Apply evidence in this order when available:

1. Code-connected or explicitly mapped application components.
2. Component documentation and established local usage.
3. Designer annotations and interaction specifications.
4. Figma variables mapped to the repository's existing tokens.
5. Raw measurements and colors interpreted with the screenshot.

Reuse matching components, tokens, icons, and assets. Extend an existing primitive when the design requires a supported variant; do not create a parallel component or token system. Preserve exact exported assets when no repository asset is a verified match, and store committed assets according to local conventions rather than relying on expiring integration URLs.

## Implement the design

- Translate the reference into the repository's language, framework, styling approach, component APIs, and file organization.
- Preserve hierarchy, grid, spacing, type scale, color roles, borders, radii, imagery, and icon geometry.
- Implement responsive behavior from explicit variants or constraints. Where Figma is silent, choose the smallest reflow consistent with the application and use `frontend-design` only if substantial design judgment is needed.
- Implement visible interaction states and behavior: focus, hover, active, disabled, loading, empty, error, overlays, transitions, and navigation where the design or surrounding application implies them.
- Keep semantic HTML, accessible names, keyboard operation, focus visibility, contrast, and reduced-motion behavior intact.
- Avoid fixed positioning that merely traces one screenshot when the design implies reusable layout behavior.

## Compare before completion

Run the application and render the implemented route or component at the Figma node's reference size. Compare it directly with the source screenshot, then repeat at relevant responsive sizes. Inspect hierarchy, bounds, alignment, spacing, type metrics, colors, assets, clipping, wrapping, and interaction states. Fix material differences and repeat the comparison.

Run the repository's required automated checks after visual convergence. Completion requires:

- the exact node's structured context and screenshot were used;
- existing components and tokens were reused or deviations were justified;
- the rendered UI was visually compared with Figma at the reference viewport;
- responsive and interaction behavior was exercised where the environment supports it;
- relevant automated checks passed;
- unverified paths and external blockers were stated explicitly.

## Provenance

Behavioral reference: Figma's official [`figma-design-to-code`](https://github.com/figma/mcp-server-guide/tree/main/skills/figma-design-to-code) workflow. This portable implementation is independently written for cross-agent use and does not depend on a plugin-cache path or a specific generated-code stack.
