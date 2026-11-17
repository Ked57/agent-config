// Hidden structural check for policy/domain-module.md, run from the worked app:
//   node domain-structure.mjs <dir> <domain> <rule>
// Rules: files | interface-types-only | layers | mock-not-in-production. Exits 1 with the reason.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [dir, domain, rule] = process.argv.slice(2);
const require = createRequire(path.join(process.cwd(), "package.json"));
const ts = require("typescript");
const file = (kind) => path.join(dir, `${domain}.${kind}.ts`);
const kinds = ["model", "interface", "service", "mock"];
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const missing = kinds.filter((kind) => !fs.existsSync(file(kind)));
if (missing.length) fail(`missing ${missing.map(file).join(", ")}`);

const imports = (source) => {
  const text = fs.readFileSync(source, "utf8");
  const info = ts.preProcessFile(text, true, true);
  return info.importedFiles.map((item) => item.fileName);
};

if (rule === "interface-types-only") {
  // Declares capabilities, not implementations: nothing survives transpilation.
  const out = ts.transpileModule(fs.readFileSync(file("interface"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  const code = out
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/export\s*\{\s*\};?/g, "")
    .trim();
  if (code) fail(`${file("interface")} has runtime code:\n${code.slice(0, 400)}`);
} else if (rule === "layers") {
  const forbidden = {
    model: /(^|\/)(db|routes|plugins)(\/|$)|drizzle|elysia|@libsql|\.service$|\.mock$|\.interface$/,
    service: /elysia|(^|\/)(routes|plugins)(\/|$)|\.mock$/,
  };
  for (const [kind, pattern] of Object.entries(forbidden)) {
    const bad = imports(file(kind)).filter((name) => pattern.test(name.replace(/\.(ts|js)$/, "")));
    if (bad.length) fail(`${file(kind)} imports ${bad.join(", ")}`);
  }
  const serviceImports = imports(file("service")).map((name) => name.replace(/\.(ts|js)$/, ""));
  if (!serviceImports.some((name) => name.endsWith(`${domain}.interface`))) fail(`${file("service")} does not depend on ${domain}.interface`);
} else if (rule === "mock-not-in-production") {
  const offenders = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "__hidden__", "test"].includes(entry.name)) visit(full);
      } else if (/\.ts$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name) && full !== file("mock")) {
        if (imports(full).some((name) => name.replace(/\.(ts|js)$/, "").endsWith(`${domain}.mock`))) offenders.push(full);
      }
    }
  };
  visit("src");
  if (offenders.length) fail(`production code imports ${domain}.mock: ${offenders.join(", ")}`);
  const mockImports = imports(file("mock")).map((name) => name.replace(/\.(ts|js)$/, ""));
  if (!mockImports.some((name) => name.endsWith(`${domain}.interface`) || name.endsWith(`${domain}.model`))) {
    fail(`${file("mock")} is not typed against ${domain}.model or ${domain}.interface`);
  }
} else if (rule !== "files") {
  fail(`unknown rule ${rule}`);
}
console.log(`${rule}: ok`);
