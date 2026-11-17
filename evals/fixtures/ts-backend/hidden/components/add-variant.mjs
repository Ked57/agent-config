// Hidden type-level check for policy/typescript.md's "a newly added variant must produce a
// compile-time failure until handled". Copies the worked app to a temp dir, adds a variant to a
// union in the production sources, and passes only when `tsc --noEmit` then fails.
//   node add-variant.mjs <regex> <replacement> [<regex> <replacement> ...]
// Every regex is applied (globally) to src/**/*.ts outside tests; at least one must match.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const app = process.cwd();
const pairs = process.argv.slice(2);
if (pairs.length === 0 || pairs.length % 2) {
  console.error("usage: add-variant.mjs <regex> <replacement> ...");
  process.exit(2);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), "add-variant-"));
const skip = new Set(["node_modules", "dist", "data", "__hidden__", ".git"]);
fs.cpSync(app, work, {
  recursive: true,
  filter: (source) => !skip.has(path.basename(source)) && !/\.db(-journal|-wal|-shm)?$/.test(source),
});
fs.symlinkSync(path.join(app, "node_modules"), path.join(work, "node_modules"));
const tsc = () =>
  spawnSync(path.join(app, "node_modules", ".bin", "tsc"), ["--noEmit", "-p", "tsconfig.json"], {
    cwd: work,
    encoding: "utf8",
  });

try {
  const before = tsc();
  if (before.status !== 0) {
    console.error(`the worked app does not compile before the variant is added:\n${before.stdout}`);
    process.exit(1);
  }
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "test") visit(full);
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(full);
    }
  };
  visit(path.join(work, "src"));
  let matched = 0;
  for (const file of files) {
    let text = fs.readFileSync(file, "utf8");
    const original = text;
    for (let index = 0; index < pairs.length; index += 2) {
      const regex = new RegExp(pairs[index], "g");
      text = text.replace(regex, () => {
        matched += 1;
        return pairs[index + 1];
      });
    }
    if (text !== original) fs.writeFileSync(file, text);
  }
  if (!matched) {
    console.error(`no union matched ${pairs.filter((_, i) => i % 2 === 0).join(" or ")}`);
    process.exit(1);
  }
  const after = tsc();
  if (after.status === 0) {
    console.error(`added the variant at ${matched} place(s) and the app still compiles: it is not handled exhaustively`);
    process.exit(1);
  }
  console.log(`added the variant at ${matched} place(s); tsc now fails as required:\n${after.stdout.split("\n").slice(0, 10).join("\n")}`);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
