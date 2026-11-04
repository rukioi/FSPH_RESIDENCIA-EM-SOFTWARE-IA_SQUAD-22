# SCRUM-129 — Inventário e validação do modelo SVO (AS-IS × TO-BE)

> Estado: inventário técnico concluído; decisões e implementações distribuídas por subtasks. A revisão da SCRUM-129 valida o levantamento e a matriz de responsabilidades, sem declarar as funcionalidades operacionais prontas.  
> Recorte: 04/11/2026. **Auditoria exclusivamente de leitura** no Supabase conectado; nenhuma DDL, DML, seed, alteração de RLS, migration, deploy ou teste destrutivo foi executado.  
> Jira: [SCRUM-129](https://unit-tiradentes.atlassian.net/browse/SCRUM-129) · Pai: SCRUM-125 · Banco: SCRUM-162 · Próxima implementação: SCRUM-130/131/132/145/147.

## 1. Fontes e escopo

- Catálogo PostgreSQL **remoto** do projeto Supabase conectado: `information_schema.columns`, `pg_constraint`, `pg_indexes`, `pg_enum`, `pg_roles`, `pg_policies` e metadados de migrations. Foram consultados nomes/tipos/constraints, indicadores agregados e contagens, **não** dados pessoais.
- Repositório, branch `main`: `backend/src/database/supabase/migrations/20261030000000_baseline.sql`, `backend/src/database/supabase/migrations/20261103000000_db_s7_01_svo_triagem.sql`, `docs/database/schema.sql`, `backend/src/modules/svo/{svo.repository.ts,svo.controller.ts,svo.routes.ts,svo.schemas.ts}`, `docs/{permissoes.md,seguranca.md,api/README.md,database/README.md}`.
- Critérios de aceite, RF/RN/RNF e referência ao DVP: **conforme descritos no Jira SCRUM-129 e SCRUM-162**. A documentação original de requisitos/DVP não foi revalidada de modo independente neste levantamento.
- **Limite da tarefa:** análise/decisões de domínio, não implementar migrations. O SQL incremental e seus testes são responsabilidade da SCRUM-162; as APIs e regras transacionais pertencem às tarefas BE correspondentes.

## 2. Situação atual comprovada no Supabase remoto

| Entidade | Campos/relações e integridade observados | Lacunas para BL26–BL28 |
| --- | --- | --- |
| `solicitacao_obito` | `id` PK; `codigo` UNIQUE, NOT NULL; `atendente_id` FK → `usuario.id` (nullable); `nome_falecido`, `local_falecimento`, `endereco_remocao`, `solicitante_nome`, `solicitante_parentesco`, `solicitante_telefone`, `observacoes_medicas`, `criado_em` | **Sem** `status_triagem`, `canal_atendimento`, `ponto_referencia`, `triado_por_id`, `triado_em` e `triagem_observacoes`. Não registra decisão SVO/IML. |
| `ordem_coleta` | `id` PK; `solicitacao_obito_id` FK **UNIQUE** (nullable); `veiculo_id`/ `motorista_id` FKs; km, fotos, datas, `validada_por_svo`, `status` | UNIQUE já limita a **no máximo uma ordem por solicitação com ID não nulo**, mas não prova que houve triagem SVO; `quantidade_corpos` ausente; FK nullable não garante vinculação de toda ordem. |
| `veiculo` | `id` PK, `placa` UNIQUE, `tipo`, `is_svo` (default false), `capacidade_obitos` (default 0), `status`, `quilometragem_atual`, demais dados de frota | `capacidade_obitos` é capacidade nominal; **não há ocupação simultânea comprovada** nem demonstração de 3 S10 cadastradas/capacidade 4 por cada. Não assumir que cada ordem corresponda a 1 corpo. |
| `motorista` | `id` PK, `usuario_id` FK/UNIQUE, CNH UNIQUE, validade/categoria CNH, status, CPF e telefone | Autorização para conduzir vários veículos/escala SVO e transições de disponibilidade exigem validação com tarefas de frota/RBAC. |
| `usuario` | `id` PK, `email` UNIQUE, `perfil` enum, `ativo`, autenticação por senha hash | Existe `ATENDENTE_SVO`, mas **não** `EQUIPE_SVO`/Logística no enum atual; não criar perfil nem dar fallback administrativo sem homologação. População **não** é usuária interna. |
| `log_atividade` | `id` PK, `usuario_id` FK, `descricao`, `data_hora`, `solicitacao_viagem_id` FK | Não há FK própria para ocorrência/ordem SVO; modelo de rastreabilidade por recurso/ação deve ser pactuado com auditoria, sem duplicação. |

Outras constatações do catálogo remoto:

- `status_ordem_coleta`: `PENDENTE_ALOCACAO`, `EM_DESLOCAMENTO`, `EM_TRANSPORTE`, `CONCLUIDA`, `CANCELADA`. **É estado da ordem, não da triagem.**
- `perfil_usuario`: `ADM`, `GESTOR_FROTA`, `SOLICITANTE_INTERNO`, `MOTORISTA`, `ATENDENTE_SVO`.
- Índices/constraints relevantes: `solicitacao_obito_codigo_key` UNIQUE; `ordem_coleta_solicitacao_obito_id_key` UNIQUE; FKs `ordem_coleta_solicitacao_obito_id_fkey`, `ordem_coleta_veiculo_id_fkey`, `ordem_coleta_motorista_id_fkey`, `solicitacao_obito_atendente_id_fkey`. Índices compostos por triagem/tempo e por veículo/status ainda não aparecem no remoto.
- Contagens agregadas no instante do levantamento: **3** linhas em `solicitacao_obito` e **2** em `ordem_coleta`. Nenhuma identificação pessoal foi copiada.
- O Supabase reportou **lista de migrations vazia**, a tabela `supabase_migrations.schema_migrations` não foi encontrada, e **não existem** `public.status_triagem_svo`, `solicitacao_obito.status_triagem` ou `ordem_coleta.quantidade_corpos` no remoto.

### 2.1 Segurança: estado observado ≠ homologação

As **10 tabelas públicas** estão com RLS habilitado, porém **0 políticas** nas tabelas verificadas; `anon` e `authenticated` não possuem `BYPASSRLS`, enquanto `postgres` e `service_role` possuem. A efetividade depende também de grants, role utilizada pela API e exposição da Data API. **RLS ativado não prova segregação de acesso de ponta a ponta**. Não criar políticas permissivas de `USING (true)` como atalho.

O snapshot da baseline versionada reproduz RLS desligado e grants amplos de origem. Não reaplicar a baseline em banco compartilhado já existente. Planejar auditoria de RLS/ACL/runtime no escopo de segurança apropriado (SCRUM-205), com homologação, backup e rollback.

## 3. Diferenças entre migração versionada e remoto

A migration da [SCRUM-162](../../backend/src/database/supabase/migrations/20261103000000_db_s7_01_svo_triagem.sql) **está no GitHub**, mas **não está aplicada no Supabase remoto**. Ela define:

| Campo / estrutura | Proposta versionada na SCRUM-162 | Remoto observado |
| --- | --- | --- |
| `status_triagem` | Enum `AGUARDANDO_TRIAGEM`, `CONFIRMADA_SVO`, `ENCAMINHADA_IML`; default para novos registros | Ausente |
| `canal_atendimento` | `varchar(20)`, default `TELEFONE`, CHECK | Ausente |
| `ponto_referencia` | `varchar(255)` opcional | Ausente |
| `triagem_observacoes` | `text` opcional | Ausente |
| `triado_por_id` | FK → `usuario.id`, exigida para decisões finais | Ausente |
| `triado_em` | Timestamp exigido para decisões finais | Ausente |
| `ordem_coleta.quantidade_corpos` | `smallint` nullable e CHECK 1–4; **sem default** para evitar contagem fictícia de legado | Ausente |
| Índices operacionais | `solicitacao_obito_triagem_criado_idx`, `ordem_coleta_veiculo_status_idx` | Ausentes |

**Preservação do legado:** a migration não transforma registros antigos em `CONFIRMADA_SVO` e não inventa sua quantidade de corpos. Uma ordem preexistente não é prova de triagem. Exige conciliação autorizada antes de qualquer migração remota.

**Semântica:** os checks por registro da migration não implementam por si só (i) a garantia de que ordens só são criadas após decisão `CONFIRMADA_SVO`, nem (ii) ocupação agregada máxima de 4 corpos por veículo sob concorrência. Esses são trabalhos transacionais da SCRUM-131 e SCRUM-147, acompanhados por testes no banco isolado.

## 4. Estado do código da aplicação

- `POST /api/svo/solicitacoes`: `criarSolicitacao()` em `svo.repository.ts` insere **solicitação e ordem na mesma transação**, antes de haver etapa de triagem. Registra atividade `solicitacao_confirmada` imediatamente. Isso **contraria RN06/RN07** e requer refatoração na SCRUM-130/131.
- `GET /api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO` consulta ordens com status real `PENDENTE_ALOCACAO`; a correspondência é de filtro de interface, não um enum adicional.
- O controller de cadastro valida obrigatórios `localFalecimento`, `enderecoRemocao` e `solicitanteNome` e opcionais legados, mas **não recebe** canal, referência, triagem ou quantidade. `atendenteId` vem da sessão na rota, corretamente; a população não autentica.
- O despacho atual protege a mesma ordem com `FOR UPDATE` e verifica recursos, mas **não contabiliza quantidade/ocupação agregada por S10**, nem valida autorização de equipe SVO específica.
- A rota atual exige `ATENDENTE_SVO`; permissões de equipe de coleta/RBAC por recurso precisam de SCRUM-145 e homologação.

## 5. Proposta de modelo TO-BE para validação com o squad

```text
Atendimento telefônico pela população (sem usuário/login)
    ↓
ATENDENTE_SVO autenticado registra solicitacao_obito
    id + codigo + atendente_id + canal_atendimento
    + dados mínimos do falecimento/solicitante
    + status_triagem = AGUARDANDO_TRIAGEM
    ↓
Triagem por perfil autorizado (registrar responsável e instante)
    ├── ENCAMINHADA_IML → nenhuma ordem de coleta SVO
    └── CONFIRMADA_SVO → criar 1 ordem vinculada (transação atômica)
             ↓
       PENDENTE_ALOCACAO → alocação de equipe/motorista/S10
             ↓
       EM_DESLOCAMENTO → EM_TRANSPORTE → CONCLUIDA
             ↘ CANCELADA (motivos/efeitos de lotação a homologar)
```

**Cardinalidades propostas (não homologadas):**

- `usuario (atendente)` **1 → N** `solicitacao_obito`; o campo FK já existe, porém nullable no legado.
- `solicitacao_obito` **1 → 0..1** `ordem_coleta` (somente se confirmada SVO). A UNIQUE já existe; a regra condicional deve ser transacional e auditável.
- `ordem_coleta` → `veiculo/motorista` opcionais até o despacho, conforme disponibilidade e RBAC.
- `ordem_coleta.quantidade_corpos`: declarar a cardinalidade real **1–4** na ordem nova se pactuada; a ocupação deve refletir a **soma das quantidades ainda a bordo/reservadas** conforme eventos de execução aprovados, não o número de ordens.
- `veiculo.is_svo` identifica veículo SVO, mas a frota real de 3 S10 e a capacidade 4 de cada uma devem ser validadas em cadastro e regra. Não inferir ocupação a partir de `capacidade_obitos`.

### 5.1 Dados pessoais: MVP e aprovação

| Informação | Decisão técnica proposta | Dependência |
| --- | --- | --- |
| Código, atendente autenticado, data/hora | Manter obrigatórios no fluxo de criação; não permitir `atendenteId` fornecido pelo cliente | BL26/RN02 |
| Identificação e local do falecimento, endereço de remoção | Preservar obrigatórios já implementados; confirmar condições excepcionais com PO | RF15/RF16 |
| Solicitante: nome, parentesco, contato | Manter campos já existentes e revisar obrigatoriedade; coletar somente para finalidade documentada | LGPD/RNF08/RNF09 |
| Canal telefônico, ponto de referência | Usar campos da SCRUM-162 e confirmar contrato HTTP | RN02 |
| CPF e nascimento do solicitante | **Fora do MVP até justificativa, necessidade e autorização formal** | LGPD/PO |
| Observações médicas e triagem | Proteger como dados potencialmente sensíveis; restringir leitura e auditoria | RNF08/RNF14–16 |
| Número de corpos e ocupação | Informar fonte/procedimento e instante de entrada/saída; **nunca deduzir = 1** | DVP §6.2 / SCRUM-147 |

## 6. Decisões de domínio e critérios de encaminhamento

1. **Triagem:** homologar nomes/estados `AGUARDANDO_TRIAGEM`, `CONFIRMADA_SVO`, `ENCAMINHADA_IML`; quem pode decidir/reverter e com qual justificativa. Nunca reutilizar `status_ordem_coleta` para triagem.
2. **Quantidade e lotação:** validar entrada de `quantidade_corpos`, regras de reserva versus embarque/desembarque, transferência, cancelamento, conclusão, múltiplas ordens e atomicidade sob concorrência. Testar 3/4 → 4/4 → rejeição de quinto corpo.
3. **Equipe SVO:** definir identidades/perfis, vínculo com ordens, operações por recurso e relação com `MOTORISTA`; não ampliar permissões por fallback.
4. **LGPD:** confirmar mínimos do formulário, campos sensíveis, acesso/retensão e necessidade de CPF/data de nascimento.
5. **Migração do remoto:** reconhecer divergência entre snapshot/migration local e DB remoto; validar backup e restauração, histórico de migrations, linhas legadas e plano incremental com responsável pelo banco. **Não executar `db push`, `db reset`, baseline ou seed no compartilhado.**
6. **RLS/ACL:** auditar roles reais do runtime, exposição da Data API, políticas por recurso e grants. Não confundir habilitar RLS com segurança já validada.

## 7. Critérios de aceite e evidências

| Critério SCRUM-129 | Evidência/status |
| --- | --- |
| AS-IS × TO-BE por entidade, FK, status e RBAC | **Mapeado** neste documento, com referência ao schema remoto e à migration local. |
| Identificação dos bloqueios e decisões de domínio | **Mapeados e atribuídos** por responsável (seções 6 e 8); revisões de negócio específicas permanecem nos itens executores. |
| Triagem antes de ordem; IML sem ordem; solicitação 0..1 ordem | **Modelo proposto**, migration local parcial; backend atual **não atende**. Implementar/testar em SCRUM-130/131. |
| Lotação física máxima S10 sob concorrência | **Não implementada** no backend atual; somente faixa 1–4 por ordem na migration local. SCRUM-147. |
| Migrations/rollback/testes isolados caso haja alteração de banco | **Fora do escopo de implementação desta SCRUM-129**, atribuídos à SCRUM-162. Não foram executados nesta auditoria. |
| Testes lint/typecheck/test/build/DB | **Não executados nesta auditoria** (documentação somente; não alegar aprovação de checks). |

### Validações executadas (somente leitura)

- Colunas e constraints das seis entidades; FKs, UNIQUE, CHECK, enums e índices do catálogo remoto.
- Presença de `status_triagem` e `quantidade_corpos` no remoto: **ausentes**.
- Histórico de migrations do remoto: **vazio/não encontrado**.
- RLS: **10/10** tabelas públicas habilitadas, **0** políticas no catálogo; verificação de `BYPASSRLS` por papel.
- Contagens sem PII: **3 solicitações** e **2 ordens** no momento do levantamento.

### Encaminhamento

Revisar e aceitar o inventário e as decisões técnicas nesta SCRUM-129; cada implementação especializada conserva seus próprios testes, critérios de aceite e eventual validação de negócio. A SCRUM-162 está **Concluída no Jira e versionada no GitHub**, mas isso **não significa aplicada no Supabase remoto**. Não bloquear a preparação isolada da SCRUM-130 por falta de deploy remoto; manter testes de integração e homologação em ambiente controlado. **Não encerrar a SCRUM-129 automaticamente sem aceitação da equipe.**


## 8. Fechamento de escopo por subtask — matriz de pendências

**Regra de responsabilidade do squad:** uma lacuna não deve ficar sem responsável nem ser implementada duas vezes. A SCRUM-129 resolve **análise de schema e definição do contrato de domínio com base documental**; mudanças executáveis de schema pertencem à SCRUM-162; API, segurança e regras transacionais aos tickets indicados abaixo. Somente incorporar código à 129 quando a mudança for necessária ao aceite de mapeamento e **não existir task especializada**. Não alterar migrations já aplicadas nem o banco remoto diretamente.

| Questão identificada | Conclusão técnica verificável nesta SCRUM-129 | Implementação / aceite final |
| --- | --- | --- |
| Tabelas `solicitacao_obito` e `ordem_coleta` | **Fechado:** ambas existem no remoto, com PK, FKs, UNIQUE de `codigo` e de `ordem_coleta.solicitacao_obito_id`. Inventário de outras quatro tabelas relacionadas registrado. | Nenhuma alteração de banco necessária para apenas provar existência. |
| Cardinalidade solicitação/ordem | **Fechado:** modelo `solicitacao_obito (1) → (0..1) ordem_coleta`; UNIQUE existente garante no máximo uma ordem por ocorrência com FK preenchida. **Não** garante decisão SVO válida. | SCRUM-131 cria ordem apenas em decisão `CONFIRMADA_SVO`, na mesma transação, com auditoria e testes concorrentes. SCRUM-162 já preserva UNIQUE. |
| Status de triagem | **Fechado como contrato técnico versionado:** `AGUARDANDO_TRIAGEM`, `CONFIRMADA_SVO`, `ENCAMINHADA_IML` são os nomes no SQL da SCRUM-162. Rascunho segue pendente, sem ordem. IML nunca gera ordem. Esses estados não substituem `status_ordem_coleta`. | SCRUM-131 implementa salvar rascunho e decisão final; procedimentos de revisão/correção de decisão devem ser aprovados na própria 131 caso necessários. |
| Estado inicial e canal | **Fechado:** atendimento da população é telefônico, sem login externo; `atendente_id` deriva da sessão do `ATENDENTE_SVO`, com protocolo `codigo` e `criado_em`. SQL da SCRUM-162 prevê default de triagem aguardando e `canal_atendimento = TELEFONE` apenas nos **novos** registros. | SCRUM-130 implementa POST e DTO de ocorrência; SCRUM-162 suporta schema local versionado. |
| Dados cadastrais / LGPD | **Fechado para o MVP técnico:** reusar nome/contato/parentesco e localização já previstos, com minimização. Não adicionar CPF/data de nascimento do solicitante por inferência. Observações médicas e de triagem exigem proteção e finalidade de acesso. | SCRUM-130 valida campos e contrato, SCRUM-145 protege acesso; retenção/ACL/RLS é SCRUM-205. Se PO exigir CPF/nascimento, registrar autorização e criar mudança versionada específica (sem implementar silenciosamente na 129). |
| Dados de decisão e referência | **Fechado:** decisão final registra resultado, responsável (`triado_por_id`), instante (`triado_em`) e observação; retorno IML não recebe `ordem_coleta`. | Migration já elaborada em SCRUM-162 para banco isolado; comportamento e rollback transacional em SCRUM-131; leitura de detalhe/rascunho em SCRUM-146. |
| Quantidade de corpos por ordem | **Fechado como estrutura mínima:** um registro de ordem **não equivale necessariamente a um corpo**; `quantidade_corpos` é explícita (1–4) na migration versionada, e legado fica NULL até conciliação. Não atribuir default 1 fictício. | SCRUM-147 define exatamente quando reserva, ocupa e libera vagas, com fonte operacional validada no domínio; SCRUM-148 informa execução; SCRUM-162 suporta a coluna/constraint local. |
| Três S10 / capacidade | **Fechado:** o tipo operacional é S10 para coleta, capacidade física máxima **4 por veículo** conforme referência do Jira/DVP; `veiculo.is_svo` e `capacidade_obitos` não comprovam ocupação atual, nem três veículos efetivamente cadastrados. | SCRUM-147 valida frota real, regras/locks e soma de `quantidade_corpos`; SCRUM-132 consulta elegibilidade e realiza despacho. |
| Equipe SVO / RBAC | **Fechado como inventário:** enum remoto inclui `ATENDENTE_SVO`, mas não `EQUIPE_SVO`; a população não tem conta. Sem fallback para ADM nem permissões definidas pelo frontend. | SCRUM-145 decide e implementa matriz por operação/vínculo, incluindo eventual mudança de enum **versionada** sob governança do banco. |
| Eventos/auditoria | **Fechado:** `log_atividade` existe, mas não tem FK específica de ocorrência/ordem; eventos precisam referenciar o recurso sem expor dados sensíveis. | SCRUM-131 (decisão/ordem), SCRUM-148 (execução), SCRUM-146 (histórico), SCRUM-205 (retenção/integridade). |
| Banco remoto × versionado | **Fechado:** migration SCRUM-162 existe no GitHub, mas não no remoto; remoto sem `status_triagem`, `quantidade_corpos` e histórico de migrations. **Isso não é bloqueio para desenvolver localmente** nem autorização para aplicar baseline. | Equipe de DB / SCRUM-162 e homologação de rollout (SCRUM-208): conciliar histórico, preservar linhas legadas, aprovar janela, backup, rollback e executar **apenas após autorização explícita**. |
| Segurança do Supabase | **Fechado como verificação:** 10/10 tabelas com RLS ativo e 0 policies; papéis privilegiados podem contornar RLS. Habilitação não prova proteção efetiva do backend nem Data API. | SCRUM-205: auditoria RLS, ACL, runtime DB role, policies e testes de acesso. **Não** abrir `USING (true)` nem desligar RLS para testes. |
| Listas e painel | **Fechado:** nenhuma implementação de dashboard/listagem deve ser interpretada a partir do mock Lovable. | SCRUM-146: filtros/detalhes/históricos; SCRUM-149: indicadores; FE SCRUM-133/135/150/152 consomem contratos reais. |
| Despacho e conclusão | **Fechado:** `status_ordem_coleta` atual listado na seção 2. Fluxo SVO de ponta a ponta não está implementado. | SCRUM-132: elegibilidade e despacho; SCRUM-148: execução, cancelamento e conclusão; SCRUM-147: liberação/concorrência. |

### 8.1 O que permanece para **revisão da própria SCRUM-129**

- [x] Verificar a existência das entidades SVO e a estrutura do Supabase remoto.
- [x] Inventariar colunas, tipos, enums, PK/FK, UNIQUE e índices relevantes.
- [x] Documentar divergências entre schema remoto, migration versionada, código e regras do Jira.
- [x] Definir mapa mínimo SVO/IML e 0..1 ordem **sem assumir comportamento já implementado**.
- [x] Identificar responsáveis pelos itens executáveis e evitar duplicação entre subtasks.
- [ ] **Aprovação do mapeamento e da matriz de encaminhamento pela equipe/PO** (etapa de governança, não lacuna de implementação da 129).

### 8.2 Limites de aceite de cada execução subsequente

A revisão da SCRUM-129 **não** substitui execução de testes nem prova que BL26–BL28 já funcionam. Migrations locais/rollback e checks DB são evidências da SCRUM-162; cadastro real é SCRUM-130; transição SVO/IML e idempotência são SCRUM-131; RBAC, lotação, despacho e execução permanecem nos tickets próprios. Não declarar deploy remoto, e2e, performance ou critérios de integração como aprovados antes de execução efetiva. Não alterar o estado da task Jira sem aceite do responsável.
