// Loads the orders count for the home page.
import { orders } from '$lib/db';
export const load = async () => ({ count: (await orders()).length });
