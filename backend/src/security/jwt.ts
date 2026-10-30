import { SignJWT, jwtVerify } from 'jose';

export const PERFIS_USUARIO = [
  'ADM',
  'GESTOR_FROTA',
  'SOLICITANTE_INTERNO',
  'MOTORISTA',
  'ATENDENTE_SVO',
] as const;
export type PerfilUsuario = (typeof PERFIS_USUARIO)[number];
const perfisValidos = new Set<string>(PERFIS_USUARIO);

const aliasesPerfil: Record<string, string> = {
  ADMINISTRADOR: 'ADM',
  GESTOR: 'GESTOR_FROTA',
  'GESTOR DA FROTA': 'GESTOR_FROTA',
  SOLICITANTE: 'SOLICITANTE_INTERNO',
};

export interface UsuarioAutenticado {
  id: string;
  email?: string;
  nome?: string;
  perfil: string;
}

function chaveJwt(): Uint8Array {
  const segredo = process.env.JWT_SECRET;

  if (!segredo || new TextEncoder().encode(segredo).byteLength < 32) {
    throw new Error('JWT_SECRET deve conter pelo menos 32 bytes.');
  }

  return new TextEncoder().encode(segredo);
}

/** Reconhece exatamente os códigos persistidos auditados do enum perfil_usuario. */
export function perfilPersistidoValido(perfil: unknown): perfil is PerfilUsuario {
  return typeof perfil === 'string' && perfisValidos.has(perfil);
}

/** Normaliza aliases legados somente na fronteira JWT; SQL usa enum persistido. */
export function normalizarPerfil(perfil: string): string | null {
  const normalizado = aliasesPerfil[perfil.trim().toUpperCase()] ?? perfil.trim().toUpperCase();
  return perfilPersistidoValido(normalizado) ? normalizado : null;
}

/** Emite token HS256 de oito horas com identidade e perfil reconhecido. */
export async function criarJwt(usuario: UsuarioAutenticado): Promise<string> {
  const perfil = normalizarPerfil(usuario.perfil);

  if (!perfil) {
    throw new Error('Perfil de usuário inválido.');
  }

  return new SignJWT({
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    perfil,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuario.id)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(chaveJwt());
}

/** Verifica assinatura HS256, subject, expiração obrigatória e perfil conhecido. */
export async function validarJwt(
  authorization: string | undefined,
): Promise<UsuarioAutenticado | null> {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, chaveJwt(), {
      algorithms: ['HS256'],
    });
    const perfil = typeof payload.perfil === 'string'
      ? normalizarPerfil(payload.perfil)
      : null;

    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.exp !== 'number' ||
      payload.exp <= Math.floor(Date.now() / 1000) ||
      !perfil
    ) {
      return null;
    }

    const usuario: UsuarioAutenticado = {
      id: payload.sub,
      perfil,
    };

    if (typeof payload.email === 'string') {
      usuario.email = payload.email;
    }

    if (typeof payload.nome === 'string') {
      usuario.nome = payload.nome;
    }

    return usuario;
  } catch {
    return null;
  }
}
