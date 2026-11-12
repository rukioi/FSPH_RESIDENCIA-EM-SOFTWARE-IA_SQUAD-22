/* Gerado por client:generate de docs/api/openapi.yaml. Não editar. */

/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ErroUsuario".
 */
export type ErroUsuario =
  | {
      error: {
        code: string;
        message: string;
        fields?: {
          [k: string]: string;
        };
      };
    }
  | {
      error: string;
    };
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ErroOperacionalSvo".
 */
export type ErroOperacionalSvo =
  | {
      error: {
        code: string;
        message: string;
        fields?: {
          [k: string]: string;
        };
      };
    }
  | {
      erro: string;
    };
/**
 * Campos extras ignorados. Valores null dos opcionais usam defaults, exceto status. LOCADO exige fornecedor não vazio. Quilometragem decimal passa pela validação atual, mas pode ser recusada pelo INTEGER no banco.
 *
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "CriarVeiculo".
 */
export type CriarVeiculo = {
  placa: string;
  modelo: string;
  marca: string;
  ano: number;
  tipo?: ('PASSEIO' | 'VAN' | 'AMBULANCIA' | 'RABECÃO_SVO') | null;
  status?: 'DISPONIVEL' | 'EM_VIAGEM' | 'EM_MANUTENCAO' | 'INDISPONIVEL';
  vinculo?: ('PROPRIO' | 'LOCADO') | null;
  fornecedor_locacao?: string | null;
  capacidade_obitos?: number | null;
  capacidade_passageiros?: number | null;
  quilometragem_atual?: number | null;
  is_svo?: boolean | null;
};
/**
 * PUT e PATCH são parciais; demais campos são ignorados. LOCADO explícito exige fornecedor no mesmo corpo. PROPRIO limpa fornecedor; null não limpa fornecedor de LOCADO.
 *
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "EditarVeiculo".
 */
export type EditarVeiculo = {
  placa?: string;
  marca?: string;
  modelo?: string;
  status?: 'DISPONIVEL' | 'EM_VIAGEM' | 'EM_MANUTENCAO' | 'INDISPONIVEL';
  capacidade_passageiros?: number;
  vinculo?: 'PROPRIO' | 'LOCADO';
  fornecedor_locacao?: string | null;
};
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Usuarios".
 */
export type Usuarios = {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  nome: string;
  email: string;
  perfil: 'ADM' | 'GESTOR_FROTA' | 'SOLICITANTE_INTERNO' | 'MOTORISTA' | 'ATENDENTE_SVO';
  ativo: boolean | null;
  criado_em: string | null;
}[];
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Auditoria".
 */
export type Auditoria =
  | {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      usuario_id: string | null;
      descricao: string;
      data_hora: string | null;
      usuario_nome: string | null;
      usuario_email: string | null;
    }[]
  | {
      data: {
        /**
         * BIGINT serializado pelo postgres como string; não converter para Number.
         */
        id: string;
        usuarioId: string | null;
        descricao: string;
        dataHora: string | null;
        usuarioNome: string | null;
      }[];
      meta: {
        page: number;
        limit: number;
        total: number;
      };
    };
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ComprovanteAbastecimento".
 */
export type ComprovanteAbastecimento = string;
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "StatusTriagem".
 */
export type StatusTriagem = 'AGUARDANDO_TRIAGEM' | 'CONFIRMADA_SVO' | 'ENCAMINHADA_IML';
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "OrdensSvo".
 */
export type OrdensSvo = {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  status: 'PENDENTE_ALOCACAO';
  solicitacao_obito_id: string | null;
  solicitacao_codigo: string;
  nome_falecido: string | null;
  endereco_remocao: string;
}[];
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "SolicitacoesSvo".
 */
export type SolicitacoesSvo = {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  codigo: string;
  status_triagem: ('AGUARDANDO_TRIAGEM' | 'CONFIRMADA_SVO' | 'ENCAMINHADA_IML') | null;
  criado_em: string | null;
}[];
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "FinalizarTriagemSvo".
 */
export type FinalizarTriagemSvo =
  | {
      decisao: 'CONFIRMADA_SVO';
      triagemObservacoes: string;
      quantidadeCorpos: number;
    }
  | {
      decisao: 'ENCAMINHADA_IML';
      triagemObservacoes: string;
    };

