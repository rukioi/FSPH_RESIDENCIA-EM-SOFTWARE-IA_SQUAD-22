import type {
  ApiDataResponse,
  CriarSolicitacaoSvoRequest,
  CriarSolicitacaoSvoResponse,
  MotoristaApi,
  OrdemColetaPendenteApi,
  OrdemDespachadaApi,
  VeiculoApi,
} from '../types/svo'

async function mensagemErro(
  response: Response,
  mensagemPadrao: string,
): Promise<string> {
  try {
    const dados = await response.json()

    if (typeof dados?.erro === 'string') {
      return dados.erro
    }

    if (typeof dados?.error?.message === 'string') {
      return dados.error.message
    }
  } catch {
    // Mantém a mensagem padrão quando a resposta não possui JSON válido.
  }

  return mensagemPadrao
}

export async function criarSolicitacaoSvo(
  dados: CriarSolicitacaoSvoRequest,
  token: string,
): Promise<CriarSolicitacaoSvoResponse> {
  const response = await fetch('/api/svo/solicitacoes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dados),
  })

  if (!response.ok) {
    throw new Error(
      await mensagemErro(
        response,
        'Não foi possível criar a solicitação.',
      ),
    )
  }

  return response.json()
}

export async function listarOrdensAguardandoSvo(
  token: string,
): Promise<OrdemColetaPendenteApi[]> {
  const response = await fetch(
    '/api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error(
      await mensagemErro(
        response,
        'Não foi possível carregar as ordens de coleta.',
      ),
    )
  }

  return response.json()
}

export async function listarMotoristasDisponiveis(): Promise<
  MotoristaApi[]
> {
  const response = await fetch('/api/motoristas')

  if (!response.ok) {
    throw new Error(
      'Não foi possível carregar os motoristas.',
    )
  }

  const resultado =
    (await response.json()) as ApiDataResponse<MotoristaApi[]>

  return resultado.data.filter(
    (motorista) => motorista.status === 'DISPONIVEL',
  )
}

export async function listarVeiculosDisponiveis(): Promise<
  VeiculoApi[]
> {
  const response = await fetch('/api/veiculos')

  if (!response.ok) {
    throw new Error(
      'Não foi possível carregar os veículos.',
    )
  }

  const resultado =
    (await response.json()) as ApiDataResponse<VeiculoApi[]>

  return resultado.data.filter(
    (veiculo) => veiculo.status === 'DISPONIVEL',
  )
}

export async function despacharOrdemSvo(
  ordemId: number,
  motoristaId: number,
  veiculoId: number,
  token: string,
): Promise<OrdemDespachadaApi> {
  const response = await fetch(
    `/api/svo/ordens-coleta/${ordemId}/despachar`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        motoristaId,
        veiculoId,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      await mensagemErro(
        response,
        'Não foi possível realizar o despacho.',
      ),
    )
  }

  return response.json()
}
