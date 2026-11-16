// Pure markdown rendering of an aggregated summary.
import { fmt, fmtSigned } from './aggregate.mjs';

const pct = (value) => (value === null || value === undefined ? '–' : `${Math.round(value * 100)}%`);
const signedPct = (value) => (value === null || value === undefined ? '–' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`);
const counts = (entries) => Object.entries(entries).sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name}×${n}`).join(', ') || '–';
const cell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const ci = (interval, format = fmtSigned) => (interval ? `${format(interval[0])} to ${format(interval[1])}` : '–');
const pluginLabel = (plugin) => (typeof plugin === 'string' ? plugin
  : `${plugin.name} ${plugin.version ?? '?'}${plugin.gitCommitSha ? ` (${plugin.gitCommitSha.slice(0, 7)})` : ''}${plugin.skills || plugin.agents ? `: ${plugin.skills?.length ?? 0} skills, ${plugin.agents?.length ?? 0} agents` : ''}`);
const refLabel = (info) => (info.ref === 'BARE' ? '`BARE` (empty home)' : `\`${info.ref}\` (${info.sha?.slice(0, 7) ?? 'working tree'})`);

/** One row per arm: what was installed, how it was toggled and what each prompt was prefixed with. */
function armLine(arm, info, spec = {}) {
  const toggles = [
    ...(info.add ?? []).map((toggle) => `+${toggle.path}${toggle.source ? ` from ${toggle.source}` : ''}`),
    ...(info.remove ?? spec.remove ?? []).map((path) => `−${path}`)
  ];
  const plugins = info.ref === 'BARE' ? 'none' : (info.plugins ?? []).map(pluginLabel).join('; ') || 'none';
  return `| ${arm} | ${refLabel(info)} | ${cell(toggles.join(', ') || '–')} | ${spec.prefix ? `\`${cell(spec.prefix)}\`` : '–'} | ${info.pluginMode ?? '–'} | ${cell(plugins)} | ${(info.skills ?? []).length} | ${(info.policies ?? []).length} | ${spec.mode ? `\`${cell(spec.mode)}\`` : '–'} |`;
}

function comparisonRow(label, c) {
  if (!c) return `| ${label} | – | – | – | – | – | – | – | – | – | – |`;
  const bounds = c.ceiling === null ? '–' : `${c.ceiling} / ${c.floor}`;
  return `| ${label} | ${fmt(c.meanA)} | ${fmt(c.meanB)} | ${fmtSigned(c.mean)} | ${fmt(c.sd)} | ${ci(c.ci)} | ${ci(c.bootstrapCi)} | ${fmt(c.mde)} | ${c.tasksNeeded?.['0.10'] ?? '–'} / ${c.tasksNeeded?.['0.20'] ?? '–'} | ${bounds} | ${cell(c.verdict.text)} |`;
}

export function renderReport({ summary, config, armsInfo, taskSet, fixture }) {
  const lines = [];
  const { overall, noise, recommendation, primary, sample } = summary;
  const single = Boolean(config.singleArm);
  lines.push(`# Agent-config A/B eval: ${config.name}`, '');
  lines.push(`Generated ${summary.generatedAt}. Task set \`${taskSet.name}\`, fixture \`${fixture.name}\`, ${summary.runs} runs, ${summary.judgments} judgments.`, '');

  lines.push('## Verdict', '');
  if (single) lines.push(`**${recommendation.verdict}**`, '', ...recommendation.reasons.map((reason) => `- ${reason}`));
  else {
    for (const line of summary.headline) lines.push(`**${line.split(':')[0]}:**${line.slice(line.indexOf(':') + 1)}`, '');
    lines.push(`- Sample: ${sample.pairedTasks} paired task(s) of ${sample.tasks} × ${sample.reps ?? '?'} rep(s) per arm, ${sample.runs} runs counted, ${sample.excludedRuns.length} excluded (isolation)${sample.unscoredTasks.length ? `, ${sample.unscoredTasks.length} task(s) without required checks left out` : ''}. Each task is one sample; reps only make each task's mean more precise.`);
    lines.push(`- Ceiling (both arms 1.0) / floor (both 0): primary ${primary.ceiling} / ${primary.floor} of ${primary.tasks} tasks; all-pass ${summary.allPass.ceiling} / ${summary.allPass.floor}. Tasks at the ceiling or floor cannot show a difference.`);
    if (armsInfo.identical) lines.push('- Arms are identical (A/A control): every difference is run-to-run or judge noise, and any "better" verdict is a false positive.');
  }
  lines.push('');

  const warnings = [...(summary.warnings ?? []), ...(summary.scoringWarnings ?? [])];
  if (warnings.length) {
    lines.push('## Integrity warnings', '');
    for (const warning of warnings) lines.push(`- ${warning}`);
    lines.push('');
  }

  lines.push('## Setup', '');
  lines.push('| Arm | Ref | Toggles | Prompt prefix | Plugin mode | Plugins (version, commit) | Skills | Policies | Input mode |', '|---|---|---|---|---|---|---|---|---|');
  lines.push(armLine('A', armsInfo.A, config.arms?.A), ...(single ? [] : [armLine('B', armsInfo.B, config.arms?.B)]), '');
  for (const arm of single ? ['A'] : ['A', 'B']) {
    const info = armsInfo[arm];
    lines.push(`- Arm ${arm} policies: ${(info.policies ?? []).join(', ') || '–'}; skills: ${(info.skills ?? []).join(', ') || '–'}.`);
  }
  for (const arm of single ? ['A'] : ['A', 'B']) {
    const reuse = summary.reuse?.[arm];
    if (reuse?.reused) lines.push(`- **Arm ${arm}: ${reuse.reused} of ${reuse.runs} runs reused** from ${reuse.sources.map((source) => `\`${source.dir}\` (${source.runs} run(s), made ${source.madeAt?.slice(0, 10) ?? 'date unknown'})`).join(', ')}: same inputsKey (arm install, plugin versions and commits, model, task, checks, fixture, rep), copied instead of run.`);
  }
  lines.push('- A task\'s own `promptPrefix` overrides the arm prefix; each run record keeps the exact prompt sent.');
  lines.push(`- Arms identical: **${armsInfo.identical ? 'yes (A/A control)' : 'no'}**. Changed between arms: ${armsInfo.changedFiles?.length ? `${armsInfo.changedFiles.length} file(s)${armsInfo.changedFiles.length > 12 ? ', first 12' : ''}: ${armsInfo.changedFiles.slice(0, 12).map((file) => `\`${file}\``).join(', ')}` : '–'}`);
  lines.push(`- Agent: provider \`${config.provider}\`, model \`${config.model}\`, effort \`${config.effort}\`, ${config.reps} rep(s) per task and arm, concurrency ${config.concurrency}.`);
  lines.push(`- Judge: ${config.judge ? `provider \`${config.judgeProvider}\`${config.judgeProvider === 'command' ? ` (\`${config.judgeCommand}\`)` : `, model \`${config.judgeModel}\``}, ${config.judgeReps} verdict(s) per pair with alternating patch order, ${config.judgeControls} A#1-vs-A#2 control pair(s) per task` : 'disabled'}.`);
  const rechecks = (summary.history ?? []).filter((entry) => entry.action === 'recheck-result');
  if (rechecks.length) {
    const last = rechecks.at(-1);
    lines.push(`- **Rechecked ${rechecks.length} time(s)**, last ${last.at} against fixture \`${last.fixtureHash}\`${last.runFixtureHash && last.runFixtureHash !== last.fixtureHash ? ` (runs were made on \`${last.runFixtureHash}\`)` : ''}: ${rechecks.reduce((total, entry) => total + entry.flips.length, 0)} check result(s) changed in total. Gates were not re-run. First results are kept as \`checksOriginal\` in each run record; see \`audit.jsonl\`.`);
  }
  if (summary.stoppedEarly) lines.push(`- **Stopped early:** ${summary.stoppedEarly}. Results are partial.`);
  const spend = summary.spend;
  if (spend) lines.push(`- Spend: agent runs ${fmt(spend.runsUsd)}${spend.reusedRuns ? ` (new runs only; the ${spend.reusedRuns} reused run(s) recorded ${fmt((spend.reusedUsdByArm?.A ?? 0) + (spend.reusedUsdByArm?.B ?? 0))} in the evals that made them, not spent here)` : ''}, judge (\`${spend.judgeSet ?? 'n/a'}\`) $${fmt(spend.judgeUsd)}${Object.keys(spend.otherJudgeSetsUsd).length ? `, other judge sets $${fmt(Object.values(spend.otherJudgeSetsUsd).reduce((a, b) => a + b, 0))}` : ''}, total $${fmt(spend.totalUsd)}${config.maxUsd ? ` (cap $${config.maxUsd})` : ''}.`);
  for (const arm of ['A', 'B']) {
    const smoke = summary.runtimeSmoke?.[arm];
    if (smoke) lines.push(`- Runtime smoke (browser/HTTP) arm ${arm}: ${smoke.pass}/${smoke.runs} runs passed.`);
  }
  lines.push('');

  if (!single) {
    lines.push('## Task-level comparison', '');
    lines.push(`d = B − A per task, each arm's task value being the mean over its reps. CI: paired t over tasks (decides the verdict) and seeded task bootstrap (10,000 resamples). MDE: smallest true difference detected 80% of the time at two-sided α = 0.05, at the observed SD. Verdicts: "B better"/"A better" when the CI excludes 0, "no difference larger than ±0.10" when it lies inside ±0.10, else "cannot conclude"; fewer than 5 paired tasks always "cannot conclude".`, '');
    lines.push('| Metric | Mean A | Mean B | Mean d | SD(d) | Paired-t 95% CI | Bootstrap 95% CI | MDE | Tasks for MDE 0.10 / 0.20 | Ceiling / floor | Verdict |', '|---|---|---|---|---|---|---|---|---|---|---|');
    lines.push(comparisonRow('**Run score (primary)**', primary), comparisonRow('All-pass rate', summary.allPass), comparisonRow('Judge overall, 1–5 (secondary)', summary.judge), '');
    if (summary.scoreComponents?.length) {
      lines.push('### Score components (descriptive)', '', 'Continuous (`json-score`) checks that appear in at least 5 tasks, compared per task like the primary metric. Descriptive: no verdict.', '');
      lines.push('| Check | Mean A | Mean B | Mean d | Paired-t 95% CI | Tasks |', '|---|---|---|---|---|---|');
      for (const c of summary.scoreComponents) lines.push(`| \`${c.id}\` | ${fmt(c.meanA)} | ${fmt(c.meanB)} | ${fmtSigned(c.mean)} | ${ci(c.ci)} | ${c.tasks} |`);
      lines.push('');
    }
  }

  lines.push('## Per-task results', '');
  lines.push('Score = mean required-check score over reps (Vitest-scored checks count passed/total test cases; 0 when a gate failed or the run errored). All-pass = share of reps with every required check and gate passing. Judge = mean overall score on A/B pairs; Pref = judge preference A·B·tie.', '');
  lines.push('Hidden tests = test cases passed / run, summed over the task\'s Vitest-scored checks and reps.', '');
  lines.push('Score checks = mean score per arm of each continuous (`json-score`) check. "reused" marks a task with runs copied from an earlier eval (count per arm).', '');
  lines.push('| Task | Category | Score A | Score B | d | Hidden tests A / B | Score checks A / B | Reps A / B | All-pass A / B | Judge A / B | Pref A·B·tie | Cost $ A / B | Features A | Features B |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const tests = (stats) => (stats.hiddenTests ? `${stats.hiddenTests.passed}/${stats.hiddenTests.total}` : '–');
  const scoreChecks = (task) => [...new Set(['A', 'B'].flatMap((arm) => Object.entries(task[arm].checks ?? {}).filter(([, check]) => check.jsonScore).map(([id]) => id)))]
    .map((id) => `${id} ${fmt(task.A.checks?.[id]?.score)} / ${fmt(task.B.checks?.[id]?.score)}`).join('; ') || '–';
  const reusedMark = (task) => (task.A.reused || task.B.reused ? ` (reused: A ${task.A.reused}/${task.A.n}, B ${task.B.reused}/${task.B.n})` : '');
  for (const task of summary.perTask) {
    const p = task.judge.preference;
    lines.push(`| ${task.id}${task.unscored ? ' (no required checks)' : ''}${reusedMark(task)} | ${task.category} | ${fmt(task.scoreA)} | ${fmt(task.scoreB)} | ${fmtSigned(task.d)} | ${tests(task.A)} / ${tests(task.B)} | ${cell(scoreChecks(task))} | ${task.A.n} / ${task.B.n} | ${pct(task.A.allPass)} / ${pct(task.B.allPass)} | ${fmt(task.judge.A.overall)} / ${fmt(task.judge.B.overall)} | ${p.A}·${p.B}·${p.tie} | ${fmt(task.A.costUsd)} / ${fmt(task.B.costUsd)} | ${cell(counts(task.A.features))} | ${cell(counts(task.B.features))} |`);
  }
  lines.push('');

  lines.push('## Per-category means (descriptive)', '');
  lines.push('Means over runs, no verdicts: categories hold too few tasks for a test.', '');
  lines.push('| Category | Arm | Runs | Score | All-pass | Gates | Judge overall | Cost $ | Wall min | Tool calls | New-dep runs |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const category of [...summary.perCategory, { label: '**All tasks**', ...summary.overall }]) {
    for (const arm of ['A', 'B']) {
      const s = category[arm];
      if (single && arm === 'B') continue;
      lines.push(`| ${arm === 'A' ? `${category.label}${category.control ? ' (control)' : ''}` : ''} | ${arm} | ${s.n} | ${fmt(s.score)} | ${pct(s.allPass)} | ${pct(s.gatesPass)} | ${fmt(category.judge[arm].overall)} | ${fmt(s.costUsd)} | ${fmt(s.wallMin, 1)} | ${fmt(s.toolCalls, 1)} | ${s.newDepRuns} |`);
    }
  }
  lines.push('');

  lines.push('## Cost', '');
  if (summary.cost) {
    lines.push('Ratio of task means (B / A − 1) with a task-bootstrap 95% CI. Reported next to quality, never folded into it.', '');
    lines.push('| Metric | Mean A | Mean B | B vs A | Bootstrap 95% CI | Tasks | Verdict |', '|---|---|---|---|---|---|---|');
    for (const [label, c, digits] of [['Cost per run ($)', summary.cost, 2], ['Wall time per run (min)', summary.cost.wallMin, 1], ['Turns per run', summary.cost.turns, 1]]) {
      lines.push(`| ${label} | ${fmt(c.meanA, digits)} | ${fmt(c.meanB, digits)} | ${signedPct(c.mean)} | ${ci(c.bootstrapCi, signedPct)} | ${c.tasks} | ${cell(c.verdict.text)} |`);
    }
    lines.push('');
  }
  lines.push('Means over runs (descriptive):', '');
  lines.push('| Metric | A | B | Δ |', '|---|---|---|---|');
  const rows = [['Cost per run ($)', 'costUsd', 2], ['Output tokens', 'outputTokens', 0], ['Input tokens incl. cache', 'inputTokens', 0], ['Wall time (min)', 'wallMin', 2], ['Turns', 'turns', 1], ['Tool calls', 'toolCalls', 1]];
  for (const [label, key, digits] of rows) lines.push(`| ${label} | ${fmt(overall.A[key], digits)} | ${fmt(overall.B[key], digits)} | ${signedPct(summary.overhead[key])} |`);
  lines.push(`| Cost per run, non-control tasks | | | ${signedPct(summary.overheadNonControl)} |`, '');
  if (spend) {
    lines.push('Where the money went:', '');
    lines.push('| Item | USD | Share |', '|---|---|---|');
    const share = (value) => (spend.totalUsd ? pct(value / spend.totalUsd) : '–');
    lines.push(`| Agent runs, arm A | ${fmt(spend.runsUsdByArm.A)} | ${share(spend.runsUsdByArm.A)} |`);
    lines.push(`| Agent runs, arm B | ${fmt(spend.runsUsdByArm.B)} | ${share(spend.runsUsdByArm.B)} |`);
    for (const arm of ['A', 'B']) if (spend.reusedUsdByArm?.[arm]) lines.push(`| Reused runs, arm ${arm} (recorded cost, paid by the eval that made them) | ${fmt(spend.reusedUsdByArm[arm])} | – |`);
    lines.push(`| Judge \`${spend.judgeSet ?? 'n/a'}\` (${summary.judgments} judgments, $${fmt(spend.judgeUsdPerJudgment, 3)} each) | ${fmt(spend.judgeUsd)} | ${share(spend.judgeUsd)} |`);
    for (const [id, usd] of Object.entries(spend.otherJudgeSetsUsd)) lines.push(`| Judge \`${id}\` (comparison set) | ${fmt(usd)} | ${share(usd)} |`);
    lines.push('');
  }

  lines.push('## Component telemetry', '');
  lines.push('Fired: a policy when the agent read its file (or ran its command signal); a skill on a `Skill` call, a read of its SKILL.md or a slash invocation (the prompt sent, or a command the session log shows expanded); a plugin when one of its skills fired that way or one of its agents ran as a subagent.', '');
  const firedTable = (title, key) => {
    const names = [...new Set([...Object.keys(overall.A[key] ?? {}), ...Object.keys(overall.B[key] ?? {})])].sort();
    if (!names.length) return;
    lines.push(`| ${title} | Fired A | Fired B |`, '|---|---|---|');
    for (const name of names) lines.push(`| ${name} | ${pct(overall.A[key][name])} | ${pct(overall.B[key][name])} |`);
    lines.push('');
  };
  firedTable('Policy', 'policiesFired');
  firedTable('Skill', 'skillsFired');
  firedTable('Plugin', 'pluginsFired');
  const subagentTypes = [...new Set(['A', 'B'].flatMap((arm) => Object.keys(overall[arm].subagents?.calls ?? {})))].sort();
  lines.push('Subagents (Task/Agent tool calls by `subagent_type`):', '');
  lines.push('| Arm | Runs using any | ' + (subagentTypes.length ? subagentTypes.map((type) => `\`${type}\` calls (runs)`).join(' | ') : 'Calls') + ' |', `|---|---|${subagentTypes.length ? subagentTypes.map(() => '---|').join('') : '---|'}`);
  for (const arm of single ? ['A'] : ['A', 'B']) {
    const sub = overall[arm].subagents;
    lines.push(`| ${arm} | ${sub.runsWithAny}/${sub.runs} | ${subagentTypes.length ? subagentTypes.map((type) => `${sub.calls[type] ?? 0} (${sub.runsByType[type] ?? 0})`).join(' | ') : '0'} |`);
  }
  lines.push('');
  const mcpTools = [...new Set(['A', 'B'].flatMap((arm) => Object.keys(overall[arm].mcp?.calls ?? {})))].sort();
  if (mcpTools.length) {
    lines.push('MCP tool calls (input-mode servers, by tool):', '');
    lines.push(`| Arm | Runs using any | ${mcpTools.map((tool) => `\`${tool}\``).join(' | ')} |`, `|---|---|${mcpTools.map(() => '---|').join('')}`);
    for (const arm of single ? ['A'] : ['A', 'B']) lines.push(`| ${arm} | ${overall[arm].mcp.runsWithAny}/${overall[arm].mcp.runs} | ${mcpTools.map((tool) => overall[arm].mcp.calls[tool] ?? 0).join(' | ')} |`);
    lines.push('');
  }
  if (summary.telemetry.watched.length) {
    lines.push('Watched components (changed between arms, or `--watch`). Expected = the task lists it in `expectsComponents`/`expectsPolicies`.', '');
    lines.push('| Watched | Arm | Fired in runs | Tasks fired on | False triggers on controls | Fired where not expected | Missed where expected |', '|---|---|---|---|---|---|---|');
    for (const [name, entry] of Object.entries(summary.telemetry.perPolicy)) {
      for (const arm of ['A', 'B']) {
        const f = entry.falseTriggers[arm];
        const m = entry.misses[arm];
        const fired = entry.fired?.[arm];
        if (!f) continue;
        lines.push(`| ${name} | ${arm} | ${fired ? `${fired.fired.length}/${fired.runs}` : '–'} | ${fired?.tasks.join(', ') || '–'} | ${f.controlFired}/${f.controlRuns} | ${f.unexpectedFired.length}/${f.unexpectedRuns} | ${m.missed.length}/${m.expectedRuns}${m.missed.length ? ` (${m.missed.join(', ')})` : ''} |`);
      }
    }
  } else {
    lines.push('No watched components (nothing changed between arms; pass `--watch <name>` to track one).');
  }
  lines.push('');

  lines.push('## Judge (secondary)', '');
  if (summary.judge) {
    lines.push(`Task-level judge comparison: ${summary.judge.verdict.text}. Mean B−A ${fmtSigned(summary.judge.mean)} overall points over ${summary.judge.tasks} task(s), 95% CI ${ci(summary.judge.ci)}. The judge only breaks a "no difference" or "cannot conclude" on the primary metric and never overrides it.`, '');
  }
  const dimensionNames = summary.overall.judge.pairs ? Object.keys(summary.overall.judge.A).filter((name) => name !== 'overall') : [];
  if (dimensionNames.length) {
    lines.push(`| Arm | ${dimensionNames.map((d) => d[0].toUpperCase() + d.slice(1)).join(' | ')} | Overall | Preferred (pairs) |`, `|---|${dimensionNames.map(() => '---|').join('')}---|---|`);
    const p = summary.overall.judge.preference;
    for (const arm of ['A', 'B']) lines.push(`| ${arm} | ${dimensionNames.map((d) => fmt(summary.overall.judge[arm][d])).join(' | ')} | ${fmt(summary.overall.judge[arm].overall)} | ${p[arm]} of ${summary.overall.judge.pairs} (${p.tie} ties) |`);
    lines.push('');
  }
  lines.push(`Noise (descriptive, gates nothing): ${noise.source}, ${noise.pairs} pair(s). Mean |overall diff| ${fmt(noise.meanAbsDiff)} (bootstrap 95% CI ${noise.meanAbsDiffCi ? `${fmt(noise.meanAbsDiffCi[0])} to ${fmt(noise.meanAbsDiffCi[1])}` : '–'}), max ${fmt(noise.maxAbsDiff)}, decisive (non-tie) rate ${pct(noise.decisiveRate)}, order/repeat split rate ${pct(noise.splitRate)}.`, '');

  if (summary.judgeComparisons?.length) {
    lines.push('### Judge comparison', '');
    lines.push(`Active judge: \`${spend?.judgeSet}\`. Each other judge set below re-judged the same pairs.`, '');
    for (const comparison of summary.judgeComparisons) {
      lines.push(`#### vs \`${comparison.id}\` (${comparison.pairs} common pairs)`, '');
      lines.push(`- Same preference: ${pct(comparison.preferenceAgreement)}; decisive flips (one judge prefers A, the other B): ${comparison.decisiveFlips}/${comparison.decisiveBoth}.`);
      lines.push(`- Mean |overall score difference| per patch: ${fmt(comparison.meanAbsScoreDelta)}; correlation of B−A margins: ${fmt(comparison.marginCorrelation)}.`, '');
      lines.push(`| | \`${spend?.judgeSet}\` | \`${comparison.id}\` |`, '|---|---|---|');
      const row = (label, pick) => lines.push(`| ${label} | ${pick(comparison.active)} | ${pick(comparison.other)} |`);
      row('Cost (these pairs)', (side) => `$${fmt(side.costUsd)}`);
      row('Cost per judgment', (side) => `$${fmt(side.costPerJudgment, 3)}`);
      row('Decisive rate', (side) => pct(side.decisiveRate));
      row('Order/repeat split rate', (side) => pct(side.splitRate));
      row(`Noise: mean abs score diff (${comparison.active.noise.source})`, (side) => `${fmt(side.noise.meanAbsDiff)} over ${side.noise.pairs} pair(s), decisive ${pct(side.noise.decisiveRate)}`);
      lines.push('');
    }
  }
  lines.push('## Notable diffs', '');
  if (!summary.notable.length) lines.push('Nothing stood out.');
  for (const note of summary.notable) {
    lines.push(`- **${note.task}** (${note.kind}): ${cell(note.text)}`);
    if (note.notesA) lines.push(`  - A: ${cell(note.notesA)}`);
    if (note.notesB) lines.push(`  - B: ${cell(note.notesB)}`);
  }
  lines.push('');

  lines.push('## Files', '');
  lines.push('- `config.json`, `arms.json`: resolved configuration and arm metadata');
  lines.push('- `runs/<task>__<arm>__r<n>/`: `transcript.jsonl`, `diff.patch`, `app/` (the worked copy)');
  lines.push('- `results/runs/*.json`: per-run measurements; `results/judge/<judge-set>/*.json`: judgments; `summary.json`: aggregates');
  lines.push('');
  return lines.join('\n');
}
