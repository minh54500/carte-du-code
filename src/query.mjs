// Questions on a map: who uses an item, what it uses, the path between two items, search,
// and the code's health (files nobody uses, import cycles, the files most others depend on).
// Shared by the Markdown map, the graph page and the MCP server.

// Items that are used from outside the code (a visitor, a host, a command, the framework itself), so "nobody imports them" is normal.
const LOADED_BY_FRAMEWORK = [
  /(^|\/)(index|main|app|App|server|cli|__init__|setup|conftest|manage|wsgi|asgi|settings|urls|middleware|instrumentation|sw|service-worker)\.[\w]+$/,
  /\.(config|cli|d|stories)\.[cm]?[jt]sx?$/, /(^|\/)(docs|examples?|scripts|\.github|public|static)\//,
  /(^|\/)(migrations|management|templatetags|fixtures)\//, /(^|\/)(admin|apps|signals|tasks|receivers)\.py$/, // Django
  /(^|\/)_(app|document|error)\.[jt]sx?$/, // Next pages router
  /(^|\/)(not-found|global-error|error|loading|default|template|layout|sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon)\.[jt]sx?$/, // Next app router
  /(^|\/)hooks(\.server|\.client)?\.[jt]s$/, /(^|\/)\+(error|layout)\.svelte$/, /(^|\/)\+(page|layout)(\.server)?\.[jt]s$/, // SvelteKit
  /(^|\/)content(\/config|\.config)\.[cm]?[jt]s$/, // Astro content collections
  /(^|\/)(app|error)\.vue$/, // Nuxt
];
const NUXT_AUTO = /(^|\/)(app\/)?(components|composables|utils|plugins|middleware|layouts|server\/(utils|plugins|middleware|routes))\//;
const ENTRY = (n, nuxt) => ['page', 'server', 'tool', 'db', 'doc'].includes(n.col) || /^(npm|cron|job|route|table|rpc|model|bucket|collection):/.test(n.id)
  || LOADED_BY_FRAMEWORK.some((re) => re.test(n.file || '')) || (nuxt && NUXT_AUTO.test(n.file || '')) || n.test;

