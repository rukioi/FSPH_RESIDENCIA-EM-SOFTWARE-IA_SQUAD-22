export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string,
    public readonly fields?: Record<string,string>, public readonly requestId?: string) {
    super(message); this.name = 'ApiError';
  }
}
/** Mensagem única para falhas de transporte sem expor detalhes técnicos ao usuário. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir a solicitação. Tente novamente.';
}
const objeto = (value: unknown): value is Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const mensagensHttp: Record<number, string> = {
  400: 'Confira os dados informados e tente novamente.',
  401: 'Sua sessão não é válida. Faça login novamente.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'O serviço solicitado não foi encontrado. Tente novamente mais tarde.',
  405: 'Esta ação não está disponível para o serviço solicitado.',
  408: 'O tempo da solicitação esgotou. Tente novamente.',
  409: 'Os dados estão em conflito. Atualize a página e tente novamente.',
  410: 'O recurso solicitado não está mais disponível.',
  413: 'O conteúdo enviado é muito grande. Reduza o tamanho e tente novamente.',
  415: 'O formato enviado não é aceito. Confira o arquivo ou os dados.',
  422: 'Não foi possível processar os dados. Confira os campos informados.',
  429: 'Muitas tentativas. Aguarde e tente novamente.',
};
/** Adapta os três envelopes atuais sem retornar conteúdo bruto ou stack do servidor. */
export function apiError(status: number, body: unknown, requestId?: string): ApiError {
  const error = objeto(body) ? body.error : undefined;
  const code = objeto(error) && typeof error.code === 'string' ? error.code : 'HTTP_'+status;
  const message = objeto(error) && typeof error.message === 'string' ? error.message
    : typeof error === 'string' ? error : objeto(body) && typeof body.erro === 'string' ? body.erro
    : mensagensHttp[status] ?? (status >= 400 && status < 500
      ? 'Não foi possível realizar esta ação. Confira a solicitação e tente novamente.'
      : 'O serviço está indisponível. Tente novamente mais tarde.');
  const fields = objeto(error) && objeto(error.fields) && Object.values(error.fields).every(v=>typeof v === 'string')
    ? error.fields as Record<string,string> : undefined;
  return new ApiError(status,code,message,fields,requestId);
}