export interface ApiSchemas {
  ListaNotificacoes: ListaNotificacoes;
  NotificacoesAtualizadas: NotificacoesAtualizadas;
  Erro: Erro;
  ErroString: ErroString;
  ErroSvo: ErroSvo;
  ErroUsuario: ErroUsuario;
  ErroOperacionalSvo: ErroOperacionalSvo;
  Exclusao: Exclusao;
  FotoVeiculoEntrada: FotoVeiculoEntrada;
  FotoVeiculoResposta: FotoVeiculoResposta;
  Veiculo: Veiculo;
  CriarVeiculo: CriarVeiculo;
  EditarVeiculo: EditarVeiculo;
  RespostaVeiculo: RespostaVeiculo;
  ListaVeiculos: ListaVeiculos;
  ExclusaoVeiculo: ExclusaoVeiculo;
  Credenciais: Credenciais;
  Login: Login;
  Sessao: Sessao;
  Usuario: Usuario;
  UsuarioStatus: UsuarioStatus;
  Usuarios: Usuarios;
  CriarUsuario: CriarUsuario;
  EditarUsuario: EditarUsuario;
  StatusUsuario: StatusUsuario;
  Atividade: Atividade;
  Auditoria: Auditoria;
  Motorista: Motorista;
  Motoristas: Motoristas;
  RespostaMotorista: RespostaMotorista;
  CriarMotorista: CriarMotorista;
  EditarMotorista: EditarMotorista;
  ComprovanteAbastecimento: ComprovanteAbastecimento;
  Abastecimento: Abastecimento;
  RespostaAbastecimento: RespostaAbastecimento;
  Abastecimentos: Abastecimentos;
  CriarAbastecimento: CriarAbastecimento;
  Documentos: Documentos;
  PendenciasDocumentos: PendenciasDocumentos;
  CriarDocumento: CriarDocumento;
  RespostaDocumento: RespostaDocumento;
  GraficosPeriodo: GraficosPeriodo;
  DashboardGestorIndicadores: DashboardGestorIndicadores;
  Dashboard: Dashboard;
  Graficos: Graficos;
  DashboardGestor: DashboardGestor;
  PendenciasDashboard: PendenciasDashboard;
  StatusTriagem: StatusTriagem;
  OrdensSvo: OrdensSvo;
  CriarSolicitacaoSvo: CriarSolicitacaoSvo;
  SolicitacaoSvo: SolicitacaoSvo;
  SolicitacoesSvo: SolicitacoesSvo;
  SalvarTriagemParcialSvo: SalvarTriagemParcialSvo;
  FinalizarTriagemSvo: FinalizarTriagemSvo;
  TriagemParcialSvo: TriagemParcialSvo;
  TriagemFinalSvo: TriagemFinalSvo;
  DespacharSvo: DespacharSvo;
  OrdemDespachada: OrdemDespachada;
  ListaSolicitacoesSvoPaginada: ListaSolicitacoesSvoPaginada;
  ListaOrdensSvoPaginada: ListaOrdensSvoPaginada;
  DetalheSolicitacaoSvo: DetalheSolicitacaoSvo;
  DetalheOrdemSvo: DetalheOrdemSvo;
  HistoricoSvo: HistoricoSvo;
  DashboardOperacionalSvo: DashboardOperacionalSvo;
  FilasOperacionaisSvo: FilasOperacionaisSvo;
  AtividadesRecentesSvo: AtividadesRecentesSvo;
  RecursosDisponiveisSvo: RecursosDisponiveisSvo;
  OcupacaoSvo: OcupacaoSvo;
  MinhasOrdensSvo: MinhasOrdensSvo;
  MinhaOrdemSvo: MinhaOrdemSvo;
  IniciarOrdemSvo: IniciarOrdemSvo;
  ConcluirOrdemSvo: ConcluirOrdemSvo;
  CancelarOrdemSvo: CancelarOrdemSvo;
  OrdemExecucaoSvo: OrdemExecucaoSvo;
  EditarSolicitacaoViagem: EditarSolicitacaoViagem;
  AgendarSolicitacaoViagem: AgendarSolicitacaoViagem;
  RespostaAgendamentoSolicitacaoViagem: RespostaAgendamentoSolicitacaoViagem;
  RejeitarSolicitacaoViagem: RejeitarSolicitacaoViagem;
  RespostaDecisaoSolicitacaoViagem: RespostaDecisaoSolicitacaoViagem;
  CriarSolicitacaoViagem: CriarSolicitacaoViagem;
  SolicitacaoViagem: SolicitacaoViagem;
  RespostaSolicitacaoViagem: RespostaSolicitacaoViagem;
  ListaSolicitacoesViagem: ListaSolicitacoesViagem;
  RespostaDetalheSolicitacaoViagem: RespostaDetalheSolicitacaoViagem;
  RespostaHistoricoSolicitacaoViagem: RespostaHistoricoSolicitacaoViagem;
  ConsultarAgendaViagem: ConsultarAgendaViagem;
  ConsultarDisponibilidadeViagem: ConsultarDisponibilidadeViagem;
  ReagendarSolicitacaoViagem: ReagendarSolicitacaoViagem;
  RespostaAgendaViagem: RespostaAgendaViagem;
  RespostaDisponibilidadeViagem: RespostaDisponibilidadeViagem;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ListaNotificacoes".
 */
export interface ListaNotificacoes {
  data: {
    id: string;
    titulo: string;
    descricao: string;
    categoria: 'informacao' | 'atencao' | 'urgente' | 'sucesso';
    criadoEm: string;
    lidaEm: string | null;
  }[];
  meta: {
    page: number;
    limit: number;
    total: number;
    naoLidas: number;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "NotificacoesAtualizadas".
 */
export interface NotificacoesAtualizadas {
  data: {
    atualizadas: number;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Erro".
 */
export interface Erro {
  error: {
    code: string;
    message: string;
    fields?: {
      [k: string]: string;
    };
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ErroString".
 */
export interface ErroString {
  error: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ErroSvo".
 */
export interface ErroSvo {
  erro: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Exclusao".
 */
export interface Exclusao {
  data: {
    success: true;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "FotoVeiculoEntrada".
 */
export interface FotoVeiculoEntrada {
  tipo: 'image/jpeg' | 'image/png';
  dadosBase64: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "FotoVeiculoResposta".
 */
export interface FotoVeiculoResposta {
  data: {
    foto: {
      tipo: 'image/jpeg' | 'image/png';
      dadosBase64: string;
    } | null;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Veiculo".
 */
export interface Veiculo {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  ano: number;
  tipo: 'PASSEIO' | 'VAN' | 'AMBULANCIA' | 'RABECÃO_SVO';
  capacidade_obitos: number | null;
  quilometragem_atual: number | null;
  status: ('DISPONIVEL' | 'EM_VIAGEM' | 'EM_MANUTENCAO' | 'INDISPONIVEL') | null;
  is_svo: boolean | null;
  criado_em: string | null;
  capacidade_passageiros: number | null;
  vinculo: 'PROPRIO' | 'LOCADO';
  fornecedor_locacao: string | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaVeiculo".
 */
export interface RespostaVeiculo {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    placa: string;
    modelo: string;
    marca: string;
    ano: number;
    tipo: 'PASSEIO' | 'VAN' | 'AMBULANCIA' | 'RABECÃO_SVO';
    capacidade_obitos: number | null;
    quilometragem_atual: number | null;
    status: ('DISPONIVEL' | 'EM_VIAGEM' | 'EM_MANUTENCAO' | 'INDISPONIVEL') | null;
    is_svo: boolean | null;
    criado_em: string | null;
    capacidade_passageiros: number | null;
    vinculo: 'PROPRIO' | 'LOCADO';
    fornecedor_locacao: string | null;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ListaVeiculos".
 */
export interface ListaVeiculos {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    placa: string;
    modelo: string;
    marca: string;
    ano: number;
    tipo: 'PASSEIO' | 'VAN' | 'AMBULANCIA' | 'RABECÃO_SVO';
    capacidade_obitos: number | null;
    quilometragem_atual: number | null;
    status: ('DISPONIVEL' | 'EM_VIAGEM' | 'EM_MANUTENCAO' | 'INDISPONIVEL') | null;
    is_svo: boolean | null;
    criado_em: string | null;
    capacidade_passageiros: number | null;
    vinculo: 'PROPRIO' | 'LOCADO';
    fornecedor_locacao: string | null;
  }[];
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ExclusaoVeiculo".
 */
export interface ExclusaoVeiculo {
  data: {
    success: true;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Credenciais".
 */
export interface Credenciais {
  email: string;
  senha: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Login".
 */
export interface Login {
  token: string;
  usuario: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    nome: string;
    email: string;
    perfil: 'ADM' | 'GESTOR_FROTA' | 'SOLICITANTE_INTERNO' | 'MOTORISTA' | 'ATENDENTE_SVO';
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Sessao".
 */
export interface Sessao {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    nome: string;
    email: string;
    perfil: 'ADM' | 'GESTOR_FROTA' | 'SOLICITANTE_INTERNO' | 'MOTORISTA' | 'ATENDENTE_SVO';
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Usuario".
 */
export interface Usuario {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  nome: string;
  email: string;
  perfil: 'ADM' | 'GESTOR_FROTA' | 'SOLICITANTE_INTERNO' | 'MOTORISTA' | 'ATENDENTE_SVO';
  ativo: boolean | null;
  criado_em: string | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "UsuarioStatus".
 */
export interface UsuarioStatus {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  nome: string;
  email: string;
  perfil: 'ADM' | 'GESTOR_FROTA' | 'SOLICITANTE_INTERNO' | 'MOTORISTA' | 'ATENDENTE_SVO';
  ativo: boolean | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "CriarUsuario".
 */
export interface CriarUsuario {
  nome: string;
  email: string;
  perfil: 'ADM' | 'GESTOR_FROTA' | 'SOLICITANTE_INTERNO' | 'MOTORISTA' | 'ATENDENTE_SVO';
  /**
   * Máximo 72 bytes UTF-8; não caracteres. Nome/email são trimados pelo serviço atual.
   */
  senha: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "EditarUsuario".
 */
export interface EditarUsuario {
  nome: string;
  email: string;
  perfil: 'ADM' | 'GESTOR_FROTA' | 'SOLICITANTE_INTERNO' | 'MOTORISTA' | 'ATENDENTE_SVO';
  /**
   * Máximo 72 bytes UTF-8; não caracteres. Nome/email são trimados pelo serviço atual.
   */
  senha?: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "StatusUsuario".
 */
export interface StatusUsuario {
  ativo: boolean;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Atividade".
 */
export interface Atividade {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  usuarioId: string | null;
  descricao: string;
  dataHora: string | null;
  usuarioNome: string | null;
}
/**
 * CPF/telefone ausentes na consulta de ATENDENTE_SVO; demais perfis recebem esses campos.
 *
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Motorista".
 */
export interface Motorista {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  usuario_id: string | null;
  nome: string;
  cnh: string;
  categoria_cnh: string;
  /**
   * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
   */
  validade_cnh: string;
  status: ('DISPONIVEL' | 'EM_VIAGEM' | 'FOLGA' | 'AFASTADO') | null;
  criado_em: string | null;
  cpf?: string | null;
  telefone?: string | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Motoristas".
 */
export interface Motoristas {
  /**
   * Items: CPF/telefone ausentes na consulta de ATENDENTE_SVO; demais perfis recebem esses campos.
   */
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    usuario_id: string | null;
    nome: string;
    cnh: string;
    categoria_cnh: string;
    /**
     * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
     */
    validade_cnh: string;
    status: ('DISPONIVEL' | 'EM_VIAGEM' | 'FOLGA' | 'AFASTADO') | null;
    criado_em: string | null;
    cpf?: string | null;
    telefone?: string | null;
  }[];
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaMotorista".
 */
export interface RespostaMotorista {
  /**
   * CPF/telefone ausentes na consulta de ATENDENTE_SVO; demais perfis recebem esses campos.
   */
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    usuario_id: string | null;
    nome: string;
    cnh: string;
    categoria_cnh: string;
    /**
     * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
     */
    validade_cnh: string;
    status: ('DISPONIVEL' | 'EM_VIAGEM' | 'FOLGA' | 'AFASTADO') | null;
    criado_em: string | null;
    cpf?: string | null;
    telefone?: string | null;
  };
}
/**
 * Legado não aplicado como validador HTTP: controller valida data de calendário, dígitos CPF/telefone, normaliza CPF/telefone e trim da CNH; não há validação uniforme de campos extras.
 *
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "CriarMotorista".
 */
export interface CriarMotorista {
  nome: string;
  cnh: string;
  categoria_cnh: 'A' | 'B' | 'C' | 'D' | 'E';
  validade_cnh: string;
  status?: ('DISPONIVEL' | 'EM_VIAGEM' | 'FOLGA' | 'AFASTADO') | null;
  cpf?: string | null;
  telefone?: string | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "EditarMotorista".
 */
export interface EditarMotorista {
  nome?: string;
  cnh?: string;
  categoria_cnh?: 'A' | 'B' | 'C' | 'D' | 'E';
  validade_cnh?: string;
  status?: 'DISPONIVEL' | 'EM_VIAGEM' | 'FOLGA' | 'AFASTADO';
  cpf?: string | null;
  telefone?: string | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Abastecimento".
 */
export interface Abastecimento {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  veiculo_id: string;
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  motorista_id: string;
  /**
   * NUMERIC serializado pelo driver como string, preservando precisão.
   */
  litragem: string;
  /**
   * NUMERIC serializado pelo driver como string, preservando precisão.
   */
  valor_total: string;
  quilometragem: number;
  /**
   * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
   */
  data_abastecimento: string;
  criado_em: string | null;
  posto: string | null;
  tanque_completo: boolean;
  comprovante_nome: string | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaAbastecimento".
 */
export interface RespostaAbastecimento {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    veiculo_id: string;
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    motorista_id: string;
    /**
     * NUMERIC serializado pelo driver como string, preservando precisão.
     */
    litragem: string;
    /**
     * NUMERIC serializado pelo driver como string, preservando precisão.
     */
    valor_total: string;
    quilometragem: number;
    /**
     * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
     */
    data_abastecimento: string;
    criado_em: string | null;
    posto: string | null;
    tanque_completo: boolean;
    comprovante_nome: string | null;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Abastecimentos".
 */
export interface Abastecimentos {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    veiculo_id: string;
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    motorista_id: string;
    /**
     * NUMERIC serializado pelo driver como string, preservando precisão.
     */
    litragem: string;
    /**
     * NUMERIC serializado pelo driver como string, preservando precisão.
     */
    valor_total: string;
    quilometragem: number;
    /**
     * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
     */
    data_abastecimento: string;
    criado_em: string | null;
    posto: string | null;
    tanque_completo: boolean;
    comprovante_nome: string | null;
    veiculo_placa: string | null;
    motorista_nome: string | null;
  }[];
}
/**
 * Forma usual de transporte. #30 classifica JSON/tipo/campo incompatível com o schema atual como 400 e FK inexistente como 404. Motorista/km omitidos ou nulos recebem 400 pelo NOT NULL atual; RF40 permanece adiado, sem migration para alterar obrigatoriedade. Validação técnica de calendário e tipos ocorre no controller.
 *
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "CriarAbastecimento".
 */
export interface CriarAbastecimento {
  veiculo_id: number | string;
  motorista_id?: number | string | null;
  posto?: string | null;
  litragem: number | string;
  valor_total: number | string;
  quilometragem?: number | null;
  data_abastecimento: string;
  tanque_completo?: boolean;
  comprovante?: {
    nome: string;
    tipo: 'image/jpeg' | 'image/png';
    dadosBase64: string;
  } | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Documentos".
 */
export interface Documentos {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    tipo: 'DOCUMENTO_VEICULO' | 'CNH_MOTORISTA';
    descricao: string;
    relacionado_id: string | null;
    /**
     * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
     */
    data_validade: string;
    status: 'SEM_VALIDADE' | 'VENCIDA' | 'PROXIMA_DO_VENCIMENTO' | 'REGULAR';
  }[];
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "PendenciasDocumentos".
 */
export interface PendenciasDocumentos {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    tipo: 'DOCUMENTO_VEICULO' | 'CNH_MOTORISTA';
    descricao: string;
    /**
     * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
     */
    data_validade: string;
    status: 'SEM_VALIDADE' | 'VENCIDA' | 'PROXIMA_DO_VENCIMENTO' | 'REGULAR';
    dias_restantes: number;
  }[];
}
/**
 * JSON até 1 MiB. Multipart converte veiculo_id para Number; campo arquivo PDF/JPEG/PNG até 5 MiB, assinatura verificada; até dez campos de 4 KiB. Data exige calendário válido.
 *
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "CriarDocumento".
 */
export interface CriarDocumento {
  veiculo_id: number;
  tipo_documento: string;
  data_vencimento: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaDocumento".
 */
export interface RespostaDocumento {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    veiculo_id: string | null;
    tipo_documento: string;
    /**
     * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
     */
    data_vencimento: string;
    status_regular: boolean | null;
    arquivo_nome: string | null;
    arquivo_tipo: string | null;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "GraficosPeriodo".
 */
export interface GraficosPeriodo {
  data: {
    veiculosPorStatus: {
      status: string | null;
      total: number;
    }[];
    solicitacoesPorStatus: {
      status: string | null;
      total: number;
    }[];
    periodo: {
      periodo: 'hoje' | '7d' | '30d' | 'personalizado';
      inicio: string;
      fim: string;
      criterio: 'dataHoraSaida';
      fuso: 'America/Maceio';
    };
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "DashboardGestorIndicadores".
 */
export interface DashboardGestorIndicadores {
  data: {
    veiculosPorStatus: {
      status: string | null;
      total: number;
    }[];
    motoristasDisponiveis: number | null;
    motoristasDisponiveisMotivo: string | null;
    solicitacoesPorStatus: {
      status: string | null;
      total: number;
    }[];
    proximasViagens: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      codigo: string;
      solicitante_id: string | null;
      origem: string;
      destino: string;
      /**
       * Timestamp sem fuso no banco, serializado pelo driver como ISO; não redefine seu significado histórico.
       */
      data_hora_saida: string;
      qtd_passageiros: number | null;
      status: string | null;
      motivo_rejeicao: string | null;
      criado_em: string | null;
      veiculo_id: string | null;
      motorista_id: string | null;
    }[];
    periodo: {
      periodo: 'hoje' | '7d' | '30d' | 'personalizado';
      inicio: string;
      fim: string;
      criterio: 'dataHoraSaida';
      fuso: 'America/Maceio';
    };
    indicadores: {
      periodo: {
        periodo: 'hoje' | '7d' | '30d' | 'personalizado';
        inicio: string;
        fim: string;
        criterio: 'dataHoraSaida';
        fuso: 'America/Maceio';
      };
      pendentes: number;
      /**
       * Estado atual APROVADA dos pedidos com saída no período; não conta eventos de decisão. Semântica provisória sujeita ao aceite da equipe.
       */
      aprovadas: number;
      /**
       * Estado atual REPROVADA dos pedidos com saída no período; não conta eventos de decisão. Semântica provisória sujeita ao aceite da equipe.
       */
      reprovadas: number;
      veiculosDisponiveis: number;
      filaAguardandoAnalise: {
        /**
         * BIGINT serializado pelo postgres como string; não converter para Number.
         */
        id: string;
        codigo: string;
        codigoExibicao: string;
        origem: string;
        destino: string;
        criadoEm: string | null;
        acao: 'ANALISAR';
      }[];
      atividadeRecente: {
        /**
         * BIGINT serializado pelo postgres como string; não converter para Number.
         */
        id: string;
        /**
         * BIGINT serializado pelo postgres como string; não converter para Number.
         */
        solicitacaoId: string;
        codigo: string;
        descricao: string;
        dataHora: string | null;
        responsavelId: string | null;
      }[];
      decisoesRecentes: {
        /**
         * BIGINT serializado pelo postgres como string; não converter para Number.
         */
        id: string;
        /**
         * BIGINT serializado pelo postgres como string; não converter para Number.
         */
        solicitacaoId: string;
        codigo: string;
        descricao: string;
        dataHora: string | null;
        responsavelId: string | null;
      }[];
      indicadoresIndisponiveis: {
        indicador: 'IND-02' | 'IND-08' | 'IND-09';
        estado: 'indisponivel';
        motivo: string;
      }[];
    };
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Dashboard".
 */
export interface Dashboard {
  data: Record<string, never>;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "Graficos".
 */
export interface Graficos {
  data: {
    veiculosPorStatus: {
      status: string | null;
      total: number;
    }[];
    solicitacoesPorStatus: {
      status: string | null;
      total: number;
    }[];
  };
}
/**
 * motoristasDisponiveis é a contagem de TODOS os motoristas; cálculo legado preservado. Não há endpoint /kpis ou filtro por período.
 *
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "DashboardGestor".
 */
export interface DashboardGestor {
  data: {
    veiculosPorStatus: {
      status: string | null;
      total: number;
    }[];
    motoristasDisponiveis: number;
    solicitacoesPorStatus: {
      status: string | null;
      total: number;
    }[];
    proximasViagens: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      codigo: string;
      solicitante_id: string | null;
      origem: string;
      destino: string;
      /**
       * Timestamp sem fuso no banco, serializado pelo driver como ISO; não redefine seu significado histórico.
       */
      data_hora_saida: string;
      qtd_passageiros: number | null;
      status: string | null;
      motivo_rejeicao: string | null;
      criado_em: string | null;
      veiculo_id: string | null;
      motorista_id: string | null;
    }[];
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "PendenciasDashboard".
 */
export interface PendenciasDashboard {
  data: {
    motoristas: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      nome: string;
      /**
       * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
       */
      vencimento: string;
      situacao: string;
    }[];
    documentos: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      tipo_documento: string;
      /**
       * Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.
       */
      vencimento: string;
      placa: string;
      modelo: string;
      situacao: string;
    }[];
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "CriarSolicitacaoSvo".
 */
export interface CriarSolicitacaoSvo {
  localFalecimento: string;
  enderecoRemocao: string;
  solicitanteNome: string;
  nomeFalecido?: string | null;
  solicitanteParentesco?: string | null;
  solicitanteTelefone?: string | null;
  observacoesMedicas?: string | null;
  pontoReferencia?: string | null;
  canalAtendimento?: 'TELEFONE';
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "SolicitacaoSvo".
 */
export interface SolicitacaoSvo {
  solicitacao: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    statusTriagem: 'AGUARDANDO_TRIAGEM';
    criadoEm: string | null;
  };
  atividades: string[];
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "SalvarTriagemParcialSvo".
 */
export interface SalvarTriagemParcialSvo {
  triagemObservacoes: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "TriagemParcialSvo".
 */
export interface TriagemParcialSvo {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  solicitacaoId: string;
  statusTriagem: 'AGUARDANDO_TRIAGEM';
  triagemObservacoes: string;
  atividades: string[];
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "TriagemFinalSvo".
 */
export interface TriagemFinalSvo {
  solicitacao: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    statusTriagem: 'CONFIRMADA_SVO' | 'ENCAMINHADA_IML';
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    triadoPorId: string;
    triadoEm: string;
  };
  ordemColeta: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    status: 'PENDENTE_ALOCACAO';
    quantidadeCorpos: number;
  } | null;
  atividades: string[];
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "DespacharSvo".
 */
export interface DespacharSvo {
  motoristaId: number;
  veiculoId: number;
}
/**
 * Conversão legada explícita para Number; precisão de BIGINT acima de MAX_SAFE_INTEGER não é garantida.
 *
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "OrdemDespachada".
 */
export interface OrdemDespachada {
  id: number;
  motorista_id: number;
  veiculo_id: number;
  status: 'EM_DESLOCAMENTO';
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ListaSolicitacoesSvoPaginada".
 */
export interface ListaSolicitacoesSvoPaginada {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    statusTriagem: string | null;
    criadoEm: string | null;
  }[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ListaOrdensSvoPaginada".
 */
export interface ListaOrdensSvoPaginada {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    status: string | null;
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    solicitacaoId: string;
    solicitacaoCodigo: string;
    quantidadeCorpos: number | null;
  }[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "DetalheSolicitacaoSvo".
 */
export interface DetalheSolicitacaoSvo {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  codigo: string;
  statusTriagem: string | null;
  criadoEm: string | null;
  triagemObservacoes: string | null;
  triadoPorId: string | null;
  triadoEm: string | null;
  localFalecimento: string;
  enderecoRemocao: string;
  pontoReferencia: string | null;
  canalAtendimento: string | null;
  solicitanteNome: string;
  solicitanteParentesco: string | null;
  solicitanteTelefone: string | null;
  nomeFalecido: string | null;
  observacoesMedicas: string | null;
  ordemColeta: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    status: string | null;
    quantidadeCorpos: number | null;
    motoristaId: string | null;
    veiculoId: string | null;
  } | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "DetalheOrdemSvo".
 */
export interface DetalheOrdemSvo {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  codigo: string;
  status: string | null;
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  solicitacaoId: string;
  solicitacaoCodigo: string;
  quantidadeCorpos: number | null;
  statusTriagem: string | null;
  motoristaId: string | null;
  veiculoId: string | null;
  kmInicial: number | null;
  kmFinal: number | null;
  dataInicio: string | null;
  dataFim: string | null;
  enderecoRemocao: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "HistoricoSvo".
 */
export interface HistoricoSvo {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    descricao: string;
    dataHora: string | null;
    usuarioId: string | null;
    usuarioNome: string | null;
  }[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "DashboardOperacionalSvo".
 */
export interface DashboardOperacionalSvo {
  periodo: 'hoje' | '7d' | '30d';
  inicio: string;
  fim: string;
  indicadores: {
    aguardandoTriagem: number;
    confirmadasSvo: number;
    ordensColeta: number;
    encaminhadasIml: number;
  };
  visaoGeral: {
    aguardandoTriagem: number;
    confirmadasSvo: number;
    encaminhadasIml: number;
    semClassificacao: number;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "FilasOperacionaisSvo".
 */
export interface FilasOperacionaisSvo {
  aguardandoTriagem: {
    total: number;
    itens: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      codigo: string;
      criadoEm: string | null;
    }[];
  };
  aguardandoDespacho: {
    total: number;
    itens: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      codigo: string;
      solicitacaoCodigo: string;
      quantidadeCorpos: number | null;
    }[];
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "AtividadesRecentesSvo".
 */
export interface AtividadesRecentesSvo {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    descricao: string;
    dataHora: string | null;
    usuarioId: string | null;
    usuarioNome: string | null;
  }[];
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RecursosDisponiveisSvo".
 */
export interface RecursosDisponiveisSvo {
  motoristas: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    nome: string;
  }[];
  veiculos: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    placa: string;
    modelo: string;
    ocupacao: number;
    capacidade: 4;
    disponivel: boolean;
  }[];
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "OcupacaoSvo".
 */
export interface OcupacaoSvo {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  placa: string;
  ocupacao: number;
  capacidade: 4;
  disponivel: boolean;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "MinhasOrdensSvo".
 */
export interface MinhasOrdensSvo {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    solicitacaoCodigo: string;
    status: 'PENDENTE_ALOCACAO' | 'EM_DESLOCAMENTO' | 'EM_TRANSPORTE' | 'CONCLUIDA' | 'CANCELADA';
    quantidadeCorpos: number | null;
    veiculoId: string | null;
    kmInicial: number | null;
    kmFinal: number | null;
    enderecoRemocao: string;
    dataInicio: string | null;
    dataFim: string | null;
  }[];
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "MinhaOrdemSvo".
 */
export interface MinhaOrdemSvo {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  codigo: string;
  solicitacaoCodigo: string;
  status: 'PENDENTE_ALOCACAO' | 'EM_DESLOCAMENTO' | 'EM_TRANSPORTE' | 'CONCLUIDA' | 'CANCELADA';
  quantidadeCorpos: number | null;
  veiculoId: string | null;
  kmInicial: number | null;
  kmFinal: number | null;
  enderecoRemocao: string;
  dataInicio: string | null;
  dataFim: string | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "IniciarOrdemSvo".
 */
export interface IniciarOrdemSvo {
  kmInicial: number;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ConcluirOrdemSvo".
 */
export interface ConcluirOrdemSvo {
  kmFinal: number;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "CancelarOrdemSvo".
 */
export type CancelarOrdemSvo = Record<string, never>;
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "OrdemExecucaoSvo".
 */
export interface OrdemExecucaoSvo {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  status: 'PENDENTE_ALOCACAO' | 'EM_DESLOCAMENTO' | 'EM_TRANSPORTE' | 'CONCLUIDA' | 'CANCELADA';
  dataInicio: string | null;
  dataFim: string | null;
  kmInicial: number | null;
  kmFinal: number | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "EditarSolicitacaoViagem".
 */
export interface EditarSolicitacaoViagem {
  origem?: string;
  destino?: string;
  finalidade?: string;
  /**
   * ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.
   */
  dataHoraSaida?: string;
  qtdPassageiros?: number;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "AgendarSolicitacaoViagem".
 */
export interface AgendarSolicitacaoViagem {
  /**
   * Inteiro em string entre -9223372036854775808 e 9223372036854775807; zero permitido, sujeito à existência do recurso.
   */
  motoristaId: string;
  /**
   * Inteiro em string entre -9223372036854775808 e 9223372036854775807; zero permitido, sujeito à existência do recurso.
   */
  veiculoId: string;
  /**
   * ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.
   */
  dataHoraRetornoPrevisto: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaAgendamentoSolicitacaoViagem".
 */
export interface RespostaAgendamentoSolicitacaoViagem {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    status: 'AGENDADA';
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    motoristaId: string;
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    veiculoId: string;
    dataHoraSaida: string;
    dataHoraRetornoPrevisto: string;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RejeitarSolicitacaoViagem".
 */
export interface RejeitarSolicitacaoViagem {
  motivo: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaDecisaoSolicitacaoViagem".
 */
export interface RespostaDecisaoSolicitacaoViagem {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    status: 'APROVADA' | 'REPROVADA';
    motivoRejeicao: string | null;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "CriarSolicitacaoViagem".
 */
export interface CriarSolicitacaoViagem {
  origem: string;
  destino: string;
  finalidade: string;
  /**
   * ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.
   */
  dataHoraSaida: string;
  qtdPassageiros: number;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "SolicitacaoViagem".
 */
export interface SolicitacaoViagem {
  /**
   * BIGINT serializado pelo postgres como string; não converter para Number.
   */
  id: string;
  codigo: string;
  codigoExibicao: string;
  solicitante: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    nome: string | null;
  } | null;
  origem: string;
  destino: string;
  finalidade: string | null;
  dataHoraSaida: string;
  qtdPassageiros: number | null;
  status:
    ('PENDENTE' | 'APROVADA' | 'AGENDADA' | 'PRONTA_PARA_INICIAR' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'REPROVADA') | null;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaSolicitacaoViagem".
 */
export interface RespostaSolicitacaoViagem {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    codigoExibicao: string;
    solicitante: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      nome: string | null;
    } | null;
    origem: string;
    destino: string;
    finalidade: string | null;
    dataHoraSaida: string;
    qtdPassageiros: number | null;
    status:
      | ('PENDENTE' | 'APROVADA' | 'AGENDADA' | 'PRONTA_PARA_INICIAR' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'REPROVADA')
      | null;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ListaSolicitacoesViagem".
 */
export interface ListaSolicitacoesViagem {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    codigoExibicao: string;
    solicitante: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      nome: string | null;
    } | null;
    origem: string;
    destino: string;
    finalidade: string | null;
    dataHoraSaida: string;
    qtdPassageiros: number | null;
    status:
      | ('PENDENTE' | 'APROVADA' | 'AGENDADA' | 'PRONTA_PARA_INICIAR' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'REPROVADA')
      | null;
  }[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaDetalheSolicitacaoViagem".
 */
export interface RespostaDetalheSolicitacaoViagem {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    codigoExibicao: string;
    solicitante: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      nome: string | null;
    } | null;
    origem: string;
    destino: string;
    finalidade: string | null;
    dataHoraSaida: string;
    qtdPassageiros: number | null;
    status:
      | ('PENDENTE' | 'APROVADA' | 'AGENDADA' | 'PRONTA_PARA_INICIAR' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'REPROVADA')
      | null;
    motivoRejeicao: string | null;
    dataHoraRetornoPrevisto: string | null;
    motorista: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      nome: string;
    } | null;
    veiculo: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      placa: string;
      modelo: string;
    } | null;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaHistoricoSolicitacaoViagem".
 */
export interface RespostaHistoricoSolicitacaoViagem {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    descricao: string;
    /**
     * Timestamp da auditoria sem fuso; não se infere UTC ou offset histórico.
     */
    dataHora: string | null;
    responsavel?: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      nome: string | null;
    } | null;
  }[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ConsultarAgendaViagem".
 */
export interface ConsultarAgendaViagem {
  /**
   * ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.
   */
  inicio: string;
  /**
   * ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.
   */
  fim: string;
  page?: string;
  limit?: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ConsultarDisponibilidadeViagem".
 */
export interface ConsultarDisponibilidadeViagem {
  /**
   * ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.
   */
  inicio: string;
  /**
   * ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.
   */
  fim: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "ReagendarSolicitacaoViagem".
 */
export interface ReagendarSolicitacaoViagem {
  /**
   * Inteiro em string entre -9223372036854775808 e 9223372036854775807; zero permitido, sujeito à existência do recurso.
   */
  motoristaId: string;
  /**
   * Inteiro em string entre -9223372036854775808 e 9223372036854775807; zero permitido, sujeito à existência do recurso.
   */
  veiculoId: string;
  /**
   * ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.
   */
  dataHoraRetornoPrevisto: string;
  /**
   * ISO com offset explícito até ±15:59, sem ano zero; a normalização institucional deve permanecer entre os anos 0001 e 9999.
   */
  dataHoraSaida: string;
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaAgendaViagem".
 */
export interface RespostaAgendaViagem {
  data: {
    /**
     * BIGINT serializado pelo postgres como string; não converter para Number.
     */
    id: string;
    codigo: string;
    codigoExibicao: string;
    status: 'AGENDADA';
    origem: string;
    destino: string;
    finalidade: string | null;
    qtdPassageiros: number | null;
    motorista: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      nome: string;
    } | null;
    veiculo: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      placa: string;
      modelo: string;
    } | null;
    dataHoraSaida: string;
    dataHoraRetornoPrevisto: string | null;
  }[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "RespostaDisponibilidadeViagem".
 */
export interface RespostaDisponibilidadeViagem {
  data: {
    motoristas: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      nome: string;
    }[];
    veiculos: {
      /**
       * BIGINT serializado pelo postgres como string; não converter para Number.
       */
      id: string;
      placa: string;
      modelo: string;
    }[];
  };
}

export interface ApiOperations {
  'notificacoes_get__api_notificacoes': { body: undefined; response: ApiSchemas['ListaNotificacoes'] };
  'notificacoes_post__api_notificacoes_ler_todas': { body: undefined; response: ApiSchemas['NotificacoesAtualizadas'] };
  'notificacoes_post__api_notificacoes_id_ler': { body: undefined; response: ApiSchemas['NotificacoesAtualizadas'] };
  'notificacoes_post__api_notificacoes_sincronizar': { body: undefined; response: ApiSchemas['NotificacoesAtualizadas'] };
  'solicitacoes_get__api_solicitacoes_viagem_id_': { body: undefined; response: ApiSchemas['RespostaDetalheSolicitacaoViagem'] };
  'solicitacoes_patch__api_solicitacoes_viagem_id_': { body: ApiSchemas['EditarSolicitacaoViagem']; response: ApiSchemas['RespostaSolicitacaoViagem'] };
  'solicitacoes_get__api_solicitacoes_viagem_id_historico': { body: undefined; response: ApiSchemas['RespostaHistoricoSolicitacaoViagem'] };
  'solicitacoes_get__api_solicitacoes_viagem_agenda': { body: undefined; response: ApiSchemas['RespostaAgendaViagem'] };
  'solicitacoes_get__api_solicitacoes_viagem_disponibilidade': { body: undefined; response: ApiSchemas['RespostaDisponibilidadeViagem'] };
  'solicitacoes_post__api_solicitacoes_viagem_id_reagendar': { body: ApiSchemas['ReagendarSolicitacaoViagem']; response: ApiSchemas['RespostaAgendamentoSolicitacaoViagem'] };
  'solicitacoes_post__api_solicitacoes_viagem_id_agendar': { body: ApiSchemas['AgendarSolicitacaoViagem']; response: ApiSchemas['RespostaAgendamentoSolicitacaoViagem'] };
  'solicitacoes_post__api_solicitacoes_viagem_id_aprovar': { body: undefined; response: ApiSchemas['RespostaDecisaoSolicitacaoViagem'] };
  'solicitacoes_post__api_solicitacoes_viagem_id_rejeitar': { body: ApiSchemas['RejeitarSolicitacaoViagem']; response: ApiSchemas['RespostaDecisaoSolicitacaoViagem'] };
  'solicitacoes_post__api_solicitacoes_viagem': { body: ApiSchemas['CriarSolicitacaoViagem']; response: ApiSchemas['RespostaSolicitacaoViagem'] };
  'solicitacoes_get__api_solicitacoes_viagem': { body: undefined; response: ApiSchemas['ListaSolicitacoesViagem'] };
  'auth_post__api_auth_login': { body: ApiSchemas['Credenciais']; response: ApiSchemas['Login'] };
  'auth_get__api_auth_sessao': { body: undefined; response: ApiSchemas['Sessao'] };
  'usuarios_get__api_admin_usuarios': { body: undefined; response: ApiSchemas['Usuarios'] };
  'usuarios_post__api_admin_usuarios': { body: ApiSchemas['CriarUsuario']; response: ApiSchemas['Usuario'] };
  'usuarios_put__api_admin_usuarios_id_': { body: ApiSchemas['EditarUsuario']; response: ApiSchemas['Usuario'] };
  'usuarios_patch__api_admin_usuarios_id_status': { body: ApiSchemas['StatusUsuario']; response: ApiSchemas['UsuarioStatus'] };
  'auditoria_get__api_admin_auditoria_logs': { body: undefined; response: ApiSchemas['Auditoria'] };
  'dashboard_get__api_dashboard': { body: undefined; response: ApiSchemas['Dashboard'] };
  'dashboard_get__api_dashboard_graficos': { body: undefined; response: ApiSchemas['GraficosPeriodo'] };
  'dashboard_get__api_dashboard_pendencias': { body: undefined; response: ApiSchemas['PendenciasDashboard'] };
  'dashboard_get__api_dashboard_gestor': { body: undefined; response: ApiSchemas['DashboardGestorIndicadores'] };
  'svo_get__api_svo_recursos_disponiveis': { body: undefined; response: ApiSchemas['RecursosDisponiveisSvo'] };
  'svo_get__api_svo_veiculos_id_ocupacao': { body: undefined; response: ApiSchemas['OcupacaoSvo'] };
  'svo_get__api_svo_ordens_coleta_minhas': { body: undefined; response: ApiSchemas['MinhasOrdensSvo'] };
  'svo_get__api_svo_ordens_coleta_minhas_id_': { body: undefined; response: ApiSchemas['MinhaOrdemSvo'] };
  'svo_patch__api_svo_ordens_coleta_id_iniciar': { body: ApiSchemas['IniciarOrdemSvo']; response: ApiSchemas['OrdemExecucaoSvo'] };
  'svo_patch__api_svo_ordens_coleta_id_etapa': { body: undefined; response: ApiSchemas['OrdemExecucaoSvo'] };
  'svo_patch__api_svo_ordens_coleta_id_concluir': { body: ApiSchemas['ConcluirOrdemSvo']; response: ApiSchemas['OrdemExecucaoSvo'] };
  'svo_patch__api_svo_ordens_coleta_id_cancelar': { body: ApiSchemas['CancelarOrdemSvo']; response: ApiSchemas['OrdemExecucaoSvo'] };
  'svo_get__api_svo_ordens_coleta': { body: undefined; response: ApiSchemas['OrdensSvo'] };
  'svo_get__api_svo_solicitacoes': { body: undefined; response: ApiSchemas['SolicitacoesSvo'] };
  'svo_post__api_svo_solicitacoes': { body: ApiSchemas['CriarSolicitacaoSvo']; response: ApiSchemas['SolicitacaoSvo'] };
  'svo_patch__api_svo_solicitacoes_id_triagem': { body: ApiSchemas['SalvarTriagemParcialSvo']; response: ApiSchemas['TriagemParcialSvo'] };
  'svo_post__api_svo_solicitacoes_id_triagem': { body: ApiSchemas['FinalizarTriagemSvo']; response: ApiSchemas['TriagemFinalSvo'] };
  'svo_patch__api_svo_ordens_coleta_id_despachar': { body: ApiSchemas['DespacharSvo']; response: ApiSchemas['OrdemDespachada'] };
  'svo_get__api_svo_solicitacoes_paginadas': { body: undefined; response: ApiSchemas['ListaSolicitacoesSvoPaginada'] };
  'svo_get__api_svo_solicitacoes_id_': { body: undefined; response: ApiSchemas['DetalheSolicitacaoSvo'] };
  'svo_get__api_svo_solicitacoes_id_historico': { body: undefined; response: ApiSchemas['HistoricoSvo'] };
  'svo_get__api_svo_ordens_coleta_paginadas': { body: undefined; response: ApiSchemas['ListaOrdensSvoPaginada'] };
  'svo_get__api_svo_ordens_coleta_id_': { body: undefined; response: ApiSchemas['DetalheOrdemSvo'] };
  'svo_get__api_svo_ordens_coleta_id_historico': { body: undefined; response: ApiSchemas['HistoricoSvo'] };
  'svo_get__api_svo_dashboard': { body: undefined; response: ApiSchemas['DashboardOperacionalSvo'] };
  'svo_get__api_svo_dashboard_filas': { body: undefined; response: ApiSchemas['FilasOperacionaisSvo'] };
  'svo_get__api_svo_dashboard_atividades': { body: undefined; response: ApiSchemas['AtividadesRecentesSvo'] };
  'veiculos_get__api_veiculos_id_foto': { body: undefined; response: ApiSchemas['FotoVeiculoResposta'] };
  'veiculos_put__api_veiculos_id_foto': { body: ApiSchemas['FotoVeiculoEntrada']; response: ApiSchemas['FotoVeiculoResposta'] };
  'veiculos_get__api_veiculos': { body: undefined; response: ApiSchemas['ListaVeiculos'] };
  'veiculos_post__api_veiculos': { body: ApiSchemas['CriarVeiculo']; response: ApiSchemas['RespostaVeiculo'] };
  'veiculos_put__api_veiculos_id_': { body: ApiSchemas['EditarVeiculo']; response: ApiSchemas['RespostaVeiculo'] };
  'veiculos_patch__api_veiculos_id_': { body: ApiSchemas['EditarVeiculo']; response: ApiSchemas['RespostaVeiculo'] };
  'veiculos_delete__api_veiculos_id_': { body: undefined; response: ApiSchemas['ExclusaoVeiculo'] };
  'motoristas_get__api_motoristas': { body: undefined; response: ApiSchemas['Motoristas'] };
  'motoristas_post__api_motoristas': { body: ApiSchemas['CriarMotorista']; response: ApiSchemas['RespostaMotorista'] };
  'motoristas_put__api_motoristas_id_': { body: ApiSchemas['EditarMotorista']; response: ApiSchemas['RespostaMotorista'] };
  'motoristas_patch__api_motoristas_id_': { body: ApiSchemas['EditarMotorista']; response: ApiSchemas['RespostaMotorista'] };
  'motoristas_delete__api_motoristas_id_': { body: undefined; response: ApiSchemas['Exclusao'] };
  'abastecimentos_get__api_abastecimentos_id_comprovante': { body: undefined; response: Blob };
  'abastecimentos_get__api_abastecimentos': { body: undefined; response: ApiSchemas['Abastecimentos'] };
  'abastecimentos_post__api_abastecimentos': { body: ApiSchemas['CriarAbastecimento']; response: ApiSchemas['RespostaAbastecimento'] };
  'documentos_get__api_documentos': { body: undefined; response: ApiSchemas['Documentos'] };
  'documentos_post__api_documentos': { body: ApiSchemas['CriarDocumento']; response: ApiSchemas['RespostaDocumento'] };
  'documentos_get__api_documentos_pendencias': { body: undefined; response: ApiSchemas['PendenciasDocumentos'] };
}
