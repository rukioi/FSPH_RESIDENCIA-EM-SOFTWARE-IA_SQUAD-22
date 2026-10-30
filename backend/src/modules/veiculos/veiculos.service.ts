import { criarVeiculoSchema, editarVeiculoSchema, erroValidacaoVeiculo, veiculo } from './veiculos.schemas.js';
import { consultarVeiculos, placaExistente, inserirVeiculo, alterarVeiculo, removerVeiculo } from './veiculos.repository.js';
import { ErroHttp } from '../../shared/http/errors.js';

function dto(row: unknown) {
  // A conversão é a mesma serialização HTTP de Date do driver, sem converter ID/decimal.
  return veiculo.parse(JSON.parse(JSON.stringify(row)));
}
/** Lista DTOs explícitos validados pela mesma fonte usada na geração. */
export async function listar() { return (await consultarVeiculos()).map(dto); }
/** Valida e aplica somente as regras de cadastro já existentes. */
export async function criar(body: unknown) {
  const result = criarVeiculoSchema.safeParse(body);
  if (!result.success) { const error = erroValidacaoVeiculo(result.error,true,body); throw new ErroHttp(400,error.code,error.message); }
  if (await placaExistente(result.data.placa)) throw new ErroHttp(409,'PLACA_DUPLICADA','Já existe um veículo cadastrado com esta placa.');
  return dto(await inserirVeiculo(result.data));
}
/** Atualiza parcialmente sem mudar regras de vínculo, capacidade ou estado. */
export async function editar(id: string, body: unknown) {
  const result = editarVeiculoSchema.safeParse(body);
  if (!result.success) { const error = erroValidacaoVeiculo(result.error,false,body); throw new ErroHttp(400,error.code,error.message); }
  if (result.data.placa !== undefined && await placaExistente(result.data.placa,id)) throw new ErroHttp(409,'PLACA_DUPLICADA','Esta placa já pertence a outro veículo.');
  const row = await alterarVeiculo(id,result.data);
  if (!row) throw new ErroHttp(404,'NAO_ENCONTRADO','Veículo não encontrado.');
  return dto(row);
}
/** Preserva exclusão 200 data.success e os erros de integridade legados. */
export async function remover(id: string) {
  if (!await removerVeiculo(id)) throw new ErroHttp(404,'NAO_ENCONTRADO','Veículo não encontrado.');
  return { success: true as const };
}