export function index(map) {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const out = new Map(), inn = new Map();
  for (const e of map.edges) {
    (out.get(e.from) || out.set(e.from, []).get(e.from)).push(e);
    (inn.get(e.to) || inn.set(e.to, []).get(e.to)).push(e);
  }
  // dependency direction: A depends on B when A uses B; a file written by a script depends on that script
  const dep = new Map(), rdep = new Map();
  const add = (m, a, b) => (m.get(a) || m.set(a, new Set()).get(a)).add(b);
  for (const e of map.edges) { if (e.type === 'writes') { add(dep, e.to, e.from); add(rdep, e.from, e.to); } else { add(dep, e.from, e.to); add(rdep, e.to, e.from); } }
  // through a Swift file only direct links count: Swift files name each other's types in one dense mesh, where "directly or not"
  // would be everything. A type and its `extension` files are one piece, so the way goes on between them
  const unit = new Set(map.edges.filter((e) => e.type === 'extended by').flatMap((e) => [`${e.from}\u0000${e.to}`, `${e.to}\u0000${e.from}`]));
  const reach = (m, id) => {
    const seen = new Set([id]), st = [id];
    while (st.length) { const x = st.pop(); for (const y of m.get(x) || []) if (!seen.has(y)) { seen.add(y); if (!y.endsWith('.swift') || unit.has(`${x}\u0000${y}`)) st.push(y); } }
    seen.delete(id); return seen;
  };

  // every item a question may mean, closest first: the same name, the same file, the end of a name or path (ui → data/ui,
  // lib/hours → src/lib/hours.ts), then any part. A file asked by its path is the file itself, not the routes or models it declares
  const matches = (q) => {
    if (!q) return [];
    if (byId.has(q)) return [byId.get(q)];
    const s = String(q).toLowerCase(), lo = (x) => (x || '').toLowerCase(), noExt = (f) => lo(f).replace(/\.\w+$/, '');
    const levels = [ // [by its name, by its file]
      [(n) => lo(n.label) === s, () => false],
      [() => false, (n) => lo(n.file) === s || noExt(n.file) === s],
      [(n) => lo(n.label).endsWith('/' + s), (n) => lo(n.file).endsWith('/' + s) || noExt(n.file).endsWith('/' + s)],
      [(n) => lo(n.label).includes(s), (n) => lo(n.file).includes(s)],
    ];
    for (const [byName, byFile] of levels) {
      const hit = map.nodes.filter((n) => byName(n) || byFile(n)), ids = new Set(hit.map((n) => n.id));
      const keep = hit.filter((n) => byName(n) || n.id === n.file || !ids.has(n.file));
      if (keep.length) return keep;
    }
    return [];
  };
  const find = (q) => matches(q)[0] || null;
  const search = (q, limit = 20) => {
    const s = String(q || '').toLowerCase();
    return map.nodes.filter((n) => `${n.label} ${n.file || ''} ${n.desc || ''}`.toLowerCase().includes(s)).sort((a, b) => b.uses - a.uses).slice(0, limit);
  };
  // both read along dependencies, so the direct answer is always part of the deep one (a generated file uses the script that writes it)
  const usedBy = (id, deep = false) => [...(deep ? reach(rdep, id) : rdep.get(id) || [])].map((x) => byId.get(x));
  const uses = (id, deep = false) => [...(deep ? reach(dep, id) : dep.get(id) || [])].map((x) => byId.get(x));
  const bfs = (a, b, nb) => {
    const prev = new Map([[a, null]]), q = [a];
    while (q.length) { const x = q.shift(); if (x === b) break; for (const y of nb(x)) if (!prev.has(y)) { prev.set(y, x); q.push(y); } }
    if (!prev.has(b)) return null;
    const p = []; for (let x = b; x !== null; x = prev.get(x)) p.unshift(byId.get(x));
    return p;
  };
  // shortest chain: a depends on b, else b depends on a (reversed so it still starts at a), else links read both ways
  const path = (a, b) => {
    const d = bfs(a, b, (x) => dep.get(x) || []); if (d) return d;
    const r = bfs(b, a, (x) => dep.get(x) || []); if (r) return r.reverse();
    return bfs(a, b, (x) => [...(out.get(x) || []).map((e) => e.to), ...(inn.get(x) || []).map((e) => e.from)]);
  };

  function health() {
    const files = map.nodes.filter((n) => n.file && !/^(table|rpc|model|bucket|collection|npm|cron|job|route):/.test(n.id));
    const nuxt = (map.kinds || []).includes('Nuxt');
    const unused = files.filter((n) => !inn.get(n.id)?.length && !ENTRY(n, nuxt) && !/\.json$/.test(n.file)).sort((a, b) => a.file.localeCompare(b.file));
    // import cycles: strongly connected components of the "uses" links between files (Tarjan). Swift is left out:
    // its files import nothing, the whole module sees every type, and types that name each other are normal there
    const g = new Map();
    for (const e of map.edges) if (e.type === 'uses' && byId.get(e.from)?.file && byId.get(e.to)?.file && !e.from.endsWith('.swift')) (g.get(e.from) || g.set(e.from, []).get(e.from)).push(e.to);
    let i = 0; const idx = new Map(), low = new Map(), on = new Set(), st = [], cycles = [];
    const strong = (v) => {
      // iterative Tarjan, so a deep project cannot overflow the stack
      const work = [[v, 0]];
      idx.set(v, i); low.set(v, i); i++; st.push(v); on.add(v);
      while (work.length) {
        const top = work[work.length - 1], [x, k] = top, next = (g.get(x) || [])[k];
        if (next !== undefined) {
          top[1]++;
          if (!idx.has(next)) { idx.set(next, i); low.set(next, i); i++; st.push(next); on.add(next); work.push([next, 0]); }
          else if (on.has(next)) low.set(x, Math.min(low.get(x), idx.get(next)));
        } else {
          work.pop();
          if (work.length) { const p = work[work.length - 1][0]; low.set(p, Math.min(low.get(p), low.get(x))); }
          if (low.get(x) === idx.get(x)) { const comp = []; let w; do { w = st.pop(); on.delete(w); comp.push(w); } while (w !== x); if (comp.length > 1) cycles.push(comp.map((id) => byId.get(id))); }
        }
      }
    };
    for (const v of g.keys()) if (!idx.has(v)) strong(v);
    // tests are left out of the count: what matters is the code that would break. Only the 40 files with the most
    // direct users are followed all the way, so a project made of one big import loop stays fast
    // direct users break the ties, so files caught in one big loop (all with the same count) still come out in a useful order
    const direct = (id) => [...(rdep.get(id) || [])].filter((x) => !byId.get(x)?.test).length;
    const sensitive = files.filter((n) => !n.test).sort((a, b) => (rdep.get(b.id)?.size || 0) - (rdep.get(a.id)?.size || 0)).slice(0, 40)
      .map((n) => ({ n, count: [...reach(rdep, n.id)].filter((id) => !byId.get(id)?.test).length, direct: direct(n.id) })).filter((x) => x.count >= 3)
      .sort((a, b) => b.count - a.count || b.direct - a.direct).slice(0, 10);
    // the most used files without a role comment: the comments worth writing first
    const bare = files.filter((n) => n.id === n.file && !n.desc && !n.test && n.col !== 'doc' && !/\.(json|config\.[cm]?[jt]s)$/.test(n.file));
    const undescribed = { total: bare.length, top: bare.map((n) => ({ n, users: direct(n.id) })).filter((x) => x.users > 0).sort((a, b) => b.users - a.users || a.n.file.localeCompare(b.n.file)).slice(0, 10) };
    return { unused, cycles, sensitive, undescribed };
  }

  return { byId, find, matches, search, usedBy, uses, path, health, out, inn };
}

