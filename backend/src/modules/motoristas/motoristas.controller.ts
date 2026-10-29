
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';

const CATEGORIAS_PERMITIDAS = ['A', 'B', 'C', 'D', 'E'];

const STATUS_PERMITIDOS = [
  'DISPONIVEL',
  'EM_VIAGEM',
  'FOLGA',
  'AFASTADO',
];

function enviarJson(res: ServerResponse, status: number, data: unknown) {
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
) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify({ error: { code, message } }));
}

async function lerBody(req: IncomingMessage): Promise<unknown> {
  const partes: Buffer[] = [];
  let tamanho = 0;
  const limite = 64 * 1024;
  let excedeuLimite = false;

  for await (const parte of req) {
    const buffer = Buffer.isBuffer(parte)
      ? parte
      : Buffer.from(parte);

    tamanho += buffer.length;

    if (tamanho > limite) {
      excedeuLimite = true;
      continue;
    }

    partes.push(buffer);
  }

  if (excedeuLimite) {
    throw new Error('CORPO_MUITO_GRANDE');
  }

  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
  } catch {
    throw new Error('JSON_INVALIDO');
  }
}
function objetoValido(valor: unknown): valor is Record<string, unknown> {
  return (
    valor !== null &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  );
}

function textoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function dataValida(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!match) return false;

  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);

  const data = new Date(Date.UTC(ano, mes - 1, dia));

  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

function cpfValido(valor: string): boolean {
  const cpf = valor.replace(/\D/g, '');

  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  for (let tamanho = 9; tamanho <= 10; tamanho++) {
    let soma = 0;

    for (let i = 0; i < tamanho; i++) {
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    }

    const resto = (soma * 10) % 11;
    const digito = resto === 10 ? 0 : resto;

    if (digito !== Number(cpf[tamanho])) {
      return false;
    }
  }

  return true;
}

function telefoneValido(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;

  const digitos = valor.replace(/\D/g, '');

  return /^\d{10,11}$/.test(digitos);
}

function tratarErro(
  res: ServerResponse,
  err: unknown,
  mensagem: string,
) {
  if (err instanceof Error && err.message === 'JSON_INVALIDO') {
    return enviarErro(
      res,
      400,
      'JSON_INVALIDO',
      'Envie um JSON válido.',
    );
  }

  if (err instanceof Error && err.message === 'CORPO_MUITO_GRANDE') {
    return enviarErro(
      res,
      413,
      'CORPO_MUITO_GRANDE',
      'Corpo da requisição muito grande.',
    );
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === '23505'
  ) {
    const detalhe = 'constraint' in err
      ? String(err.constraint)
      : '';

    if (detalhe === 'motorista_cpf_key') {
      return enviarErro(
        res,
        409,
        'CPF_DUPLICADO',
        'Este CPF já está cadastrado.',
      );
    }

    return enviarErro(
      res,
      409,
      'CNH_DUPLICADA',
      'Esta CNH já está cadastrada.',
    );
  }

  console.error(mensagem, err);

  return enviarErro(res, 500, 'ERRO_INTERNO', mensagem);
}

/** Lista os motoristas cadastrados. */
export async function listarMotoristas(
  _req: IncomingMessage,
  res: ServerResponse,
  perfil: string,
) {
  try {
    const motoristas = await sql`
      SELECT * FROM motorista ORDER BY id DESC
    `;

    const dados = perfil === 'ATENDENTE_SVO'
      ? motoristas.map((motorista) =>
          Object.fromEntries(
            Object.entries(motorista).filter(
              ([campo]) => campo !== 'cpf' && campo !== 'telefone',
            ),
          ),
        )
      : motoristas;

enviarJson(res, 200, dados);
  } catch (err) {
    tratarErro(res, err, 'Falha ao listar motoristas.');
  }
}

