import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL não está definida no .env');
}

export const sql = postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
});