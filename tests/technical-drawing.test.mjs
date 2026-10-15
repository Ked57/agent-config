import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scripts = fileURLToPath(new URL('../skills/technical-drawing/scripts/', import.meta.url));
for (const name of ['geometry', 'render-queue', 'theme', 'viewer-builder']) {
  test(`vendored technical drawing ${name} regressions`, () => {
    execFileSync(process.execPath, [path.join(scripts, `test-${name}.cjs`)], { stdio: 'pipe' });
  });
}
