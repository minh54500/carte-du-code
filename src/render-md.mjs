// The Markdown map: what an AI assistant reads first, compact and grouped by column.
export const COLUMNS = ['page', 'bloc', 'data', 'db', 'server', 'tool', 'doc'];
export const columnTitle = (col, web, t) => t(col === 'page' ? (web ? 'col.page' : 'col.entry') : `col.${col}`);

export function renderMarkdown(map, t, { date, htmlPath, health, changes, condensed = false, detail = '' }) {
  const by = (col) => map.nodes.filter((n) => n.col === col).sort((a, b) => (a.route ?? a.label).localeCompare(b.route ?? b.label));
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const outOf = new Map(), inOf = new Map();
  for (const e of map.edges) { (outOf.get(e.from) || outOf.set(e.from, []).get(e.from)).push(byId.get(e.to)); (inOf.get(e.to) || inOf.set(e.to, []).get(e.to)).push(byId.get(e.from)); }
  const names = (list = [], max = 8) => { const u = [...new Set(list.map((n) => n.label))]; return u.slice(0, max).join(', ') + (u.length > max ? ` +${u.length - max}` : ''); };
  const L = [`# ${t('md.title', { name: map.name })}`, '', t('md.generated', { date, nodes: map.nodes.length, edges: map.edges.length, html: htmlPath }), t('md.kind', { kinds: map.kinds.join(' · ') || t('md.unknown') }), '', t('md.howto'), ''];
  if (changes && (changes.added.length || changes.removed.length)) {
    L.push(`## ${t('changes.title', { since: changes.since ? new Date(changes.since).toLocaleString() : '?' })}`, '');
    if (changes.added.length) L.push(`- ${t('changes.added', { n: changes.added.length })} : ${changes.added.slice(0, 20).map((id) => byId.get(id)?.label || id).join(', ')}${changes.added.length > 20 ? ' …' : ''}`);
    if (changes.removed.length) L.push(`- ${t('changes.removed', { n: changes.removed.length })} : ${changes.removed.slice(0, 20).map((n) => n.label).join(', ')}${changes.removed.length > 20 ? ' …' : ''}`);
    L.push(`- ${t('changes.links', { a: changes.linksAdded, r: changes.linksRemoved })}`, '');
  }
  if (health) {
    L.push(`## ${t('health.title')}`, '');
    L.push(`- ${t('health.unused', { n: health.unused.length })}${health.unused.length ? ' : ' + health.unused.slice(0, 25).map((n) => '`' + n.file + '`').join(', ') + (health.unused.length > 25 ? ' …' : '') : ''}`);
    L.push(`- ${t('health.cycles', { n: health.cycles.length })}${health.cycles.length ? ' : ' + health.cycles.slice(0, 8).map((c) => c.length > 8 ? `${c.slice(0, 6).map((n) => n.label).join(' ↔ ')} ↔ … (${c.length})` : c.map((n) => n.label).join(' ↔ ')).join(' · ') : ''}`);
    L.push(`- ${t('health.sensitive')} : ${health.sensitive.length ? health.sensitive.map((x) => t(x.direct < x.count ? 'health.sensitiveItemDirect' : 'health.sensitiveItem', { label: x.n.label, n: x.count, d: x.direct })).join(' · ') : t('health.ok')}`);
    if (health.undescribed?.top.length) L.push(`- ${t('health.undescribed', { n: health.undescribed.total })} : ${health.undescribed.top.map((x) => '`' + x.n.file + '`').join(', ')}`);
    L.push('');
  }
  if (condensed) {
    // big projects: one line per folder, the per-file detail lives in its own file
    L.push(t('md.condensed', { detail }), '', `## ${t('md.folder')}`, '');
    const groups = new Map();
    for (const n of map.nodes) { const k = n.group || (n.file && n.file.includes('/') ? n.file.split('/').slice(0, n.file.startsWith('src/') || n.file.startsWith('app/') ? 2 : 1).join('/') : n.col === 'db' ? 'database' : '(root)'); (groups.get(k) || groups.set(k, []).get(k)).push(n); }
    for (const [dir, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) L.push(`- ${t('md.folderLine', { dir, n: list.length, top: list.sort((a, b) => b.uses - a.uses).slice(0, 5).map((n) => n.label).join(', ') })}`);
    L.push('');
    for (const col of ['page', 'server', 'db']) {
      const list = by(col);
      if (!list.length) continue;
      L.push(`## ${columnTitle(col, map.web, t)} (${list.length})`, '');
      for (const n of list.slice(0, 150)) L.push(`- **${n.label}**${n.file && n.file !== n.label && !/^(table|rpc|model|bucket|collection):/.test(n.id) ? ` \`${n.file}\`` : ''}${n.desc ? ` : ${n.desc}` : ''}`);
      if (list.length > 150) L.push(`- … +${list.length - 150}`);
      L.push('');
    }
  }
  for (const col of condensed ? [] : COLUMNS) {
    const list = by(col);
    if (!list.length) continue;
    L.push(`## ${columnTitle(col, map.web, t)} (${list.length})`, '');
    for (const n of list) {
      const o = outOf.get(n.id), i = inOf.get(n.id);
      const where = n.file && n.file !== n.label && !/^(table|rpc|model|bucket):/.test(n.id) ? ` \`${n.file}\`` : '';
      L.push(`- **${n.label}**${where}${n.desc ? ` : ${n.desc}` : ''}${n.badge ? ` [${n.badge}]` : ''}`);
      const rel = [o?.length ? `→ ${names(o)}` : '', i?.length ? `← ${names(i)}` : ''].filter(Boolean).join(' · ');
      if (rel) L.push(`  ${rel}`);
    }
    L.push('');
  }
  if (map.env.size) {
    L.push(`## ${t('md.env')}`, '');
    for (const [n, fs] of [...map.env].sort()) L.push(`- \`${n}\` ← ${[...fs].map((f) => byId.get(f)?.label || f).join(', ')}`);
    L.push('');
  }
  if (map.host.length) L.push(`## ${t('md.host')}`, '', ...map.host.map((h) => `- ${h}`), '');
  return L.join('\n');
}
