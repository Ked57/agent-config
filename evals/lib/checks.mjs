// Pure analysis of a run: unified-diff parsing, task checks, feature counts, policy/skill telemetry.
import { matchesAny } from './config.mjs';

// A comment opener only counts at the start of a line or after whitespace or one of `;{}(),>`, so
// `https://…`, `"//cdn"` and globs such as `'src/**/*.ts'` stay code.
const COMMENT_START = /<!--|(?<![^\s;{}(),>])\/[/*]/;

/**
 * Blanks comment text (`//`, `/* *\/`, `<!-- -->`) in consecutive source lines so a check matches code,
 * not a remark about it. Heuristic, not a parser: a line starting with `*` is taken as a block-comment
 * body, which covers a diff hunk that begins inside a JSDoc block.
 */
export function stripComments(lines) {
  let closer = null;
  return lines.map((line) => {
    if (!closer && /^\s*\*(\s|\/|$)/.test(line)) return '';
    let kept = '';
    let rest = line;
    for (;;) {
      if (closer) {
        const end = rest.indexOf(closer);
        if (end === -1) return kept;
        rest = rest.slice(end + closer.length);
        closer = null;
      }
      const start = COMMENT_START.exec(rest);
      if (!start) return kept + rest;
      kept += rest.slice(0, start.index);
      if (start[0] === '//') return kept;
      closer = start[0] === '<!--' ? '-->' : '*/';
      rest = rest.slice(start.index + start[0].length);
    }
  });
}

/**
 * Parses `diff -ruN a b` output whose paths were rewritten to `a/...` and `b/...`.
 * Returns changed files (relative paths) with their added lines; `code` is the added lines with
 * comments blanked, using each hunk's context lines to know where a comment starts.
 */
export function parseUnifiedDiff(text) {
  const files = [];
  let current = null;
  let hunk = [];
  const flushHunk = () => {
    if (current) {
      const stripped = stripComments(hunk.map((entry) => entry.text));
      current.code.push(...stripped.filter((_, index) => hunk[index].added));
    }
    hunk = [];
  };
  for (const line of text.split('\n')) {
    const header = /^\+\+\+ b\/(\S+)/.exec(line);
    const binary = /^Binary files a\/\S+ and b\/(\S+) differ$/.exec(line);
    if (header) {
      flushHunk();
      current = { path: header[1], added: [], code: [], removed: 0, binary: false };
      files.push(current);
    } else if (binary) {
      flushHunk();
      files.push({ path: binary[1], added: [], code: [], removed: 0, binary: true });
      current = null;
    } else if (line.startsWith('@@')) {
      flushHunk();
    } else if (current && line.startsWith('+')) {
      current.added.push(line.slice(1));
      hunk.push({ text: line.slice(1), added: true });
    } else if (current && line.startsWith(' ')) {
      hunk.push({ text: line.slice(1), added: false });
    } else if (current && line.startsWith('-') && !line.startsWith('---')) {
      current.removed += 1;
    }
  }
  flushHunk();
  return {
    files,
    changedFiles: files.map((file) => file.path),
    added: files.flatMap((file) => file.added),
    code: files.flatMap((file) => file.code),
    addedLines: files.reduce((sum, file) => sum + file.added.length, 0),
    removedLines: files.reduce((sum, file) => sum + file.removed, 0)
  };
}

/**
 * Evaluates a task's checks. Pattern checks match code with comments blanked (see `stripComments`);
 * `"comments": true` on a check matches the raw text instead.
 * `readFinal(globs)` returns `[{ path, content }]` for current files matching the globs.
 */
export function evaluateChecks(checks = [], diff, readFinal) {
  // `command` checks execute code and are evaluated by measure.mjs.
  return checks.filter((check) => check.type !== 'command').map((check) => {
    const level = check.level ?? 'required';
    if (check.type === 'changed') {
      const hits = diff.changedFiles.filter((file) => matchesAny(file, check.files));
      const pass = check.expect === 'any' ? hits.length > 0 : hits.length === 0;
      return { id: check.id, label: check.label ?? check.id, level, pass, score: pass ? 1 : 0, detail: hits.slice(0, 5).join(', ') };
    }
    const pattern = new RegExp(check.pattern, 'm');
    let hits;
    if (check.in === 'added') {
      const files = check.files ? diff.files.filter((file) => matchesAny(file.path, check.files)) : diff.files;
      hits = files.flatMap((file) => (check.comments ? file.added : file.code).filter((line) => pattern.test(line)).map(() => file.path));
    } else {
      const text = (content) => (check.comments ? content : stripComments(content.split('\n')).join('\n'));
      hits = readFinal(check.files).filter((file) => pattern.test(text(file.content))).map((file) => file.path);
    }
    const pass = check.expect === 'present' ? hits.length > 0 : hits.length === 0;
    return { id: check.id, label: check.label ?? check.id, level, pass, score: pass ? 1 : 0, detail: [...new Set(hits)].slice(0, 5).join(', ') };
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

/** Slash commands a run was started with or expanded: `/<name>` at the start of the prompt, plus `<command-name>` tags. */
export function slashInvocations({ prompt = '', commandTags = [] } = {}) {
  const fromPrompt = /^\s*\/([A-Za-z0-9._-]+(?::[A-Za-z0-9._-]+)?)/.exec(prompt ?? '')?.[1];
  return [...new Set([...(fromPrompt ? [fromPrompt] : []), ...commandTags.map((tag) => tag.replace(/^\//, ''))])];
}

/** `<command-name>/x:y</command-name>` tags in a raw transcript: Claude Code's record of an expanded slash command. */
export const commandTags = (transcript) => [...String(transcript).matchAll(/<command-name>\s*(\/?[^<\s]+)\s*<\/command-name>/g)].map((match) => match[1]);

/**
 * Subagent types the agent started: `subagent_type` of every `Task`/`Agent` tool call in a
 * stream-json transcript (one entry per call; "general-purpose" when the call names none).
 */
export function subagentCalls(transcript) {
  const types = [];
  for (const line of String(transcript).split('\n')) {
    if (!line.includes('"tool_use"')) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    for (const block of message?.message?.content ?? []) {
      if (block?.type === 'tool_use' && (block.name === 'Task' || block.name === 'Agent')) types.push(String(block.input?.subagent_type ?? 'general-purpose'));
    }
  }
  return types;
}

/**
 * Whether a plugin fired, given the skill invocations and subagent types of a run: a
 * `<plugin>:<x>` name, or a bare name listed in the plugin's own `skills`/`agents` (from the arm
 * inventory) that no standalone skill claims. Returns the matching names.
 */
export function pluginUse(plugin, { invocations = [], subagents = [], standaloneSkills = [] }) {
  const name = typeof plugin === 'string' ? plugin : plugin.name;
  const own = new Set([...(plugin.skills ?? []), ...(plugin.agents ?? [])].filter((entry) => !standaloneSkills.includes(entry)));
  return [...new Set([...invocations, ...subagents].filter((entry) => entry.startsWith(`${name}:`) || own.has(entry)))].sort();
}

/**
 * Detects which policies, skills and plugins an agent consulted.
 * `events` is a provider-normalised transcript: `{ reads: string[], commands: string[], skills: string[] }`.
 * A policy counts as read when a Read targeted `.../policy/<name>.md` or a shell command named
 * `<name>.md` (agents often `cat $P/<name>.md`). If the task set defines a `commandPattern`
 * signal for the policy, `fired` means the agent acted on it; otherwise `fired` means read.
 * A skill fires on a `Skill` call naming it (bare or `<plugin>:<name>`), a read of its SKILL.md, or a
 * slash invocation (`prompt` starting with `/<name>`, or an expanded `<command-name>` tag in
 * `commandTags`). A plugin fires when any of its skills fires that way or one of its agents runs as a
 * subagent (see `pluginUse`). `plugins` are names or inventory entries `{ name, skills, agents }`;
 * `subagents` are the run's subagent types, reported as counts.
 */
export function detectPolicies(events, { policies = [], skills = [], plugins = [], signals = {}, prompt = '', commandTags = [], subagents = [] }) {
  const result = { policies: {}, skills: {}, plugins: {} };
  const slash = slashInvocations({ prompt, commandTags });
  const invocations = [...events.skills, ...slash];
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
    const invoked = invocations.some((skill) => skill === name || skill.endsWith(`:${name}`))
      || events.reads.some((read) => read.endsWith(path))
      || events.commands.some((command) => command.includes(path));
    result.skills[name] = { fired: invoked };
  }
  for (const plugin of plugins) {
    const used = pluginUse(plugin, { invocations, subagents, standaloneSkills: skills });
    result.plugins[typeof plugin === 'string' ? plugin : plugin.name] = { fired: used.length > 0, skills: used };
  }
  const subagentCounts = {};
  for (const type of subagents) subagentCounts[type] = (subagentCounts[type] ?? 0) + 1;
  result.subagents = subagentCounts;
  return result;
}

/**
 * Reads a Vitest `--reporter=json` report. Counts test cases that ran (passed or failed; skipped
 * and todo are left out). `loadFailed` lists test files that failed without running any test
 * (import or syntax errors). Returns null when the text is not a Vitest JSON report.
 */
export function parseVitestJson(text) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(report?.testResults)) return null;
  const cases = report.testResults.flatMap((file) => file.assertionResults ?? []);
  const failed = cases.filter((test) => test.status === 'failed');
  return {
    passed: cases.filter((test) => test.status === 'passed').length,
    total: cases.filter((test) => test.status === 'passed' || test.status === 'failed').length,
    failed: failed.map((test) => test.fullName ?? test.title),
    loadFailed: report.testResults.filter((file) => file.status === 'failed' && !(file.assertionResults ?? []).length)
      .map((file) => ({ file: String(file.name ?? '').split('/').slice(-2).join('/'), message: String(file.message ?? '').slice(0, 300) }))
  };
}

/** Score of one check result: its `score` when it has one (Vitest-scored command checks), else 1 for a pass and 0 for a fail. */
export const checkScore = (check) => (typeof check?.score === 'number' ? check.score : check?.pass ? 1 : 0);

/**
 * Run score: mean score of the required checks, or 0 when the run did not finish (`status` other than
 * `ok`) or a fixture gate failed. `score` is null when the task has no required checks. `allPass`
 * means every required check and every gate passed. Old records without check scores are scored
 * from `pass`.
 */
export function scoreRun(run) {
  const required = (run.checks ?? []).filter((check) => check && (check.level ?? 'required') === 'required');
  const finished = run.status === 'ok' && run.gatesPass !== false;
  if (!required.length) return { score: null, allPass: finished };
  return {
    score: finished ? required.reduce((sum, check) => sum + checkScore(check), 0) / required.length : 0,
    allPass: finished && required.every((check) => check.pass)
  };
}

/** Dependency names present in `after` but not in `before` (npm-style manifests). */
export function newDependencies(before = {}, after = {}) {
  const names = (manifest) => new Set(Object.keys({ ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) }));
  const previous = names(before);
  return [...names(after)].filter((name) => !previous.has(name)).sort();
}
