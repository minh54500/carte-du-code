// MCP server (stdio): lets an AI assistant ask the map questions directly instead of reading the whole Markdown.
// Newline-delimited JSON-RPC 2.0 on stdin/stdout; logs go to stderr only.
import { resolve, parse } from 'node:path';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { mapOf } from './generate.mjs';
import { index } from './query.mjs';
import { COLUMNS } from './render-md.mjs';

const VERSION = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).version;
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const project = { type: 'string', description: 'Project folder (default: the folder the assistant runs in)' };
const item = (what) => ({ type: 'string', description: `${what}: a file path, a label, a route or an id such as table:dishes` });

const TOOLS = [
  { name: 'overview', description: 'Summary of the project map: stack, how many items per column, pages, database tables, server endpoints, the most used files and the code health. Start here on an unknown project.',
    inputSchema: { type: 'object', properties: { project } } },
  { name: 'search', description: 'Find files, pages, tables, routes or env names matching a word (in the name, path or first comment).',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Word or part of a path' }, limit: { type: 'number', description: 'Max results (default 20)' }, project }, required: ['query'] } },
  { name: 'item', description: 'Everything about one item: its file, role, column, what it uses, who uses it, and how many items depend on it directly or not.',
    inputSchema: { type: 'object', properties: { item: item('The item'), project }, required: ['item'] } },
  { name: 'who_uses', description: 'Who uses an item. With deep=true: every item that depends on it, directly or not, i.e. what may break if it changes.',
    inputSchema: { type: 'object', properties: { item: item('The item'), deep: { type: 'boolean', description: 'Include indirect users (default false)' }, project }, required: ['item'] } },
  { name: 'uses', description: 'What an item uses. With deep=true: everything it depends on, directly or not.',
    inputSchema: { type: 'object', properties: { item: item('The item'), deep: { type: 'boolean', description: 'Include indirect dependencies (default false)' }, project }, required: ['item'] } },
  { name: 'path', description: 'The shortest chain of links between two items, e.g. from a page to a database table.',
    inputSchema: { type: 'object', properties: { from: item('Start'), to: item('End'), project }, required: ['from', 'to'] } },
  { name: 'health', description: 'Code health: files no other file imports (maybe unused), import cycles, and the sensitive files most others depend on.',
    inputSchema: { type: 'object', properties: { project } } },
];

// The map is rebuilt when older than a few seconds, so answers follow the files being edited.
const cache = new Map();
function load(dir) {
  const root = resolve(dir || process.cwd());
  if (!existsSync(root)) throw new Error(`Folder not found: ${root}`);
  if (root === parse(root).root || root === homedir()) throw new Error(`${root} is not a project folder: pass the project's own folder.`);
  const hit = cache.get(root);
  if (hit && Date.now() - hit.at < 3000) return hit;
  const map = mapOf(root, loadConfig(root));
  const entry = { at: Date.now(), map, q: index(map), roots: [...new Set([root, realpathSync(root)])] };
  cache.set(root, entry);
  return entry;
}

const line = (n) => `- ${n.label}${n.file && n.file !== n.label ? ` (${n.file})` : ''} [${n.col}]${n.desc ? ` : ${n.desc}` : ''}`;
const list = (nodes, max = 60) => nodes.length ? nodes.slice(0, max).map(line).join('\n') + (nodes.length > max ? `\n… +${nodes.length - max}` : '') : '(none)';

// Assistants often pass absolute or Windows paths: bring them back to the project's own relative path.
function relPath(roots, name) {
  let s = String(name ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
  for (const r of roots) { const p = r.replace(/\\/g, '/') + '/'; if (s.startsWith(p)) return s.slice(p.length); }
  return s;
}

function need({ q, roots }, name, label = 'item') {
  const n = q.find(relPath(roots, name));
  if (n) return n;
  const close = q.search(String(name).split('/').pop().replace(/\.\w+$/, ''), 5);
  throw new Error(`No ${label} matches "${name}".${close.length ? ` Close matches:\n${list(close)}` : ''}`);
}

function call(name, a = {}) {
  const loaded = load(a.project), { map, q } = loaded;
  switch (name) {
    case 'overview': {
      const count = COLUMNS.map((c) => `${c}: ${map.nodes.filter((n) => n.col === c).length}`).join(' · ');
      const pick = (c, max = 40) => list(map.nodes.filter((n) => n.col === c).sort((x, y) => (x.route ?? x.label).localeCompare(y.route ?? y.label)), max);
      const h = q.health();
      return [`Project ${map.name} · stack: ${map.kinds.join(', ') || 'unknown'} · ${map.nodes.length} items, ${map.edges.length} links`,
        `Columns (page → bloc → data → db → server → tool): ${count}`,
        `\nPages / entry points:\n${pick('page')}`, `\nDatabase:\n${pick('db')}`, `\nServer and jobs:\n${pick('server')}`,
        `\nMost used:\n${list([...map.nodes].sort((x, y) => y.uses - x.uses).slice(0, 10))}`,
        `\nHealth: ${h.unused.length} maybe unused, ${h.cycles.length} import cycle(s), sensitive: ${h.sensitive.slice(0, 5).map((x) => `${x.n.label} (${x.count})`).join(', ') || 'none'}`,
        map.env.size ? `\nEnv names: ${[...map.env.keys()].sort().join(', ')}` : ''].join('\n');
    }
    case 'search': return list(q.search(a.query, Number(a.limit) || 20));
    case 'item': {
      const n = need(loaded, a.item);
      return [line(n).slice(2), n.route ? `route: ${n.route}` : '', n.endpoint ? `endpoint: ${n.endpoint}` : '', n.badge ? `badge: ${n.badge}` : '',
        `\nUses:\n${list(q.uses(n.id))}`, `\nUsed by:\n${list(q.usedBy(n.id))}`,
        `\n${q.usedBy(n.id, true).length} item(s) depend on it directly or not; it depends on ${q.uses(n.id, true).length}.`].filter(Boolean).join('\n');
    }
    case 'who_uses': { const n = need(loaded, a.item); return `${a.deep ? 'Everything that depends on' : 'Used by'} ${n.label}:\n${list(q.usedBy(n.id, !!a.deep), 200)}`; }
    case 'uses': { const n = need(loaded, a.item); return `${a.deep ? 'Everything' : 'What'} ${n.label} ${a.deep ? 'depends on' : 'uses'}:\n${list(q.uses(n.id, !!a.deep), 200)}`; }
    case 'path': {
      const A = need(loaded, a.from, 'start'), B = need(loaded, a.to, 'end'), p = q.path(A.id, B.id);
      return p ? p.map((n) => `${n.label}${n.file && n.file !== n.label ? ` (${n.file})` : ''}`).join('\n→ ') : `No chain of links between ${A.label} and ${B.label}.`;
    }
    case 'health': {
      const h = q.health();
      return [`Maybe unused (no file imports them) (${h.unused.length}):\n${list(h.unused, 100)}`,
        `\nImport cycles (${h.cycles.length}):\n${h.cycles.map((c) => '- ' + c.map((n) => n.label).join(' ↔ ')).join('\n') || '(none)'}`,
        `\nSensitive files (most dependents):\n${h.sensitive.map((x) => `- ${x.n.label} (${x.n.file}) : ${x.count}`).join('\n') || '(none)'}`].join('\n');
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

const fail = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

export function handle(msg) {
  // a batch (2025-03-26) is answered as one array; an empty one is an invalid request
  if (Array.isArray(msg)) { if (!msg.length) return fail(null, -32600, 'Invalid Request'); const out = msg.map(handle).filter(Boolean); return out.length ? out : null; }
  if (!msg || typeof msg !== 'object') return fail(null, -32600, 'Invalid Request');
  if (typeof msg.method !== 'string') return 'result' in msg || 'error' in msg ? null : fail(msg.id, -32600, 'Invalid Request'); // the client's own answers need no reply
  const { id, method } = msg, params = msg.params && typeof msg.params === 'object' ? msg.params : {};
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  if (method === 'initialize') return ok({
    protocolVersion: PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
    capabilities: { tools: {} }, serverInfo: { name: 'carte-du-code', version: VERSION },
    instructions: 'Code map of the current project. Use these tools before searching files: overview first on an unknown project, then item, who_uses (deep=true before changing a shared file), uses, path and search.',
  });
  if (method === 'ping') return ok({});
  if (method === 'tools/list') return ok({ tools: TOOLS });
  if (method === 'tools/call') {
    // an unknown tool or a missing argument is a protocol error; a question the map cannot answer is a tool result
    const tool = TOOLS.find((x) => x.name === params.name), args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
    if (!tool) return fail(id, -32602, `Unknown tool: ${params.name}`);
    const missing = (tool.inputSchema.required || []).filter((k) => args[k] === undefined || args[k] === '');
    if (missing.length) return fail(id, -32602, `Missing argument(s) for ${tool.name}: ${missing.join(', ')}`);
    try { return ok({ content: [{ type: 'text', text: call(tool.name, args) }] }); }
    catch (e) { return ok({ content: [{ type: 'text', text: e.message }], isError: true }); }
  }
  if (id === undefined) return null; // notifications need no answer
  return fail(id, -32601, `Method not found: ${method}`);
}

export function serve(dir) {
  if (dir) process.chdir(resolve(dir));
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const raw = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!raw) continue;
      let msg, res;
      try { msg = JSON.parse(raw); } catch { process.stdout.write(JSON.stringify(fail(null, -32700, 'Parse error')) + '\n'); continue; }
      // one bad message must never stop the server
      try { res = handle(msg); } catch (e) { res = fail(msg?.id, -32603, `Internal error: ${e.message}`); }
      if (res) process.stdout.write(JSON.stringify(res) + '\n');
    }
  });
  process.stdin.on('end', () => process.exit(0));
}
