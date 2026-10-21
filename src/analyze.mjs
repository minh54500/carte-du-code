// The analysis: from the project's files to nodes (pages, blocks, data, database, server, tools) and links.
// No AI and no parser dependency: imports, routes, SQL migrations, Prisma models, host config and env names are read with patterns.
import { posix } from 'node:path';
import { scan } from './scan.mjs';

const { join, dirname, basename, normalize } = posix;
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ASSET = /\.(css|scss|sass|less|svg|png|jpe?g|webp|avif|gif|ico|woff2?|otf|ttf|mp4|webm|mp3)$/;

export function analyze(root, cfg, t) {
  const { files: ALL, has, read, json } = scan(root, cfg.ignore);
  const nodes = new Map();
  const edges = new Set();
  const node = (id, n) => { if (!nodes.has(id)) nodes.set(id, { id, uses: 0, ...n }); return nodes.get(id); };
  const link = (a, b, type = 'uses') => { if (a && b && a !== b && nodes.has(a) && nodes.has(b)) edges.add(`${a}\u0000${b}\u0000${type}`); };

  // ---------- stack ----------
  const pkg = json('package.json') || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const kinds = [];
  if (deps.astro) kinds.push('Astro');
  if (deps.next) kinds.push('Next.js');
  if (deps['@sveltejs/kit']) kinds.push('SvelteKit');
  if (deps.nuxt) kinds.push('Nuxt');
  if (deps['@remix-run/react'] || deps['react-router']) kinds.push('React Router');
  if (deps.vite && !kinds.length) kinds.push('Vite');
  if (deps.react && !deps.next && !kinds.includes('React Router')) kinds.push('React');
  if (deps.express) kinds.push('Express');
  if (deps.fastify) kinds.push('Fastify');
  if (ALL.some((f) => f.endsWith('.py'))) kinds.push('Python');
  if (ALL.some((f) => f.endsWith('.swift'))) kinds.push('Swift');
  if (ALL.some((f) => /(^|\/)supabase\/.*\.sql$/.test(f)) || deps['@supabase/supabase-js']) kinds.push('Supabase');
  if (ALL.some((f) => f.endsWith('.prisma')) || deps.prisma || deps['@prisma/client']) kinds.push('Prisma');
  if (has('vercel.json') || ALL.some((f) => f.startsWith('api/'))) kinds.push('Vercel');
  if (has('netlify.toml')) kinds.push('Netlify');
  if (has('wrangler.toml') || ALL.some((f) => /(^|\/)_headers$/.test(f))) kinds.push('Cloudflare');
  // workspaces (monorepos): apps/web, packages/ui… each with its own package.json; their names resolve to their entry
  const wsPatterns = [].concat(pkg.workspaces?.packages || pkg.workspaces || []);
  if (has('pnpm-workspace.yaml')) for (const m of read('pnpm-workspace.yaml').matchAll(/^\s*-\s*['"]?([^'"\n#]+)['"]?/gm)) wsPatterns.push(m[1].trim());
  const wsRe = wsPatterns.map((g) => new RegExp('^' + g.replace(/\/$/, '').replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.+').replace(/\*/g, '[^/]+') + '$'));
  const workspaces = [];
  for (const f of ALL) {
    const d = dirname(f);
    if (basename(f) !== 'package.json' || d === '.' || (wsRe.length && !wsRe.some((re) => re.test(d)))) continue;
    if (!wsRe.length) continue;
    const wp = json(f) || {};
    const entry = [wp.source, typeof wp.exports === 'string' ? wp.exports : wp.exports?.['.']?.import || wp.exports?.['.']?.default || (typeof wp.exports?.['.'] === 'string' ? wp.exports['.'] : null), wp.module, wp.main].find(Boolean);
    workspaces.push({ dir: d, name: wp.name || basename(d), entry: entry ? normalize(join(d, entry)) : null, deps: { ...wp.dependencies, ...wp.devDependencies } });
  }
  workspaces.sort((a, b) => b.dir.length - a.dir.length);
  if (workspaces.length) kinds.push('monorepo');
  for (const w of workspaces) {
    if (w.deps.astro && !kinds.includes('Astro')) kinds.push('Astro');
    if (w.deps.next && !kinds.includes('Next.js')) kinds.push('Next.js');
    if (w.deps['@sveltejs/kit'] && !kinds.includes('SvelteKit')) kinds.push('SvelteKit');
    if (w.deps.nuxt && !kinds.includes('Nuxt')) kinds.push('Nuxt');
    if (w.deps.express && !kinds.includes('Express')) kinds.push('Express');
    for (const [dep, k] of [['drizzle-orm', 'Drizzle'], ['mongoose', 'MongoDB'], ['firebase', 'Firebase'], ['@prisma/client', 'Prisma'], ['@supabase/supabase-js', 'Supabase']]) if (w.deps[dep] && !kinds.includes(k)) kinds.push(k);
  }
  const wsOf = (f) => workspaces.find((w) => f.startsWith(w.dir + '/')) || null;
  const inWs = (f) => { const w = wsOf(f); return w ? f.slice(w.dir.length + 1) : f; };
  if (ALL.some((f) => /(^|\/)(manage\.py|wsgi\.py|asgi\.py)$/.test(f)) || ALL.some((f) => /(^|\/)urls\.py$/.test(f))) kinds.push('Django');
  if (deps['drizzle-orm'] && !kinds.includes('Drizzle')) kinds.push('Drizzle');
  if ((deps.firebase || deps['firebase-admin']) && !kinds.includes('Firebase')) kinds.push('Firebase');
  if (deps.mongoose && !kinds.includes('MongoDB')) kinds.push('MongoDB');
  if (!kinds.length && has('package.json')) kinds.push('Node.js');
  const WEB = kinds.some((k) => ['Astro', 'Next.js', 'SvelteKit', 'Nuxt', 'Vite', 'React', 'React Router', 'Django'].includes(k)) || ALL.some((f) => /^[^/]+\.html?$/.test(f));

  // ---------- files as nodes ----------
  function describe(text, file) {
    // the comment at the top of a file says what it is for
    const body = file.endsWith('.astro') || file.endsWith('.svelte') || file.endsWith('.vue') ? text.replace(/^---\n?/, '').replace(/^\s*<script[^>]*>\s*/, '') : text.replace(/^#!.*\n/, '').replace(/^\s*['"]use (client|server|strict)['"];?\s*/, '');
    // a run of // or # lines counts as one comment; tool pragmas (@ts-check, eslint-disable…) are not a description
    const pragma = /^\s*(?:\/\/|#)\s*(?:@ts-|eslint|prettier|biome|jshint|global |-\*-|type: ?ignore|noqa|pylint|#?region)/;
    const lines = body.split('\n'); while (lines.length && pragma.test(lines[0])) lines.shift();
    const m = lines.join('\n').match(/^\s*(?:((?:[ \t]*\/\/.*(?:\n|$))+)|\/\*+\s*([\s\S]*?)\*\/|((?:[ \t]*#.*(?:\n|$))+)|<!--\s*([\s\S]*?)-->|"""([\s\S]*?)"""|'''([\s\S]*?)''')/);
    const s = (m && (m[1] || m[2] || m[3] || m[4] || m[5] || m[6]) || '').replace(/^[ \t]*(\/\/|#|\*)[ \t]?/gm, '').replace(/\s+/g, ' ').trim();
    if (s.length <= 160) return s;
    // long comments: up to the last full sentence that fits, else cut at a word
    const end = s.lastIndexOf('. ', 160);
    return end > 50 ? s.slice(0, end + 1) : s.slice(0, s.lastIndexOf(' ', 157)) + '…';
  }
  function routeOf(full) {
    const f = inWs(full);
    let m;
    if ((m = f.match(/^src\/pages\/(.+)\.(astro|md|mdx|html)$/)) && !/(^|\/)_/.test(m[1])) return '/' + m[1].replace(/(^|\/)index$/, '');
    if ((m = f.match(/^(?:src\/)?app\/(.*?)\/?page\.(tsx?|jsx?|mdx)$/))) return '/' + m[1].split('/').filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@')).join('/');
    if ((m = f.match(/^(?:src\/)?pages\/(.+)\.(tsx?|jsx?|vue)$/)) && !m[1].startsWith('api/') && !/^_/.test(basename(m[1]))) return '/' + m[1].replace(/(^|\/)index$/, '');
    if ((m = f.match(/^src\/routes\/(.*?)\/?\+page\.svelte$/))) return '/' + m[1].split('/').filter((s) => !/^\(.*\)$/.test(s)).join('/');
    if ((m = f.match(/^app\/routes\/(.+)\.(tsx?|jsx?)$/))) return '/' + m[1].replace(/\./g, '/').replace(/(^|\/)_index$/, '').replace(/\$(\w+)/g, ':$1');
    if ((m = f.match(/^pages\/(.+)\.vue$/)) && (deps.nuxt || wsOf(full)?.deps.nuxt)) return '/' + m[1].replace(/(^|\/)index$/, '');
    if (/^[^/]+\.html?$/.test(f)) return '/' + f.replace(/(^|\/)index\.html?$/, '').replace(/\.html?$/, '');
    return null;
  }
  function endpointOf(full) {
    const f = inWs(full);
    let m;
    if ((m = f.match(/^api\/(.+)\.(ts|js|mjs|py)$/)) && !basename(m[1]).startsWith('_')) return '/api/' + m[1].replace(/\/index$/, '');
    if ((m = f.match(/^src\/pages\/(.+)\.(ts|js)$/))) return '/' + m[1];
    if ((m = f.match(/^(?:src\/)?app\/(.*?)\/?route\.(ts|js)$/))) return '/' + m[1];
    if ((m = f.match(/^(?:src\/)?pages\/api\/(.+)\.(ts|js)$/))) return '/api/' + m[1].replace(/\/index$/, '');
    if ((m = f.match(/^src\/routes\/(.*?)\/?\+server\.(ts|js)$/))) return '/' + m[1];
    if ((m = f.match(/^netlify\/functions\/(.+)\.(ts|js|mjs)$/))) return '/.netlify/functions/' + m[1];
    if ((m = f.match(/^(?:supabase\/)?functions\/([\w-]+)\/index\.ts$/))) return '/functions/v1/' + m[1];
    if ((m = f.match(/^server\/api\/(.+)\.(ts|js)$/))) return '/api/' + m[1].replace(/\/index$/, '').replace(/\.(get|post|put|patch|delete)$/, '');
    if (/^(src\/)?middleware\.(ts|js)$/.test(f)) return '*';
    return null;
  }
  function columnOf(full, text) {
    if (routeOf(full) !== null) return 'page';
    if (endpointOf(full) !== null) return 'server';
    const f = inWs(full);
    if (/(^|\/)(data|content|i18n|locales|fixtures)\//.test(f) || /\.json$/.test(f)) return 'data';
    if (/^(scripts|tools|bin)\//.test(f) || /\/scripts\//.test(f) || /\.(config)\.(m?[jt]s|cjs)$/.test(f) || /\.(sh|command)$/.test(f)) return 'tool';
    if (f.endsWith('.py') && (/__name__\s*==\s*['"]__main__['"]/.test(text) || /@\w+\.(route|get|post|put|patch|delete)\(/.test(text))) return 'page';
    if (f.endsWith('.swift') && /@main\b|:\s*App\s*\{/.test(text)) return 'page';
    return 'bloc';
  }
  const short = (f) => basename(f).replace(/\.(astro|tsx?|jsx?|mjs|cjs|mts|cts|svelte|vue|py|swift|html?|sh|command)$/, '').replace(/^(index|page|route|\+page|\+server|__init__)$/, (x) => `${basename(dirname(f)) || x}/${x}`);

  const texts = new Map();
  for (const f of ALL) {
    if (/\.(sql|json|prisma)$/.test(f) || /(^|\/)(_headers|_redirects|netlify\.toml|wrangler\.toml)$/.test(f)) continue;
    const text = read(f);
    texts.set(f, text);
    const route = routeOf(f), ep = endpointOf(f), w = wsOf(f);
    const prefix = w && (route !== null || ep) ? `${w.name.replace(/^@[^/]+\//, '')} ` : '';
    node(f, {
      col: columnOf(f, text), file: f, label: prefix + (route !== null ? route || '/' : ep === '*' ? 'middleware' : ep || short(f)), desc: describe(text, f),
      route, endpoint: ep === '*' ? null : ep, test: /(^|\/)(__tests__|tests?|spec|e2e|cypress|playwright)\//.test(f) || /\.(test|spec)\.[\w]+$/.test(f),
      group: w ? w.name.replace(/^@[^/]+\//, '') : undefined,
    });
  }

  // ---------- imports ----------
  const tsconfig = json('tsconfig.json') || json('jsconfig.json') || {};
  const baseUrl = tsconfig.compilerOptions?.baseUrl || '.';
  const aliases = Object.entries(tsconfig.compilerOptions?.paths || {}).map(([k, [v]]) => [k.replace(/\*$/, ''), join(baseUrl, (v || '').replace(/\*$/, ''))]);
  if (!aliases.some(([a]) => a === '@/') && ALL.some((f) => f.startsWith('src/'))) aliases.push(['@/', 'src/']);
  if (deps['@sveltejs/kit']) aliases.push(['$lib/', 'src/lib/']);
  const EXT = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.astro', '.svelte', '.vue', '.json', '/index.ts', '/index.tsx', '/index.js', '/index.jsx', '/index.astro', '/index.svelte', '/index.vue'];
  const wsAliases = new Map(workspaces.map((w) => {
    const tc = json(`${w.dir}/tsconfig.json`) || json(`${w.dir}/jsconfig.json`) || {};
    const bu = join(w.dir, tc.compilerOptions?.baseUrl || '.');
    const list = Object.entries(tc.compilerOptions?.paths || {}).map(([k, [v]]) => [k.replace(/\*$/, ''), join(bu, (v || '').replace(/\*$/, ''))]);
    if (!list.some(([a]) => a === '@/')) list.push(['@/', `${w.dir}/src/`]);
    return [w.dir, list];
  }));
  function resolveImport(from, spec) {
    let base = null;
    const w = wsOf(from);
    if (spec.startsWith('.')) base = join(dirname(from), spec);
    else if (spec.startsWith('/')) base = spec.slice(1);
    else {
      const pkgWs = workspaces.find((x) => spec === x.name || spec.startsWith(x.name + '/'));
      if (pkgWs) {
        const sub = spec.slice(pkgWs.name.length).replace(/^\//, '');
        if (!sub && pkgWs.entry) { for (const e of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.js']) if (has(pkgWs.entry + e)) return pkgWs.entry + e; }
        base = join(pkgWs.dir, sub || 'src/index');
        if (!sub) for (const c of [`${pkgWs.dir}/src/index`, `${pkgWs.dir}/index`]) for (const e of ['.ts', '.tsx', '.js', '.mjs']) if (has(c + e)) return c + e;
      } else for (const [a, target] of [...(w ? wsAliases.get(w.dir) : []), ...aliases]) if (spec.startsWith(a)) { base = join(target, spec.slice(a.length)); break; }
    }
    if (base === null) return null;
    for (const e of EXT) { const c = normalize(base + e); if (has(c)) return c; }
    const noJs = base.replace(/\.(m|c)?jsx?$/, ''); // TypeScript ESM: './x.js' means './x.ts'
    if (noJs !== base) for (const e of ['.ts', '.tsx', '.mts', '.cts']) { const c = normalize(noJs + e); if (has(c)) return c; }
    return null;
  }
  function pyResolve(from, mod) {
    const dots = mod.match(/^\.*/)[0].length;
    const rest = mod.slice(dots).replace(/\./g, '/');
    const bases = dots ? [join(dirname(from), '../'.repeat(dots - 1), rest)] : [rest, `src/${rest}`, `app/${rest}`];
    for (const b of bases) for (const c of [`${b}.py`, `${b}/__init__.py`]) { const n = normalize(c); if (has(n)) return n; }
    return null;
  }
  const dataNode = (f) => { if (!nodes.has(f)) node(f, { col: 'data', file: f, label: basename(f), desc: '' }); return f; };
  const swiftTypes = new Map();
  for (const [f, s] of texts) if (f.endsWith('.swift')) for (const m of s.matchAll(/\b(?:class|struct|enum|protocol|actor)\s+([A-Z]\w+)/g)) swiftTypes.set(m[1], f);

  for (const [f, s] of texts) {
    if (/\.(astro|tsx?|jsx?|mjs|cjs|mts|cts|svelte|vue)$/.test(f)) {
      for (const m of s.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)|<script[^>]+src=["']([^"']+)["']/g)) {
        const target = resolveImport(f, m[1] || m[2] || m[3] || m[4]);
        if (!target || ASSET.test(target)) continue;
        if (!nodes.has(target)) dataNode(target);
        link(f, target);
      }
    } else if (f.endsWith('.py')) {
      // from x import (a, b) may span lines; any other import stays on its line
      for (const m of s.matchAll(/^[ \t]*(?:from[ \t]+([.\w]+)[ \t]+import[ \t]+(?:\(([^)]*)\)|([^\n#]+))|import[ \t]+([\w., \t]+))/gm)) {
        if (m[1]) { const target = pyResolve(f, m[1]); if (target) link(f, target); else for (const n of (m[2] || m[3]).split(',')) { const t2 = pyResolve(f, `${m[1]}.${n.trim().split(/\s/)[0]}`); if (t2) link(f, t2); } }
        else for (const n of m[4].split(',')) { const t2 = pyResolve(f, n.trim().split(/\s/)[0]); if (t2) link(f, t2); }
      }
    } else if (f.endsWith('.swift')) {
      for (const [type, file] of swiftTypes) if (file !== f && new RegExp(`\\b${type}\\b`).test(s)) link(f, file);
    } else if (/\.html?$/.test(f)) {
      for (const m of s.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"':]+)["']|<a[^>]+href=["']([^"':#?]+\.html?)["']/g)) {
        const spec = m[1] || m[2];
        const target = resolveImport(f, spec.startsWith('/') ? spec : './' + spec);
        if (target && !ASSET.test(target)) link(f, target);
      }
    }
  }

  // implicit wrappers: Next.js layouts, SvelteKit layouts and load files, Nuxt layouts
  for (const n of [...nodes.values()]) {
    if (n.route === null || n.route === undefined || !n.file) continue;
    const f = n.file, w = wsOf(f), base = w ? w.dir + '/' : '';
    const rel = inWs(f);
    if (/^(src\/)?app\//.test(rel)) {
      let d = dirname(f);
      for (;;) { for (const x of ['layout', 'template', 'loading', 'error']) for (const e of ['tsx', 'jsx', 'js', 'ts']) if (has(`${d}/${x}.${e}`) && nodes.has(`${d}/${x}.${e}`) && (x === 'layout' || x === 'template' || d === dirname(f))) link(f, `${d}/${x}.${e}`, 'wrapped by');
        if (/(^|\/)app$/.test(d) || d === '.' || !d.includes('/')) break; d = dirname(d); }
    }
    if (/^src\/routes\//.test(rel)) {
      const d0 = dirname(f);
      for (const x of ['+page.ts', '+page.js', '+page.server.ts', '+page.server.js']) if (nodes.has(`${d0}/${x}`)) link(f, `${d0}/${x}`, 'loads');
      let d = d0;
      for (;;) { for (const x of ['+layout.svelte', '+layout.ts', '+layout.server.ts']) if (nodes.has(`${d}/${x}`)) link(f, `${d}/${x}`, 'wrapped by'); if (/(^|\/)src\/routes$/.test(d)) break; d = dirname(d); }
    }
    if ((deps.nuxt || w?.deps.nuxt) && /^pages\//.test(rel)) {
      const lay = (texts.get(f) || '').match(/layout\s*:\s*['"]([\w-]+)['"]/)?.[1] || 'default';
      for (const e of ['vue']) if (nodes.has(`${base}layouts/${lay}.${e}`)) link(f, `${base}layouts/${lay}.${e}`, 'wrapped by');
    }
  }

  // scripts that run another file by its name (convert.py, build.sh…), comments left out
  const byBase = new Map();
  for (const f of texts.keys()) { const b = basename(f); byBase.set(b, byBase.has(b) ? null : f); }
  for (const [f, s] of texts) {
    if (!/\.(sh|command|swift|py)$/.test(f)) continue;
    const code = f.endsWith('.swift') ? s.replace(/\/\/.*$/gm, '') : s.replace(/^\s*#.*$/gm, '');
    for (const [b, target] of byBase) if (target && target !== f && /\.(py|sh|swift|js|mjs|command)$/.test(b) && new RegExp(`(^|[\\s"'/=(])${reEsc(b)}(?=[\\s"')]|$)`, 'm').test(code)) link(f, target, 'runs');
  }

  // a project path in a string: the script reads or writes that file (generated data)
  for (const [f, s] of texts) for (const m of s.matchAll(/['"`]((?:\.\.?\/)*(?:src|public|data|content|static)\/[\w./-]+\.(?:json|ts|js|md|yml|yaml))['"`]/g)) {
    const p = m[1].startsWith('.') ? normalize(join(dirname(f), m[1])) : m[1];
    const bare = m[1].replace(/^(\.\.?\/)+/, '');
    const target = has(p) ? p : has(bare) ? bare : null;
    if (!target || target === f) continue;
    dataNode(target);
    link(f, target, /writeFile|\.write\(|createWriteStream|open\([^)]*['"]w/.test(s) ? 'writes' : 'reads');
  }

  // ---------- database: SQL migrations (Supabase, Postgres) ----------
  const tables = new Map(), fns = new Map(), jobs = [], buckets = new Set();
  for (const f of ALL.filter((x) => x.endsWith('.sql')).sort()) {
    let sql = read(f).replace(/--.*$/gm, '');
    // foreach t in array array['a','b'] loop execute format('... %I ...', t); end loop -> one statement per table
    for (const m of sql.matchAll(/foreach\s+\w+\s+in\s+array\s+array\[([^\]]+)\]\s+loop([\s\S]*?)end\s+loop/gi)) {
      const names = [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]);
      for (const fm of m[2].matchAll(/format\(\s*'((?:[^']|'')*)'/g)) for (const n of names) sql += '\n' + fm[1].replace(/''/g, "'").replace(/%I/g, n) + ';';
    }
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)) if (!tables.has(m[1])) tables.set(m[1], { name: m[1], rls: false, read: new Set(), write: new Set(), file: f });
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)) tables.delete(m[1]);
    for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?\s+enable\s+row\s+level\s+security/gi)) if (tables.has(m[1])) tables.get(m[1]).rls = true;
    for (const m of sql.matchAll(/create\s+policy\s+(?:"[^"]*"|\w+)\s+on\s+(?:public\.)?"?(\w+)"?\s*(?:as\s+\w+\s*)?(?:for\s+(\w+)\s*)?(?:to\s+([\w\s,]+?))?\s*(using|with\s+check)\s*\(([\s\S]*?)\)\s*;/gi)) {
      const tb = tables.get(m[1]); if (!tb) continue;
      const who = /is_editor|editor|is_admin|admin/i.test(m[5]) ? t('db.editors') : /auth\.uid\(\)/.test(m[5]) ? t('db.owner') : (m[3] || 'public').trim().replace(/\s+/g, ' ');
      const cmd = (m[2] || 'all').toLowerCase();
      if (cmd === 'select' || cmd === 'all') tb.read.add(who);
      if (cmd !== 'select') tb.write.add(who);
    }
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?(\w+)"?\s*\(/gi)) {
      const head = sql.slice(m.index, m.index + 800);
      fns.set(m[1], { name: m[1], definer: /security\s+definer/i.test(head.split(/\$\$|\$\w+\$/)[0] + (head.split(/\$\$|\$\w+\$/)[2] || '')), file: f });
    }
    for (const m of sql.matchAll(/cron\.schedule\(\s*'([^']+)'\s*,\s*'([^']+)'/gi)) jobs.push({ name: m[1], when: m[2], file: f, sql });
    for (const m of sql.matchAll(/insert\s+into\s+storage\.buckets[\s\S]*?values\s*\(\s*'([\w-]+)'/gi)) buckets.add(m[1]);
  }
  const admin = t('db.editors');
  for (const tb of tables.values()) {
    const n = node(`table:${tb.name}`, { col: 'db', label: tb.name, file: tb.file, desc: `${tb.rls ? t('db.rls') : t('db.norls')} · ${t('db.read')} : ${[...tb.read].join(', ') || t('db.nobody')} · ${t('db.write')} : ${[...tb.write].join(', ') || t('db.nobody')}` });
    if (tb.write.has(admin)) n.badge = t('badge.admin');
  }
  for (const fn of fns.values()) node(`rpc:${fn.name}`, { col: 'db', label: `${fn.name}()`, file: fn.file, desc: fn.definer ? t('db.definer') : t('db.fn') });
  for (const b of buckets) node(`bucket:${b}`, { col: 'db', label: b, desc: t('db.bucket') });
  for (const j of jobs) node(`job:${j.name}`, { col: 'server', label: `${t('task')} ${j.name} : ${cronText(j.when, t)}`, file: j.file, desc: t('task.pg', { cron: j.when }) });

  // Prisma models
  const models = [];
  for (const f of ALL.filter((x) => x.endsWith('.prisma'))) for (const m of read(f).matchAll(/^\s*model\s+(\w+)\s*\{/gm)) { models.push(m[1]); node(`model:${m[1]}`, { col: 'db', label: m[1], file: f, desc: t('db.model') }); }

  // Django: models, and urls.py routes pointing to views
  const djangoModels = [];
  for (const [f, s] of texts) if (f.endsWith('.py')) {
    for (const m of s.matchAll(/^class\s+(\w+)\((?:[\w.]*models\.)?Model\)/gm)) { djangoModels.push(m[1]); node(`model:${m[1]}`, { col: 'db', label: m[1], file: f, desc: t('db.django') }); }
    if (basename(f) === 'urls.py') for (const m of s.matchAll(/(?:re_)?path\(\s*r?['"]([^'"]*)['"]\s*,\s*([\w.]+)/g)) {
      const id = `route:DJ /${m[1]}`;
      node(id, { col: 'page', label: `/${m[1]}`, file: f, desc: m[2], endpoint: `/${m[1]}` });
      link(id, f, 'defined in');
      const mod = m[2].split('.')[0];
      const views = [`${dirname(f)}/${mod}.py`, `${dirname(f)}/views.py`].find((c) => nodes.has(c));
      if (views && mod !== 'include') link(id, views, 'calls');
    }
  }
  // Drizzle tables, Firestore collections, Mongoose models
  const drizzle = new Map();
  for (const [f, s] of texts) {
    for (const m of s.matchAll(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:pg|sqlite|mysql)Table\(\s*['"](\w+)['"]/g)) { drizzle.set(m[1], m[2]); if (!nodes.has(`table:${m[2]}`)) node(`table:${m[2]}`, { col: 'db', label: m[2], file: f, desc: t('db.drizzle') }); }
    for (const m of s.matchAll(/(?:\bcollection\(\s*\w+\s*,\s*|\.collection\(\s*|\bdoc\(\s*\w+\s*,\s*)['"]([\w-]+)['"]/g)) { node(`collection:${m[1]}`, { col: 'db', label: m[1], desc: t('db.firestore') }); link(f, `collection:${m[1]}`, 'reads/writes'); }
    if (/mongoose/.test(s)) for (const m of s.matchAll(/\bmodel\(\s*['"](\w+)['"]\s*,/g)) node(`model:${m[1]}`, { col: 'db', label: m[1], file: f, desc: t('db.mongo') });
  }
  const mongo = [...nodes.values()].filter((n) => n.desc === t('db.mongo')).map((n) => n.label);
  for (const [f, s] of texts) {
    for (const [v, tb] of drizzle) if (new RegExp(`(?:\\.from|\\binsert|\\bupdate|\\bdelete)\\(\\s*${v}\\s*\\)|db\\.query\\.${v}\\b`).test(s)) link(f, `table:${tb}`, 'reads/writes');
    for (const mo of mongo) if (new RegExp(`\\b${mo}\\.(?:find|findOne|findById|create|insertMany|updateOne|updateMany|deleteOne|deleteMany|aggregate|countDocuments)\\b`).test(s)) link(f, `model:${mo}`, 'reads/writes');
    for (const mo of djangoModels) if (f.endsWith('.py') && new RegExp(`\\b${mo}\\.objects\\b|ForeignKey\\(\\s*['"]?${mo}\\b`).test(s)) link(f, `model:${mo}`, 'reads/writes');
  }

  const tableNames = [...tables.keys()], fnNames = [...fns.keys()];
  for (const [f, s] of texts) {
    const rest = /rest\/v1|supabase/i.test(s);
    for (const n of tableNames) if (new RegExp(`(?:\\.from|\\.table|\\b(?:select|insert|update|remove|upsert))\\s*(?:<[^>]*>)?\\(\\s*['"\`]${n}['"\`]|/rest/v1/${n}\\b`).test(s) || (rest && new RegExp(`['"\`/]${n}['"\`?]`).test(s))) link(f, `table:${n}`, 'reads/writes');
    for (const n of fnNames) if (new RegExp(`rpc\\s*(?:<[^>]*>)?\\(\\s*['"\`]${n}['"\`]|/rest/v1/rpc/${n}\\b`).test(s)) link(f, `rpc:${n}`, 'calls');
    for (const b of buckets) if (new RegExp(`storage[\\s\\S]{0,40}['"\`/]${reEsc(b)}['"\`/]|/storage/v1/object/(?:public/)?${reEsc(b)}/`).test(s)) link(f, `bucket:${b}`, 'reads/writes');
    for (const mo of models) if (new RegExp(`prisma\\.${mo[0].toLowerCase() + mo.slice(1)}\\b`).test(s)) link(f, `model:${mo}`, 'reads/writes');
  }
  for (const j of jobs) for (const n of fnNames) if (new RegExp(`cron\\.schedule\\(\\s*'${reEsc(j.name)}'[^;]*\\b${n}\\b`, 'i').test(j.sql)) link(`job:${j.name}`, `rpc:${n}`, 'calls');

  // ---------- server: routes declared in code (Express, Fastify, Flask, FastAPI), calls to endpoints, host jobs ----------
  for (const [f, s] of texts) for (const m of s.matchAll(/(?:\b(?:app|router|server|api|bp|blueprint|fastify)\.(get|post|put|patch|delete|route)\(\s*['"`]([^'"`]+)['"`])/gi)) {
    if (!m[2].startsWith('/')) continue;
    const id = `route:${m[1].toUpperCase()} ${m[2]}`;
    node(id, { col: 'server', label: `${m[1] === 'route' ? '' : m[1].toUpperCase() + ' '}${m[2]}`, file: f, desc: '', endpoint: m[2] });
    link(id, f, 'defined in');
  }
  const endpoints = [...nodes.values()].filter((n) => n.endpoint);
  for (const [f, s] of texts) for (const e of endpoints) if (e.file !== f && new RegExp(`['"\`]${reEsc(e.endpoint.replace(/:\w+|\[[^\]]+\]/g, '§')).replace(/§/g, '[^\'"`/?]+')}(?:['"\`?/])`).test(s)) link(f, e.id, 'calls');
  const vercel = json('vercel.json') || {};
  for (const c of vercel.crons || []) {
    const id = `cron:${c.path}`;
    node(id, { col: 'server', label: `${t('task')} : ${cronText(c.schedule, t)}`, file: 'vercel.json', desc: t('task.vercel', { cron: c.schedule, path: c.path }) });
    const target = endpoints.find((e) => e.endpoint === c.path.split('?')[0]);
    if (target) link(id, target.id, 'triggers');
  }

  // ---------- tools: package.json scripts ----------
  for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
    const id = `npm:${name}`;
    node(id, { col: 'tool', label: `npm run ${name}`, file: 'package.json', desc: cmd });
    for (const m of String(cmd).matchAll(/([\w./-]+\.(?:m?js|ts|py|sh))/g)) if (has(m[1])) link(id, m[1], 'runs');
  }

  // ---------- environment names (never values) ----------
  const env = new Map();
  for (const [f, s] of texts) for (const m of s.matchAll(/(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]+)|(?:process\.env|import\.meta\.env)\[['"]([A-Z][A-Z0-9_]+)['"]\]|os\.(?:environ\.get|getenv)\(\s*['"]([A-Z][A-Z0-9_]+)['"]|os\.environ\[['"]([A-Z][A-Z0-9_]+)['"]\]|Deno\.env\.get\(['"]([A-Z][A-Z0-9_]+)['"]\)|ProcessInfo\.processInfo\.environment\[['"]([A-Z][A-Z0-9_]+)['"]\]/g)) {
    const n = m[1] || m[2] || m[3] || m[4] || m[5] || m[6];
    if (/^(PROD|DEV|SSR|MODE|BASE_URL|SITE|NODE_ENV)$/.test(n)) continue;
    (env.get(n) || env.set(n, new Set()).get(n)).add(f);
  }

  // ---------- hosting ----------
  const host = [];
  if (vercel.crons?.length) host.push(t('host.crons', { n: vercel.crons.length }));
  if (vercel.headers?.length) host.push(t('host.headers', { n: vercel.headers.reduce((s, h) => s + (h.headers?.length || 0), 0) }));
  if (vercel.redirects?.length) host.push(t('host.redirects', { n: vercel.redirects.length }));
  for (const f of ['netlify.toml', 'wrangler.toml']) if (has(f)) host.push(t('host.file', { f }));
  for (const f of ALL.filter((x) => /(^|\/)_(headers|redirects)$/.test(x))) host.push(t('host.file', { f }));

  const E = [...edges].map((e) => { const [from, to, type] = e.split('\u0000'); return { from, to, type }; });
  for (const e of E) nodes.get(e.to).uses++;
  return { name: cfg.title || pkg.name || basename(root), kinds, web: WEB, nodes: [...nodes.values()], edges: E, env, host, files: ALL.length };
}

export function cronText(c, t) {
  const parts = c.trim().split(/\s+/);
  const [mi, h, dom, mon, dow] = parts;
  if (c.trim() === '* * * * *') return t('cron.minute');
  if (/^\*\/\d+$/.test(mi) && h === '*') return t('cron.every', { n: mi.slice(2) });
  if (/^\d+$/.test(mi) && /^\d+$/.test(h) && dom === '*' && mon === '*') {
    const days = { '*': t('cron.daily'), '1-5': t('cron.weekdays'), 0: t('cron.d0'), 1: t('cron.d1'), 6: t('cron.d6') }[dow] || t('cron.days', { d: dow });
    return t('cron.at', { days, at: `${h.padStart(2, '0')}:${mi.padStart(2, '0')}` });
  }
  return c;
}
