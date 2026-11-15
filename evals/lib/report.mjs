// Pure markdown rendering of an aggregated summary.
import { fmt, fmtSigned } from './aggregate.mjs';
import { DIMENSIONS } from './judge.mjs';

const pct = (value) => (value === null || value === undefined ? '–' : `${Math.round(value * 100)}%`);
const signedPct = (value) => (value === null || value === undefined ? '–' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`);
const counts = (entries) => Object.entries(entries).sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name}×${n}`).join(', ') || '–';
const cell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

function armLine(arm, info) {
  const toggles = [
    ...(info.add ?? []).map((toggle) => `+${toggle.path}${toggle.source ? ` from ${toggle.source}` : ''}`),
    ...(info.remove ?? []).map((path) => `−${path}`)
  ];
  return `| ${arm} | \`${info.ref}\` (${info.sha?.slice(0, 7) ?? 'working tree'}) | ${toggles.join(', ') || '–'} | ${(info.policies ?? []).join(', ')} | ${(info.skills ?? []).join(', ')} |`;
}

export function renderReport({ summary, config, armsInfo, taskSet, fixture, spend }) {
  const lines = [];
  const { overall, comparison, noise, recommendation } = summary;
  lines.push(`# Agent-config A/B eval: ${config.name}`, '');
  lines.push(`Generated ${summary.generatedAt}. Task set \`${taskSet.name}\`, fixture \`${fixture.name}\`, ${summary.runs} runs, ${summary.judgments} judgments.`, '');

  lines.push('## Recommendation', '');
  lines.push(`**${recommendation.verdict}**${recommendation.heuristic ? ' (heuristic; read the evidence below)' : ''}`, '');
  for (const reason of recommendation.reasons) lines.push(`- ${reason}`);
  lines.push('');

  lines.push('## Setup', '');
  lines.push('| Arm | Ref | Toggles | Policies | Skills |', '|---|---|---|---|---|');
  lines.push(armLine('A', armsInfo.A), armLine('B', armsInfo.B), '');
  lines.push(`- Arms identical: **${armsInfo.identical ? 'yes (A/A control)' : 'no'}**. Changed between arms: ${armsInfo.changedFiles?.length ? armsInfo.changedFiles.map((file) => `\`${file}\``).join(', ') : '–'}`);
  lines.push(`- Agent: provider \`${config.provider}\`, model \`${config.model}\`, effort \`${config.effort}\`, ${config.reps} rep(s) per task and arm, concurrency ${config.concurrency}.`);
  lines.push(`- Judge: ${config.judge ? `provider \`${config.judgeProvider}\`${config.judgeProvider === 'command' ? ` (\`${config.judgeCommand}\`)` : `, model \`${config.judgeModel}\``}, ${config.judgeReps} verdict(s) per pair with alternating patch order, ${config.judgeControls} A#1-vs-A#2 control pair(s) per task` : 'disabled'}.`);
  lines.push(`- Isolation: each arm installed with its own ref's \`bin/agent-config.mjs sync --user\` into a temporary HOME; telemetry env vars off.`);
  if (summary.stoppedEarly) lines.push(`- **Stopped early:** ${summary.stoppedEarly}. Results are partial.`);
  if (spend) lines.push(`- Spend: agent runs $${fmt(spend.runsUsd)}, judge $${fmt(spend.judgeUsd)}, total $${fmt(spend.runsUsd + spend.judgeUsd)}${config.maxUsd ? ` (cap $${config.maxUsd})` : ''}.`);
  lines.push('');

  lines.push('## Per-task results', '');
  lines.push('Gates = all fixture gates pass. Checks = required task checks passed. Judge = mean of the five dimensions on A/B pairs. Pref = judge preference A·B·tie.', '');
  lines.push('| Task | Category | Gates A / B | Checks A / B | Judge A / B | Pref A·B·tie | Cost $ A / B | Wall min A / B | Features A | Features B |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const task of summary.perTask) {
    const p = task.judge.preference;
    lines.push(`| ${task.id} | ${task.category} | ${pct(task.A.gatesPass)} / ${pct(task.B.gatesPass)} | ${pct(task.A.requiredChecksPass)} / ${pct(task.B.requiredChecksPass)} | ${fmt(task.judge.A.overall)} / ${fmt(task.judge.B.overall)} | ${p.A}·${p.B}·${p.tie} | ${fmt(task.A.costUsd)} / ${fmt(task.B.costUsd)} | ${fmt(task.A.wallMin, 1)} / ${fmt(task.B.wallMin, 1)} | ${cell(counts(task.A.features))} | ${cell(counts(task.B.features))} |`);
  }
  lines.push('');

  lines.push('## Per-category summary', '');
  lines.push(`| Category | Arm | Gates | Checks | ${DIMENSIONS.map((d) => d[0].toUpperCase() + d.slice(1)).join(' | ')} | Overall | Pref A·B·tie | Cost $ | Out tokens | Wall min | Tool calls | New-dep runs |`);
  lines.push(`|---|---|---|---|${DIMENSIONS.map(() => '---|').join('')}---|---|---|---|---|---|---|`);
  for (const category of [...summary.perCategory, { label: '**All tasks**', ...summary.overall }]) {
    for (const arm of ['A', 'B']) {
      const s = category[arm];
      const p = category.judge.preference;
      lines.push(`| ${arm === 'A' ? `${category.label}${category.control ? ' (control)' : ''}` : ''} | ${arm} | ${pct(s.gatesPass)} | ${pct(s.requiredChecksPass)} | ${DIMENSIONS.map((d) => fmt(category.judge[arm][d])).join(' | ')} | ${fmt(category.judge[arm].overall)} | ${arm === 'A' ? `${p.A}·${p.B}·${p.tie}` : ''} | ${fmt(s.costUsd)} | ${s.outputTokens === null ? '–' : Math.round(s.outputTokens)} | ${fmt(s.wallMin, 1)} | ${fmt(s.toolCalls, 1)} | ${s.newDepRuns} |`);
    }
  }
  lines.push('');

  lines.push('## Cost overhead of B', '');
  lines.push('| Metric | A | B | Δ |', '|---|---|---|---|');
  const rows = [['Cost per run ($)', 'costUsd', 2], ['Output tokens', 'outputTokens', 0], ['Input tokens incl. cache', 'inputTokens', 0], ['Wall time (min)', 'wallMin', 2], ['Turns', 'turns', 1], ['Tool calls', 'toolCalls', 1]];
  for (const [label, key, digits] of rows) lines.push(`| ${label} | ${fmt(overall.A[key], digits)} | ${fmt(overall.B[key], digits)} | ${signedPct(summary.overhead[key])} |`);
  lines.push(`| Cost per run, non-control tasks | | | ${signedPct(summary.overheadNonControl)} |`, '');

  lines.push('## Policy and skill telemetry', '');
  lines.push('Fired = the agent read the policy file (or, for policies with a command signal, acted on it).', '');
  const policyNames = [...new Set([...Object.keys(overall.A.policiesFired), ...Object.keys(overall.B.policiesFired)])].sort();
  if (policyNames.length) {
    lines.push('| Policy | Fired A | Fired B | Signal hits/run A | Signal hits/run B |', '|---|---|---|---|---|');
    for (const name of policyNames) lines.push(`| ${name} | ${pct(overall.A.policiesFired[name])} | ${pct(overall.B.policiesFired[name])} | ${fmt(overall.A.signalHits[name], 1)} | ${fmt(overall.B.signalHits[name], 1)} |`);
    lines.push('');
  }
  const skillNames = [...new Set([...Object.keys(overall.A.skillsFired ?? {}), ...Object.keys(overall.B.skillsFired ?? {})])].sort();
  if (skillNames.length) {
    lines.push('| Skill | Invoked A | Invoked B |', '|---|---|---|');
    for (const name of skillNames) lines.push(`| ${name} | ${pct(overall.A.skillsFired[name])} | ${pct(overall.B.skillsFired[name])} |`);
    lines.push('');
  }
  if (summary.telemetry.watched.length) {
    lines.push('| Watched policy | Arm | False triggers on controls | Fired where not expected | Missed where expected |', '|---|---|---|---|---|');
    for (const [name, entry] of Object.entries(summary.telemetry.perPolicy)) {
      for (const arm of ['A', 'B']) {
        const f = entry.falseTriggers[arm];
        const m = entry.misses[arm];
        if (!f) continue;
        lines.push(`| ${name} | ${arm} | ${f.controlFired}/${f.controlRuns} | ${f.unexpectedFired.length}/${f.unexpectedRuns} | ${m.missed.length}/${m.expectedRuns}${m.missed.length ? ` (${m.missed.join(', ')})` : ''} |`);
      }
    }
  } else {
    lines.push('No watched policies (nothing changed between arms; pass `--watch <policy>` to track one).');
  }
  lines.push('');

  lines.push('## Judge noise floor', '');
  lines.push(`Source: ${noise.source}, ${noise.pairs} pair(s). Decisive (non-tie) rate ${pct(noise.decisiveRate)}, mean |overall diff| ${fmt(noise.meanAbsDiff)}, max ${fmt(noise.maxAbsDiff)}, order/repeat split rate ${pct(noise.splitRate)}.`, '');
  lines.push(`A/B comparison: ${comparison.pairs} pair(s), B ${comparison.bWins} · A ${comparison.aWins} · tie ${comparison.ties}; mean overall B−A ${fmtSigned(comparison.meanDiff)}; sign test p=${fmt(comparison.signTestP)}; ${comparison.beyondNoise === null ? 'noise floor unavailable' : comparison.beyondNoise ? 'mean difference beyond the noise floor' : 'mean difference within the noise floor'}. A difference counts only when it is beyond the floor **and** p < 0.1: **${comparison.beyondNoise && comparison.signTestP < 0.1 ? 'significant' : 'not significant'}**.`, '');

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
  lines.push('- `results/runs/*.json`: per-run measurements; `results/judge/*.json`: judgments; `summary.json`: aggregates');
  lines.push('');
  return lines.join('\n');
}
