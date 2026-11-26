import type { TransactionSql } from 'postgres';
import type { z } from 'zod';
import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { registrarAtividades, type AlteracaoManutencaoAuditada, type EventoAtividade } from '../auditoria/auditoria.service.js';
import { instanteEmMicrosPostgres } from '../solicitacoes/solicitacoes.datas.js';
import {
  atualizarManutencao, bloquearManutencao, bloquearVeiculo, buscarManutencao, identificarVeiculo,
  inserirHistorico, inserirManutencao, instanteMutacao, janelaManutencao,
  listarHistorico, listarManutencoes, type DadosManutencao,
} from './manutencoes.repository.js';
import {
  consultaHistoricoManutencao, consultaIndicadoresManutencao, consultaManutencao, consultaManutencaoVeiculo, manutencoesSchemas,
  type Cadastro, type Edicao, type Evento, type LinhaManutencao, type Status, type Transicao,
} from './manutencoes.schemas.js';

import { consultarIndicadoresManutencao } from './manutencoes.indicadores.js';
import { atualizarRevisoesManutencao } from './manutencoes.alertas.js';

/** Valida contratos de entrada com mensagens seguras no envelope comum. */
export function validarManutencao<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields = Object.fromEntries(result.error.issues.map(issue => [
    issue.path.join('.') || 'entrada', 'Informe um valor válido, sem campos adicionais.',
  ]));
  throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Revise os campos informados.', fields);
}

function paginacao(f: { page?: string; limit?: string }) {
  const page = Number(f.page ?? 1);
  const limit = Number(f.limit ?? 20);
  if (!Number.isSafeInteger((page - 1) * limit)) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Página fora do intervalo suportado.');
  return { page, limit };
}

function query(params: URLSearchParams) {
  const entries = [...params.entries()];
  if (new Set(params.keys()).size !== entries.length) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Parâmetros duplicados.');
  return Object.fromEntries(entries);
}

function versao(linha: LinhaManutencao) {
  return '"' + Buffer.from(linha.atualizadoEm).toString('base64url') + '"';
}

function resposta(linha: LinhaManutencao) {
  return manutencoesSchemas.RespostaManutencao.parse({ data: { ...linha, versao: versao(linha) } });
}

/** Valida a consulta e retorna o agregado em um snapshot do PostgreSQL. */
export function obterIndicadoresManutencao(params: URLSearchParams) {
  return consultarIndicadoresManutencao(validarManutencao(consultaIndicadoresManutencao, query(params)));
}

/** Valida filtros e preserva o total quando a página excede a última. */
export async function consultarListaManutencoes(params: URLSearchParams, veiculo?: string) {
  const f = validarManutencao(veiculo === undefined ? consultaManutencao : consultaManutencaoVeiculo, query(params));
  if (f.inicio && f.fim && f.inicio > f.fim) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Período invertido.');
  return manutencoesSchemas.ListaManutencoes.parse(await listarManutencoes(f, paginacao(f), veiculo));
}

/** Consulta e valida a projeção sem expor identidade de autores. */
export async function consultarManutencao(id: string) {
  const linha = await buscarManutencao(id);
  if (!linha) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Manutenção não encontrada.');
  return resposta(linha);
}

/** Consulta apenas o histórico estruturado da ocorrência. */
export async function consultarHistoricoManutencao(id: string, params: URLSearchParams) {
  const f = validarManutencao(consultaHistoricoManutencao, query(params));
  return manutencoesSchemas.HistoricoManutencao.parse(await listarHistorico(id, paginacao(f)));
}

type Operacao = 'CADASTRAR' | 'EDITAR' | Transicao['acao'];
type GuardaDisponibilidade = (tx: TransactionSql, contexto: {
  veiculo: Awaited<ReturnType<typeof bloquearVeiculo>>;
  atual: LinhaManutencao | null;
  janela: { inicio: string; fim: string };
  status: Status;
  operacao: Operacao;
}) => Promise<void>;

