import type { IncomingMessage, ServerResponse } from 'node:http';
import { sql } from '../../database/connection.js';
import { validarJwt } from '../../security/jwt.js';


const STATUS_AGUARDANDO_ANALISE = [
  'AGUARDANDO_ANALISE',
  'PENDENTE_ANALISE',
  'EM_ANALISE',
  'AGUARDANDO_APROVACAO',
  'PENDENTE_APROVACAO',
  'PENDENTE',
  'SOLICITADA',
];

const PERFIS_AUTORIZADOS = ['ADMINISTRADOR', 'GESTOR_FROTA'];
const FUSO_OPERACAO = 'America/Sao_Paulo';
const PAGINA_PADRAO = 1;
const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

const TABELAS_PASSAGEIROS = [
  'passageiro_viagem',
  'passageiro_solicitacao',
  'solicitacao_passageiro',
  'solicitacao_viagem_passageiro',
  'viagem_passageiro',
  'passageiro',
  'passageiros',
];

const COLUNAS_FK_SOLICITACAO = [
  'solicitacao_viagem_id',
  'solicitacao_id',
  'viagem_id',
];

export interface ChamadoAguardandoAnalise {
  id: number | null;
  codigo: string | null;
  instituicao: string | null;
  origem: string | null;
  destino: string | null;
  data: string | null;
  dataHora: string | null;
  passageiros: number;
  status: string;
}

export interface ListaAguardandoAnalise {
  data: ChamadoAguardandoAnalise[];
  meta: { page: number; limit: number; total: number };
}

