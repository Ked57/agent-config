import fs from 'node:fs';
import path from 'node:path';

export const harnessNames = { claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor' };
const placeholder = /\{\{models\.([a-z][a-z0-9-]*)\}\}/g;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const validate = (value, file) => {
  if (!isRecord(value)) throw new Error(`Invalid ${file}: expected an object keyed by harness`);
  for (const [harness, roles] of Object.entries(value)) {
    if (!Object.hasOwn(harnessNames, harness)) throw new Error(`Invalid ${file}: unknown harness ${harness}`);
    if (!isRecord(roles)) throw new Error(`Invalid ${file}: ${harness} must map roles to models`);
    for (const [role, model] of Object.entries(roles)) {
      if (!/^[a-z][a-z0-9-]*$/.test(role)) throw new Error(`Invalid ${file}: invalid role ${harness}.${role}`);
      if (typeof model !== 'string' || !model.trim() || /[`\n]/.test(model)) {
        throw new Error(`Invalid ${file}: ${harness}.${role} must be a non-empty model name`);
      }
    }
  }
  return value;
};

const readModels = (file) => {
  if (!fs.existsSync(file)) return {};
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid ${file}: ${error.message}`);
  }
  return validate(parsed, file);
};

export const loadModels = ({ sourceRoot, overrideFile }) => {
  const defaults = readModels(path.join(sourceRoot, 'models.json'));
  const overrides = overrideFile ? readModels(overrideFile) : {};
  const roles = new Set(Object.values(defaults).flatMap((entry) => Object.keys(entry)));
  for (const [harness, entry] of Object.entries(overrides)) {
    for (const role of Object.keys(entry)) {
      if (!roles.has(role)) throw new Error(`Invalid ${overrideFile}: ${harness}.${role} is not a role declared in models.json`);
    }
  }
  const models = Object.fromEntries(Object.keys(harnessNames).map((harness) => [
    harness,
    { ...defaults[harness], ...overrides[harness] }
  ]));
  return { models, roles };
};

export const renderModels = (contents, harnesses, { models, roles }) => contents.replace(placeholder, (_, role) => {
  if (!roles.has(role)) throw new Error(`Unknown model role {{models.${role}}}; declare it in models.json`);
  const values = harnesses.map((harness) => `\`${models[harness][role] ?? 'unset'}\``);
  if (new Set(values).size === 1) return values[0];
  return harnesses.map((harness, index) => `${values[index]} in ${harnessNames[harness]}`).join(', ');
});
