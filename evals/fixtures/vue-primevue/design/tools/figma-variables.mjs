// Colour variables for a frame: the names a designer's Figma file built on the fixture's theme would bind
// its colours to. Designers name palettes their own way (the theme's primary is "Brand", its surface
// palette "Gray"), so mapping a variable to the project's token is part of the task. (Spacing, radius and
// type variables are derived by the MCP stub from the layer tree.)

const PALETTE = { primary: 'Brand', surface: 'Gray' };
const capitalise = (word) => word[0].toUpperCase() + word.slice(1);

/**
 * Turns a custom property into a variable name: theme palettes (`--p-primary-500`, `--p-surface-0`)
 * become `Brand/500` and `Gray/0`, Tailwind colours (`--color-emerald-600`) `Emerald/600`; anything else
 * is not a variable.
 */
function tokenName(property) {
  const theme = property.match(/^--p-(primary|surface)-(\d+)$/);
  if (theme) return `${PALETTE[theme[1]]}/${theme[2]}`;
  const tailwind = property.match(/^--color-([a-z]+)-(\d+)$/);
  if (tailwind) return `${capitalise(tailwind[1])}/${tailwind[2]}`;
  if (property === '--color-white') return 'Base/White';
  return null;
}

/** Maps each colour (hex) to its token name; theme tokens win over Tailwind palette names, then alphabetical. */
export function colourTokensFor(colours) {
  const colourTokens = {};
  const theme = (name) => Number(name.startsWith('Brand/') || name.startsWith('Gray/'));
  for (const [hex, properties] of Object.entries(colours).sort(([a], [b]) => a.localeCompare(b))) {
    const names = properties.map(tokenName).filter(Boolean).sort((a, b) => theme(b) - theme(a) || a.localeCompare(b));
    if (names.length) colourTokens[hex] = names[0];
  }
  return colourTokens;
}
