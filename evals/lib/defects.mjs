// Pure part of `npm run eval:defects`: the design-review findings that `vue-design` checks record
// (`findings` on json-score checks, see fixtures/vue-primevue/design/README.md "Findings"), counted per
// category so a config change can be judged by which kinds of defect it removes.

export const CATEGORIES = ['missing', 'component', 'spacing', 'size', 'typography', 'colour', 'radius', 'state', 'responsive', 'behaviour', 'a11y'];

/** The findings of one run record, each tagged with the check that reported it. */
export function runFindings(run) {
  return (run.checks ?? []).flatMap((check) => (check.findings ?? []).map((finding) => ({ check: check.id, ...finding })));
}

const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

/**
 * Per task: the runs, their mean score per check, and the mean number of findings per category and run.
 * `runs` are run records (status ok only); returns `{ tasks: { <task>: { runs, checks, categories, findings } }, totals }`.
 */
export function summarise(runs) {
  const tasks = {};
  for (const run of runs.filter((record) => record.status === 'ok')) {
    const entry = (tasks[run.task] ??= { runs: 0, usd: [], checks: {}, counts: [], findings: [] });
    entry.runs += 1;
    if (typeof run.cost?.usd === 'number') entry.usd.push(run.cost.usd);
    for (const check of run.checks ?? []) (entry.checks[check.id] ??= []).push(check.score ?? 0);
    const findings = runFindings(run);
    const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
    for (const finding of findings) counts[finding.category] = (counts[finding.category] ?? 0) + 1;
    entry.counts.push(counts);
    entry.findings.push(...findings);
  }
  const summary = { tasks: {}, totals: Object.fromEntries(CATEGORIES.map((category) => [category, 0])) };
  for (const [task, entry] of Object.entries(tasks).sort(([a], [b]) => a.localeCompare(b))) {
    const categories = {};
    for (const category of new Set(entry.counts.flatMap((counts) => Object.keys(counts)))) {
      categories[category] = round(mean(entry.counts.map((counts) => counts[category] ?? 0)), 1);
      summary.totals[category] = round((summary.totals[category] ?? 0) + categories[category], 1);
    }
    summary.tasks[task] = {
      runs: entry.runs,
      usd: entry.usd.length ? round(mean(entry.usd)) : null,
      checks: Object.fromEntries(Object.entries(entry.checks).map(([id, scores]) => [id, round(mean(scores), 3)])),
      categories,
      findings: entry.findings
    };
  }
  return summary;
}

/** The most frequent findings of a task (same frame, element, property), with how many runs had each. */
export function recurring(findings, limit = 15) {
  const groups = new Map();
  for (const finding of findings) {
    const key = [finding.category, finding.frame ?? '', finding.element, finding.property].join('|');
    const group = groups.get(key) ?? { ...finding, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)).slice(0, limit);
}

/** Markdown report over one or more labelled summaries (`[{ label, summary }]`); the first is the reference column. */
export function defectsReport(labelled) {
  const lines = ['# Design defects', ''];
  lines.push('Mean findings per run, by category (what a design review would flag). Lower is better.', '');
  const header = ['Category', ...labelled.map(({ label }) => label)];
  lines.push(`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`);
  for (const category of CATEGORIES) {
    const cells = labelled.map(({ summary }, index) => {
      const value = summary.totals[category] ?? 0;
      if (!index) return String(value);
      const delta = round(value - (labelled[0].summary.totals[category] ?? 0), 1);
      return `${value} (${delta > 0 ? '+' : ''}${delta})`;
    });
    lines.push(`| ${category} | ${cells.join(' | ')} |`);
  }
  for (const { label, summary } of labelled) {
    lines.push('', `## ${label}`);
    for (const [task, entry] of Object.entries(summary.tasks)) {
      const scores = Object.entries(entry.checks).map(([id, score]) => `${id} ${score}`).join(', ');
      const counts = Object.entries(entry.categories).filter(([, count]) => count).map(([category, count]) => `${category} ${count}`).join(', ') || 'none';
      lines.push('', `### ${task}`, '', `${entry.runs} run(s)${entry.usd !== null ? `, $${entry.usd} per run` : ''}. Checks: ${scores}.`, `Findings per run: ${counts}.`, '');
      const top = recurring(entry.findings);
      if (!top.length) continue;
      lines.push('| Runs | Category | Frame | Element | Property | Expected | Rendered |', '|---|---|---|---|---|---|---|');
      for (const finding of top) lines.push(`| ${finding.count} | ${finding.category} | ${finding.frame ?? ''} | ${finding.element} | ${finding.property} | ${finding.expected} | ${String(finding.rendered).replace(/\|/g, '\\|')} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}