interface TabelaPassageiros {
  tabela: string;
  colunaFk: string;
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

async function localizarTabelaPassageiros(): Promise<TabelaPassageiros | null> {
  const linhas = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ${sql(TABELAS_PASSAGEIROS)}
      AND column_name IN ${sql(COLUNAS_FK_SOLICITACAO)}
  `;

  for (const tabela of TABELAS_PASSAGEIROS) {
    for (const coluna of COLUNAS_FK_SOLICITACAO) {
      const encontrada = linhas.some(
        (linha) => linha.table_name === tabela && linha.column_name === coluna
      );

      if (encontrada) {
        return { tabela, colunaFk: coluna };
      }
    }
  }

  return null;
}

async function contarPassageiros(
  tabela: TabelaPassageiros,
  ids: number[]
): Promise<Map<number, number>> {
  const contagem = new Map<number, number>();

  if (ids.length === 0) {
    return contagem;
  }

  const linhas = await sql`
    SELECT ${sql(tabela.colunaFk)} AS solicitacao_id, COUNT(*)::int AS total
    FROM ${sql('public.' + tabela.tabela)}
    WHERE ${sql(tabela.colunaFk)} IN ${sql(ids)}
    GROUP BY ${sql(tabela.colunaFk)}
  `;

  for (const linha of linhas) {
    const id = paraNumero(linha.solicitacao_id);

    if (id !== null) {
      contagem.set(id, Number(linha.total));
    }
  }

  return contagem;
}

export async function listarChamadosAguardandoAnalise(
  pagina: number,
  limite: number
): Promise<ListaAguardandoAnalise> {
  const deslocamento = (pagina - 1) * limite;

  const linhas = await sql`
    WITH base AS (
      SELECT to_jsonb(s) AS r
      FROM public.solicitacao_viagem s
      WHERE s.status::text IN ${sql(STATUS_AGUARDANDO_ANALISE)}
    ),
    normalizado AS (
      SELECT
        r->>'id' AS id,
        r->>'status' AS status,
        r->>'codigo' AS codigo,
        COALESCE(
          r->>'instituicao',
          r->>'instituicao_nome',
          r->>'nome_instituicao',
          r->>'unidade_solicitante',
          r->>'setor_solicitante'
        ) AS instituicao,
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
        ) AS momento,
        COALESCE(
          r->>'horario',
          r->>'horario_saida',
          r->>'hora_saida',
          r->>'hora'
        ) AS horario,
        COALESCE(
          r->>'quantidade_passageiros',
          r->>'qtd_passageiros',
          r->>'numero_passageiros',
          r->>'num_passageiros',
          r->>'total_passageiros',
          r->>'passageiros'
        ) AS passageiros
      FROM base
    ),
    com_data AS (
      SELECT
        *,
        CASE
          WHEN momento ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            AND horario ~ '^[0-9]{2}:[0-9]{2}'
            THEN (momento || ' ' || horario)::timestamp AT TIME ZONE ${FUSO_OPERACAO}
          WHEN momento ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            THEN NULL
          WHEN momento ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            THEN momento::timestamptz
        END AS data_hora,
        CASE
          WHEN momento ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN momento::date
          WHEN momento ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            THEN (momento::timestamptz AT TIME ZONE ${FUSO_OPERACAO})::date
        END AS data
      FROM normalizado
    )
    SELECT
      id,
      status,
      codigo,
      instituicao,
      origem,
      destino,
      to_char(data, 'YYYY-MM-DD') AS data,
      data_hora,
      CASE WHEN passageiros ~ '^[0-9]+$' THEN passageiros::int END AS passageiros,
      COUNT(*) OVER ()::int AS total
    FROM com_data
    ORDER BY
      data ASC NULLS LAST,
      data_hora ASC NULLS LAST,
      CASE WHEN id ~ '^[0-9]+$' THEN id::bigint END ASC NULLS LAST
    LIMIT ${limite}
    OFFSET ${deslocamento}
  `;

  const total = linhas.length > 0 ? Number(linhas[0].total) : await contarTotal();

  const ids = linhas
    .map((linha) => paraNumero(linha.id))
    .filter((id): id is number => id !== null);

  const tabelaPassageiros = await localizarTabelaPassageiros();
  const contagem = tabelaPassageiros
    ? await contarPassageiros(tabelaPassageiros, ids)
    : null;

  const chamados = linhas.map((linha) => {
    const id = paraNumero(linha.id);
    const passageiros = contagem
      ? (id !== null ? contagem.get(id) ?? 0 : 0)
      : paraNumero(linha.passageiros) ?? 0;

    return {
      id,
      codigo: paraTexto(linha.codigo),
      instituicao: paraTexto(linha.instituicao),
      origem: paraTexto(linha.origem),
      destino: paraTexto(linha.destino),
      data: paraTexto(linha.data),
      dataHora: paraIso(linha.data_hora),
      passageiros,
      status: String(linha.status),
    };
  });

  return {
    data: chamados,
    meta: { page: pagina, limit: limite, total },
  };
}

async function contarTotal(): Promise<number> {
  const linhas = await sql`
    SELECT COUNT(*)::int AS total
    FROM public.solicitacao_viagem s
    WHERE s.status::text IN ${sql(STATUS_AGUARDANDO_ANALISE)}
  `;

  return Number(linhas[0]?.total ?? 0);
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

function lerInteiroPositivo(
  valor: string | null,
  padrao: number,
  maximo?: number
): number | null {
  if (valor === null) {
    return padrao;
  }

  if (!/^[1-9][0-9]*$/.test(valor)) {
    return null;
  }

  const numero = Number(valor);

  if (!Number.isSafeInteger(numero) || (maximo !== undefined && numero > maximo)) {
    return null;
  }

  return numero;
}

export async function aguardandoAnaliseController(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const url = new URL(request.url ?? '', 'http://localhost');
  const pagina = lerInteiroPositivo(url.searchParams.get('page'), PAGINA_PADRAO);
  const limite = lerInteiroPositivo(
    url.searchParams.get('limit'),
    LIMITE_PADRAO,
    LIMITE_MAXIMO
  );

  if (pagina === null || limite === null) {
    const fields: Record<string, string> = {};

    if (pagina === null) {
      fields.page = 'Informe um número inteiro positivo.';
    }

    if (limite === null) {
      fields.limit = `Informe um número inteiro entre 1 e ${LIMITE_MAXIMO}.`;
    }

    responderJson(response, 400, {
      error: {
        code: 'ENTRADA_INVALIDA',
        message: 'Confira os parâmetros de paginação.',
        fields,
      },
    });
    return;
  }

  try {
    const resultado = await listarChamadosAguardandoAnalise(pagina, limite);
    responderJson(response, 200, resultado);
  } catch (erro) {
    console.error('Erro ao listar chamados aguardando análise:', erro);
    responderJson(response, 500, {
      error: {
        code: 'ERRO_INTERNO',
        message: 'Não foi possível consultar os chamados aguardando análise.',
      },
    });
  }
}

export async function aguardandoAnaliseRoute(
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

  await aguardandoAnaliseController(request, response);
}
