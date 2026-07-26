import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { DATABASE_URL } from '$env/static/private';

// prepare: false — required by Supabase's transaction pooler (6543).
const client = postgres(DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });
