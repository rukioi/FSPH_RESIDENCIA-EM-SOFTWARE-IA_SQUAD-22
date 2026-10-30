-- T1 (#27): somente fixtures artificiais. Senha de teste: T1-fixture-2026!
-- IDs negativos reservados [-27099, -27001]; sequências positivas ficam intactas.
INSERT INTO public.usuario (id, nome, email, senha_hash, perfil, ativo, criado_em) VALUES
  (-27001, 'Fixture T1 ADM', 't1-adm@example.invalid', '$2b$04$012345678901234567890ud3r6X1HYs9VFiLfPc00.TiAFIElDz1a', 'ADM', true, '2026-01-15 12:00:00'),
  (-27002, 'Fixture T1 GESTOR_FROTA', 't1-gestor_frota@example.invalid', '$2b$04$012345678901234567890ud3r6X1HYs9VFiLfPc00.TiAFIElDz1a', 'GESTOR_FROTA', true, '2026-01-15 12:00:00'),
  (-27003, 'Fixture T1 SOLICITANTE_INTERNO', 't1-solicitante_interno@example.invalid', '$2b$04$012345678901234567890ud3r6X1HYs9VFiLfPc00.TiAFIElDz1a', 'SOLICITANTE_INTERNO', true, '2026-01-15 12:00:00'),
  (-27004, 'Fixture T1 MOTORISTA', 't1-motorista@example.invalid', '$2b$04$012345678901234567890ud3r6X1HYs9VFiLfPc00.TiAFIElDz1a', 'MOTORISTA', true, '2026-01-15 12:00:00'),
  (-27005, 'Fixture T1 ATENDENTE_SVO', 't1-atendente_svo@example.invalid', '$2b$04$012345678901234567890ud3r6X1HYs9VFiLfPc00.TiAFIElDz1a', 'ATENDENTE_SVO', true, '2026-01-15 12:00:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.motorista (id, usuario_id, nome, cnh, categoria_cnh, validade_cnh, status, criado_em, cpf, telefone) VALUES
  (-27001, -27004, 'Motorista fictício T1 0', 'T1-CNH-0', 'D', '2030-01-15', 'DISPONIVEL', '2026-01-15 12:00:00', 'T1-CPF-0', '00000000000'),
  (-27002, NULL, 'Motorista fictício T1 1', 'T1-CNH-1', 'D', '2030-01-15', 'EM_VIAGEM', '2026-01-15 12:00:00', 'T1-CPF-1', '00000000000'),
  (-27003, NULL, 'Motorista fictício T1 2', 'T1-CNH-2', 'D', '2030-01-15', 'FOLGA', '2026-01-15 12:00:00', 'T1-CPF-2', '00000000000'),
  (-27004, NULL, 'Motorista fictício T1 3', 'T1-CNH-3', 'D', '2030-01-15', 'AFASTADO', '2026-01-15 12:00:00', 'T1-CPF-3', '00000000000')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.veiculo (id, placa, modelo, marca, ano, tipo, capacidade_obitos, quilometragem_atual, status, is_svo, criado_em, capacidade_passageiros, vinculo, fornecedor_locacao) VALUES
  (-27001, 'T1F0000', 'Veículo fictício 0', 'Fixture', 2026, 'PASSEIO', 0, 1000, 'DISPONIVEL', false, '2026-01-15 12:00:00', 5, 'PROPRIO', NULL),
  (-27002, 'T1F0001', 'Veículo fictício 1', 'Fixture', 2026, 'VAN', 0, 1000, 'EM_VIAGEM', false, '2026-01-15 12:00:00', 5, 'LOCADO', 'Fornecedor fictício'),
  (-27003, 'T1F0002', 'Veículo fictício 2', 'Fixture', 2026, 'AMBULANCIA', 0, 1000, 'EM_MANUTENCAO', false, '2026-01-15 12:00:00', 5, 'PROPRIO', NULL),
  (-27004, 'T1F0003', 'Veículo fictício 3', 'Fixture', 2026, 'RABECÃO_SVO', 2, 1000, 'INDISPONIVEL', true, '2026-01-15 12:00:00', 5, 'LOCADO', 'Fornecedor fictício')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitacao_viagem (id, codigo, solicitante_id, origem, destino, data_hora_saida, qtd_passageiros, status, criado_em, veiculo_id, motorista_id) VALUES
  (-27001, 'T1-V-0', -27003, 'Origem fictícia', 'Destino fictício', '2026-01-15 12:00:00', 1, 'PENDENTE', '2026-01-15 12:00:00', -27001, -27001),
  (-27002, 'T1-V-1', -27003, 'Origem fictícia', 'Destino fictício', '2026-01-15 12:00:00', 1, 'AGENDADA', '2026-01-15 12:00:00', -27002, -27002),
  (-27003, 'T1-V-2', -27003, 'Origem fictícia', 'Destino fictício', '2026-01-15 12:00:00', 1, 'PRONTA_PARA_INICIAR', '2026-01-15 12:00:00', -27003, -27003),
  (-27004, 'T1-V-3', -27003, 'Origem fictícia', 'Destino fictício', '2026-01-15 12:00:00', 1, 'EM_ANDAMENTO', '2026-01-15 12:00:00', -27004, -27004),
  (-27005, 'T1-V-4', -27003, 'Origem fictícia', 'Destino fictício', '2026-01-15 12:00:00', 1, 'CONCLUIDA', '2026-01-15 12:00:00', -27001, -27001),
  (-27006, 'T1-V-5', -27003, 'Origem fictícia', 'Destino fictício', '2026-01-15 12:00:00', 1, 'REPROVADA', '2026-01-15 12:00:00', -27002, -27002)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.viagem (id, solicitacao_id, veiculo_id, motorista_id, km_inicial, km_final, data_inicio, data_fim, validada_por_gestor, status) VALUES
  (-27001, -27001, -27001, -27001, 1000, 1010, '2026-01-15 12:00:00', '2026-01-15 13:00:00', false, 'AGENDADA'),
  (-27002, -27002, -27002, -27002, 1000, 1010, '2026-01-15 12:00:00', '2026-01-15 13:00:00', false, 'EM_TRANSPORTE'),
  (-27003, -27003, -27003, -27003, 1000, 1010, '2026-01-15 12:00:00', '2026-01-15 13:00:00', false, 'CONCLUIDA'),
  (-27004, -27004, -27004, -27004, 1000, 1010, '2026-01-15 12:00:00', '2026-01-15 13:00:00', false, 'CANCELADA')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.solicitacao_obito (id, codigo, atendente_id, nome_falecido, local_falecimento, endereco_remocao, solicitante_nome, criado_em) VALUES
  (-27001, 'T1-O-0', -27005, 'Pessoa fictícia', 'Local fictício', 'Endereço fictício', 'Solicitante fictício', '2026-01-15 12:00:00'),
  (-27002, 'T1-O-1', -27005, 'Pessoa fictícia', 'Local fictício', 'Endereço fictício', 'Solicitante fictício', '2026-01-15 12:00:00'),
  (-27003, 'T1-O-2', -27005, 'Pessoa fictícia', 'Local fictício', 'Endereço fictício', 'Solicitante fictício', '2026-01-15 12:00:00'),
  (-27004, 'T1-O-3', -27005, 'Pessoa fictícia', 'Local fictício', 'Endereço fictício', 'Solicitante fictício', '2026-01-15 12:00:00'),
  (-27005, 'T1-O-4', -27005, 'Pessoa fictícia', 'Local fictício', 'Endereço fictício', 'Solicitante fictício', '2026-01-15 12:00:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ordem_coleta (id, solicitacao_obito_id, veiculo_id, motorista_id, km_inicial, km_final, data_inicio, data_fim, validada_por_svo, status) VALUES
  (-27001, -27001, -27004, -27001, 1000, 1010, '2026-01-15 12:00:00', '2026-01-15 13:00:00', false, 'PENDENTE_ALOCACAO'),
  (-27002, -27002, -27004, -27002, 1000, 1010, '2026-01-15 12:00:00', '2026-01-15 13:00:00', false, 'EM_DESLOCAMENTO'),
  (-27003, -27003, -27004, -27003, 1000, 1010, '2026-01-15 12:00:00', '2026-01-15 13:00:00', false, 'EM_TRANSPORTE'),
  (-27004, -27004, -27004, -27004, 1000, 1010, '2026-01-15 12:00:00', '2026-01-15 13:00:00', false, 'CONCLUIDA'),
  (-27005, -27005, -27004, -27001, 1000, 1010, '2026-01-15 12:00:00', '2026-01-15 13:00:00', false, 'CANCELADA')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.documento_veiculo (id, veiculo_id, tipo_documento, data_vencimento, status_regular, arquivo_dados, arquivo_nome, arquivo_tipo) VALUES
  (-27001, -27001, 'Fixture', '2030-01-15', true, '\\x5431'::bytea, 'fixture.txt', 'text/plain')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.abastecimento (id, veiculo_id, motorista_id, litragem, valor_total, quilometragem, data_abastecimento, criado_em, posto) VALUES
  (-27001, -27001, -27001, 10.50, 63.00, 1000, '2026-01-15', '2026-01-15 12:00:00', 'Posto fictício')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.log_atividade (id, usuario_id, descricao, data_hora) VALUES
  (-27001, -27001, 'Fixture sintética T1', '2026-01-15 12:00:00')
ON CONFLICT (id) DO NOTHING;
