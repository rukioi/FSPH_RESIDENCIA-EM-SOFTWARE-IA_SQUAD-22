import type { CorrigirQuilometragem } from '../../../frontend/src/shared/api/generated/schema.js';

const inicial = { kmInicial: 100, justificativa: 'Conferencia' } satisfies CorrigirQuilometragem;
const final = { kmFinal: 120, justificativa: 'Conferencia' } satisfies CorrigirQuilometragem;
const ambos = { kmInicial: 100, kmFinal: 120, justificativa: 'Conferencia' } satisfies CorrigirQuilometragem;
// @ts-expect-error Pelo menos uma quilometragem deve ser fornecida.
const ausente: CorrigirQuilometragem = { justificativa: 'Conferencia' };
type EntradaLegada = {kmInicial?:number;kmFinal?:number;justificativa:string};
declare const legada: EntradaLegada;
// @ts-expect-error O tipo antigo exige adaptacao ou validacao antes do envio.
const adaptacaoNecessaria: CorrigirQuilometragem = legada;
void [inicial, final, ambos, ausente, adaptacaoNecessaria];