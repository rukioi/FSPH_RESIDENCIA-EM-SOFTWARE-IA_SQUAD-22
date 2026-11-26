-- Somente no banco descartável do ensaio de upgrade, após o seed T1.
INSERT INTO public.abastecimento_comprovante (abastecimento_id, nome, tipo, dados)
VALUES (-27001, 'comprovante-teste.png', 'image/png', decode('89504e470d0a1a0a01', 'hex'));

INSERT INTO public.viagem_evidencia (id, viagem_id, momento, versao, nome, tipo, dados, enviado_por_id)
VALUES (-20401, -27001, 'INICIAL', 1, 'odometro-teste.png', 'image/png', decode('89504e470d0a1a0a02', 'hex'), -27004);
