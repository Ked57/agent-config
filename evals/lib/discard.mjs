// Spend on runs that left no record (cut off by the provider, or redone with --redo), kept in the
// results dir so budgets and the report stay honest across resumes.
import fs from 'node:fs';
import path from 'node:path';

const discardedFile = (outDir) => path.join(outDir, 'results', 'discarded.json');

/** `{ usd, runs: [{ id, at, kind, message, usd }] }` from `<outDir>/results/discarded.json`. */
export function readDiscarded(outDir) {
  const file = discardedFile(outDir);
  const runs = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).runs ?? [] : [];
  return { usd: runs.reduce((sum, run) => sum + (run.usd ?? 0), 0), runs };
}

/** Appends one discarded run and returns the new state. */
export function recordDiscarded(outDir, { id, kind, message = null, usd = 0, at = new Date().toISOString() }) {
  const runs = [...readDiscarded(outDir).runs, { id, at, kind, message, usd }];
  fs.mkdirSync(path.dirname(discardedFile(outDir)), { recursive: true });
  fs.writeFileSync(discardedFile(outDir), `${JSON.stringify({ runs }, null, 2)}\n`);
  return readDiscarded(outDir);
}

/**
 * `--redo`: moves the named runs' records, their saved run dirs and every judgment that used them into
 * `<outDir>/discarded/<stamp>/` (same layout), so `--resume` runs them again. A run's recorded cost was
 * spent by this eval (unless reused from another) and is added to the discarded spend. Every id must
 * have a record. Returns `{ dir, runs: [{ id, usd, judgments }] }`.
 */
export function redoRuns({ outDir, ids, at = new Date().toISOString() }) {
  const recordFile = (id) => path.join(outDir, 'results', 'runs', `${id}.json`);
  const missing = ids.filter((id) => !fs.existsSync(recordFile(id)));
  if (missing.length) throw new Error(`--redo: no recorded run ${missing.join(', ')} in ${outDir}`);
  const dir = path.join(outDir, 'discarded', at.replace(/[:.]/g, '-'));
  const move = (from) => {
    const to = path.join(dir, path.relative(outDir, from));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  };
  const judgeRoot = path.join(outDir, 'results', 'judge');
  const judgmentFiles = (fs.existsSync(judgeRoot) ? fs.readdirSync(judgeRoot, { withFileTypes: true }) : [])
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => fs.readdirSync(path.join(judgeRoot, entry.name)).filter((file) => file.endsWith('.json')).map((file) => path.join(judgeRoot, entry.name, file)));
  const result = { dir, runs: [] };
  for (const id of ids) {
    const record = JSON.parse(fs.readFileSync(recordFile(id), 'utf8'));
    move(recordFile(id));
    if (fs.existsSync(path.join(outDir, 'runs', id))) move(path.join(outDir, 'runs', id));
    const judgments = [];
    for (const file of judgmentFiles) {
      if (!fs.existsSync(file) || !(JSON.parse(fs.readFileSync(file, 'utf8')).runs ?? []).includes(id)) continue;
      move(file);
      judgments.push(path.relative(judgeRoot, file).split(path.sep).join('/'));
    }
    const usd = record.reusedFrom ? 0 : record.cost?.usd ?? 0;
    recordDiscarded(outDir, { id, kind: 'redo', message: `--redo; record moved to ${path.relative(outDir, dir)}`, usd, at });
    result.runs.push({ id, usd, judgments });
  }
  return result;
}
