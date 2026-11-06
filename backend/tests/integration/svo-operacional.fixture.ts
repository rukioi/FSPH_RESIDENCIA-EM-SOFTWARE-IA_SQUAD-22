import bcrypt from 'bcrypt';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';

export const emailAtendente = 's7-at@example.invalid';
export const usuarios = [38100, 38101, 38102, 38103, 38104] as const;
export const motoristas = [38110, 38111, 38112] as const;
export const veiculo = 38120;
export const segundoVeiculo = 38121;
export const ordens = [38141, 38142, 38143, 38144, 38145] as const;
const solicitacoes = [38131, 38132, 38133, 38134, 38135] as const;

/** Compartilha o cenário SCRUM-132/147. A senha opcional habilita login real das contas usadas pelo navegador. */
export async function prepararFixtureSvo(senhaDeTeste?: string) {
  const sql = await verifiedSql();
  try {
    const hashDeTeste = senhaDeTeste ? await bcrypt.hash(senhaDeTeste, 4) : 'invalido';
    await sql.begin(async tx => {
      await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES
        (38100,'Fixture Atendimento S7',${emailAtendente},${hashDeTeste},'ATENDENTE_SVO',TRUE),
        (38101,'Fixture Motorista S7 A','s7-a@example.invalid',${hashDeTeste},'MOTORISTA',TRUE),
        (38102,'Fixture Motorista S7 B','s7-b@example.invalid',${hashDeTeste},'MOTORISTA',TRUE),
        (38103,'Fixture Motorista S7 C','s7-c@example.invalid','invalido','MOTORISTA',TRUE),
        (38104,'Fixture ADM S7','s7-adm@example.invalid','invalido','ADM',TRUE)`;
      await tx`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES
        (38110,38101,'Condutor A','S7A38110','B','2035-12-31','DISPONIVEL'),
        (38111,38102,'Condutor B','S7B38111','B','2035-12-31','DISPONIVEL'),
        (38112,38103,'Condutor C','S7C38112','B','2035-12-31','DISPONIVEL')`;
      await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,is_svo,
        vinculo,capacidade_obitos,capacidade_passageiros) VALUES
        (${veiculo},'S7T3820','CHEVROLET','S10 TESTE',2026,'RABECÃO_SVO','DISPONIVEL',TRUE,'PROPRIO',4,2),
        (${segundoVeiculo},'S7T3821','CHEVROLET','S10 TESTE',2026,'RABECÃO_SVO','DISPONIVEL',TRUE,'PROPRIO',4,2)`;
      for(let i=0;i<5;i++){
        await tx`INSERT INTO public.solicitacao_obito (id,codigo,atendente_id,local_falecimento,endereco_remocao,
          solicitante_nome,status_triagem,triado_por_id,triado_em) VALUES
          (${solicitacoes[i]},${`#SVO-${solicitacoes[i]}`},38100,'Unidade fictícia','Rua fictícia','Pessoa fictícia',
            'CONFIRMADA_SVO',38100,CURRENT_TIMESTAMP)`;
        await tx`INSERT INTO public.ordem_coleta (id,solicitacao_obito_id,quantidade_corpos,status)
          VALUES (${ordens[i]},${solicitacoes[i]},${i===0?3:i===1?1:i===2?1:i===3?3:2},'PENDENTE_ALOCACAO')`;
      }
    });
  } catch (error) {
    // Um conflito nos IDs reservados desfaz a criação inteira, sem limpar registros de outra execução.
    await sql.end();
    throw error;
  }

  async function limpar() {
    try {
      await sql.begin(async tx => {
        await tx`DELETE FROM public.log_atividade WHERE usuario_id IN (38100,38101,38102,38103,38104)`;
        await tx`DELETE FROM public.ordem_coleta WHERE solicitacao_obito_id IN (SELECT id FROM public.solicitacao_obito WHERE atendente_id=${usuarios[0]})`;
        await tx`DELETE FROM public.solicitacao_obito WHERE atendente_id=${usuarios[0]}`;
        await tx`DELETE FROM public.veiculo WHERE id IN (38120,38121)`;
        await tx`DELETE FROM public.motorista WHERE id IN (38110,38111,38112)`;
        await tx`DELETE FROM public.usuario WHERE id IN (38100,38101,38102,38103,38104)`;
      });
    } finally {
      await sql.end();
    }
  }

  return { sql, limpar };
}
