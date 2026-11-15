// Pure analysis of a run: unified-diff parsing, task checks, feature counts, policy/skill telemetry.
import { matchesAny } from './config.mjs';

/**
 * Parses `diff -ruN a b` output whose paths were rewritten to `a/...` and `b/...`.
 * Returns changed files (relative paths) with their added lines.
 */
export function parseUnifiedDiff(text) {
  const files = [];
  let current = null;
  for (const line of text.split('\n')) {
    const header = /^\+\+\+ b\/(\S+)/.exec(line);
    const binary = /^Binary files a\/\S+ and b\/(\S+) differ$/.exec(line);
    if (header) {
      current = { path: header[1], added: [], removed: 0, binary: false };
      files.push(current);
    } else if (binary) {
      files.push({ path: binary[1], added: [], removed: 0, binary: true });
      current = null;
    } else if (current && line.startsWith('+')) {
      current.added.push(line.slice(1));
    } else if (current && line.startsWith('-') && !line.startsWith('---')) {
      current.removed += 1;
    }
  }
  return {
    files,
    changedFiles: files.map((file) => file.path),
    added: files.flatMap((file) => file.added),
    addedLines: files.reduce((sum, file) => sum + file.added.length, 0),
    removedLines: files.reduce((sum, file) => sum + file.removed, 0)
  };
}

/**
 * Evaluates a task's checks.
 * `readFinal(globs)` returns `[{ path, content }]` for current files matching the globs.
 */
export function evaluateChecks(checks = [], diff, readFinal) {
  // `command` checks execute code and are evaluated by measure.mjs.
  return checks.filter((check) => check.type !== 'command').map((check) => {
    const level = check.level ?? 'required';
    if (check.type === 'changed') {
      const hits = diff.changedFiles.filter((file) => matchesAny(file, check.files));
      const pass = check.expect === 'any' ? hits.length > 0 : hits.length === 0;
      return { id: check.id, label: check.label ?? check.id, level, pass, detail: hits.slice(0, 5).join(', ') };
    }
    const pattern = new RegExp(check.pattern, 'm');
    let hits;
    if (check.in === 'added') {
      const files = check.files ? diff.files.filter((file) => matchesAny(file.path, check.files)) : diff.files;
      hits = files.flatMap((file) => file.added.filter((line) => pattern.test(line)).map(() => file.path));
    } else {
      hits = readFinal(check.files).filter((file) => pattern.test(file.content)).map((file) => file.path);
    }
    const pass = check.expect === 'present' ? hits.length > 0 : hits.length === 0;
    return { id: check.id, label: check.label ?? check.id, level, pass, detail: [...new Set(hits)].slice(0, 5).join(', ') };
  });
}

/** Counts, per named pattern, how many added lines match. Zero counts are omitted. */
export function countFeatures(patterns = {}, addedLines = []) {
  const counts = {};
  for (const [name, source] of Object.entries(patterns)) {
    const pattern = new RegExp(source);
    const count = addedLines.filter((line) => pattern.test(line)).length;
    if (count > 0) counts[name] = count;
  }
  return counts;
}

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Detects which policies and skills an agent consulted.
 * `events` is a provider-normalised transcript: `{ reads: string[], commands: string[], skills: string[] }`.
 * A policy counts as read when a Read targeted `.../policy/<name>.md` or a shell command named
 * `<name>.md` (agents often `cat $P/<name>.md`). If the task set defines a `commandPattern`
 * signal for the policy, `fired` means the agent acted on it; otherwise `fired` means read.
 */
export function detectPolicies(events, { policies = [], skills = [], signals = {} }) {
  const result = { policies: {}, skills: {} };
  for (const name of policies) {
    const file = new RegExp(`(^|[\\s/"'$=])${escape(name)}\\.md\\b`);
    const read = events.reads.some((path) => path.endsWith(`/policy/${name}.md`))
      || events.commands.some((command) => file.test(command) && /polic/i.test(command));
    const signal = signals[name]?.commandPattern ? new RegExp(signals[name].commandPattern, 'g') : null;
    const signalHits = signal ? events.commands.reduce((sum, command) => sum + (command.match(signal)?.length ?? 0), 0) : null;
    result.policies[name] = { read, signalHits, fired: signal ? signalHits > 0 : read };
  }
  for (const name of skills) {
    const path = `skills/${name}/SKILL.md`;
    const invoked = events.skills.some((skill) => skill === name || skill.endsWith(`:${name}`))
      || events.reads.some((read) => read.endsWith(path))
      || events.commands.some((command) => command.includes(path));
    result.skills[name] = { fired: invoked };
  }
  return result;
}

/** Dependency names present in `after` but not in `before` (npm-style manifests). */
export function newDependencies(before = {}, after = {}) {
  const names = (manifest) => new Set(Object.keys({ ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) }));
  const previous = names(before);
  return [...names(after)].filter((name) => !previous.has(name)).sort();
}
