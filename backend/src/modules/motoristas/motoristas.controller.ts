import { lerCorpoJson as lerBody } from '../../shared/http/body.js';
import { responderErroCorpo } from '../../shared/http/errors.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { enviarDados as enviarJson, enviarErro } from '../../shared/http/json.js';

import type { IncomingMessage, ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import { registrarVersaoDocumental } from '../documentos/documentos.historico.js';

const CATEGORIAS_PERMITIDAS = ['A', 'B', 'C', 'D', 'E'];

const STATUS_PERMITIDOS = [
  'DISPONIVEL',
  'EM_VIAGEM',
  'FOLGA',
  'AFASTADO',
];

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
  if (responderErroCorpo(res, err)) return;
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

  registrarFalha(err);

  return enviarErro(res, 500, 'ERRO_INTERNO', mensagem);
}

/** Lista os motoristas cadastrados, com o e-mail do usuário vinculado quando houver. */
export async function listarMotoristas(
  _req: IncomingMessage,
  res: ServerResponse,
  perfil: string,
) {
  try {
    const motoristas = await sql`
      SELECT m.*, u.email
      FROM motorista m
      LEFT JOIN usuario u ON u.id = m.usuario_id
      ORDER BY m.id DESC
    `;

    const dados = perfil === 'ATENDENTE_SVO'
      ? motoristas.map((motorista) =>
          Object.fromEntries(
            Object.entries(motorista).filter(
              ([campo]) => campo !== 'cpf' && campo !== 'telefone' && campo !== 'email',
            ),
          ),
        )
      : motoristas;

enviarJson(res, 200, dados);
  } catch (err) {
    tratarErro(res, err, 'Falha ao listar motoristas.');
  }
}

/** Cadastra um motorista após validar seus dados e, se informado, vincula o usuário pelo e-mail. */
export async function criarMotorista(
  req: IncomingMessage,
  res: ServerResponse,
  autorId: string,
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
      email,
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

    let usuarioId: string | null = null;
    let emailVinculado: string | null = null;

    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return enviarErro(
          res,
          400,
          'EMAIL_INVALIDO',
          'Informe um e-mail válido.',
        );
      }

      const [usuario] = await sql`
        SELECT id, email, perfil, ativo
        FROM usuario
        WHERE LOWER(email) = LOWER(${email.trim()})
        LIMIT 1
      `;

      if (!usuario) {
        return enviarErro(
          res,
          404,
          'USUARIO_NAO_ENCONTRADO',
          'Nenhum usuário com este e-mail. Crie-o antes em Administração › Usuários com perfil Motorista.',
        );
      }

      if (usuario.perfil !== 'MOTORISTA') {
        return enviarErro(
          res,
          400,
          'PERFIL_INVALIDO',
          'O usuário deste e-mail precisa ter o perfil Motorista.',
        );
      }

      if (!usuario.ativo) {
        return enviarErro(
          res,
          400,
          'USUARIO_INATIVO',
          'O usuário deste e-mail está inativo.',
        );
      }

      const [jaVinculado] = await sql`
        SELECT id FROM motorista WHERE usuario_id = ${usuario.id}
      `;

      if (jaVinculado) {
        return enviarErro(
          res,
          409,
          'USUARIO_JA_VINCULADO',
          'Este e-mail já está vinculado a outro motorista.',
        );
      }

      usuarioId = String(usuario.id);
      emailVinculado = usuario.email;
    }

    const novo = await sql.begin(async tx => {
      const [row] = await tx`
      INSERT INTO motorista (
        nome,
        cnh,
        categoria_cnh,
        validade_cnh,
        status,
        cpf,
        telefone,
        usuario_id
      )
      VALUES (
        ${nome},
        ${cnh.trim()},
        ${categoria_cnh},
        ${validade_cnh},
        ${statusOp},
        ${cpfNormalizado},
        ${telefoneNormalizado},
        ${usuarioId}
      )
      RETURNING *
    `;

      await registrarVersaoDocumental(tx, 'CNH_MOTORISTA', row.id, autorId);
      return row;
    });
    enviarJson(res, 201, { ...novo, email: emailVinculado });
  } catch (err) {
    tratarErro(res, err, 'Falha ao cadastrar motorista.');
  }
}

/** Atualiza os dados de um motorista existente. */
export async function atualizarMotorista(
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
  autorId: string,
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

    const atualizado = await sql.begin(async tx => {
      const [antes] = await tx`SELECT cnh,categoria_cnh,validade_cnh FROM motorista WHERE id=${id} FOR UPDATE`;
      const [row] = await tx`
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

      if (row && antes && (row.cnh !== antes.cnh || row.categoria_cnh !== antes.categoria_cnh
        || String(row.validade_cnh) !== String(antes.validade_cnh))) {
        await registrarVersaoDocumental(tx, 'CNH_MOTORISTA', row.id, autorId);
      }
      return row;
    });
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

/** Remove cadastros sem histórico de CNH/disponibilidade e preserva versões já registradas. */
export async function deletarMotorista(
  _req: IncomingMessage,
  res: ServerResponse,
  id: string,
) {
  try {
    const resultado = await sql.begin(async tx => {
      const [motorista] = await tx`SELECT id FROM public.motorista WHERE id = ${id} FOR UPDATE`;
      if (!motorista) return 'AUSENTE';

      const [historico] = await tx`SELECT EXISTS (
        SELECT 1 FROM public.documento_historico WHERE motorista_id = ${id}
      ) AS existe`;
      if (historico.existe) return 'HISTORICO';
      // SCRUM-239: escala, impedimento e transição são trilhas preservadas.
      const [disponibilidade] = await tx`SELECT
        EXISTS (SELECT 1 FROM public.escala_motorista WHERE motorista_id = ${id})
        OR EXISTS (SELECT 1 FROM public.indisponibilidade_motorista WHERE motorista_id = ${id})
        OR EXISTS (SELECT 1 FROM public.motorista_transicao_profissional WHERE motorista_id = ${id}) AS existe`;
      if (disponibilidade.existe) return 'DISPONIBILIDADE';

      await tx`DELETE FROM public.motorista WHERE id = ${id}`;
      return 'REMOVIDO';
    });

    if (resultado === 'AUSENTE') {
      return enviarErro(res, 404, 'NAO_ENCONTRADO', 'Motorista não encontrado.');
    }
    if (resultado === 'DISPONIBILIDADE') {
      return enviarErro(res, 409, 'HISTORICO_DISPONIBILIDADE_EXISTENTE',
        'Não é possível remover o motorista porque ele possui escala, impedimento ou inativação registrada.');
    }
    if (resultado === 'HISTORICO') {
      return enviarErro(res, 409, 'HISTORICO_CNH_EXISTENTE',
        'Não é possível remover o motorista porque ele possui histórico de CNH.');
    }
    enviarJson(res, 200, { success: true });
  } catch (err) {
    tratarErro(res, err, 'Falha ao remover motorista.');
  }
}
