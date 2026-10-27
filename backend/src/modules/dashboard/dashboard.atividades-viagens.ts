import type { IncomingMessage, ServerResponse } from 'node:http';
import { sql } from '../../database/connection.js';
import { validarJwt } from '../../security/jwt.js';


const LIMITE_ATIVIDADES = 10;
const LIMITE_VIAGENS = 10;
const FUSO_OPERACAO = 'America/Sao_Paulo';
const PERFIS_AUTORIZADOS = ['ADMINISTRADOR', 'GESTOR_FROTA'];

export interface AtividadeRecente {
  id: number | null;
  descricao: string | null;
  usuarioId: number | null;
  dataHora: string | null;
}

export interface ProximaViagem {
  id: number | null;
  codigo: string | null;
  origem: string | null;
  destino: string | null;
  dataHora: string | null;
  status: string;
}

export interface AtividadesEViagens {
  atividades: AtividadeRecente[];
  viagens: ProximaViagem[];
}


function paraNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) {
    return null;
  }

  const numero = Number(valor);
  return Number.isSafeInteger(numero) ? numero : null;
}

function paraTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }

  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

function paraIso(valor: unknown): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }

  const data = valor instanceof Date ? valor : new Date(String(valor));
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

export async function buscarAtividadesRecentes(): Promise<AtividadeRecente[]> {
  const linhas = await sql`
    WITH base AS (
      SELECT to_jsonb(l) AS r
      FROM public.log_atividade l
    ),
    normalizado AS (
      SELECT
        r->>'id' AS id,
        r->>'descricao' AS descricao,
        r->>'usuario_id' AS usuario_id,
        COALESCE(
          r->>'criado_em',
          r->>'created_at',
          r->>'data_hora',
          r->>'data_criacao',
          r->>'data_registro',
          r->>'registrado_em'
        ) AS momento
      FROM base
    )
    SELECT
      id,
      descricao,
      usuario_id,
      CASE
        WHEN momento ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN momento::timestamptz
      END AS data_hora
    FROM normalizado
    ORDER BY
      data_hora DESC NULLS LAST,
      CASE WHEN id ~ '^[0-9]+$' THEN id::bigint END DESC NULLS LAST
    LIMIT ${LIMITE_ATIVIDADES}
  `;

  return linhas.map((linha) => ({
    id: paraNumero(linha.id),
    descricao: paraTexto(linha.descricao),
    usuarioId: paraNumero(linha.usuario_id),
    dataHora: paraIso(linha.data_hora),
  }));
}

export async function buscarProximasViagensDoDia(): Promise<ProximaViagem[]> {
  const linhas = await sql`
    WITH base AS (
      SELECT to_jsonb(s) AS r
      FROM public.solicitacao_viagem s
      WHERE s.status IN ('AGENDADA', 'PRONTA_PARA_INICIAR')
    ),
    normalizado AS (
      SELECT
        r->>'id' AS id,
        r->>'status' AS status,
        r->>'codigo' AS codigo,
        COALESCE(
          r->>'origem',
          r->>'endereco_origem',
          r->>'local_origem'
        ) AS origem,
        COALESCE(
          r->>'destino',
          r->>'endereco_destino',
          r->>'local_destino'
        ) AS destino,
        COALESCE(
          r->>'data_hora_saida',
          r->>'data_hora_partida',
          r->>'data_hora_viagem',
          r->>'data_hora',
          r->>'data_viagem',
          r->>'data_saida',
          r->>'data_partida',
          r->>'data_agendada'
        ) AS momento
      FROM base
    ),
    com_data AS (
      SELECT
        id,
        status,
        codigo,
        origem,
        destino,
        CASE
          WHEN momento ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN momento::timestamptz
        END AS data_hora
      FROM normalizado
    )
    SELECT id, status, codigo, origem, destino, data_hora
    FROM com_data
    WHERE (data_hora AT TIME ZONE ${FUSO_OPERACAO})::date
        = (now() AT TIME ZONE ${FUSO_OPERACAO})::date
    ORDER BY
      data_hora ASC,
      CASE WHEN id ~ '^[0-9]+$' THEN id::bigint END ASC NULLS LAST
    LIMIT ${LIMITE_VIAGENS}
  `;

  return linhas.map((linha) => ({
    id: paraNumero(linha.id),
    codigo: paraTexto(linha.codigo),
    origem: paraTexto(linha.origem),
    destino: paraTexto(linha.destino),
    dataHora: paraIso(linha.data_hora),
    status: String(linha.status),
  }));
}

export async function buscarAtividadesEViagens(): Promise<AtividadesEViagens> {
  const [atividades, viagens] = await Promise.all([
    buscarAtividadesRecentes(),
    buscarProximasViagensDoDia(),
  ]);

  return { atividades, viagens };
}

function responderJson(
  response: ServerResponse,
  status: number,
  corpo: unknown
): void {
  if (response.headersSent || response.writableEnded || response.destroyed) {
    return;
  }

  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(corpo));
}

  response: ServerResponse
): Promise<void> {
  try {
    const dados = await buscarAtividadesEViagens();
    responderJson(response, 200, { data: dados });
  } catch (erro) {
    console.error('Erro ao buscar atividades recentes e próximas viagens:', erro);
    responderJson(response, 500, {
      error: {
        code: 'ERRO_INTERNO',
        message: 'Não foi possível consultar as atividades e viagens.',
      },
    });
  }
}

export async function atividadesEViagensRoute(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const usuario = await validarJwt(request.headers.authorization);

  if (!usuario) {
    responderJson(response, 401, {
      error: { code: 'NAO_AUTENTICADO', message: 'Autenticação necessária.' },
    });
    return;
  }

  if (!PERFIS_AUTORIZADOS.includes(usuario.perfil)) {
    responderJson(response, 403, {
      error: { code: 'ACESSO_NEGADO', message: 'Acesso não permitido.' },
    });
    return;
  }

  if (request.method !== 'GET') {
    responderJson(response, 405, {
      error: { code: 'METODO_NAO_PERMITIDO', message: 'Use o método GET.' },
    });
    return;
  }

  await atividadesEViagensController(response);
}
