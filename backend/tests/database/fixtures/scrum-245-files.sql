-- Somente para o banco descartável da SCRUM-245, após carregar o seed T1.
-- PNG de 1 pixel do fixture de viagem e JPEG sintético com marcadores aceitos.
WITH arquivos AS (
  SELECT decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=', 'base64') AS png,
         decode('ffd8ff00ffd9', 'hex') AS jpeg
)
INSERT INTO public.viagem_evidencia (id, viagem_id, momento, versao, nome, tipo, dados, enviado_por_id, criado_em)
SELECT v.id, v.viagem_id, v.momento, v.versao, v.nome, v.tipo, v.dados, -27004, v.criado_em
FROM arquivos
CROSS JOIN LATERAL (VALUES
  (-24501, -27001, 'INICIAL', 1, 'inicial.png', 'image/png', png, '2026-01-15 12:00:00.123456+00'::timestamptz),
  (-24502, -27001, 'INICIAL', 2, 'inicial-v2.jpg', 'image/jpeg', jpeg, '2026-01-15 12:05:00+00'),
  (-24503, -27002, 'FINAL', 1, 'final.png', 'image/png', png, '2026-01-15 13:00:00+00'),
  (-24504, -27001, 'FINAL', 1, 'invalida.png', 'image/png', decode('89504e470d0a1a0a', 'hex'), '2026-01-15 13:00:00+00'),
  (-24505, -27001, 'FINAL', 2, '../invalida.jpg', 'image/jpeg', jpeg, '2026-01-15 13:10:00+00')
) AS v(id, viagem_id, momento, versao, nome, tipo, dados, criado_em);

UPDATE public.documento_veiculo
SET arquivo_nome = 'legado.pdf', arquivo_tipo = 'application/pdf', arquivo_dados = convert_to('%PDF-fixture', 'UTF8')
WHERE id = -27001;
INSERT INTO public.documento_veiculo (id, veiculo_id, tipo_documento, data_vencimento)
VALUES (-24501, -27001, 'Documento sem arquivo', '2030-01-15');
INSERT INTO public.abastecimento_comprovante (abastecimento_id, nome, tipo, dados)
VALUES (-27001, 'legado.jpg', 'image/jpeg', decode('ffd8ff00ffd9', 'hex'));

-- Controle de um anexo documental já registrado com proveniência.
INSERT INTO public.anexo (id, nome, tipo, tamanho, sha256, dados, autor_id, criado_em, documento_veiculo_id)
SELECT -24501, 'novo.pdf', 'application/pdf', octet_length(bytes), encode(sha256(bytes), 'hex'),
  bytes, -27002, '2026-01-18 10:00:00+00', -27001
FROM (SELECT convert_to('%PDF-novo-fixture', 'UTF8') AS bytes) fixture;
INSERT INTO public.documento_historico (id, documento_veiculo_id, versao, tipo_documento, data_vencimento, anexo_id, autor_id)
VALUES (-24501, -27001, 1, 'Fixture', '2030-01-15', -24501, -27002);
