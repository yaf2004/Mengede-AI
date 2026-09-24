import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

let db;
let pool;

export function getDb() {
  if (db) return db;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Set it or use migrations with DATABASE_URL_DIRECT.');
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool);
  return db;
}

export function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}
