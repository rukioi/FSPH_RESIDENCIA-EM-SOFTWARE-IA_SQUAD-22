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

export interface ApiSchemas {
  Erro: Erro;
  ErroString: ErroString;
  ErroSvo: ErroSvo;
  ErroUsuario: ErroUsuario;
  ErroOperacionalSvo: ErroOperacionalSvo;
  Exclusao: Exclusao;
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
  Abastecimento: Abastecimento;
  RespostaAbastecimento: RespostaAbastecimento;
  Abastecimentos: Abastecimentos;
  CriarAbastecimento: CriarAbastecimento;
  Documentos: Documentos;
  PendenciasDocumentos: PendenciasDocumentos;
  CriarDocumento: CriarDocumento;
  RespostaDocumento: RespostaDocumento;
  Dashboard: Dashboard;
  Graficos: Graficos;
  DashboardGestor: DashboardGestor;
  PendenciasDashboard: PendenciasDashboard;
  OrdensSvo: OrdensSvo;
  CriarSolicitacaoSvo: CriarSolicitacaoSvo;
  SolicitacaoSvo: SolicitacaoSvo;
  DespacharSvo: DespacharSvo;
  OrdemDespachada: OrdemDespachada;
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
    veiculo_placa: string | null;
    motorista_nome: string | null;
  }[];
}
/**
 * Legado valida somente truthiness de veículo/litragem/valor/data; tipos/coerções/constraints são do banco. Ausência de motorista/km passa pelo controller mas falha NOT NULL (500). Schema documenta a forma usual, não endurece entrada.
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
}
/**
 * This interface was referenced by `ApiSchemas`'s JSON-Schema
 * via the `definition` "SolicitacaoSvo".
 */
export interface SolicitacaoSvo {
  solicitacao: {
    id: number;
    codigo: string;
  };
  ordemColeta: {
    id: number;
    codigo: string;
    status: 'PENDENTE_ALOCACAO';
  };
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

export interface ApiOperations {
  'auth_post__api_auth_login': { body: ApiSchemas['Credenciais']; response: ApiSchemas['Login'] };
  'auth_get__api_auth_sessao': { body: undefined; response: ApiSchemas['Sessao'] };
  'usuarios_get__api_admin_usuarios': { body: undefined; response: ApiSchemas['Usuarios'] };
  'usuarios_post__api_admin_usuarios': { body: ApiSchemas['CriarUsuario']; response: ApiSchemas['Usuario'] };
  'usuarios_put__api_admin_usuarios_id_': { body: ApiSchemas['EditarUsuario']; response: ApiSchemas['Usuario'] };
  'usuarios_patch__api_admin_usuarios_id_status': { body: ApiSchemas['StatusUsuario']; response: ApiSchemas['UsuarioStatus'] };
  'auditoria_get__api_admin_auditoria_logs': { body: undefined; response: ApiSchemas['Auditoria'] };
  'dashboard_get__api_dashboard': { body: undefined; response: ApiSchemas['Dashboard'] };
  'dashboard_get__api_dashboard_graficos': { body: undefined; response: ApiSchemas['Graficos'] };
  'dashboard_get__api_dashboard_pendencias': { body: undefined; response: ApiSchemas['PendenciasDashboard'] };
  'dashboard_get__api_dashboard_gestor': { body: undefined; response: ApiSchemas['DashboardGestor'] };
  'svo_get__api_svo_ordens_coleta': { body: undefined; response: ApiSchemas['OrdensSvo'] };
  'svo_post__api_svo_solicitacoes': { body: ApiSchemas['CriarSolicitacaoSvo']; response: ApiSchemas['SolicitacaoSvo'] };
  'svo_patch__api_svo_ordens_coleta_id_despachar': { body: ApiSchemas['DespacharSvo']; response: ApiSchemas['OrdemDespachada'] };
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
  'abastecimentos_get__api_abastecimentos': { body: undefined; response: ApiSchemas['Abastecimentos'] };
  'abastecimentos_post__api_abastecimentos': { body: ApiSchemas['CriarAbastecimento']; response: ApiSchemas['RespostaAbastecimento'] };
  'documentos_get__api_documentos': { body: undefined; response: ApiSchemas['Documentos'] };
  'documentos_post__api_documentos': { body: ApiSchemas['CriarDocumento']; response: ApiSchemas['RespostaDocumento'] };
  'documentos_get__api_documentos_pendencias': { body: undefined; response: ApiSchemas['PendenciasDocumentos'] };
}
