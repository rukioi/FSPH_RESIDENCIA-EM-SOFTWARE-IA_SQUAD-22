import { SignJWT } from 'jose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback_secret_para_desenvolvimento'
  );
  
  const token = await new SignJWT({ perfil: 'ADMINISTRADOR', sub: '123' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);

  console.log(`\nNovo Token Gerado:\nBearer ${token}\n`);
}

run();