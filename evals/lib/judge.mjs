// Blind pairwise judging: prompt construction, reply parsing and verdict combination (pure),
// plus the retrying runner that calls a judge provider.

export const DIMENSIONS = ['correctness', 'accessibility', 'fit', 'platform', 'scope'];

/**
 * Removes what a saved `diff -ruN` patch reveals beyond the change itself: the command line (its
 * `--exclude=.eval-ready` arguments name the harness) and the file timestamps (when, and for how
 * long, each run edited files). Applied to both patches before the judge sees them.
 */
export function sanitisePatch(patch) {
  return String(patch)
    .replace(/^diff (?:(?:'-[^'\n]*'|-\S+) )+/gm, 'diff ')
    .replace(/^((?:---|\+\+\+) [^\t\n]+)\t\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)? [+-]\d{4}$/gm, '$1');
}

export function buildJudgePrompt({ context, task, patch1, patch2 }) {
  [patch1, patch2] = [sanitisePatch(patch1), sanitisePatch(patch2)];
  return `You are reviewing two independent patches to the same codebase. ${context ?? ''}

Score each patch from 1 (poor) to 5 (excellent) on:
- correctness: does it fully and correctly do what the task asks, without bugs?
- accessibility: keyboard, focus, semantics, labels, announcements, as relevant to the task (3 when not applicable).
- fit: idiomatic for this codebase's frameworks and existing patterns; no needless parallel abstractions.
- platform: appropriate use of modern platform features with suitable support or fallbacks for the stated target. Do not reward novelty for its own sake; score 3 when the task gives no meaningful opportunity.
- scope: does only what was asked, no unrelated changes, no unnecessary dependencies.
Then give an overall preference: "1", "2", or "tie". Prefer "tie" when the patches are of equivalent quality.

Respond with ONLY a JSON object, no prose before or after:
{"patch1":{"correctness":n,"accessibility":n,"fit":n,"platform":n,"scope":n,"notes":"<=40 words"},"patch2":{...same...},"preference":"1"|"2"|"tie","reason":"<=50 words"}

## Task given to the developer

${task}

## Patch 1

\`\`\`diff
${patch1}
\`\`\`

## Patch 2

\`\`\`diff
${patch2}
\`\`\`
`;
}

/** Extracts and validates the judge's JSON. Returns `{ ok: true, value }` or `{ ok: false, error }`. */
export function parseJudgeReply(text) {
  if (typeof text !== 'string') return { ok: false, error: 'reply is not text' };
  const unfenced = text.replace(/```(?:json)?/g, '');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return { ok: false, error: 'no JSON object found' };
  let value;
  try {
    value = JSON.parse(unfenced.slice(start, end + 1));
  } catch (error) {
    return { ok: false, error: `invalid JSON: ${error.message}` };
  }
  for (const side of ['patch1', 'patch2']) {
    for (const dimension of DIMENSIONS) {
      const score = value?.[side]?.[dimension];
      if (!Number.isInteger(score) || score < 1 || score > 5) return { ok: false, error: `${side}.${dimension} must be an integer 1-5` };
    }
  }
  const preference = String(value.preference ?? '').trim().toLowerCase();
  if (!['1', '2', 'tie'].includes(preference)) return { ok: false, error: 'preference must be "1", "2" or "tie"' };
  value.preference = preference;
  return { ok: true, value };
}

export const overallScore = (scores) => DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension], 0) / DIMENSIONS.length;

/**
 * Combines one or more verdicts on the same pair. Each verdict is `{ order: [left, right], value }`
 * where `value` is a parsed reply and `order` maps patch1/patch2 to side keys. Scores are averaged per
 * side. A side wins when it has more votes than the other side and more than half as many as the
 * ties, so with two verdicts an order-dependent flip is a tie, but one vote for a side plus one tie
 * is a win for that side (`unanimous` is false in both cases).
 */
export function combineVerdicts(verdicts, sides) {
  const scores = Object.fromEntries(sides.map((side) => [side, Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 0]))]));
  const votes = Object.fromEntries([...sides, 'tie'].map((key) => [key, 0]));
  const notes = Object.fromEntries(sides.map((side) => [side, []]));
  const reasons = [];
  for (const { order, value } of verdicts) {
    const bySide = { [order[0]]: value.patch1, [order[1]]: value.patch2 };
    for (const side of sides) {
      for (const dimension of DIMENSIONS) scores[side][dimension] += bySide[side][dimension] / verdicts.length;
      if (bySide[side].notes) notes[side].push(bySide[side].notes);
    }
    votes[value.preference === 'tie' ? 'tie' : value.preference === '1' ? order[0] : order[1]] += 1;
    if (value.reason) reasons.push(value.reason);
  }
  for (const side of sides) scores[side].overall = overallScore(scores[side]);
  const [first, second] = sides;
  const preference = votes[first] > votes[second] && votes[first] > votes.tie / 2 ? first
    : votes[second] > votes[first] && votes[second] > votes.tie / 2 ? second : 'tie';
  const unanimous = Object.values(votes).filter((count) => count > 0).length === 1;
  return { scores, preference, votes, unanimous, notes, reasons };
}

/**
 * Judges one pair `repeats` times, alternating presentation order (the first order is random).
 * `ask(prompt)` must resolve to `{ text, costUsd }`. Malformed replies are retried up to `retries` times.
 */
export async function judgePair({ ask, buildPrompt, sides, repeats = 2, retries = 2, random = Math.random }) {
  const verdicts = [];
  let costUsd = 0;
  const firstFlipped = random() < 0.5;
  for (let index = 0; index < repeats; index += 1) {
    const flipped = index % 2 === 0 ? firstFlipped : !firstFlipped;
    const order = flipped ? [sides[1], sides[0]] : [sides[0], sides[1]];
    const prompt = buildPrompt(order);
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const reply = await ask(prompt);
      costUsd += reply.costUsd ?? 0;
      const parsed = parseJudgeReply(reply.text);
      if (parsed.ok) {
        verdicts.push({ order, value: parsed.value });
        lastError = null;
        break;
      }
      lastError = parsed.error;
    }
    if (lastError) throw new Error(`judge reply malformed after ${retries + 1} attempts: ${lastError}`);
  }
  // Keep each verdict with its presentation order so position bias can be audited from the record.
  const calls = verdicts.map(({ order, value }) => ({ order, preference: value.preference, overall: [overallScore(value.patch1), overallScore(value.patch2)] }));
  return { ...combineVerdicts(verdicts, sides), repeats: verdicts.length, calls, costUsd };
}
