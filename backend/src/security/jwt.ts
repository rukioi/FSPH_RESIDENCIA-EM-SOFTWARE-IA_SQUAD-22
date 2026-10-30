import type { IncomingMessage, ServerResponse } from 'node:http';
import { SignJWT, jwtVerify } from 'jose';

const perfisValidos = new Set([
  'ADM',
  'GESTOR_FROTA',
  'SOLICITANTE',
  'MOTORISTA',
  'ATENDENTE_SVO',
]);

const aliasesPerfil: Record<string, string> = {
  ADMINISTRADOR: 'ADM',
  GESTOR: 'GESTOR_FROTA',
  'GESTOR DA FROTA': 'GESTOR_FROTA',
  SOLICITANTE_INTERNO: 'SOLICITANTE',
};

export interface UsuarioAutenticado {
  id: string;
  email?: string;
  nome?: string;
  perfil: string;
}

function chaveJwt(): Uint8Array {
  const segredo = process.env.JWT_SECRET;

  if (!segredo || new TextEncoder().encode(segredo).byteLength < 16) {
    throw new Error('JWT_SECRET deve conter pelo menos 16 bytes.');
  }

  return new TextEncoder().encode(segredo);
}

export function normalizarPerfil(perfil: string): string | null {
  const normalizado = aliasesPerfil[perfil.trim().toUpperCase()] ?? perfil.trim().toUpperCase();
  return perfisValidos.has(normalizado) ? normalizado : null;
}

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

export function enviarErroAutenticacao(
  response: ServerResponse,
  status: 401 | 403,
): void {
  const autenticado = status === 401;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify({
    error: {
      code: autenticado ? 'NAO_AUTENTICADO' : 'ACESSO_NEGADO',
      message: autenticado
        ? 'Autenticação necessária.'
        : 'Acesso não permitido.',
    },
  }));
}

export async function autenticarRequisicao(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<UsuarioAutenticado | null> {
  const usuario = await validarJwt(request.headers.authorization);

  if (!usuario) {
    enviarErroAutenticacao(response, 401);
  }

  return usuario;
}

export function autorizarPerfis(
  usuario: UsuarioAutenticado,
  perfisPermitidos: string[],
  response: ServerResponse,
): boolean {
  if (!perfisPermitidos.includes(usuario.perfil)) {
    enviarErroAutenticacao(response, 403);
    return false;
  }

  return true;
}