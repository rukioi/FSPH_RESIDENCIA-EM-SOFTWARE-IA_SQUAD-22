import postgres from 'postgres';

if (process.env.NODE_ENV === 'test') {
  const { verifyTestEnvironment } = await import('./scripts/verify-test-db.js');
  await verifyTestEnvironment();
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL não configurada.');
}

export const sql = postgres(databaseUrl);
