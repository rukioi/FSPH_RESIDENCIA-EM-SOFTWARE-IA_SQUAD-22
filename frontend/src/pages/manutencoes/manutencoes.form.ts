import { dataCivil, decimal, idValido, type Cadastro, type Detalhe, type Edicao, type Status, type Transicao } from '../../shared/services/manutencoes.service';
import { instanteEmMicrosPostgres } from '../../../../backend/src/modules/solicitacoes/solicitacoes.datas';

export const tipos = {PREVENTIVA: 'Preventiva', CORRETIVA: 'Corretiva'} as const;
export const estados = {AGENDADA: 'Agendada', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada'} as const;
export const acoes = {INICIAR: 'Iniciar manutenção', CONCLUIR: 'Concluir manutenção', CANCELAR: 'Cancelar manutenção',
  REABRIR: 'Reabrir manutenção', REATIVAR: 'Reativar manutenção'} as const;
export const acoesPorEstado: Record<Status, readonly Transicao['acao'][]> = {
  AGENDADA: ['INICIAR', 'CANCELAR'], EM_ANDAMENTO: ['CONCLUIR'], CONCLUIDA: ['REABRIR'], CANCELADA: ['REATIVAR'],
};
export const eventos = {CONCLUSAO: 'Conclusão', CORRECAO_DATAS: 'Correção de datas', REABERTURA: 'Reabertura',
  CANCELAMENTO: 'Cancelamento', REATIVACAO: 'Reativação'} as const;
export const vinculo = {PROPRIO: 'Próprio', LOCADO: 'Locado'} as const;
export const campos = {
  veiculoId: 'Veículo', tipo: 'Tipo de manutenção', descricao: 'Descrição do serviço', entrada: 'Data de entrada',
  conclusaoPrevista: 'Data prevista de conclusão', quilometragem: 'Quilometragem', prestador: 'Prestador responsável',
  custo: 'Custo (R$)', observacoes: 'Observações', iniciadaEm: 'Início efetivo', concluidaEm: 'Conclusão efetiva',
} as const;
export type Campo = keyof typeof campos;
export type Rascunho = Record<Campo, string> & { iniciarImediatamente: boolean };
export type Erros = Partial<Record<Campo, string>>;
export const fuso = 'America/Maceio';
const formatoLocal = new Intl.DateTimeFormat('sv-SE', {timeZone: fuso, year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'});
const formatoInstante = new Intl.DateTimeFormat('pt-BR', {timeZone: fuso, dateStyle: 'short', timeStyle: 'medium'});
const inteiro = new Intl.NumberFormat('pt-BR');

export function dataPt(valor: string) {
  return valor.split('-').reverse().join('/');
}

export function dinheiro(valor: string | null) {
  if (valor === null) return 'Não informado';
  const [parte, fracao = ''] = valor.split('.');
  return 'R$ ' + inteiro.format(BigInt(parte)) + ',' + fracao.padEnd(2, '0');
}

export function instantePt(valor: string | null) {
  return valor === null ? 'Não informado' : formatoInstante.format(new Date(valor));
}

function dataHoraLocal(valor: string) {
  const partes = Object.fromEntries(formatoLocal.formatToParts(new Date(valor)).map(p => [p.type, p.value]));
  return partes.year.padStart(4, '0') + '-' + partes.month + '-' + partes.day + 'T' +
    partes.hour + ':' + partes.minute + ':' + partes.second;
}

function instanteLocal(valor: string | null) {
  if (!valor) return '';
  return dataHoraLocal(valor).replace('T', ' ') + (valor.match(/\.\d+/)?.[0] ?? '').replace('.', ',');
}

// Resolve a hora civil explicitamente no fuso institucional, usando UTC só para aritmética.
export function converterInstante(valor: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:[,.](\d{1,6}))?)?$/.exec(valor.trim());
  if (!m || !dataCivil.safeParse(m[1]).success) return null;
  const civil = m[1] + 'T' + m[2] + ':' + m[3] + ':' + (m[4] ?? '00');
  const desejado = Date.parse(civil + 'Z');
  let utc = desejado;
  for (let rodada = 0; rodada < 3; rodada++) {
    const atual = dataHoraLocal(new Date(utc).toISOString());
    if (atual === civil) {
      const iso = new Date(utc).toISOString().replace(/\.\d+Z$/, '.' + (m[5] ?? '').padEnd(6, '0') + 'Z');
      return instanteEmMicrosPostgres(iso) === null ? null : iso;
    }
    utc += desejado - Date.parse(atual + 'Z');
  }
  return null;
}

export function abrirRascunho(d?: Detalhe): Rascunho {
  return {
    veiculoId: d?.veiculo.id ?? '', tipo: d?.tipo ?? 'PREVENTIVA', descricao: d?.descricao ?? '',
    entrada: d?.entrada ?? '', conclusaoPrevista: d?.conclusaoPrevista ?? '',
    quilometragem: d ? String(d.quilometragem) : '', prestador: d?.prestador ?? '',
    custo: d?.custo?.replace('.', ',') ?? '', observacoes: d?.observacoes ?? '',
    iniciadaEm: instanteLocal(d?.iniciadaEm ?? null), concluidaEm: instanteLocal(d?.concluidaEm ?? null),
    iniciarImediatamente: false,
  };
}

export function reconciliar(original: Rascunho, digitado: Rascunho, atual: Rascunho): Rascunho {
  const revisado = {...atual};
  for (const chave of Object.keys(campos) as Campo[]) {
    if (digitado[chave] !== original[chave]) revisado[chave] = digitado[chave];
  }
  return revisado;
}

export function validarJanela(entrada: string, conclusaoPrevista: string): Erros {
  const erros: Erros = {};
  if (!dataCivil.safeParse(entrada).success) erros.entrada = 'Informe uma data de entrada válida.';
  if (!dataCivil.safeParse(conclusaoPrevista).success) erros.conclusaoPrevista = 'Informe uma previsão válida.';
  if (!erros.entrada && !erros.conclusaoPrevista && entrada > conclusaoPrevista) erros.conclusaoPrevista = 'A previsão deve ser igual ou posterior à entrada.';
  return erros;
}

export function prepararFormulario(r: Rascunho, detalhe?: Detalhe) {
  const erros: Erros = validarJanela(r.entrada, r.conclusaoPrevista);
  const base = abrirRascunho(detalhe);
  if (!idValido(r.veiculoId)) erros.veiculoId = 'Selecione um veículo.';
  if (r.tipo !== 'PREVENTIVA' && r.tipo !== 'CORRETIVA') erros.tipo = 'Selecione um tipo de manutenção.';
  if (!r.descricao.trim() || r.descricao.trim().length > 2000) erros.descricao = 'Informe de 1 a 2.000 caracteres.';
  if (!/^\d+$/.test(r.quilometragem) || Number(r.quilometragem) > 2147483647) erros.quilometragem = 'Informe um inteiro de 0 a 2.147.483.647.';
  if (r.prestador.trim().length > 255) erros.prestador = 'Informe até 255 caracteres.';
  if (r.observacoes.trim().length > 2000) erros.observacoes = 'Informe até 2.000 caracteres.';
  const custo = r.custo.trim().replace(',', '.') || null;
  if (custo !== null && (!/^\d+(?:,\d+)?$/.test(r.custo.trim()) || !decimal.safeParse(custo).success)) {
    erros.custo = 'Use dígitos e vírgula decimal, sem separador de milhares.';
  }
  const entrada: Cadastro = {
    veiculoId: r.veiculoId, tipo: r.tipo as Cadastro['tipo'], descricao: r.descricao.trim(),
    entrada: r.entrada, conclusaoPrevista: r.conclusaoPrevista, quilometragem: Number(r.quilometragem),
    prestador: r.prestador.trim() || null, custo, observacoes: r.observacoes.trim() || null,
  };
  if (entrada.tipo === 'CORRETIVA' && r.iniciarImediatamente) entrada.iniciarImediatamente = true;
  const edicao: Edicao = {};
  if (detalhe) {
    const {tipo, descricao, entrada: inicio, conclusaoPrevista, quilometragem, prestador, custo, observacoes} = entrada;
    const alteraveis = {tipo, descricao, entrada: inicio, conclusaoPrevista, quilometragem, prestador, custo, observacoes};
    Object.assign(edicao, Object.fromEntries(Object.entries(alteraveis).filter(([chave, valor]) =>
      detalhe[chave as keyof typeof alteraveis] !== valor)));
    if (detalhe.status === 'CONCLUIDA') {
      for (const campo of ['iniciadaEm', 'concluidaEm'] as const) {
        if (r[campo] === base[campo]) continue;
        const instante = converterInstante(r[campo]);
        if (!instante) erros[campo] = 'Informe data e hora válidas em America/Maceio.';
        else edicao[campo] = instante;
      }
      const i = instanteEmMicrosPostgres(edicao.iniciadaEm ?? detalhe.iniciadaEm ?? '');
      const f = instanteEmMicrosPostgres(edicao.concluidaEm ?? detalhe.concluidaEm ?? '');
      if (i !== null && f !== null && f < i) erros.concluidaEm = 'A conclusão deve ser igual ou posterior ao início.';
    }
  }
  if (new TextEncoder().encode(JSON.stringify(detalhe ? edicao : entrada)).length > 65536) {
    erros.custo ??= 'O formulário excede o tamanho aceito pela API.';
  }
  return {erros, entrada, edicao};
}
