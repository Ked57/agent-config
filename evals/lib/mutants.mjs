// Mutation gate: manifest validation, patch-header normalisation and scoring. No I/O beyond what
// callers pass in, so `tests/evals-mutants.test.mjs` can exercise it directly.

export const MIN_KILL_RATE = 0.8;
const EXPECT = new Set(['killed', 'survives']);

/**
 * Turns `diff -ruN` output whose roots were rewritten to `a/` and `b/` into a stable patch: no
 * timestamps, no exclude lists, and `/dev/null` for created or deleted files (diff -N marks them
 * with the epoch), so the same app always produces the same bytes and `git apply` reads it.
 */
export function normalisePatch(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const command = /^diff -ruN .* (a\/\S+) (b\/\S+)$/.exec(line);
    if (command) {
      out.push(`diff -ruN ${command[1]} ${command[2]}`);
      continue;
    }
    const header = /^(---|\+\+\+) ([ab]\/\S+)\t(.*)$/.exec(line);
    if (header) out.push(header[3].startsWith('1970-01-01') ? `${header[1]} /dev/null` : `${header[1]} ${header[2]}`);
    else out.push(line);
  }
  return out.join('\n');
}

/** Problems with a manifest's shape and its file references; `files` lists the task dir's entries. */
export function validateManifest(manifest, taskId, files) {
  const problems = [];
  if (manifest.task !== taskId) problems.push(`manifest.task is ${JSON.stringify(manifest.task)}, expected ${taskId}`);
  const listed = [];
  for (const key of ['references', 'knownFailing', 'mutants']) {
    const entries = manifest[key] ?? [];
    if (!Array.isArray(entries)) {
      problems.push(`${key} must be an array`);
      continue;
    }
    for (const entry of entries) {
      if (!entry?.file) {
        problems.push(`${key}: entry without file`);
        continue;
      }
      listed.push(entry.file);
      if (!files.includes(entry.file)) problems.push(`${key}: ${entry.file} does not exist`);
      if (key === 'references' && !entry.source) problems.push(`${entry.file}: reference without source`);
      if (key === 'knownFailing' && !entry.reason) problems.push(`${entry.file}: knownFailing without reason`);
      if (key === 'mutants') {
        if (!entry.wrong || !entry.violates) problems.push(`${entry.file}: mutant needs wrong and violates`);
        if (!EXPECT.has(entry.expect)) problems.push(`${entry.file}: expect must be killed or survives`);
        if (entry.expect === 'survives' && !entry.why) problems.push(`${entry.file}: a surviving mutant needs why`);
      }
    }
  }
  if (manifest.scoreGate !== undefined) {
    const gate = manifest.scoreGate;
    const unit = (value) => typeof value === 'number' && value >= 0 && value <= 1;
    if (!gate || typeof gate !== 'object' || !['referenceMin', 'untouchedMax', 'mutantMaxDrop'].every((key) => unit(gate[key]))) problems.push('scoreGate needs referenceMin, untouchedMax and mutantMaxDrop, each in 0..1');
  }
  if (!(manifest.references ?? []).length) problems.push('no references');
  if (!(manifest.mutants ?? []).length) problems.push('no mutants');
  const duplicates = listed.filter((file, index) => listed.indexOf(file) !== index);
  if (duplicates.length) problems.push(`listed twice: ${[...new Set(duplicates)].join(', ')}`);
  for (const file of files) if (file.endsWith('.patch') && !listed.includes(file)) problems.push(`${file} is not listed in the manifest`);
  return problems;
}

/** Share of mutants the manifest expects to be killed. */
export const declaredKillRate = (manifest) => (manifest.mutants ?? []).filter((mutant) => mutant.expect === 'killed').length / Math.max(1, (manifest.mutants ?? []).length);

/**
 * Scores one task. `results` maps a patch file (or `null` for the untouched fixture) to
 * `{ pass, failed: [check ids], score }`, where `pass` means every required check passed and `score` is
 * the mean required-check score. Returns the kill rate and every rule the task breaks. With
 * `manifest.scoreGate` the task is judged on scores instead (see `scoreGateTask`).
 */