// What changed between two maps (the previous JSON and this run).
export function diff(prev, map) {
  if (!prev?.nodes) return null;
  const before = new Map(prev.nodes.map((n) => [n.id, n])), now = new Map(map.nodes.map((n) => [n.id, n]));
  const key = (e) => `${e.from}\u0000${e.to}`;
  const eb = new Set((prev.edges || []).map(key)), en = new Set(map.edges.map(key));
  return {
    since: prev.generated || null,
    added: [...now.keys()].filter((k) => !before.has(k)),
    removed: [...before.values()].filter((n) => !now.has(n.id)).map((n) => ({ id: n.id, label: n.label, file: n.file })),
    linksAdded: map.edges.filter((e) => !eb.has(key(e))).length,
    linksRemoved: (prev.edges || []).filter((e) => !en.has(key(e))).length,
  };
}

// The folder an item belongs to, for the colours and the folder bubbles of the graph.
export function famOf(n) {
  if (n.group) return n.group;
  if (/^(table|rpc|model|bucket|job|collection):/.test(n.id)) return 'database';
  if (n.id.startsWith('npm:')) return 'npm';
  if (n.id.startsWith('cron:')) return 'cron';
  const f = n.file || '', d = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '(root)', p = d.split('/');
  return p[0] === 'src' || p[0] === 'app' ? p.slice(0, Math.min(p.length, 3)).join('/') : p[0];
}

// One hue per folder that stays the same from one map to the next: folders already in the previous map keep theirs,
// a new folder takes the hue of its name, moved round the wheel until it is far enough from the others.
export function folderHues(nodes, prev = {}) {
  const size = new Map();
  for (const n of nodes) { const f = famOf(n); size.set(f, (size.get(f) || 0) + 1); }
  const hues = {};
  for (const f of size.keys()) if (typeof prev?.[f] === 'number') hues[f] = prev[f];
  const dist = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  for (const f of [...size.keys()].sort((a, b) => size.get(b) - size.get(a) || a.localeCompare(b))) {
    if (f in hues) continue;
    let h0 = 0; for (const c of f) h0 = (h0 * 31 + c.charCodeAt(0)) >>> 0;
    let best = h0 % 360, gap = -1;
    for (let k = 0; k < 14; k++) {
      const h = Math.round((h0 + k * 137.508) % 360), g = Math.min(360, ...Object.values(hues).map((x) => dist(x, h)));
      if (g >= 28) { best = h; break; }
      if (g > gap) { gap = g; best = h; }
    }
    hues[f] = best;
  }
  return hues;
}

