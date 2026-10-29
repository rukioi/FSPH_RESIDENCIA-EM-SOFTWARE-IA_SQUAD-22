export interface CriarSolicitacaoSvoRequest {
  localFalecimento: string
  enderecoRemocao: string
  solicitanteNome: string
  nomeFalecido?: string
  solicitanteParentesco?: string
  solicitanteTelefone?: string
  observacoesMedicas?: string
}

export interface CriarSolicitacaoSvoResponse {
  solicitacao: {
    id: number
    codigo: string
  }
  ordemColeta: {
    id: number
    codigo: string
    status: string
  }
  atividades: string[]
}

export interface OrdemColetaPendenteApi {
  id: number
  status: string
  solicitacao_obito_id: number
  solicitacao_codigo: string
  nome_falecido: string | null
  endereco_remocao: string
}

export interface MotoristaApi {
  id: number
  nome: string
  status: string
}

export interface VeiculoApi {
  id: number
  placa: string
  modelo: string
  marca: string
  status: string
  is_svo?: boolean
}

export interface OrdemDespachadaApi {
  id: number
  motorista_id: number
  veiculo_id: number
  status: string
}

export interface ApiDataResponse<T> {
  data: T
}
