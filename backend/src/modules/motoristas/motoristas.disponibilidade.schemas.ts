import { z } from 'zod';
import { dados, id, meta } from '../../shared/contract/schemas.js';

/** SCRUM-239: contratos de escala, impedimento e transição profissional (SCRUM-219). */
const instante = z.iso.datetime({ offset: true }).describe('ISO 8601 com fuso; persistido como timestamptz.');
const textoLivre = (max: number) => z.string().trim().min(1).max(max)
  .refine(v => ![...v].some(c => { const n = c.charCodeAt(0); return (n < 32 && ![9, 10, 13].includes(n)) || n === 127; }));
const anterior = (inicio: string, fim: string) => Date.parse(inicio) < Date.parse(fim);

export const situacaoEscala = z.enum(['EM_ESCALA', 'FORA_DE_ESCALA']);
export const tipoImpedimento = z.enum(['FOLGA', 'AFASTADO']);
const estadoRegistro = z.enum(['VIGENTE', 'CANCELADA']);

export const criarEscala = z.object({ inicio: instante, fim: instante, situacao: situacaoEscala }).strict()
  .refine(v => anterior(v.inicio, v.fim), { path: ['fim'], message: 'fim deve ser posterior ao início' });
export const criarImpedimento = z.object({ tipo: tipoImpedimento, inicio: instante, fim: instante.nullable().optional() }).strict()
  .refine(v => v.fim == null || anterior(v.inicio, v.fim), { path: ['fim'], message: 'fim deve ser posterior ao início' });
export const cancelarRegistro = z.object({ motivo: textoLivre(500) }).strict();
export const motivoTransicao = z.object({ motivo: textoLivre(1000) }).strict()
  .describe('Motivo administrativo obrigatório. Não registrar diagnóstico ou dado médico.');

const paginacao = { page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20) };
/** Filtro opcional por sobreposição com [inicio, fim); exige os dois limites. */
export const consultaPeriodos = z.object({ ...paginacao, inicio: instante.optional(), fim: instante.optional() }).strict()
  .refine(v => (v.inicio === undefined) === (v.fim === undefined) && (v.inicio === undefined || anterior(v.inicio, v.fim!)));
export const consultaTransicoes = z.object(paginacao).strict();

const cancelamento = z.object({ autorId: id, em: z.iso.datetime(), motivo: z.string() }).nullable();
const escala = z.object({ id, motoristaId: id, inicio: z.iso.datetime(), fim: z.iso.datetime(), situacao: situacaoEscala,
  estado: estadoRegistro, autorId: id, criadoEm: z.iso.datetime(), cancelamento });
const impedimento = z.object({ id, motoristaId: id, tipo: tipoImpedimento, inicio: z.iso.datetime(),
  fim: z.iso.datetime().nullable().describe('null = término não informado.'), estado: estadoRegistro, autorId: id,
  criadoEm: z.iso.datetime(), cancelamento });
const transicao = z.object({ id, motoristaId: id, versao: z.number().int().min(1), acao: z.enum(['INATIVACAO', 'REATIVACAO']),
  motivo: z.string(), autorId: id, criadoEm: z.iso.datetime() });
const situacaoProfissional = z.object({ motoristaId: id, inativo: z.boolean()
  .describe('Somente pela última transição registrada; sem transição = nunca inativado por este fluxo.') });

export const motoristasDisponibilidadeSchemas = {
  CriarEscalaMotorista: criarEscala, CriarImpedimentoMotorista: criarImpedimento,
  CancelarRegistroMotorista: cancelarRegistro, MotivoTransicaoMotorista: motivoTransicao,
  RespostaEscalaMotorista: dados(escala), ListaEscalasMotorista: dados(z.array(escala)).extend({ meta }),
  RespostaImpedimentoMotorista: dados(impedimento), ListaImpedimentosMotorista: dados(z.array(impedimento)).extend({ meta }),
  RespostaTransicaoMotorista: dados(transicao),
  ListaTransicoesMotorista: dados(z.array(transicao)).extend({ meta, situacao: situacaoProfissional }),
};
