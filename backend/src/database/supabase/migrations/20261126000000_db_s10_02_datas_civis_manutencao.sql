BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.manutencao_veiculo
  DROP CONSTRAINT manutencao_veiculo_dias_check,
  ADD CONSTRAINT manutencao_veiculo_dias_check CHECK (
    CASE WHEN isfinite(entrada_em) AND isfinite(conclusao_prevista_em) THEN
      entrada_em = ((entrada_em AT TIME ZONE 'America/Maceio')::date::timestamp AT TIME ZONE 'America/Maceio')
      AND conclusao_prevista_em = ((conclusao_prevista_em AT TIME ZONE 'America/Maceio')::date::timestamp AT TIME ZONE 'America/Maceio')
      AND conclusao_prevista_em >= entrada_em
    ELSE false END
  );

ALTER TABLE public.manutencao_veiculo_historico
  DROP CONSTRAINT manutencao_veiculo_historico_dias_check,
  ADD CONSTRAINT manutencao_veiculo_historico_dias_check CHECK (
    (CASE WHEN isfinite(anterior_entrada_em) AND isfinite(anterior_conclusao_prevista_em) THEN
      anterior_entrada_em = ((anterior_entrada_em AT TIME ZONE 'America/Maceio')::date::timestamp AT TIME ZONE 'America/Maceio')
      AND anterior_conclusao_prevista_em = ((anterior_conclusao_prevista_em AT TIME ZONE 'America/Maceio')::date::timestamp AT TIME ZONE 'America/Maceio')
      AND anterior_conclusao_prevista_em >= anterior_entrada_em
    ELSE false END)
    AND (CASE WHEN isfinite(posterior_entrada_em) AND isfinite(posterior_conclusao_prevista_em) THEN
      posterior_entrada_em = ((posterior_entrada_em AT TIME ZONE 'America/Maceio')::date::timestamp AT TIME ZONE 'America/Maceio')
      AND posterior_conclusao_prevista_em = ((posterior_conclusao_prevista_em AT TIME ZONE 'America/Maceio')::date::timestamp AT TIME ZONE 'America/Maceio')
      AND posterior_conclusao_prevista_em >= posterior_entrada_em
    ELSE false END)
  );
COMMIT;
