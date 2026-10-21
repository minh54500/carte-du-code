// Marks a dish sold out (staff only).
import { write } from './_db.js';
export default async () => write(process.env.SUPABASE_SECRET_KEY, process.env.STAFF_CODE);
