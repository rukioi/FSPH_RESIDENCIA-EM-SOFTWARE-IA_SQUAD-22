
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import { receberUpload } from './documentos.upload.js';

function enviarJson(
  res: ServerResponse,
  status: number,
  data: unknown,
): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  res.end(JSON.stringify({ data }));
}

function enviarErro(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  res.end(JSON.stringify({
    error: { code, message },
  }));
}

/** Consulta pendências de vencimento das CNHs e documentos dos veículos. */
export async function buscarPendenciasDocumentos(
  res: ServerResponse,
): Promise<void> {
  try {
    const alertasCnh = await sql`
      SELECT
        id,
        nome,
        cnh,
        validade_cnh,
        (validade_cnh::date - CURRENT_DATE) AS dias_restantes
      FROM motorista
      WHERE validade_cnh IS NOT NULL
        AND validade_cnh::date <= (CURRENT_DATE + INTERVAL '30 days')
      ORDER BY validade_cnh ASC
    `;

    const pendencias = alertasCnh.map((m) => ({
      id: m.id,
      tipo: 'CNH_MOTORISTA',
      descricao: `CNH de ${m.nome} (${m.cnh})`,
      data_validade: m.validade_cnh,
      dias_restantes: Number(m.dias_restantes),
      status: Number(m.dias_restantes) < 0
        ? 'VENCIDA'
        : 'PROXIMA_DO_VENCIMENTO',
    }));

    const alertasVeiculos = await sql`
      SELECT
        id,
        veiculo_id,
        tipo_documento,
        data_vencimento,
        (data_vencimento::date - CURRENT_DATE) AS dias_restantes
      FROM documento_veiculo
      WHERE data_vencimento IS NOT NULL
        AND data_vencimento::date <= (CURRENT_DATE + INTERVAL '30 days')
      ORDER BY data_vencimento ASC
    `;

    const pendenciasVeiculos = alertasVeiculos.map((documento) => ({
      id: documento.id,
      tipo: 'DOCUMENTO_VEICULO',
      descricao: `Documento ${documento.tipo_documento} do veículo ${documento.veiculo_id}`,
      data_validade: documento.data_vencimento,
      dias_restantes: Number(documento.dias_restantes),
      status: Number(documento.dias_restantes) < 0
        ? 'VENCIDA'
        : 'PROXIMA_DO_VENCIMENTO',
    }));

    enviarJson(res, 200, [...pendencias, ...pendenciasVeiculos]);
  } catch (err) {
    console.error('Erro ao calcular pendências:', err);

    enviarErro(
      res,
      500,
      'ERRO_INTERNO',
      'Erro ao processar alertas de documentos.',
    );
  }
}

/**
 * Cadastra documentos de veículos.
 * Aceita JSON e multipart/form-data com PDF, JPG ou PNG.
 */
