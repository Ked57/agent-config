// A minimal stdio MCP server for tests: answers initialize, tools/list and one `echo` tool, and
// reports whether it can see the agent's credentials. Newline-delimited JSON-RPC on stdin/stdout.
import readline from 'node:readline';

const reply = (id, result) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
const tools = [{ name: 'echo', description: 'Echo the text back', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } }];

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  if (message.method === 'initialize') {
    reply(message.id, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'echo', version: '1.0.0' } });
  } else if (message.method === 'tools/list') reply(message.id, { tools });
  else if (message.method === 'tools/call') {
    const credentials = ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN'].filter((name) => process.env[name]);
    reply(message.id, { content: [{ type: 'text', text: `${message.params?.arguments?.text ?? ''}|credentials:${credentials.join(',') || 'none'}` }] });
  }
});
