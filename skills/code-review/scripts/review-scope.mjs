#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const usage = 'Usage: node review-scope.mjs [--scope range|worktree|staged|unstaged] [--base <ref>]';
const git = (...args) => execFileSync('git', args, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024
});
const optionalGit = (...args) => { try { return git(...args).trim(); } catch { return null; } };
const commit = (ref) => optionalGit('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`);
const paths = (output) => output.split('\0').filter(Boolean);

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(usage);
    process.exit(0);
  }
  let scope;
  let baseRef;
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!['--scope', '--base'].includes(flag) || !value || value.startsWith('--')) throw new Error(usage);
    if (flag === '--scope') {
      if (scope) throw new Error('Duplicate --scope');
      scope = value;
    } else {
      if (baseRef) throw new Error('Duplicate --base');
      baseRef = value;
    }
  }
  const head = commit('HEAD');
  if (!head) throw new Error('Review requires a Git repository with a HEAD commit.');
  scope ??= baseRef ? 'range' : git('status', '--porcelain', '-z').length ? 'worktree' : 'range';
  if (!['range', 'worktree', 'staged', 'unstaged'].includes(scope)) throw new Error(`Invalid scope. ${usage}`);
  if (baseRef && scope !== 'range') throw new Error('--base applies only to a committed range.');

  let base = null;
  let commits = [];
  let diffArgs = ['diff', '--no-ext-diff', '--no-textconv', '--no-color'];
  if (scope === 'range') {
    baseRef ??= [optionalGit('symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'),
      'origin/main', 'main', 'origin/master', 'master'].find((ref) => ref && commit(ref));
    if (!baseRef) throw new Error('No base branch found; supply --base <ref>.');
    const baseCommit = commit(baseRef);
    if (!baseCommit) throw new Error(`Invalid base ref: ${baseRef}`);
    base = git('merge-base', baseCommit, head).trim();
    diffArgs.push(`${base}..${head}`);
    commits = git('log', '--format=%H %s', `${base}..${head}`).trim().split('\n').filter(Boolean);
  } else if (scope === 'staged') diffArgs.push('--cached', head);

  const diffs = scope === 'worktree' ? [[...diffArgs, '--cached', head], [...diffArgs]] : [diffArgs];
  const tracked = diffs.flatMap((args) => paths(git(...args, '--name-only', '-z', '--')));
  const untracked = scope === 'worktree' ? paths(git('ls-files', '--others', '--exclude-standard', '-z')) : [];
  const files = [...new Set([...tracked, ...untracked])].sort();
  if (!files.length) throw new Error(`No changes in ${scope} scope.`);
  console.log(JSON.stringify({ scope, baseRef: baseRef ?? null, base, head, diffs: diffs.map((args) => [...args, '--']), files, untracked, commits }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
