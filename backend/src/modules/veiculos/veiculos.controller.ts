
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';

const TIPOS_PERMITIDOS = [
  'PASSEIO',
  'VAN',
  'AMBULANCIA',
  'RABECÃO_SVO',
];

const STATUS_PERMITIDOS = [
  'DISPONIVEL',
  'EM_VIAGEM',
  'EM_MANUTENCAO',
  'INDISPONIVEL',
];

function enviarJson(
  res: ServerResponse,
  status: number,
  data: unknown,
) {
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

  for await (const parte of req) {
    const buffer = Buffer.isBuffer(parte)
      ? parte
      : Buffer.from(parte);

    tamanho += buffer.length;

    if (tamanho > limite) {
      throw new Error('CORPO_MUITO_GRANDE');
    }

    partes.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
  } catch {
    throw new Error('JSON_INVALIDO');
  }
}

function objetoValido(
  valor: unknown,
): valor is Record<string, unknown> {
  return (
    valor !== null &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  );
}

function textoValido(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    valor.trim().length > 0
  );
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
    return enviarErro(
      res,
      409,
      'PLACA_DUPLICADA',
      'Já existe um veículo cadastrado com esta placa.',
    );
  }

  console.error(mensagem, err);

  return enviarErro(
    res,
    500,
    'ERRO_INTERNO',
    mensagem,
  );
}

/** Lista os veículos cadastrados. */
export async function listarVeiculos(
  _req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const veiculos = await sql`
      SELECT * FROM veiculo ORDER BY id DESC
    `;

    enviarJson(res, 200, veiculos);
  } catch (err) {
    tratarErro(res, err, 'Falha ao listar veículos.');
  }
}

/** Cadastra um veículo após validar seus dados. */
export async function criarVeiculo(
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
      placa,
      modelo,
      marca,
      ano,
      tipo,
      capacidade_obitos,
      capacidade_passageiros,
      quilometragem_atual,
            status,
      is_svo,
      vinculo,
      fornecedor_locacao,
    } = body;

    if (
      !textoValido(placa) ||
      !textoValido(modelo) ||
      !textoValido(marca) ||
      typeof ano !== 'number' ||
      !Number.isInteger(ano) ||
      ano < 1900 ||
      ano > 2100
    ) {
      return enviarErro(
        res,
        400,
        'DADOS_INVALIDOS',
        'Informe placa, modelo, marca e ano válidos.',
      );
    }

    const tipoVeiculo = tipo ?? 'PASSEIO';

    if (
      typeof tipoVeiculo !== 'string' ||
      !TIPOS_PERMITIDOS.includes(tipoVeiculo)
    ) {
      return enviarErro(
        res,
        400,
        'TIPO_INVALIDO',
        'Tipo inválido. Utilize PASSEIO, VAN, AMBULANCIA ou RABECÃO_SVO.',
      );
    }

    const statusOp = status ?? 'DISPONIVEL';

    if (
      typeof statusOp !== 'string' ||
      !STATUS_PERMITIDOS.includes(statusOp)
    ) {
      return enviarErro(
        res,
        400,
        'STATUS_INVALIDO',
        'Status inválido. Utilize DISPONIVEL, EM_VIAGEM, EM_MANUTENCAO ou INDISPONIVEL.',
      );
    }

    const capOb = capacidade_obitos ?? 0;
    const capPassageiros = capacidade_passageiros ?? 5;
    const kmAtual = quilometragem_atual ?? 0;
    const isSvoVal = is_svo ?? false;
    const statusPermitidos = [
  'DISPONIVEL',
  'EM_VIAGEM',
  'EM_MANUTENCAO',
  'INDISPONIVEL',
];

if (
  status !== undefined &&
  (typeof status !== 'string' || !statusPermitidos.includes(status))
) {
  return enviarErro(
    res,
    400,
    'STATUS_INVALIDO',
    'Status inválido. Utilize DISPONIVEL, EM_VIAGEM, EM_MANUTENCAO ou INDISPONIVEL.',
  );
}
    const vinculoVal = vinculo ?? 'PROPRIO';

if (
  vinculoVal !== 'PROPRIO' &&
  vinculoVal !== 'LOCADO'
) {
  return enviarErro(
    res,
    400,
    'VINCULO_INVALIDO',
    'O vínculo deve ser PROPRIO ou LOCADO.',
  );
}

if (
  vinculoVal === 'LOCADO' &&
  !textoValido(fornecedor_locacao)
) {
  return enviarErro(
    res,
    400,
    'FORNECEDOR_OBRIGATORIO',
    'Informe o fornecedor de locação para veículos locados.',
  );
}

