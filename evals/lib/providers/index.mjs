// Provider registry. An agent provider implements runAgent/parseTranscript/ask; a judge-only
// provider implements ask. Adding Codex means adding a module here, not changing the orchestrator.
import { claudeProvider } from './claude.mjs';
import { commandProvider } from './command.mjs';

const agentProviders = { claude: claudeProvider };

export function agentProvider(name) {
  const provider = agentProviders[name];
  if (!provider) throw new Error(`Unknown provider: ${name} (available: ${Object.keys(agentProviders).join(', ')})`);
  return provider;
}

export function judgeProvider(config) {
  if (config.judgeProvider === 'command') return commandProvider(config.judgeCommand);
  return agentProvider(config.judgeProvider);
}
