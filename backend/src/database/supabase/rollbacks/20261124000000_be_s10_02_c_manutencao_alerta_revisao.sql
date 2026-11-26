-- Suspender o emissor e as escritas que mantêm revisões antes da reversão.
BEGIN;
SET LOCAL lock_timeout = '5s';

LOCK TABLE public.manutencao_alerta_revisao IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.notificacao IN SHARE MODE;

DO $rollback$
BEGIN
    IF EXISTS (SELECT 1 FROM public.manutencao_alerta_revisao)
       OR EXISTS (
           SELECT 1 FROM public.notificacao
           WHERE chave ~ '^manutencao:-?[0-9]+:(PREVENTIVA_PROXIMA|ATRASO):[0-9]+$'
       ) THEN
        RAISE EXCEPTION 'Rollback SCRUM-234 recusado: existem revisões ou avisos de manutenção.';
    END IF;
END
$rollback$;

DROP TABLE public.manutencao_alerta_revisao RESTRICT;

COMMIT;
