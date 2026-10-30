import type { ApiSchemas } from '../api/generated/schema';
// Aliases do transporte gerado; as telas podem compor modelos próprios de apresentação.
export type CriarSolicitacaoSvoRequest = ApiSchemas['CriarSolicitacaoSvo'];
export type CriarSolicitacaoSvoResponse = ApiSchemas['SolicitacaoSvo'];
export type OrdemColetaPendenteApi = ApiSchemas['OrdensSvo'][number];
export type MotoristaApi = ApiSchemas['Motorista'];
export type VeiculoApi = ApiSchemas['Veiculo'];
export type OrdemDespachadaApi = ApiSchemas['OrdemDespachada'];
