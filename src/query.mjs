// Questions on a map: who uses an item, what it uses, the path between two items, search,
// and the code's health (files nobody uses, import cycles, the files most others depend on).
// Shared by the Markdown map, the graph page and the MCP server.

// Items that are used from outside the code (a visitor, a host, a command), so "nobody imports them" is normal.
const ENTRY = (n) => ['page', 'server', 'tool', 'db'].includes(n.col) || /^(npm|cron|job|route|table|rpc|model|bucket|collection):/.test(n.id)
  || /(^|\/)(index|main|app|server|cli|__init__|setup|conftest|manage|wsgi|asgi|settings|urls|middleware|instrumentation)\.[\w]+$/.test(n.file || '')
  || /\.(config|cli|d)\.[cm]?[jt]s$/.test(n.file || '') || /^(docs|examples?|scripts|\.github)\//.test(n.file || '') || n.test;

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
  const reach = (m, id) => { const seen = new Set([id]), st = [id]; while (st.length) for (const y of m.get(st.pop()) || []) if (!seen.has(y)) { seen.add(y); st.push(y); } seen.delete(id); return seen; };

  const find = (q) => {
    if (!q) return null;
    if (byId.has(q)) return byId.get(q);
    const s = String(q).toLowerCase();
    return map.nodes.find((n) => n.label.toLowerCase() === s) || map.nodes.find((n) => (n.file || '').toLowerCase() === s)
      || map.nodes.find((n) => n.label.toLowerCase().includes(s) || (n.file || '').toLowerCase().includes(s)) || null;
  };
  const search = (q, limit = 20) => {
    const s = String(q || '').toLowerCase();
    return map.nodes.filter((n) => `${n.label} ${n.file || ''} ${n.desc || ''}`.toLowerCase().includes(s)).sort((a, b) => b.uses - a.uses).slice(0, limit);
  };
  const usedBy = (id, deep = false) => deep ? [...reach(rdep, id)].map((x) => byId.get(x)) : [...new Set((inn.get(id) || []).map((e) => byId.get(e.from)))];
  const uses = (id, deep = false) => deep ? [...reach(dep, id)].map((x) => byId.get(x)) : [...new Set((out.get(id) || []).map((e) => byId.get(e.to)))];
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
    const unused = files.filter((n) => !inn.get(n.id)?.length && !ENTRY(n) && !/\.json$/.test(n.file)).sort((a, b) => a.file.localeCompare(b.file));
    // import cycles: strongly connected components of the "uses" links between files (Tarjan)
    const g = new Map();
    for (const e of map.edges) if (e.type === 'uses' && byId.get(e.from)?.file && byId.get(e.to)?.file) (g.get(e.from) || g.set(e.from, []).get(e.from)).push(e.to);
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
    const sensitive = files.map((n) => ({ n, count: reach(rdep, n.id).size })).filter((x) => x.count >= 3).sort((a, b) => b.count - a.count).slice(0, 10);
    return { unused, cycles, sensitive };
  }

  return { byId, find, search, usedBy, uses, path, health, out, inn };
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
