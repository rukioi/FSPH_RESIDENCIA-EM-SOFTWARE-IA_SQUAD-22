// Ponto único da autenticação. Atualmente é apenas uma SIMULAÇÃO visual:
// não valida credenciais, não gera nem armazena token.
// Na integração, substituir o corpo de `entrar` por:
//   const r = await fetch('/api/auth/login', { method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(credenciais) })
//   if (!r.ok) throw new Error('E-mail ou senha inválidos.')
//   return r.json()

export type Credenciais = { email: string; senha: string }
export type ResultadoLogin = { simulado: true; destino: string }

export async function entrar(_credenciais: Credenciais): Promise<ResultadoLogin> {
  await new Promise((r) => setTimeout(r, 700))
  return { simulado: true, destino: '/admin/dashboard' }
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
