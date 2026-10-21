// Options: command line first, then .carterc.json at the project root, then the defaults.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULTS = { out: 'docs/carte', lang: 'fr', ignore: [], title: null, json: true };

export function loadConfig(root, cli = {}) {
  let file = {};
  const p = join(root, '.carterc.json');
  if (existsSync(p)) {
    try { file = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { throw new Error(`.carterc.json illisible : ${e.message}`); }
  }
  const cfg = { ...DEFAULTS, ...file, ...Object.fromEntries(Object.entries(cli).filter(([, v]) => v !== undefined)) };
  cfg.ignore = [...(file.ignore || []), ...(cli.ignore || [])];
  return cfg;
}
