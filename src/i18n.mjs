// Every word the map shows, in French and English. t('key', { n: 3 }) fills {n}.
const STRINGS = {
  fr: {
    'col.page': 'Pages', 'col.entry': 'Points d’entrée', 'col.bloc': 'Blocs (composants et modules)', 'col.data': 'Données',
    'col.db': 'Base de données', 'col.server': 'Serveur et tâches', 'col.tool': 'Outils et commandes',
    'md.title': 'Carte du code : {name}',
    'md.generated': 'Générée automatiquement le {date} par carte-du-code (ne pas modifier à la main). {nodes} éléments, {edges} liens. Graphe : `{html}`.',
    'md.kind': 'Type : {kinds}.', 'md.unknown': 'inconnu',
    'md.howto': 'Lecture : chaque ligne donne le fichier, son rôle (son premier commentaire), puis → ce qu’il utilise et ← qui l’utilise.',
    'md.env': 'Réglages secrets et variables (noms seulement)', 'md.host': 'Hébergement',
    'host.crons': 'Vercel : {n} tâche(s) planifiée(s)', 'host.headers': 'Vercel : en-têtes de sécurité ({n})', 'host.redirects': 'Vercel : {n} redirection(s)', 'host.file': '{f} présent',
    'db.rls': 'RLS activé', 'db.norls': 'RLS ABSENT', 'db.read': 'lecture', 'db.write': 'écriture', 'db.nobody': 'personne', 'db.editors': 'éditeurs', 'db.owner': 'propriétaire',
    'db.fn': 'fonction', 'db.definer': 'fonction security definer', 'db.model': 'modèle Prisma', 'db.bucket': 'stockage de fichiers',
    'badge.admin': 'modifié depuis l’admin',
    'task': 'tâche', 'task.vercel': 'planifiée par Vercel ({cron}) → {path}', 'task.pg': 'base de données (pg_cron « {cron} »)',
    'cron.minute': 'chaque minute', 'cron.every': 'toutes les {n} minutes', 'cron.daily': 'chaque jour', 'cron.weekdays': 'du lundi au vendredi',
    'cron.d0': 'le dimanche', 'cron.d1': 'le lundi', 'cron.d6': 'le samedi', 'cron.days': 'jours {d}', 'cron.at': '{days} à {at} UTC',
    'route.defines': 'définit',
    'html.search': 'Chercher un fichier, une page, une table…', 'html.brain': 'Cerveau', 'html.columns': 'Colonnes',
    'html.colors': 'Couleurs', 'html.byFolder': 'dossiers', 'html.byType': 'types', 'html.all': 'Tout afficher', 'html.png': 'Image',
    'html.uses': 'Utilise', 'html.usedBy': 'Utilisé par', 'html.elements': 'éléments', 'html.links': 'liens',
    'html.help': 'Molette : zoom · glisser : se déplacer · glisser un point : le bouger · clic : son chemin · Échap : tout afficher',
    'html.badgeLegend': 'cercle jaune = modifié depuis l’admin', 'html.loading': 'Carte en cours de création…',
    'cli.done': 'Carte : {nodes} éléments, {edges} liens ({kinds})', 'cli.hook': 'Mise à jour automatique après chaque commit : installée.',
    'cli.nogit': 'Pas de dépôt git : pas de mise à jour automatique (relancer `carte` à la main).', 'cli.claude': 'Section ajoutée à CLAUDE.md.',
    'cli.live': 'Carte en direct de {root}\n  {url}  (Ctrl+C pour arrêter)', 'cli.rebuilt': 'carte refaite',
  },
  en: {
    'col.page': 'Pages', 'col.entry': 'Entry points', 'col.bloc': 'Building blocks (components and modules)', 'col.data': 'Data',
    'col.db': 'Database', 'col.server': 'Server and jobs', 'col.tool': 'Tools and commands',
    'md.title': 'Code map: {name}',
    'md.generated': 'Generated on {date} by carte-du-code (do not edit by hand). {nodes} items, {edges} links. Graph: `{html}`.',
    'md.kind': 'Stack: {kinds}.', 'md.unknown': 'unknown',
    'md.howto': 'How to read: each line gives the file, its role (its first comment), then → what it uses and ← who uses it.',
    'md.env': 'Secrets and variables (names only)', 'md.host': 'Hosting',
    'host.crons': 'Vercel: {n} scheduled job(s)', 'host.headers': 'Vercel: security headers ({n})', 'host.redirects': 'Vercel: {n} redirect(s)', 'host.file': '{f} present',
    'db.rls': 'RLS on', 'db.norls': 'RLS MISSING', 'db.read': 'read', 'db.write': 'write', 'db.nobody': 'nobody', 'db.editors': 'editors', 'db.owner': 'owner',
    'db.fn': 'function', 'db.definer': 'security definer function', 'db.model': 'Prisma model', 'db.bucket': 'file storage',
    'badge.admin': 'edited from the admin',
    'task': 'job', 'task.vercel': 'scheduled by Vercel ({cron}) → {path}', 'task.pg': 'database (pg_cron "{cron}")',
    'cron.minute': 'every minute', 'cron.every': 'every {n} minutes', 'cron.daily': 'every day', 'cron.weekdays': 'Monday to Friday',
    'cron.d0': 'on Sundays', 'cron.d1': 'on Mondays', 'cron.d6': 'on Saturdays', 'cron.days': 'days {d}', 'cron.at': '{days} at {at} UTC',
    'route.defines': 'defines',
    'html.search': 'Search a file, a page, a table…', 'html.brain': 'Brain', 'html.columns': 'Columns',
    'html.colors': 'Colours', 'html.byFolder': 'folders', 'html.byType': 'types', 'html.all': 'Show all', 'html.png': 'Image',
    'html.uses': 'Uses', 'html.usedBy': 'Used by', 'html.elements': 'items', 'html.links': 'links',
    'html.help': 'Wheel: zoom · drag: pan · drag a dot: move it · click: its chain · Esc: show all',
    'html.badgeLegend': 'yellow ring = edited from the admin', 'html.loading': 'Building the map…',
    'cli.done': 'Map: {nodes} items, {edges} links ({kinds})', 'cli.hook': 'Refresh after every commit: installed.',
    'cli.nogit': 'Not a git repository: no automatic refresh (run `carte` again by hand).', 'cli.claude': 'Section added to CLAUDE.md.',
    'cli.live': 'Live map of {root}\n  {url}  (Ctrl+C to stop)', 'cli.rebuilt': 'map rebuilt',
  },
};

export function i18n(lang = 'fr') {
  const dict = STRINGS[lang] || STRINGS.fr;
  const t = (key, vars = {}) => (dict[key] ?? STRINGS.fr[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return { t, lang: STRINGS[lang] ? lang : 'fr', html: Object.fromEntries(Object.entries(dict).filter(([k]) => k.startsWith('html.'))) };
}
