import fs from 'node:fs';
import path from 'node:path';

// Authored native sources intentionally use a flat, scalar-only subset. Reject
// anything outside it instead of pretending to parse arbitrary YAML or TOML.
export function discoverAgents(sourceRoot, userHome, codexHome) {
  const result = [];
  const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const list = (directory, extension) => fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => {
    if (!entry.isFile() || !new RegExp(`^[a-z][a-z0-9-]*\\.${extension}$`).test(entry.name)) throw new Error(`Invalid agent source: ${path.join(directory, entry.name)}`);
    return entry.name;
  });
  const sharedDirectory = path.join(sourceRoot, 'agents');
  const shared = list(sharedDirectory, 'md');
  if (!shared.length) throw new Error('No shared agents found');
  for (const file of shared) {
    const contents = read(path.join(sharedDirectory, file));
    if (!contents.trim()) throw new Error(`Empty shared agent: ${file}`);
    result.push({ key: `agent:${file}`, destination: path.join(userHome, '.agents/agents', file), contents: `<!-- agent-config:managed -->\n${contents.replace(/^<!-- agent-config:managed -->\n/, '')}` });
  }
  for (const harness of ['codex', 'claude', 'cursor']) {
    const directory = path.join(sourceRoot, 'harnesses', harness, 'agents');
    const extension = harness === 'codex' ? 'toml' : 'md';
    const files = list(directory, extension);
    if (JSON.stringify(files.map((file) => file.replace(/\.[^.]+$/, ''))) !== JSON.stringify(shared.map((file) => file.slice(0, -3)))) throw new Error(`Native ${harness} agents must match shared roles`);
    for (const file of files) {
      const source = read(path.join(directory, file));
      const role = file.replace(/\.[^.]+$/, '');
      const codex = harness === 'codex';
      const frontmatter = codex ? null : /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
      if (!codex && !frontmatter) throw new Error(`Invalid frontmatter: ${harness}/${file}`);
      const fields = {};
      const allowed = codex ? ['name', 'description', 'model', 'model_reasoning_effort', 'developer_instructions'] : ['name', 'description', 'model', ...(harness === 'claude' ? ['effort'] : [])];
      for (const line of (codex ? source : frontmatter[1]).split('\n')) {
        if (!line.trim() || (codex && /^#/.test(line))) continue;
        const match = (codex ? /^([a-z_]+) = (.+)$/ : /^([a-z_]+): (.+)$/).exec(line);
        if (!match || !allowed.includes(match[1]) || Object.hasOwn(fields, match[1])) throw new Error(`Invalid or duplicate native field: ${harness}/${file}: ${line}`);
        let value = match[2];
        if (codex || value.startsWith('"')) {
          // JSON-only escapes shared with TOML basic strings; slash escapes and
          // surrogate code points are rejected because they are not TOML escapes.
          if (codex && (/\\\//.test(value) || /\\u[dD][89a-fA-F][0-9a-fA-F]{2}/.test(value))) throw new Error(`Invalid TOML escape: ${file}`);
          try { value = JSON.parse(value); } catch { throw new Error(`Invalid quoted scalar: ${harness}/${file}`); }
        } else if (!/^[a-zA-Z][a-zA-Z0-9 ._/-]*$/.test(value) || /^(true|false|null)$/i.test(value)) throw new Error(`Use double quotes for this scalar: ${harness}/${file}`);
        if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`Invalid scalar: ${harness}/${file}`);
        fields[match[1]] = value;
      }
      if (allowed.filter((field) => field !== 'effort').some((field) => !fields[field]) || fields.name !== role) throw new Error(`Missing fields or mismatched name: ${harness}/${file}`);
      const modelPattern = harness === 'cursor'
        ? /^[a-zA-Z0-9][a-zA-Z0-9._/-]*(?:\[effort=(?:none|minimal|low|medium|high|xhigh|max|ultra)\])?$/
        : /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;
      if (!modelPattern.test(fields.model)) throw new Error(`Invalid model or model options: ${harness}/${file}`);
      if (codex && !['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(fields.model_reasoning_effort)) throw new Error(`Invalid reasoning effort: ${file}`);
      if (fields.effort && !['low', 'medium', 'high', 'xhigh', 'max'].includes(fields.effort)) throw new Error(`Invalid effort: ${file}`);
      const instructions = codex ? fields.developer_instructions : frontmatter[2];
      if (!instructions.includes(`~/.agents/agents/${role}.md`)) throw new Error(`Missing shared agent pointer: ${harness}/${file}`);
      const contents = codex ? `# agent-config:managed\n${source.replace(/^# agent-config:managed\n/, '')}` : `---\n${frontmatter[1]}\n---\n<!-- agent-config:managed -->\n${frontmatter[2].replace(/^\s*<!-- agent-config:managed -->\n/, '').trimStart()}`;
      result.push({ key: `${harness}:agent:${file}`, destination: path.join(harness === 'codex' ? codexHome : path.join(userHome, `.${harness}`), 'agents', file), contents });
    }
  }
  return result;
}
