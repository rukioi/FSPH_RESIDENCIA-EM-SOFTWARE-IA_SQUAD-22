import postgres from 'postgres';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL não configurada.');
}
export const sql = postgres(databaseUrl);
