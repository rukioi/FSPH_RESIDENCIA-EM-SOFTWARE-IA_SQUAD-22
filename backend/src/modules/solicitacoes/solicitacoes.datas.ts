import { z } from 'zod';

const anoInstitucional = new Intl.DateTimeFormat('en-US', {
  timeZone:'America/Maceio',year:'numeric',era:'short',
});

/** Recusa ano zero, offsets fora do limite PostgreSQL e datas que sairiam do calendário público após normalizar. */
export function dataCompativelComPostgres(value:string):boolean {
  if (value.startsWith('0000-')) return false;
  const offset = value.match(/[+-](\d{2}):(\d{2})$/);
  if (offset && Number(offset[1]) > 15) return false;
  let instante = Date.parse(value);
  if (!Number.isFinite(instante)) return false;
  // PostgreSQL arredonda a microssegundos; um carry no fim do segundo pode
  // ultrapassar o ano 9999 mesmo quando Date.parse ainda o trunca em 999 ms.
  const fracao=value.match(/\.(\d+)/)?.[1];
  if (fracao && /^999999[5-9]/.test(fracao)) instante=Math.floor(instante/1000)*1000+1000;
  const partes = anoInstitucional.formatToParts(new Date(instante));
  const ano = Number(partes.find(item=>item.type==='year')?.value);
  return partes.find(item=>item.type==='era')?.value==='AD' && ano>=1 && ano<=9999;
}

export const dataHoraInstitucionalSchema = z.iso.datetime({offset:true})
  .refine(dataCompativelComPostgres,'Informe uma data/hora compatível com PostgreSQL e America/Maceio.')
  .describe('ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.')
  .meta({allOf:[{not:{pattern:'^0000-'}},{pattern:'(?:Z|[+-](?:0\\d|1[0-5]):[0-5]\\d)$'}]});
