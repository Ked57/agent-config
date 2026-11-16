// Pure statistics for the task-level paired comparison: Student t quantiles, paired-t and bootstrap
// confidence intervals, minimum detectable effect, and the number of tasks a target MDE needs.

const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

function logGamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let sum = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i += 1) sum += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

// Continued fraction for the regularised incomplete beta function (Numerical Recipes, betacf).
function betaContinuedFraction(x, a, b) {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return h;
}

function regularisedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaContinuedFraction(x, a, b)) / a : 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

/** Student t cumulative distribution with `df` degrees of freedom. */
export function tCdf(t, df) {
  const tail = 0.5 * regularisedBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

// Acklam's rational approximation to the standard normal quantile (relative error < 1.2e-9).
function normalQuantile(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Quantile of Student's t (inverse CDF) by bisection on the exact CDF; normal quantile for df above 1e6. */
export function tQuantile(p, df) {
  if (!(p > 0 && p < 1) || !(df > 0)) throw new RangeError(`tQuantile needs 0 < p < 1 and df > 0 (got p=${p}, df=${df})`);
  if (p === 0.5) return 0;
  if (p < 0.5) return -tQuantile(1 - p, df);
  if (df > 1e6) return normalQuantile(p);
  let lo = 0;
  let hi = 2;
  while (tCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-12; i += 1) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Deterministic PRNG (mulberry32) so bootstrap intervals are reproducible. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

export function sampleSd(values) {
  if (values.length < 2) return null;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}

const percentile = (sorted, q) => {
  const position = (sorted.length - 1) * q;
  const below = Math.floor(position);
  return sorted[below] + (sorted[Math.min(below + 1, sorted.length - 1)] - sorted[below]) * (position - below);
};

/**
 * Percentile bootstrap CI of `statistic(sample)` resampling the items (tasks) with replacement.
 * Returns null for fewer than 2 items.
 */
export function bootstrapCi(items, statistic, { resamples = 10000, seed = 1, level = 0.95 } = {}) {
  if (items.length < 2) return null;
  const random = seededRandom(seed);
  const values = [];
  const sample = new Array(items.length);
  for (let r = 0; r < resamples; r += 1) {
    for (let i = 0; i < items.length; i += 1) sample[i] = items[Math.floor(random() * items.length)];
    const value = statistic(sample);
    if (value !== null && Number.isFinite(value)) values.push(value);
  }
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  return [percentile(values, (1 - level) / 2), percentile(values, 1 - (1 - level) / 2)];
}

/** Minimum detectable effect at 80% power, two-sided alpha 0.05, for a paired t test over `tasks` tasks. */
export function mde(sd, tasks) {
  if (sd === null || tasks < 2) return null;
  return ((tQuantile(0.975, tasks - 1) + tQuantile(0.8, tasks - 1)) * sd) / Math.sqrt(tasks);
}

/** Smallest number of tasks (at least `minTasks`) whose MDE at this SD is at most `target`. */
export function tasksNeeded(sd, target, minTasks = 5) {
  if (sd === null) return null;
  if (sd === 0) return minTasks;
  // The t quantiles exceed the normal ones, so the normal-approximation count is a lower bound.
  let tasks = Math.max(2, Math.ceil(((2.8 * sd) / target) ** 2));
  while (mde(sd, tasks) > target) tasks += 1;
  return Math.max(minTasks, tasks);
}

/**
 * Paired comparison over per-task differences d_t = B_t − A_t: mean, SD, paired-t 95% CI, seeded
 * task-level bootstrap 95% CI, MDE and tasks needed for an MDE of 0.10 and 0.20. Each task is one
 * sample; reps only enter through the task means.
 */
export function pairedStats(diffs, { seed = 1, resamples = 10000 } = {}) {
  const tasks = diffs.length;
  const m = mean(diffs);
  const sd = sampleSd(diffs);
  const half = sd === null ? null : (tQuantile(0.975, tasks - 1) * sd) / Math.sqrt(tasks);
  return {
    tasks,
    mean: m,
    sd,
    ci: half === null ? null : [m - half, m + half],
    bootstrapCi: bootstrapCi(diffs, mean, { seed, resamples }),
    mde: mde(sd, tasks),
    tasksNeeded: { '0.10': tasksNeeded(sd, 0.1), '0.20': tasksNeeded(sd, 0.2) }
  };
}

/** Ratio of means B/A − 1 over paired tasks (`[{ a, b }]`), with a task-level bootstrap CI. */
export function ratioStats(pairs, { seed = 1, resamples = 10000 } = {}) {
  const ratio = (sample) => {
    const a = mean(sample.map((pair) => pair.a));
    return a ? mean(sample.map((pair) => pair.b)) / a - 1 : null;
  };
  return {
    tasks: pairs.length,
    meanA: mean(pairs.map((pair) => pair.a)),
    meanB: mean(pairs.map((pair) => pair.b)),
    mean: pairs.length ? ratio(pairs) : null,
    bootstrapCi: bootstrapCi(pairs, ratio, { seed, resamples })
  };
}
