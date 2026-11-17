-- SCRUM-179: somente contagens agregadas e sem dados pessoais ou bytes de arquivos.
-- Execute somente depois de inspect-s9-catalog.sql confirmar public.abastecimento,
-- public.veiculo e public.motorista e suas colunas exigidas pelo schema versionado.
-- O resultado e diagnostico e nao autoriza migration ou limpeza de dados.
SELECT 'abastecimentos' AS verificacao, count(*) AS total,
       count(*) FILTER (WHERE a.motorista_id IS NULL) AS sem_motorista,
       count(*) FILTER (WHERE a.quilometragem IS NULL) AS sem_quilometragem,
       count(*) FILTER (WHERE a.litragem IS NULL) AS litros_nulos,
       count(*) FILTER (WHERE a.litragem <= 0 OR a.litragem = 'NaN'::numeric) AS litros_invalidos,
       count(*) FILTER (WHERE a.valor_total IS NULL) AS valores_nulos,
       count(*) FILTER (WHERE a.valor_total <= 0 OR a.valor_total = 'NaN'::numeric) AS valores_invalidos,
       count(*) FILTER (WHERE a.quilometragem < 0) AS quilometragens_negativas,
       count(*) FILTER (WHERE a.veiculo_id IS NULL) AS sem_veiculo,
       count(*) FILTER (WHERE a.veiculo_id IS NOT NULL AND v.id IS NULL) AS veiculo_inexistente,
       count(*) FILTER (WHERE a.motorista_id IS NOT NULL AND m.id IS NULL) AS motorista_inexistente,
       count(*) FILTER (WHERE v.is_svo IS TRUE) AS veiculos_com_marcador_svo,
       count(*) FILTER (WHERE v.tipo::text = U&'RABEC\00C3O_SVO') AS veiculos_tipo_svo
FROM public.abastecimento a
LEFT JOIN public.veiculo v ON v.id=a.veiculo_id
LEFT JOIN public.motorista m ON m.id=a.motorista_id;
