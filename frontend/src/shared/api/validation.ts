import { ApiError } from './errors';

/** Valida JSON usando os schemas puros que também geram o contrato HTTP. */
export function parseResponse<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(200, 'RESPOSTA_INVALIDA', 'A resposta do servidor é inválida. Tente novamente.');
  return result.data;
}