function aplicarEdicao(a: DadosManutencao, e: Edicao): DadosManutencao {
  return {
    tipo: e.tipo ?? a.tipo, descricao: e.descricao ?? a.descricao, status: a.status,
    entrada: e.entrada ?? a.entrada, conclusaoPrevista: e.conclusaoPrevista ?? a.conclusaoPrevista,
    quilometragem: e.quilometragem ?? a.quilometragem, prestador: e.prestador === undefined ? a.prestador : e.prestador,
    custo: e.custo === undefined ? a.custo : e.custo, observacoes: e.observacoes === undefined ? a.observacoes : e.observacoes,
    iniciadaEm: e.iniciadaEm ?? a.iniciadaEm, concluidaEm: e.concluidaEm ?? a.concluidaEm, canceladaEm: a.canceladaEm,
  };
}

function aplicarTransicao(a: LinhaManutencao, t: Transicao, d: DadosManutencao, agora: string): DadosManutencao {
  switch (t.acao) {
    case 'INICIAR':
      if (a.status === 'AGENDADA') return { ...d, status: 'EM_ANDAMENTO', iniciadaEm: agora };
      break;
    case 'CONCLUIR':
      if (a.status === 'EM_ANDAMENTO') return { ...d, status: 'CONCLUIDA', concluidaEm: agora };
      break;
    case 'CANCELAR':
      if (a.status === 'AGENDADA') return { ...d, status: 'CANCELADA', canceladaEm: agora };
      break;
    case 'REABRIR':
    case 'REATIVAR':
      if (a.status === (t.acao === 'REABRIR' ? 'CONCLUIDA' : 'CANCELADA')) {
        return { ...d, status: t.destino, iniciadaEm: t.destino === 'EM_ANDAMENTO' ? agora : null,
          concluidaEm: null, canceladaEm: null };
      }
  }
  throw new ErroHttp(409, 'ESTADO_INCOMPATIVEL', 'Transição incompatível com o estado atual.');
}

function validarDatas(d: DadosManutencao) {
  if (d.entrada > d.conclusaoPrevista ||
      (d.iniciadaEm && d.concluidaEm &&
        instanteEmMicrosPostgres(d.concluidaEm)! < instanteEmMicrosPostgres(d.iniciadaEm)!)) {
    throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Datas da manutenção incompatíveis.');
  }
}

const eventos: Partial<Record<Transicao['acao'], Evento['evento']>> = {
  CONCLUIR: 'CONCLUSAO', CANCELAR: 'CANCELAMENTO', REABRIR: 'REABERTURA', REATIVAR: 'REATIVACAO',
};
const datas = ['entrada', 'conclusaoPrevista', 'iniciadaEm', 'concluidaEm', 'canceladaEm'] as const;

function alteracoesAuditadas(a: LinhaManutencao, b: LinhaManutencao): AlteracaoManutencaoAuditada[] {
  return (['tipo', ...datas] as const).filter(campo => a[campo] !== b[campo])
    .map(campo => ({ campo, anterior: a[campo], posterior: b[campo] }));
}

function exigirPersistencia(linha: LinhaManutencao | undefined): LinhaManutencao {
  if (!linha) throw new Error('Ocorrência gravada não retornada.');
  return linha;
}

