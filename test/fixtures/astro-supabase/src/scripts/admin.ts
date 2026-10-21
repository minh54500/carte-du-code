// Admin screen: marks a dish sold out through the API, checks the editor with an RPC.
const SB = 'https://x.supabase.co';
export async function soldOut(id: string) { await fetch('/api/staff', { method: 'POST', body: id }); }
export const ok = () => fetch(SB + '/rest/v1/rpc/is_editor', { method: 'POST' });
export const list = () => fetch(`${SB}/rest/v1/dishes?order=position`);