/** Cadastra um motorista após validar seus dados. */
export async function criarMotorista(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const body = await lerBody(req);

    if (!objetoValido(body)) {
      return enviarErro(
        res,
        400,
        'DADOS_INVALIDOS',
        'Envie um objeto JSON válido.',
      );
    }

    const {
      nome,
      cnh,
      categoria_cnh,
      validade_cnh,
      status,
      cpf,
      telefone,
    } = body;

    if (
      !textoValido(nome) ||
      !textoValido(cnh) ||
      !textoValido(categoria_cnh) ||
      !textoValido(validade_cnh)
    ) {
      return enviarErro(
        res,
        400,
        'DADOS_INVALIDOS',
        'Nome, CNH, categoria da CNH e validade são obrigatórios.',
      );
    }

    if (!CATEGORIAS_PERMITIDAS.includes(categoria_cnh)) {
      return enviarErro(
        res,
        400,
        'CATEGORIA_CNH_INVALIDA',
        'A categoria da CNH deve ser A, B, C, D ou E.',
      );
    }

    if (!dataValida(validade_cnh)) {
      return enviarErro(
        res,
        400,
        'DATA_INVALIDA',
        'A validade da CNH deve ser uma data válida no formato AAAA-MM-DD.',
      );
    }

    if (
      cpf !== undefined &&
      cpf !== null &&
      (
        typeof cpf !== 'string' ||
        !cpfValido(cpf)
      )
    ) {
      return enviarErro(
        res,
        400,
        'CPF_INVALIDO',
        'Informe um CPF válido com 11 dígitos.',
      );
    }

    if (
      telefone !== undefined &&
      telefone !== null &&
      !telefoneValido(telefone)
    ) {
      return enviarErro(
        res,
        400,
        'TELEFONE_INVALIDO',
        'Informe um telefone válido com DDD.',
      );
    }

    const cpfNormalizado = typeof cpf === 'string'
      ? cpf.replace(/\D/g, '')
      : null;

    const telefoneNormalizado = typeof telefone === 'string'
      ? telefone.replace(/\D/g, '')
      : null;

    const statusOp = status ?? 'DISPONIVEL';

    if (
      typeof statusOp !== 'string' ||
      !STATUS_PERMITIDOS.includes(statusOp)
    ) {
      return enviarErro(
        res,
        400,
        'STATUS_INVALIDO',
        'Status inválido. Utilize DISPONIVEL, EM_VIAGEM, FOLGA ou AFASTADO.',
      );
    }

    const [existente] = await sql`
      SELECT id FROM motorista WHERE cnh = ${cnh.trim()}
    `;

    if (existente) {
      return enviarErro(
        res,
        409,
        'CNH_DUPLICADA',
        'Já existe um motorista cadastrado com esta CNH.',
      );
    }

    if (cpfNormalizado !== null) {
      const [cpfExistente] = await sql`
        SELECT id FROM motorista WHERE cpf = ${cpfNormalizado}
      `;

      if (cpfExistente) {
        return enviarErro(
          res,
          409,
          'CPF_DUPLICADO',
          'Este CPF já está cadastrado.',
        );
      }
    }

    const [novo] = await sql`
      INSERT INTO motorista (
        nome,
        cnh,
        categoria_cnh,
        validade_cnh,
        status,
        cpf,
        telefone
      )
      VALUES (
        ${nome},
        ${cnh.trim()},
        ${categoria_cnh},
        ${validade_cnh},
        ${statusOp},
        ${cpfNormalizado},
        ${telefoneNormalizado}
      )
      RETURNING *
    `;

    enviarJson(res, 201, novo);
  } catch (err) {
    tratarErro(res, err, 'Falha ao cadastrar motorista.');
  }
}

