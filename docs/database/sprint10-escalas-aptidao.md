# SCRUM-219 — Escalas, indisponibilidades e matriz de aptidão (DB-S10-03)

Subtarefas: SCRUM-237 (jornada, indisponibilidade e matriz) e SCRUM-238
(justificativa auditável de inativação/reativação). Bloqueia SCRUM-220/221.

Migration: `backend/src/database/supabase/migrations/20261124000100_db_s10_03_escalas_aptidao_motoristas.sql`
Rollback manual: `backend/src/database/supabase/rollbacks/20261124000100_db_s10_03_escalas_aptidao_motoristas.sql`
Prova: `backend/tests/database/escalas-aptidao-s10.test.ts`

## O que muda

Somente estruturas novas e vazias. Não há seed, backfill nem inferência a partir
de dados existentes. Permanecem intactos `status_motorista`
(DISPONIVEL, EM_VIAGEM, FOLGA, AFASTADO), `motorista.status`, `usuario.ativo`,
CNH, alocação, dashboard (`SEM_ESCALA_E_MATRIZ_CNH`) e regras SVO (RN05/RN08/RN12
conforme SCRUM-147). Nenhuma API ou tela consome as tabelas ainda.

| Tabela | Finalidade | Garantias no banco |
| --- | --- | --- |
| `escala_motorista` | Período explícito `[inicio, fim)` em que o motorista está `EM_ESCALA` ou `FORA_DE_ESCALA`, informado por um autor | FK motorista/autor; intervalo finito e não vazio; sem sobreposição entre períodos `VIGENTE` do mesmo motorista; cancelamento exige autor, instante e motivo |
| `indisponibilidade_motorista` | Ausência `FOLGA` ou `AFASTADO` (valores já existentes no contrato), `fim` nulo quando o término não foi informado | Mesmas garantias; sem campo livre, para não receber dado médico |
| `habilitacao_categoria_veiculo` | Matriz proposta categoria CNH × classe veicular, com fonte normativa e vigência em datas civis `[inicio, fim)` | Categoria A–E; classe e fonte obrigatórias; sem duplicidade de categoria, classe e início de vigência; `permitido` obrigatório |
| `motorista_transicao_profissional` | Inativação/reativação profissional append-only com motivo e autor | Versão sequencial sem lacuna (FK para a versão anterior), primeira transição sempre `INATIVACAO`, alternância obrigatória, versão única por motorista |

### Cobertura conhecida × dado ausente

- Um instante coberto por escala `VIGENTE` tem situação conhecida (`EM_ESCALA` ou `FORA_DE_ESCALA`).
- Lacuna entre períodos, ou período cancelado, é **dado ausente**: não significa folga nem disponibilidade.
- Na matriz, ausência de linha é desconhecido; `permitido = false` é vedação conhecida.
- Motorista sem transição profissional nunca foi inativado por este fluxo. Não há
  estado INATIVO no enum, e a conta (`usuario.ativo`) não é alterada.

O teste demonstra a consulta de lacunas para todo o intervalo pedido
(`tstzmultirange` menos a união dos períodos vigentes).

### Escrita permitida

RLS habilitada sem policies (nega Data API). `anon` e `authenticated` não têm
privilégio. O papel do backend (`postgres`/`service_role`) só faz `SELECT`/`INSERT`,
mais `UPDATE` restrito por coluna:

- escala/indisponibilidade: `estado`, `cancelado_por_id`, `cancelado_em`, `motivo_cancelamento` (cancelar);
- matriz: `vigencia_fim` (encerrar vigência).

Sem `DELETE`/`TRUNCATE`. A transição profissional não aceita `UPDATE`.
Limite conhecido: sem trigger (o gerador de snapshot recusa triggers), o banco não
impede que uma API futura volte um período `CANCELADA` para `VIGENTE`. A API da
SCRUM-220/221 deve permitir só a transição para `CANCELADA`.

### Sem extensões

As constraints `EXCLUDE` usam só operadores GiST nativos de range: a igualdade por
motorista é feita com `int8range` de um ponto. O backup da SCRUM-204 copia apenas os
schemas `public` e `fsph_test_harness`, então uma extensão em outro schema quebraria a
restauração (detectado pelo CI no `db:test:restore`).

## Decisões que dependem da FSPH (não implementadas)

Bloqueiam apenas as ações dependentes:

1. Regras de jornada: duração máxima, intervalos, repouso e horários padrão. Nenhum horário foi criado.
2. Precedência entre escala `EM_ESCALA` e indisponibilidade simultânea (hoje as duas coexistem; não há conflito cruzado).
3. Se ausências de tipos diferentes podem se sobrepor. Hoje são bloqueadas como duplicidade; relaxar exige nova migration.
4. Taxonomia de ausência além de FOLGA/AFASTADO e se algum motivo pode ser registrado sem dado médico.
5. Se vigências da matriz para a mesma categoria e classe podem se sobrepor (hoje só a duplicidade exata é bloqueada).
6. Classe veicular verificável. `veiculo` não tem classe: `tipo` (PASSEIO/VAN/AMBULANCIA/RABECÃO_SVO) e modelo **não** determinam CNH. Falta definir onde a classe do veículo será registrada, a política de categorias/combinações e a fonte oficial antes de povoar ou aplicar a matriz.
7. Se a inativação profissional terá estado no enum (`INATIVO`) e como impacta alocação, dashboard e conta. Hoje só existe a trilha.
8. Perfis autorizados a registrar e consultar cada tabela (RBAC das APIs).

## Rollback e recuperação

O rollback roda em transação, bloqueia as quatro tabelas e **recusa** reverter se
houver qualquer linha. Com as tabelas vazias, remove-as e devolve o esquema anterior.
O teste aplica rollback e reaplica a migration na mesma transação, comparando os
metadados e as linhas de `motorista`/`usuario`.

## Evidências

Comandos previstos, a partir da raiz:

```sh
npm run db:test:start
npm run db:test:prepare
npm run db:docs:generate
npm run db:docs:check
npm run test:db
npm run db:test:upgrade
npm run lint
npm run typecheck
npm test
npm run build
```

Ver o registro de execução no PR. O que não foi executado no harness Docker oficial
não é declarado como aprovado.
