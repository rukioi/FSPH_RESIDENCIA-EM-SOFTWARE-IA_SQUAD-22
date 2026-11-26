/** Confere a faixa PostgreSQL sem converter o identificador em Number. */
export function idValido(id: string): boolean {
  if (!/^-?[0-9]{1,19}$/.test(id)) return false;
  const valor = BigInt(id);
  return valor >= -9223372036854775808n && valor <= 9223372036854775807n;
}
