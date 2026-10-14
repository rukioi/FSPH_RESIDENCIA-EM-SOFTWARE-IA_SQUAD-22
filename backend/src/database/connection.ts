import { Pool } from 'pg';

export interface Database {
  query(sql: string, values: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

let pool: Pool | undefined;

export const database: Database = {
  async query(sql, values) {
    if (!process.env.DATABASE_URL) {
      throw new Error('Banco de dados não configurado.');
    }

    if (!pool) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
      });
      pool.on('error', () => {
        console.error('Uma conexão ociosa com o banco foi interrompida.');
      });
    }
    return pool.query(sql, values);
  },
};

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
