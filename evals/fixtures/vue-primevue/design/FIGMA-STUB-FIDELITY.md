# Figma MCP stub: fidelity

`../figma-stub/server.mjs` stands in for Figma's MCP server in `vue-design` runs (`figma-link` mode). It is
offline and deterministic and serves frames exported from the hidden reference implementation. This file lives
here, not in `figma-stub/`, because everything in `figma-stub/` is copied into the run and readable by the
agent, and a Figma file would not explain how it was made.

Sources checked on 2026-11-16:

- Tools and prompts: <https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts> (tool list, what each
  returns, `clientFrameworks`, "By default, the output is React and Tailwind", `get_metadata` XML outline,
  `get_screenshot` PNG as URL or base64 with `enableBase64Response`, `get_variable_defs` variables and styles).
- Guide repository: <https://github.com/figma/mcp-server-guide> README (registration
  `claude mcp add --transport http figma https://mcp.figma.com/mcp`, so the server name is `figma`; "Copy the link
  to a frame or layer in Figma") and `figma-power/steering/implement-design.md` (URL
  `https://figma.com/design/:fileKey/:fileName?node-id=1-2`, calls `get_design_context(fileKey, nodeId="1-2")`,
  `get_metadata` first for large frames, `get_screenshot` for the visual reference).

Neither source gives full parameter schemas, response bodies, tool descriptions or the text appended to
generated code. Where the stub needs those it uses wording recalled from the real server's tool listing and
output, marked **unconfirmed** below.

## Matches

- Server name `figma`; tools `get_design_context`, `get_variable_defs`, `get_screenshot`, `get_metadata` (the
  read-only design tools; no Code Connect, `create_design_system_rules`, write, FigJam, Make or Weave tools).
- Parameters `nodeId` (`1:2` or `1-2`) and `fileKey`, plus the client hints `clientLanguages` and
  `clientFrameworks`. A full Figma URL in either `nodeId` or `fileKey` is resolved too.
- `get_design_context` returns React + Tailwind code with `data-node-id` / `data-name` attributes, arbitrary-value
  utilities and asset constants, then a second text block of guidance. For a selection too large to return
  as code, it returns the sparse metadata and asks for child nodes, which is what the guide tells agents to
  expect.
- `get_metadata` returns an XML outline (ids, layer types, names, positions relative to the parent, sizes); without
  a node id it lists the file's pages and their frames.
- `get_screenshot` returns a PNG as an MCP image content block (the frame, or a crop for a child layer).
- `get_variable_defs` returns a flat JSON object of the variables and text styles used under the node.
- Text layers are as tall as their line boxes (line height × lines), as Figma draws text without vertical trim,
  and tabular figures appear as the text style's `TNUM` OpenType flag (`tabular-nums` in the code).
- Layer ids are unique in a file and never equal a frame's id, so every frame link opens that frame.

## Gaps (real server does, stub doesn't)

1. **Assets.** Image and icon constants point at `https://www.figma.com/api/mcp/asset/<uuid>` placeholders that
   do not resolve. The real remote server serves downloadable assets for a limited time (the desktop server serves
   them from `localhost:3845`). Agents must use the project's icon set and draw the charts from data.
2. **Code is generated from a rendered page, not from Figma nodes.** Auto-layout is inferred from flex and grid
   (`GRID` and `gridColumnCount` approximate Figma's grid auto-layout), wrappers without styling are collapsed,
   icons become `icon/<name>` instances, charts and sparklines become vectors. PrimeVue components in the reference
   become instances of a design kit named in designer words (`scorer/kit.mjs`: Select is "Dropdown", Tag "Status
   chip", ToggleSwitch "Toggle") with variant properties read from the rendered component (`Type=Danger,
   Style=Outlined`, `State=Error`, `On=True`). Anything the reference builds by hand stays a plain frame, as a
   detached or custom layer would. There are no instance overrides, constraints or Dev Mode annotations.
   **Unconfirmed:** how the real server writes instances into code without Code Connect. The stub draws an instance's
   layers like a frame, names it after its component (`data-name`), puts a `{/* Instance of Button (Type=Primary, …)
   */}` comment before it, and lists the selection's components in the guidance block.
3. **Unconfirmed wording.** Tool descriptions, the parameter descriptions, the "SUPER CRITICAL: The generated
   React+Tailwind code MUST be converted…" guidance block, the asset URL form and the `Font(family: …, style: …,
   size: …, weight: …, lineHeight: …)` style format are recalled, not documented.
4. **Variable names** are derived from the fixture's theme but named the way a designer would: the theme's primary
   palette is `Brand/<shade>`, its surface palette `Gray/<shade>`, Tailwind colours `Emerald/600`, white `Base/White`;
   text styles carry type-scale names (`Heading/H1`, `Body/Default`, `Label/Strong`, `Caption/Default`); spacing is
   `spacing/<n>` on a 4 px scale and radii `radius/*`. Code references them as `var(--brand-500,#hex)`. Only colours
   that match a theme value are bound to variables; none carries a code syntax pointing at the project's tokens.
5. **Screenshots** are crops of the frame render (overlapping siblings show through); the real tool renders the
   node itself and can return a URL. `enableBase64Response` is not accepted: the stub always answers inline.
6. **Size limits** are the stub's own (60,000 characters of code). The real server's thresholds are not documented.
7. **No desktop-app selection**, no `whoami`, `get_code_connect_map`, `get_libraries`, `search_design_system`,
   `download_assets` or `get_motion_context`; no rate limits, authentication or seat checks.
8. **Transport.** The stub is a local stdio server; the real one is HTTP (`https://mcp.figma.com/mcp`) behind OAuth.

## Reverse gaps (stub does, real server may not)

- Tools carry `annotations.readOnlyHint: true`.
- Every frame includes the app shell (top bar and navigation) because frames are full-page renders.
- Node ids are synthetic and stable per export (`12:2` for frames, `<20+index>:<n>` for layers).
- Errors (unknown file or node, page id passed to a node tool) come back as `isError` tool results with a short
  hint; the real server's error texts are unknown.
