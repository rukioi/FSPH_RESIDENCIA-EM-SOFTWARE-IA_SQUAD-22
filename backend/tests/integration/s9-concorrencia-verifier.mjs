import { testUrl, verifyContainer, verifiedSql } from '../database/s9-preflight-harness.mjs';
export { verifiedSql } from '../database/s9-preflight-harness.mjs';

/** Preserva nonce, alvo exato e conferência do marcador antes do pool da aplicação. */
export async function verifyTestEnvironment() {
  const manifest = verifyContainer();
  if (!process.env.FSPH_TEST_NONCE || process.env.FSPH_TEST_NONCE !== manifest.nonce ||
      process.env.DATABASE_URL !== testUrl) throw new Error('Identidade de teste Sprint 9 divergente.');
  const sql = await verifiedSql();
  await sql.end();
}
