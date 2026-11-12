import { ErroHttp } from '../../shared/http/errors.js';
import { consultarLinhasRelatorio } from './relatorios.repository.js';
import { consultaRelatorioSchema, respostaRelatorioSchema, type ConsultaRelatorio, type ColunaRelatorio } from './relatorios.schemas.js';

/** Recusa parâmetros desconhecidos, duplicados e períodos/identificadores inválidos antes do SQL. */
export function validarConsultaRelatorio(params: URLSearchParams, svo = false): ConsultaRelatorio {
  const entradas: Record<string, string> = {};
  for (const [chave, valor] of params) {
    if (chave in entradas) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Não repita parâmetros de consulta.');
    entradas[chave] = valor;
  }
  const result = consultaRelatorioSchema.safeParse({...entradas, ...(svo && !entradas.tipo ? {tipo: 'svo'} : {})});
  if (!result.success) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Confira o relatório, o período (até 366 dias) e os filtros.');
  if ((result.data.tipo === 'svo') !== svo) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Utilize o módulo correspondente ao relatório.');
  return result.data;
}
const c = (chave: string, titulo: string, tipo: ColunaRelatorio['tipo'] = 'texto'): ColunaRelatorio => ({chave, titulo, tipo});
const comuns = [c('codigo','Ticket'), c('data','Saída prevista / início','dataHora'), c('origem','Origem'), c('destino','Destino'), c('motorista','Motorista'), c('placa','Veículo'), c('status','Status')];
const km = [c('kmInicial','Km inicial','numero'), c('kmFinal','Km final','numero'), c('kmPercorridos','Km concluídos','numero'), c('validada','Validada')];
const definicoes = {
  viagens: {titulo: 'Viagens', criterio: 'Início real da viagem; saída prevista enquanto não iniciada.', colunas: [...comuns.map(coluna => coluna.chave==='data' ? c('data','Início / saída prevista','dataHora') : coluna), ...km]},
  solicitacoes: {titulo: 'Solicitações de transporte', criterio: 'Data de saída prevista da solicitação.', colunas: comuns},
  veiculos: {titulo: 'Demandas por veículo', criterio: 'Saída prevista da solicitação; início real nas viagens sem solicitação.', colunas: [...comuns, ...km]},
  motoristas: {titulo: 'Viagens por motorista', criterio: 'Início real da viagem; saída prevista enquanto não iniciada.', colunas: [...comuns.map(coluna => coluna.chave==='data' ? c('data','Início / saída prevista','dataHora') : coluna), ...km]},
  ocorrencias: {titulo: 'Ocorrências e justificativas registradas', criterio: 'Data de registro da correção em America/Maceio.', colunas: [c('codigo','Ticket'), c('data','Registrada em','dataHora'), c('placa','Veículo'), c('motorista','Motorista'), c('tipo','Tipo'), c('justificativa','Justificativa'), c('kmInicialAnterior','Km inicial anterior','numero'), c('kmFinalAnterior','Km final anterior','numero'), c('kmInicial','Km inicial corrigido','numero'), c('kmFinal','Km final corrigido','numero'), c('versao','Versão','numero')]},
  abastecimentos: {titulo: 'Abastecimentos', criterio: 'Data do abastecimento.', colunas: [c('id','Registro'), c('data','Data','data'), c('placa','Veículo'), c('motorista','Motorista'), c('odometro','Odômetro','numero'), c('litros','Litros'), c('valor','Valor total (R$)'), c('posto','Posto'), c('tanqueCompleto','Tanque completo')]},
  svo: {titulo: 'Ordens de coleta SVO', criterio: 'Início da coleta; criação da solicitação quando ainda não iniciada.', colunas: [c('id','Ordem'), c('codigo','Solicitação'), c('data','Início / criação','dataHora'), c('motorista','Motorista'), c('placa','Veículo'), c('status','Status'), ...km]},
};

/** Monta tabela e resumo sobre a mesma consulta; ausência de km não se converte em zero. */
export async function gerarRelatorio(query: ConsultaRelatorio) {
  const rows = await consultarLinhasRelatorio(query);
  if (rows.length > 5000) throw new ErroHttp(422, 'RELATORIO_MUITO_GRANDE', 'O relatório excede 5.000 registros. Reduza o período ou selecione veículo/motorista.');
  const definicao = definicoes[query.tipo];
  const linhas = rows.map(row => Object.fromEntries(definicao.colunas.map(coluna => [coluna.chave, row[coluna.chave] ?? null])));
  const possuiKm = definicao.colunas.some(coluna => coluna.chave === 'kmPercorridos');
  const concluidas = linhas.filter(row => row.status === 'CONCLUIDA');
  const informadas = concluidas.filter(row => typeof row.kmPercorridos === 'number');
  return respostaRelatorioSchema.parse({data: {
    tipo: query.tipo, titulo: definicao.titulo, inicio: query.inicio, fim: query.fim,
    criterioPeriodo: definicao.criterio, geradoEm: new Date().toISOString(),
    filtros: {veiculoId: query.veiculoId ?? null, motoristaId: query.motoristaId ?? null, status: query.status ?? null},
    observacoes: [
      'Período inclui as duas datas. Horários civis são apresentados sem conversão histórica de fuso.',
      ...(possuiKm ? ['Quilometragem soma somente execuções concluídas com odômetros válidos; ausência é indicada por travessão. Validação gerencial é apresentada separadamente.'] : []),
      ...(query.tipo === 'ocorrencias' ? ['A base atual registra correções de quilometragem com justificativa. Desvios e outras ocorrências ainda não possuem cadastro estruturado.'] : []),
      ...(query.tipo === 'svo' ? ['Sem nomes de falecidos, contatos, endereços ou informações médicas. Ordens sem início nem data de criação vinculada não pertencem a um período conhecido.'] : []),
    ],
    colunas: definicao.colunas, linhas,
    resumo: {registros: linhas.length, kmConcluidos: possuiKm && informadas.length ? informadas.reduce((sum,row) => sum + Number(row.kmPercorridos),0) : null,
      semQuilometragem: possuiKm ? concluidas.length - informadas.length : null},
  }});
}
