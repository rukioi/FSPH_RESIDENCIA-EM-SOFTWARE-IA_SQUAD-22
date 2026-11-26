-- Executado em uma transação que já possui a lista de evidências validadas.
LOCK TABLE public.viagem_evidencia_anexo_piloto IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  origem public.viagem_evidencia%ROWTYPE;
  novo_anexo_id bigint;
BEGIN
  FOR origem IN
    SELECT e.* FROM public.viagem_evidencia AS e
    JOIN pg_temp.scrum245_elegiveis AS f ON f.id = e.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.viagem_evidencia_anexo_piloto p WHERE p.evidencia_id = e.id
    )
    ORDER BY e.id
  LOOP
    INSERT INTO public.anexo (nome, tipo, tamanho, sha256, dados, autor_id, criado_em, viagem_id)
    VALUES (origem.nome, origem.tipo, octet_length(origem.dados), encode(sha256(origem.dados), 'hex'),
      origem.dados, origem.enviado_por_id, origem.criado_em, origem.viagem_id)
    RETURNING id INTO novo_anexo_id;

    INSERT INTO public.viagem_evidencia_anexo_piloto (evidencia_id, viagem_id, anexo_id)
    VALUES (origem.id, origem.viagem_id, novo_anexo_id);
  END LOOP;
END $$;
