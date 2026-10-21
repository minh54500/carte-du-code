#!/usr/bin/env node
// carte: the code map of a project, for AI assistants (Markdown) and for humans (a "brain" graph). Zero dependencies.
import { resolve, join, isAbsolute } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.mjs';
import { generate } from '../src/generate.mjs';
import { installHook } from '../src/init.mjs';
import { live } from '../src/live.mjs';
import { i18n } from '../src/i18n.mjs';
import { serve } from '../src/mcp.mjs';

const HELP = `carte — la carte du code d'un projet / the code map of a project

Usage
  carte [dossier]            génère la carte (docs/carte/) / builds the map
  carte live [dossier]       carte en direct, redessinée à chaque sauvegarde / live map, redrawn on every save
  carte init [dossier]       la refait après chaque commit, la garde hors de git / refresh after every commit
  carte init --claude        + dit à Claude Code de la lire en premier (CLAUDE.md) / + tell Claude Code to read it first
  carte mcp                  serveur MCP : l'assistant interroge la carte directement / MCP server for AI assistants
                             claude mcp add carte -s user -- carte mcp

Options
  --out <dossier>    dossier de sortie (défaut docs/carte) / output folder
  --lang fr|en       langue de la carte / map language
  --ignore <motif>   ignorer des fichiers (répétable), ex. --ignore "legacy/**"
  --no-json          ne pas écrire carte-du-code.json
  --open             ouvrir le graphe à la fin / open the graph when done
  --port <n>         port du mode direct (défaut 4747)
  --quiet            silencieux / no output
  -v, --version      version
  -h, --help         cette aide

Réglages permanents : .carterc.json à la racine, ex. {"lang":"en","ignore":["legacy/**"],"out":"docs/carte"}`;

const argv = process.argv.slice(2);
const flags = { ignore: [] }, pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--out' || a === '--lang' || a === '--port') flags[a.slice(2)] = argv[++i];
  else if (a === '--ignore') flags.ignore.push(argv[++i]);
  else if (a === '--no-json') flags.json = false;
  else if (a === '--quiet' || a === '-q') flags.quiet = true;
  else if (a === '--open') flags.open = true;
  else if (a === '--claude') flags.claude = true;
  else if (a === '-h' || a === '--help') flags.help = true;
  else if (a === '-v' || a === '--version') flags.version = true;
  else if (a.startsWith('-')) { console.error(`Option inconnue / unknown option: ${a}\n\n${HELP}`); process.exit(2); }
  else pos.push(a);
}
if (flags.help) { console.log(HELP); process.exit(0); }
if (flags.version) { console.log(JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).version); process.exit(0); }

const command = ['live', 'init', 'mcp'].includes(pos[0]) ? pos.shift() : 'build';
const root = resolve(pos[0] || '.');
if (!existsSync(root)) { console.error(`Dossier introuvable / folder not found: ${root}`); process.exit(1); }
if (command === 'mcp') serve(pos[0]); // each project's settings are read with each question
else run();

function run() {
  const cfg = loadConfig(root, { out: flags.out, lang: flags.lang, json: flags.json, ignore: flags.ignore });
  const say = (...m) => { if (!flags.quiet) console.log(...m); };
  try {
    if (command === 'live') return live(root, cfg, { port: Number(flags.port) || 4747 });
    const { paths, summary } = generate(root, cfg);
    if (command === 'init') for (const m of installHook(root, cfg, i18n(cfg.lang).t, { claude: flags.claude })) say(m);
    say(`${summary}\n  ${paths.md}\n  ${paths.html}`);
    if (flags.open) try { execFileSync(process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open', [paths.html], { stdio: 'ignore' }); } catch {}
  } catch (e) {
    console.error(`carte : ${e.message}`);
    process.exit(1);
  }
}
