export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string,
    public readonly fields?: Record<string,string>, public readonly requestId?: string) {
    super(message); this.name = 'ApiError';
  }
}
const objeto = (value: unknown): value is Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** Adapta os três envelopes atuais sem retornar conteúdo bruto ou stack do servidor. */
export function apiError(status: number, body: unknown, requestId?: string): ApiError {
  const error = objeto(body) ? body.error : undefined;
  const code = objeto(error) && typeof error.code === 'string' ? error.code : 'HTTP_'+status;
  const message = objeto(error) && typeof error.message === 'string' ? error.message
    : typeof error === 'string' ? error : objeto(body) && typeof body.erro === 'string' ? body.erro
    : 'Não foi possível concluir a solicitação. Tente novamente.';
  const fields = objeto(error) && objeto(error.fields) && Object.values(error.fields).every(v=>typeof v === 'string')
    ? error.fields as Record<string,string> : undefined;
  return new ApiError(status,code,message,fields,requestId);
}