if (
  fornecedor_locacao !== undefined &&
  fornecedor_locacao !== null &&
  !textoValido(fornecedor_locacao)
) {
  return enviarErro(
    res,
    400,
    'FORNECEDOR_INVALIDO',
    'Informe um fornecedor de locação válido.',
  );
}

    if (
      typeof capOb !== 'number' ||
      !Number.isInteger(capOb) ||
      capOb < 0 ||
      typeof capPassageiros !== 'number' ||
      !Number.isInteger(capPassageiros) ||
      capPassageiros <= 0 ||
      typeof kmAtual !== 'number' ||
      !Number.isFinite(kmAtual) ||
      kmAtual < 0 ||
      typeof isSvoVal !== 'boolean'
    ) {
      return enviarErro(
        res,
        400,
        'DADOS_INVALIDOS',
        'Capacidade, quilometragem ou indicação SVO inválida.',
      );
    }

    const [existente] = await sql`
      SELECT id FROM veiculo WHERE placa = ${placa}
    `;

    if (existente) {
      return enviarErro(
        res,
        409,
        'PLACA_DUPLICADA',
        'Já existe um veículo cadastrado com esta placa.',
      );
    }

    const [novo] = await sql`
      INSERT INTO veiculo (
        placa,
        modelo,
        marca,
        ano,
        tipo,
        capacidade_obitos,
        capacidade_passageiros,
        quilometragem_atual,
                status,
        is_svo,
        vinculo,
        fornecedor_locacao
      )
      VALUES (
        ${placa},
        ${modelo},
        ${marca},
        ${ano},
        ${tipoVeiculo},
        ${capOb},
        ${capPassageiros},
        ${kmAtual},
                ${statusOp},
        ${isSvoVal},
        ${vinculoVal},
        ${vinculoVal === 'LOCADO' && typeof fornecedor_locacao === 'string' ? fornecedor_locacao : null}
      )
      RETURNING *
    `;

    enviarJson(res, 201, novo);
  } catch (err) {
    tratarErro(res, err, 'Falha ao cadastrar veículo.');
  }
}

/** Atualiza os dados de um veículo existente. */
export async function atualizarVeiculo(
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
  placa,
  marca,
  modelo,
  status,
  capacidade_passageiros,
  vinculo,
  fornecedor_locacao,
} = body;

    if (
      (placa !== undefined && !textoValido(placa)) ||
      (marca !== undefined && !textoValido(marca)) ||
      (modelo !== undefined && !textoValido(modelo))
    ) {
      return enviarErro(
        res,
        400,
        'DADOS_INVALIDOS',
        'Placa, marca ou modelo inválidos.',
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
        'Status inválido. Utilize DISPONIVEL, EM_VIAGEM, EM_MANUTENCAO ou INDISPONIVEL.',
      );
    }

    if (
      capacidade_passageiros !== undefined &&
      (
        typeof capacidade_passageiros !== 'number' ||
        !Number.isInteger(capacidade_passageiros) ||
        capacidade_passageiros <= 0
      )
    ) {
      return enviarErro(
        res,
        400,
        'CAPACIDADE_INVALIDA',
        'A capacidade de passageiros deve ser um número inteiro maior que zero.',
      );
    }

    if (
  vinculo !== undefined &&
  vinculo !== 'PROPRIO' &&
  vinculo !== 'LOCADO'
) {
  return enviarErro(
    res,
    400,
    'VINCULO_INVALIDO',
    'O vínculo deve ser PROPRIO ou LOCADO.',
  );
}

if (
  fornecedor_locacao !== undefined &&
  fornecedor_locacao !== null &&
  !textoValido(fornecedor_locacao)
) {
  return enviarErro(
    res,
    400,
    'FORNECEDOR_INVALIDO',
    'Informe um fornecedor de locação válido.',
  );
}

  if (
  vinculo === 'LOCADO' &&
  !textoValido(fornecedor_locacao)
) {
  return enviarErro(
    res,
    400,
    'FORNECEDOR_OBRIGATORIO',
    'Informe o fornecedor ao alterar o vínculo para LOCADO.',
  );
}
    if (placa !== undefined) {
      const [existente] = await sql`
        SELECT id
        FROM veiculo
        WHERE placa = ${placa}
          AND id <> ${id}
      `;

      if (existente) {
        return enviarErro(
          res,
          409,
          'PLACA_DUPLICADA',
          'Esta placa já pertence a outro veículo.',
        );
      }
    }

    const [atualizado] = await sql`
      UPDATE veiculo
      SET
        placa = COALESCE(${placa ?? null}, placa),
        marca = COALESCE(${marca ?? null}, marca),
        modelo = COALESCE(${modelo ?? null}, modelo),
        status = COALESCE(${status ?? null}, status),
        capacidade_passageiros = COALESCE(
  ${capacidade_passageiros ?? null},
  capacidade_passageiros
),
vinculo = COALESCE(${vinculo ?? null}, vinculo),
fornecedor_locacao = CASE
  WHEN ${vinculo ?? null} = 'PROPRIO' THEN NULL
  ELSE COALESCE(${fornecedor_locacao ?? null}, fornecedor_locacao)
END
      WHERE id = ${id}
      RETURNING *
    `;

    if (!atualizado) {
      return enviarErro(
        res,
        404,
        'NAO_ENCONTRADO',
        'Veículo não encontrado.',
      );
    }

    enviarJson(res, 200, atualizado);
  } catch (err) {
    tratarErro(res, err, 'Falha ao atualizar veículo.');
  }
}

/** Remove um veículo pelo identificador. */
export async function deletarVeiculo(
  _req: IncomingMessage,
  res: ServerResponse,
  id: string,
) {
  try {
    const [deletado] = await sql`
      DELETE FROM veiculo
      WHERE id = ${id}
      RETURNING id
    `;

    if (!deletado) {
      return enviarErro(
        res,
        404,
        'NAO_ENCONTRADO',
        'Veículo não encontrado.',
      );
    }

    enviarJson(res, 200, { success: true });
  } catch (err) {
    tratarErro(res, err, 'Falha ao remover veículo.');
  }
}