/** Compõe a escrita com guarda, histórico e auditoria na mesma transação. */
export function criarEscritaManutencao(guardar: GuardaDisponibilidade, auditar = registrarAtividades, registrarHistorico = inserirHistorico) {
  return {
    cadastrar(c: Cadastro, ator: string) {
      return sql.begin('isolation level read committed', async tx => {
        const veiculo = await bloquearVeiculo(tx, c.veiculoId);
        const status = c.iniciarImediatamente ? 'EM_ANDAMENTO' : 'AGENDADA';
        await guardar(tx, { veiculo, atual: null, janela: await janelaManutencao(tx, c.entrada, c.conclusaoPrevista),
          status, operacao: 'CADASTRAR' });
        const agora = await instanteMutacao(tx);
        const d: DadosManutencao = { ...c, status, iniciadaEm: c.iniciarImediatamente ? agora : null,
          concluidaEm: null, canceladaEm: null, prestador: c.prestador ?? null, custo: c.custo ?? null,
          observacoes: c.observacoes ?? null };
        const gravada = exigirPersistencia(await inserirManutencao(tx, veiculo.id, ator, d, agora));
        const atividades: EventoAtividade[] = [{ operacao: 'manutencao_mutacao', recursoId: gravada.id, acao: 'CADASTRAR', alteracoes: [] }];
        if (c.iniciarImediatamente) atividades.push({ operacao: 'manutencao_mutacao', recursoId: gravada.id,
          acao: 'INICIAR', alteracoes: [{ campo: 'iniciadaEm', anterior: null, posterior: agora }] });
        await auditar(tx, ator, atividades, agora);
        return resposta(gravada);
      });
    },

    alterar(id: string, ator: string, token: string, comando: { edicao: Edicao } | { transicao: Transicao }) {
      return sql.begin('isolation level read committed', async tx => {
        const veiculo = await bloquearVeiculo(tx, await identificarVeiculo(tx, id));
        const atual = await bloquearManutencao(tx, id);
        if (versao(atual) !== token) throw new ErroHttp(409, 'VERSAO_DESATUALIZADA', 'A manutenção foi alterada. Consulte a versão atual.');
        const t = 'transicao' in comando ? comando.transicao : undefined;
        const e: Edicao = 'edicao' in comando ? comando.edicao : comando.transicao.alteracoes ?? {};
        if ((e.iniciadaEm !== undefined || e.concluidaEm !== undefined) && atual.status !== 'CONCLUIDA') {
          throw new ErroHttp(409, 'ESTADO_INCOMPATIVEL', 'Correção de instantes efetivos exige manutenção concluída.');
        }
        const operacao = t?.acao ?? 'EDITAR';
        const camposEditados = aplicarEdicao(atual, e);
        const janelaMudou = camposEditados.entrada !== atual.entrada || camposEditados.conclusaoPrevista !== atual.conclusaoPrevista;
        const ativa = atual.status === 'AGENDADA' || atual.status === 'EM_ANDAMENTO';
        let agora = await instanteMutacao(tx);
        let d = t ? aplicarTransicao(atual, t, camposEditados, agora) : camposEditados;
        validarDatas(d);
        if (operacao === 'INICIAR' || operacao === 'REABRIR' || operacao === 'REATIVAR' || (operacao === 'EDITAR' && ativa && janelaMudou)) {
          await guardar(tx, { veiculo, atual, janela: await janelaManutencao(tx, d.entrada, d.conclusaoPrevista),
            status: d.status, operacao });
          agora = await instanteMutacao(tx);
          if (t) d = aplicarTransicao(atual, t, camposEditados, agora);
        }
        if (!t && Object.entries(d).every(([campo, valor]) => valor === atual[campo as keyof DadosManutencao])) return resposta(atual);
        const gravada = exigirPersistencia(await atualizarManutencao(tx, id, ator, d, agora));
        await atualizarRevisoesManutencao(tx, id, atual, gravada, operacao);
        const mudancas = alteracoesAuditadas(atual, gravada);
        const evento = t ? eventos[t.acao] : atual.status === 'CONCLUIDA' && mudancas.some(v => v.campo !== 'tipo')
          ? 'CORRECAO_DATAS' : undefined;
        if (evento) await registrarHistorico(tx, evento, atual, gravada, ator, agora);
        await auditar(tx, ator, [{ operacao: 'manutencao_mutacao', recursoId: id, acao: operacao, alteracoes: mudancas }], agora);
        return resposta(gravada);
      });
    },
  };
}
