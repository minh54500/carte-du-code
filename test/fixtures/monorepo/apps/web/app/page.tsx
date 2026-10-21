// Home page: the list of customers.
import { Button } from '@acme/ui';
import { db } from '../db';
import { users } from '../db/schema';
export default async function Home() { const rows = await db.select().from(users); return <Button>{rows.length}</Button>; }
