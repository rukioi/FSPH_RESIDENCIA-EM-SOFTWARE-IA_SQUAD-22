BEGIN;
SET LOCAL lock_timeout = '5s';

-- O propriet?rio pode ter revogado de si mesmo REFERENCES e ainda pode conced?-lo.
DO $fk_s10$
DECLARE
    conceder_temporariamente boolean := NOT has_column_privilege(
        'postgres', 'public.manutencao_veiculo', 'id', 'REFERENCES'
    ) AND current_user = 'postgres';
BEGIN
    IF conceder_temporariamente THEN
        GRANT REFERENCES (id) ON TABLE public.manutencao_veiculo TO postgres;
    END IF;

    CREATE TABLE public.manutencao_alerta_revisao (
        manutencao_id bigint NOT NULL,
        alerta text NOT NULL,
        revisao bigint NOT NULL DEFAULT 1,
        CONSTRAINT manutencao_alerta_revisao_pk PRIMARY KEY (manutencao_id, alerta),
        CONSTRAINT manutencao_alerta_revisao_manutencao_fk
            FOREIGN KEY (manutencao_id) REFERENCES public.manutencao_veiculo (id) ON DELETE RESTRICT,
        CONSTRAINT manutencao_alerta_revisao_alerta_check CHECK (alerta IN ('PREVENTIVA_PROXIMA', 'ATRASO')),
        CONSTRAINT manutencao_alerta_revisao_revisao_check CHECK (revisao > 0)
    );

    IF conceder_temporariamente THEN
        REVOKE REFERENCES (id) ON TABLE public.manutencao_veiculo FROM postgres;
    END IF;
END
$fk_s10$;

ALTER TABLE public.manutencao_alerta_revisao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.manutencao_alerta_revisao
    FROM PUBLIC, anon, authenticated, service_role, postgres;
-- Papel do runtime local, com BYPASSRLS no harness. Confirmar a identidade no rollout.
GRANT SELECT, INSERT, UPDATE ON TABLE public.manutencao_alerta_revisao TO postgres;

COMMIT;
