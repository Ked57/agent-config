// Accessibility: axe-core (WCAG 2.1 A and AA rules) on a frame's page state.

export const PENALTY = { critical: 0.25, serious: 0.15, moderate: 0.05, minor: 0.02 };

/** Violations on the page: `[{ id, impact, nodes }]`. */
export async function runAxe(page, axeSource) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
    return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact ?? 'minor', nodes: violation.nodes.length, first: String(violation.nodes[0]?.html ?? '').slice(0, 120) }));
  });
}

/**
 * Frame score: 1 minus a penalty per violated rule by impact (floor 0), times the frame's layout
 * coverage, so a page that does not show the design (an empty route has nothing to violate) earns nothing.
 */
export function scoreA11y(violations, coverage) {
  const penalty = violations.reduce((sum, violation) => sum + (PENALTY[violation.impact] ?? PENALTY.minor), 0);
  return Math.max(0, 1 - penalty) * coverage;
}