export function scoreTask({ manifest, results, baselinePasses = false, commandCheckIds = [] }) {
  if (manifest.scoreGate) return scoreGateTask({ manifest, results });
  const errors = [];
  const baseline = results.get(null);
  if (baseline?.pass) errors.push('untouched fixture passes every required check');
  const hiddenFailures = baseline ? baseline.failed.filter((id) => commandCheckIds.includes(id)) : [];
  if (baselinePasses && hiddenFailures.length) errors.push(`untouched fixture fails hidden check(s) ${hiddenFailures.join(', ')} although the task preserves behaviour`);
  for (const reference of manifest.references ?? []) {
    const result = results.get(reference.file);
    if (result && !result.pass) errors.push(`reference ${reference.file} fails ${result.failed.join(', ')}`);
  }
  for (const known of manifest.knownFailing ?? []) {
    const result = results.get(known.file);
    if (result?.pass) errors.push(`known-failing ${known.file} now passes`);
  }
  const mutants = manifest.mutants ?? [];
  let killed = 0;
  const unexpected = [];
  for (const mutant of mutants) {
    const result = results.get(mutant.file);
    if (!result) continue;
    if (!result.pass) killed += 1;
    if (mutant.expect === 'killed' && result.pass) errors.push(`mutant ${mutant.file} survives but is expected to be killed`);
    if (mutant.expect === 'survives' && !result.pass) unexpected.push(mutant.file);
  }
  const killRate = mutants.length ? killed / mutants.length : 0;
  if (killRate < MIN_KILL_RATE) errors.push(`kill rate ${(killRate * 100).toFixed(0)}% is under ${MIN_KILL_RATE * 100}%`);
  return { killed, total: mutants.length, killRate, errors, unexpectedKills: unexpected };
}

// Scores within this of the threshold count as reaching it (floating-point means of check scores).
const EPSILON = 1e-9;

/**
 * Score-based gate for tasks with continuous checks: every reference scores at least `referenceMin`,
 * the untouched fixture at most `untouchedMax`, and a mutant (or known-failing solution) is killed when
 * it scores at least `mutantMaxDrop` below the lowest reference.
 */
export function scoreGateTask({ manifest, results }) {
  const { referenceMin, untouchedMax, mutantMaxDrop } = manifest.scoreGate;
  const errors = [];
  const shown = (score) => (typeof score === 'number' ? score.toFixed(2) : '?');
  const baseline = results.get(null);
  if (baseline && !(baseline.score <= untouchedMax + EPSILON)) errors.push(`untouched fixture scores ${shown(baseline.score)}, above untouchedMax ${untouchedMax}`);
  const referenceScores = [];
  for (const reference of manifest.references ?? []) {
    const result = results.get(reference.file);
    if (!result) continue;
    referenceScores.push(result.score ?? 0);
    if (!((result.score ?? 0) >= referenceMin - EPSILON)) errors.push(`reference ${reference.file} scores ${shown(result.score)}, under referenceMin ${referenceMin}`);
  }
  const lowest = referenceScores.length ? Math.min(...referenceScores) : null;
  const isKilled = (result) => lowest !== null && (result.score ?? 0) <= lowest - mutantMaxDrop + EPSILON;
  for (const known of manifest.knownFailing ?? []) {
    const result = results.get(known.file);
    if (result && !isKilled(result)) errors.push(`known-failing ${known.file} scores ${shown(result.score)}, less than ${mutantMaxDrop} below the lowest reference (${shown(lowest)})`);
  }
  const mutants = manifest.mutants ?? [];
  let killed = 0;
  const unexpected = [];
  for (const mutant of mutants) {
    const result = results.get(mutant.file);
    if (!result) continue;
    if (isKilled(result)) killed += 1;
    if (mutant.expect === 'killed' && !isKilled(result)) errors.push(`mutant ${mutant.file} scores ${shown(result.score)}, less than ${mutantMaxDrop} below the lowest reference (${shown(lowest)})`);
    if (mutant.expect === 'survives' && isKilled(result)) unexpected.push(mutant.file);
  }
  const killRate = mutants.length ? killed / mutants.length : 0;
  if (killRate < MIN_KILL_RATE) errors.push(`kill rate ${(killRate * 100).toFixed(0)}% is under ${MIN_KILL_RATE * 100}%`);
  return { killed, total: mutants.length, killRate, errors, unexpectedKills: unexpected, killedFiles: mutants.filter((mutant) => results.get(mutant.file) && isKilled(results.get(mutant.file))).map((mutant) => mutant.file) };
}
