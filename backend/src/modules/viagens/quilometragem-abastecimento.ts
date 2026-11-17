/** Compara somente limites cuja ordem decorre das datas civis disponíveis. */
export function conflitoAbastecimentoViagem(dia: string, km: number, viagem: {inicio: string; fim: string; inicial: number; final: number}): boolean {
  if (dia < viagem.inicio) return km > viagem.inicial;
  if (dia > viagem.fim) return km < viagem.final;
  if (viagem.inicio === viagem.fim) return false;
  if (dia === viagem.inicio) return km > viagem.final;
  if (dia === viagem.fim) return km < viagem.inicial;
  return km < viagem.inicial || km > viagem.final;
}
