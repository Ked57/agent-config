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
 * `{ pass, failed: [check ids] }`, where `pass` means every required check passed.
 * Returns the kill rate and every rule the task breaks.
 */
export function scoreTask({ manifest, results, baselinePasses = false, commandCheckIds = [] }) {
  const errors = [];
  const baseline = results.get(null);
  if (baseline?.pass) errors.push('untouched fixture passes every required check');
  if (baselinePasses && baseline && baseline.failed.some((id) => commandCheckIds.includes(id))) {
    errors.push(`untouched fixture fails hidden check(s) ${baseline.failed.join(', ')} although the task preserves behaviour`);
  }
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
