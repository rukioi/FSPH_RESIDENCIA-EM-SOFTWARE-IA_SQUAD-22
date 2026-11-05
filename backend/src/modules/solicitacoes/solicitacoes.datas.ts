import { z } from 'zod';

const isoComOffset=z.iso.datetime({offset:true});
const anoInstitucional = new Intl.DateTimeFormat('en-US', {
  timeZone:'America/Maceio',year:'numeric',era:'short',
});

/** Converte ISO com offset em microssegundos inteiros; a fração segue strtod/rint do PostgreSQL 17. */
export function instanteEmMicrosPostgres(value:string):bigint|null {
  if(!isoComOffset.safeParse(value).success||value.startsWith('0000-'))return null;
  const offset=value.match(/[+-](\d{2}):(\d{2})$/);
  if(offset&&Number(offset[1])>15)return null;
  // Date só interpreta o segundo inteiro com offset. Nunca recebe a fração a preservar.
  const segundo=Date.parse(value.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}$)/,''));
  if(!Number.isSafeInteger(segundo))return null;
  const fracao=value.match(/\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/)?.[1]??'0';
  // Fonte: https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/adt/datetime.c#L673
  // datetime.c ParseFractionalSecond: rint(strtod(fração) * 1000000), empate para par.
  // O double é restrito à fração; o instante completo permanece em BigInt.
  const micros=Number('0.'+fracao)*1000000;
  const inteiro=Math.floor(micros);
  const arredondado=micros-inteiro===0.5?inteiro+inteiro%2:Math.round(micros);
  return BigInt(segundo)*1000n+BigInt(arredondado);
}

/** Compara na precisão persistida, inclusive arredondamento/carry, sem limite novo no reagendamento. */
export function intervaloTemporalValido(inicio:string,fim:string,limiteDias?:number):boolean {
  const a=instanteEmMicrosPostgres(inicio),b=instanteEmMicrosPostgres(fim);
  if(a===null||b===null||b<=a)return false;
  return limiteDias===undefined||(Number.isSafeInteger(limiteDias)&&limiteDias>=0&&b-a<=BigInt(limiteDias)*86400000000n);
}

/** Recusa ano zero, offsets fora do limite PostgreSQL e datas fora do calendário institucional após arredondar. */
export function dataCompativelComPostgres(value:string):boolean {
  const micros=instanteEmMicrosPostgres(value);
  if(micros===null)return false;
  // Divisão inteira com piso também para instantes anteriores a 1970.
  const instante=Number(micros>=0n?micros/1000n:(micros-999n)/1000n);
  const partes=anoInstitucional.formatToParts(new Date(instante));
  const ano=Number(partes.find(item=>item.type==='year')?.value);
  return partes.find(item=>item.type==='era')?.value==='AD'&&ano>=1&&ano<=9999;
}

export const dataHoraInstitucionalSchema = isoComOffset
  .refine(dataCompativelComPostgres,'Informe uma data/hora compatível com PostgreSQL e America/Maceio.')
  .describe('ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.')
  .meta({allOf:[{not:{pattern:'^0000-'}},{pattern:'(?:Z|[+-](?:0\\d|1[0-5]):[0-5]\\d)$'}]});