/** Atualiza os dados de um motorista existente. */
export async function atualizarMotorista(
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
) {
  try {
    const body = await lerBody(req);

    if (!objetoValido(body)) {
      return enviarErro(
        res,
        400,
        'DADOS_INVALIDOS',
        'Envie um objeto JSON válido.',
      );
    }

    const {
      nome,
      cnh,
      categoria_cnh,
      validade_cnh,
      status,
      cpf,
      telefone,
    } = body;

    if (nome !== undefined && !textoValido(nome)) {
      return enviarErro(
        res,
        400,
        'DADOS_INVALIDOS',
        'Nome inválido.',
      );
    }

    if (cnh !== undefined && !textoValido(cnh)) {
      return enviarErro(
        res,
        400,
        'DADOS_INVALIDOS',
        'CNH inválida.',
      );
    }

    if (
      categoria_cnh !== undefined &&
      (
        typeof categoria_cnh !== 'string' ||
        !CATEGORIAS_PERMITIDAS.includes(categoria_cnh)
      )
    ) {
      return enviarErro(
        res,
        400,
        'CATEGORIA_CNH_INVALIDA',
        'A categoria da CNH deve ser A, B, C, D ou E.',
      );
    }

    if (
      validade_cnh !== undefined &&
      !dataValida(validade_cnh)
    ) {
      return enviarErro(
        res,
        400,
        'DATA_INVALIDA',
        'A validade da CNH deve ser uma data válida no formato AAAA-MM-DD.',
      );
    }

    if (
      status !== undefined &&
      (
        typeof status !== 'string' ||
        !STATUS_PERMITIDOS.includes(status)
      )
    ) {
      return enviarErro(
        res,
        400,
        'STATUS_INVALIDO',
        'Status inválido. Utilize DISPONIVEL, EM_VIAGEM, FOLGA ou AFASTADO.',
      );
    }

    if (
      cpf !== undefined &&
      cpf !== null &&
      (
        typeof cpf !== 'string' ||
        !cpfValido(cpf)
      )
    ) {
      return enviarErro(
        res,
        400,
        'CPF_INVALIDO',
        'Informe um CPF válido com 11 dígitos.',
      );
    }

    if (
      telefone !== undefined &&
      telefone !== null &&
      !telefoneValido(telefone)
    ) {
      return enviarErro(
        res,
        400,
        'TELEFONE_INVALIDO',
        'Informe um telefone válido com DDD.',
      );
    }

    const cpfNormalizado = typeof cpf === 'string'
      ? cpf.replace(/\D/g, '')
      : null;

    const telefoneNormalizado = typeof telefone === 'string'
      ? telefone.replace(/\D/g, '')
      : null;

    if (cnh !== undefined) {
      const [existente] = await sql`
        SELECT id
        FROM motorista
        WHERE cnh = ${cnh.trim()} AND id <> ${id}
      `;

      if (existente) {
        return enviarErro(
          res,
          409,
          'CNH_DUPLICADA',
          'Esta CNH já pertence a outro motorista.',
        );
      }
    }

    if (cpfNormalizado !== null) {
      const [cpfExistente] = await sql`
        SELECT id
        FROM motorista
        WHERE cpf = ${cpfNormalizado} AND id <> ${id}
      `;

      if (cpfExistente) {
        return enviarErro(
          res,
          409,
          'CPF_DUPLICADO',
          'Este CPF já pertence a outro motorista.',
        );
      }
    }

    const [atualizado] = await sql`
      UPDATE motorista
      SET
        nome = COALESCE(${nome ?? null}, nome),
        cnh = COALESCE(${cnh?.trim() ?? null}, cnh),
        categoria_cnh = COALESCE(${categoria_cnh ?? null}, categoria_cnh),
        validade_cnh = COALESCE(${validade_cnh ?? null}, validade_cnh),
        status = COALESCE(${status ?? null}, status),
        cpf = CASE
          WHEN ${cpf !== undefined} THEN ${cpfNormalizado}
          ELSE cpf
        END,
        telefone = CASE
          WHEN ${telefone !== undefined} THEN ${telefoneNormalizado}
          ELSE telefone
        END
      WHERE id = ${id}
      RETURNING *
    `;

    if (!atualizado) {
      return enviarErro(
        res,
        404,
        'NAO_ENCONTRADO',
        'Motorista não encontrado.',
      );
    }

    enviarJson(res, 200, atualizado);
  } catch (err) {
    tratarErro(res, err, 'Falha ao atualizar motorista.');
  }
}

/** Remove um motorista pelo identificador. */
export async function deletarMotorista(
  _req: IncomingMessage,
  res: ServerResponse,
  id: string,
) {
  try {
    const [deletado] = await sql`
      DELETE FROM motorista WHERE id = ${id} RETURNING id
    `;

    if (!deletado) {
      return enviarErro(
        res,
        404,
        'NAO_ENCONTRADO',
        'Motorista não encontrado.',
      );
    }

    enviarJson(res, 200, { success: true });
  } catch (err) {
    tratarErro(res, err, 'Falha ao remover motorista.');
  }
}
