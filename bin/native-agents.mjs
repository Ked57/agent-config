import fs from 'node:fs';
import path from 'node:path';

export function discoverAgents(sourceRoot, userHome) {
  const directory = path.join(sourceRoot, 'agents');
  if (!fs.existsSync(directory)) return [];
  const result = [];
  const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const files = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => {
    if (!entry.isFile() || !/^[a-z][a-z0-9-]*\.md$/.test(entry.name)) throw new Error(`Invalid agent source: ${path.join(directory, entry.name)}`);
    return entry.name;
  });
  for (const file of files) {
    const contents = read(path.join(directory, file));
    if (!contents.trim()) throw new Error(`Empty shared agent: ${file}`);
    result.push({
      key: `agent:${file}`,
      destination: path.join(userHome, '.agents/agents', file),
      contents: `<!-- agent-config:managed -->\n${contents.replace(/^<!-- agent-config:managed -->\n/, '')}`
    });
  }
  return result;
}