export async function criarDocumento(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let body: unknown;

  let arquivoDocumento: {
    nome: string;
    tipo: string;
    conteudo: Buffer;
  } | null = null;

  const tipoConteudo = req.headers?.['content-type'] ?? '';
  const ehMultipart = tipoConteudo.startsWith('multipart/form-data');

  if (ehMultipart) {
    try {
      const upload = await receberUpload(req);

      arquivoDocumento = upload.arquivo;

      body = {
        veiculo_id: Number(upload.campos.veiculo_id),
        tipo_documento: upload.campos.tipo_documento,
        data_vencimento: upload.campos.data_vencimento,
      };
    } catch {
      enviarErro(
        res,
        400,
        'UPLOAD_INVALIDO',
        'Envie um arquivo PDF, JPG ou PNG de até 5 MB.',
      );
      return;
    }
  } else {
    const partes: Buffer[] = [];
    const limiteJson = 1024 * 1024; // 1 MB
    let tamanho = 0;
    let excedeuLimite = false;

    try {
      for await (const parte of req) {
        const buffer = Buffer.isBuffer(parte)
          ? parte
          : Buffer.from(parte);

        tamanho += buffer.length;

        if (tamanho > limiteJson) {
          if (!excedeuLimite) {
            excedeuLimite = true;
            enviarErro(
              res,
              413,
              'CORPO_MUITO_GRANDE',
              'O JSON deve ter no máximo 1 MB.',
            );
          }
          continue;
        }

        partes.push(buffer);
      }

      if (excedeuLimite) {
        return;
      }

      body = JSON.parse(Buffer.concat(partes).toString('utf8'));
    } catch {
      enviarErro(
        res,
        400,
        'JSON_INVALIDO',
        'Envie um JSON válido.',
      );
      return;
    }
  }

  if (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    enviarErro(
      res,
      400,
      'DADOS_INVALIDOS',
      'Envie um objeto válido.',
    );
    return;
  }

  const dados = body as Record<string, unknown>;

  const {
    veiculo_id,
    tipo_documento,
    data_vencimento,
  } = dados;

  if (
    !Number.isSafeInteger(veiculo_id) ||
    Number(veiculo_id) <= 0 ||
    typeof tipo_documento !== 'string' ||
    !tipo_documento.trim() ||
    typeof data_vencimento !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data_vencimento)
  ) {
    enviarErro(
      res,
      400,
      'DADOS_INVALIDOS',
      'Informe veiculo_id, tipo_documento e data_vencimento válidos.',
    );
    return;
  }

  // Confere o conteúdo real, não apenas o tipo informado pelo navegador.
  if (arquivoDocumento) {
    const conteudo = arquivoDocumento.conteudo;
    const tipo = arquivoDocumento.tipo;

    const pdf =
      conteudo.length >= 5 &&
      conteudo.subarray(0, 5).toString('ascii') === '%PDF-';

    const png =
      conteudo.length >= 8 &&
      conteudo.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );

    const jpg =
      conteudo.length >= 3 &&
      conteudo[0] === 0xff &&
      conteudo[1] === 0xd8 &&
      conteudo[2] === 0xff;

    const valido =
      (tipo === 'application/pdf' && pdf) ||
      (tipo === 'image/png' && png) ||
      (tipo === 'image/jpeg' && jpg);

    if (!valido) {
      enviarErro(
        res,
        400,
        'ARQUIVO_INVALIDO',
        'O conteúdo do arquivo não corresponde a um PDF, JPG ou PNG válido.',
      );
      return;
    }
  }

  const arquivoNome = arquivoDocumento?.nome ?? null;
  const arquivoTipo = arquivoDocumento?.tipo ?? null;

  // O PostgreSQL aceita BYTEA no formato hexadecimal \x...
  const arquivoDados = arquivoDocumento
    ? `\\x${arquivoDocumento.conteudo.toString('hex')}`
    : null;

  try {
    const [documento] = await sql`
      INSERT INTO documento_veiculo (
        veiculo_id,
        tipo_documento,
        data_vencimento,
        status_regular,
        arquivo_nome,
        arquivo_tipo,
        arquivo_dados
      )
      VALUES (
        ${Number(veiculo_id)},
        ${tipo_documento as string},
        ${data_vencimento as string},
        ${true},
        ${arquivoNome},
        ${arquivoTipo},
        ${arquivoDados}
      )
      RETURNING
        id,
        veiculo_id,
        tipo_documento,
        data_vencimento,
        status_regular,
        arquivo_nome,
        arquivo_tipo
    `;

    enviarJson(res, 201, documento);
  } catch (erro) {
    console.error('Erro ao cadastrar documento:', erro);

    enviarErro(
      res,
      500,
      'ERRO_INTERNO',
      'Não foi possível cadastrar o documento.',
    );
  }
}

/** Lista todos os documentos de veículos e as CNHs dos motoristas. */
export async function listarDocumentos(
  res: ServerResponse,
): Promise<void> {
  try {
    const documentosVeiculos = await sql`
      SELECT
        id,
        veiculo_id,
        tipo_documento,
        data_vencimento,
        status_regular
      FROM documento_veiculo
      ORDER BY id DESC
    `;

    const documentosMotoristas = await sql`
      SELECT
        id,
        nome,
        cnh,
        validade_cnh
      FROM motorista
      WHERE cnh IS NOT NULL
      ORDER BY id DESC
    `;

    const veiculos = documentosVeiculos.map((doc) => {
      const diasRestantes = doc.data_vencimento
        ? Math.ceil(
            (
              new Date(String(doc.data_vencimento)).getTime() -
              new Date().setHours(0, 0, 0, 0)
            ) / 86400000,
          )
        : null;

      return {
        id: doc.id,
        tipo: 'DOCUMENTO_VEICULO',
        descricao: doc.tipo_documento,
        relacionado_id: doc.veiculo_id,
        data_validade: doc.data_vencimento,
        status: diasRestantes === null
          ? 'SEM_VALIDADE'
          : diasRestantes < 0
            ? 'VENCIDA'
            : diasRestantes <= 30
              ? 'PROXIMA_DO_VENCIMENTO'
              : 'REGULAR',
      };
    });

    const motoristas = documentosMotoristas.map((motorista) => {
      const diasRestantes = motorista.validade_cnh
        ? Math.ceil(
            (
              new Date(String(motorista.validade_cnh)).getTime() -
              new Date().setHours(0, 0, 0, 0)
            ) / 86400000,
          )
        : null;

      return {
        id: motorista.id,
        tipo: 'CNH_MOTORISTA',
        descricao: `CNH de ${motorista.nome}`,
        relacionado_id: motorista.id,
        data_validade: motorista.validade_cnh,
        status: diasRestantes === null
          ? 'SEM_VALIDADE'
          : diasRestantes < 0
            ? 'VENCIDA'
            : diasRestantes <= 30
              ? 'PROXIMA_DO_VENCIMENTO'
              : 'REGULAR',
      };
    });

    enviarJson(res, 200, [...veiculos, ...motoristas]);
  } catch (erro) {
    console.error('Erro ao listar documentos:', erro);

    enviarErro(
      res,
      500,
      'ERRO_INTERNO',
      'Não foi possível listar os documentos.',
    );
  }
}
