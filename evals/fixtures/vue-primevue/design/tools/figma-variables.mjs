// Colour variables for a frame: the token names a Figma file built on the fixture's theme would bind its
// colours to. (Spacing, radius and type variables are derived by the MCP stub from the layer tree.)

/**
 * Turns a custom property into a token name: theme palettes (`--p-primary-500`, `--p-surface-0`) and
 * Tailwind colours (`--color-emerald-600`) become `color/<palette>/<shade>`; anything else is not a token.
 */
function tokenName(property) {
  const theme = property.match(/^--p-(primary|surface)-(\d+)$/);
  if (theme) return `color/${theme[1]}/${theme[2]}`;
  const tailwind = property.match(/^--color-([a-z]+)-(\d+)$/);
  if (tailwind) return `color/${tailwind[1]}/${tailwind[2]}`;
  if (property === '--color-white') return 'color/white';
  return null;
}

/** Maps each colour (hex) to its token name; theme tokens win over Tailwind palette names, then alphabetical. */
export function colourTokensFor(colours) {
  const colourTokens = {};
  const theme = (name) => Number(name.startsWith('color/primary') || name.startsWith('color/surface'));
  for (const [hex, properties] of Object.entries(colours).sort(([a], [b]) => a.localeCompare(b))) {
    const names = properties.map(tokenName).filter(Boolean).sort((a, b) => theme(b) - theme(a) || a.localeCompare(b));
    if (names.length) colourTokens[hex] = names[0];
  }
  return colourTokens;
}
