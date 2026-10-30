import { perfilPersistidoValido } from '../../security/jwt.js';
export interface DadosUsuario { nome: string; email: string; perfil: string; senha?: string }

/** Aceita somente campos editáveis e códigos reais do enum perfil_usuario. */
export function validarDadosUsuario(body: unknown, cadastro: boolean): DadosUsuario | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const dados = body as Record<string, unknown>;
  if (Object.keys(dados).some(k => !['nome', 'email', 'perfil', 'senha'].includes(k))) return null;
  const { nome, email, perfil, senha } = dados;
  if (typeof nome !== 'string' || nome.trim().length < 3 || nome.length > 150 ||
      typeof email !== 'string' || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !perfilPersistidoValido(perfil) ||
      (cadastro && typeof senha !== 'string') ||
      (senha !== undefined && (typeof senha !== 'string' || senha.length < 8 || Buffer.byteLength(senha) > 72))) return null;
  return { nome: nome.trim(), email: email.trim(), perfil, senha: senha as string | undefined };
}

/** Status é estado desejado; rejeita campos extras e coerção de tipos. */
export function validarStatusUsuario(body: unknown): body is { ativo: boolean } {
  return !!body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === 1 && typeof (body as { ativo?: unknown }).ativo === 'boolean';
}
