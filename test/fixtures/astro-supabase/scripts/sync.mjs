// Pulls the dishes from Supabase and writes the content the site reads.
import { writeFileSync } from 'node:fs';
const SB = 'https://x.supabase.co/rest/v1';
const get = (q) => fetch(`${SB}/${q}`).then((r) => r.json());
const OUT = new URL('../src/data/generated.json', import.meta.url);
writeFileSync(OUT, JSON.stringify({ dishes: await get('dishes?order=position') }));
