import { sql } from '../../config/db.js';
import { inserirNotificacao } from '../notificacoes/notificacoes.repository.js';
import { randomUUID } from 'node:crypto';
import type { TransactionSql } from 'postgres';
import type { z } from 'zod';
import type { criarVeiculoSchema, editarVeiculoSchema, veiculo } from './veiculos.schemas.js';

type Entrada = z.infer<typeof criarVeiculoSchema>;
type Edicao = z.infer<typeof editarVeiculoSchema>;
type Linha = Omit<z.infer<typeof veiculo>,'criado_em'> & { criado_em: Date | null };

/** Projeta somente os 14 campos públicos já existentes, na ordenação original. */
export async function consultarVeiculos() {
  return sql<Linha[]>`SELECT id, placa, modelo, marca, ano, tipo, capacidade_obitos,
    quilometragem_atual, status, is_svo, criado_em, capacidade_passageiros, vinculo, fornecedor_locacao
    FROM veiculo ORDER BY id DESC`;
}
/** Mantém a checagem de duplicidade amigável; a constraint continua protegendo a concorrência. */
export async function placaExistente(placa: string, id?: string) {
  const rows = id === undefined ? await sql`SELECT id FROM veiculo WHERE placa = ${placa}`
    : await sql`SELECT id FROM veiculo WHERE placa = ${placa} AND id <> ${id}`;
  return rows.length > 0;
}
/** Persiste os defaults e a limpeza de fornecedor existentes sem alterar disponibilidade ou estado. */
export async function inserirVeiculo(dados: Entrada) {
  const [row] = await sql<Linha[]>`INSERT INTO veiculo (placa,modelo,marca,ano,tipo,capacidade_obitos,
    capacidade_passageiros,quilometragem_atual,status,is_svo,vinculo,fornecedor_locacao)
    VALUES (${dados.placa},${dados.modelo},${dados.marca},${dados.ano},${dados.tipo ?? 'PASSEIO'},
      ${dados.capacidade_obitos ?? 0},${dados.capacidade_passageiros ?? 5},${dados.quilometragem_atual ?? 0},
      ${dados.status ?? 'DISPONIVEL'},${dados.is_svo ?? false},${dados.vinculo ?? 'PROPRIO'},
      ${dados.vinculo === 'LOCADO' ? dados.fornecedor_locacao! : null})
    RETURNING id, placa, modelo, marca, ano, tipo, capacidade_obitos, quilometragem_atual,
      status, is_svo, criado_em, capacidade_passageiros, vinculo, fornecedor_locacao`;
  return row;
}
/** Preserva edição parcial; mudança para manutenção e avisos confirmam na mesma transação. */
export async function alterarVeiculo(id: string, dados: Edicao) {
  const atualizar = async (tx: typeof sql | TransactionSql) => {
    const [row] = await tx<Linha[]>`UPDATE veiculo SET
    placa=COALESCE(${dados.placa ?? null},placa), marca=COALESCE(${dados.marca ?? null},marca),
    modelo=COALESCE(${dados.modelo ?? null},modelo), status=COALESCE(${dados.status ?? null},status),
    capacidade_passageiros=COALESCE(${dados.capacidade_passageiros ?? null},capacidade_passageiros),
    vinculo=COALESCE(${dados.vinculo ?? null},vinculo),
    fornecedor_locacao=CASE WHEN COALESCE(${dados.vinculo ?? null},vinculo)='PROPRIO' THEN NULL
      ELSE COALESCE(${dados.fornecedor_locacao ?? null},fornecedor_locacao) END
    WHERE id=${id}
    RETURNING id, placa, modelo, marca, ano, tipo, capacidade_obitos, quilometragem_atual,
      status, is_svo, criado_em, capacidade_passageiros, vinculo, fornecedor_locacao`;
    return row;
  };
  if (dados.status !== 'EM_MANUTENCAO') return atualizar(sql);
  return sql.begin(async tx => {
    const [antes] = await tx`SELECT status FROM veiculo WHERE id=${id} FOR UPDATE`;
    const row = await atualizar(tx);
    if (row && antes?.status !== 'EM_MANUTENCAO') {
      const usuarios = await tx`SELECT id::text FROM public.usuario WHERE ativo=true AND perfil IN ('ADM','GESTOR_FROTA')`;
      await inserirNotificacao(tx,usuarios.map(u=>String(u.id)),randomUUID(),`Veículo ${row.placa} em manutenção`,row.modelo,'atencao');
    }
    return row;
  });
}
/** Remove pelo ID preservando constraints e o resultado de ausência existente. */
export async function removerVeiculo(id: string) {
  const rows = await sql`DELETE FROM veiculo WHERE id=${id} RETURNING id`;
  return rows.length > 0;
}
