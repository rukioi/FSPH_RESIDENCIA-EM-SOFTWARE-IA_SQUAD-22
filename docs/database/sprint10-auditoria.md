# Auditoria SQL da SCRUM-205

```sh
npm run db:test:start
npm run db:test:prepare
npm run db:test:audit
npm run db:docs:check
npm run test:db
npm test
```

O ensaio exige a identidade do PostgreSQL Docker e o marcador do harness. Ele registra RLS, FORCE RLS, quantidade de políticas, proprietário, privilégios de tabela/coluna e ACLs padrão para os papéis de interesse. Registra separadamente os atributos de cada papel SQL. Os papéis da aplicação são resolvidos pelo backend com base na sessão e no usuário ativo. O código do produto usa o pool PostgreSQL no backend e a API própria no frontend. A integração de fotos de veículos com Storage também passa pelo backend.

## Acesso, integridade e evidências existentes

| Controle | Evidência automatizada |
| --- | --- |
| Sessão JWT, perfil atual e desativação | `backend/tests/integration/usuarios-sessao.test.ts` |
| ACL candidata, negação real de acesso SQL e retorno transacional | `backend/tests/security/direct-data-access.test.ts` |
| Anexos protegidos por recurso e preservação dos bytes | `backend/tests/integration/anexos-s9.test.ts` e `backend/tests/integration/abastecimentos-anexos-s9.test.ts` |
| Agendamentos simultâneos para o mesmo recurso | `backend/tests/integration/solicitacoes-http.test.ts` |
| Duas confirmações simultâneas da mesma ocorrência | `backend/tests/integration/svo-triagem.test.ts` |
| Despachos simultâneos e limite de quatro corpos | `backend/tests/integration/svo-operacional.test.ts` |
| Finalizações concorrentes, rollback de upload, nova tentativa, bytes e auditoria | `backend/tests/integration/viagens-execucao-http.test.ts` |
| Acesso à trilha apenas por ADM e rollback se a gravação da atividade falhar | `backend/tests/integration/auditoria.test.ts` e `backend/tests/integration/auditoria-transacao.test.ts` |

## Planos de execução

O comando roda `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` três vezes por consulta e registra o plano da execução mediana. São 50 mil linhas em cada uma das quatro tabelas principais e 2 mil motoristas em tabelas temporárias com os índices da instalação limpa. As consultas reproduzem recortes de filtro e ordenação do autor/status da solicitação, motorista/status da viagem, vencimento de documentos e CNH, e veículo/período de abastecimento.

Os planos de laboratório usam projeções mínimas, distribuição sintética, cache e valores fixos. A leitura de blocos inclui acertos no cache local. Janela ampla, totalizador, projeção com histórico, joins de comprovantes e seletividade de produção podem ter planos diferentes. A medição serve para decidir quais consultas merecem um ensaio representativo antes de propor índices ou metas de tempo.

## Riscos e plano de permissões

| Achado | Ação antes de publicação |
| --- | --- |
| A baseline mantém grants legados em tabelas como `usuario`, `solicitacao_obito` e `log_atividade`. A prova de ACL candidata já nega acesso aos clientes SQL em ambiente isolado. | Confirmar schemas expostos na Data API publicada, endpoints efetivamente utilizados, papel runtime, propriedade, memberships, grants de coluna, sequências e privilégios padrão. Aplicar mudanças só com aprovação. |
| Papéis com BYPASSRLS e proprietários sem FORCE RLS exigem avaliação separada. RLS e ACL do laboratório e o relato remoto de 18/11 representam ambientes diferentes. | Se a Data API estiver em uso, aprovar a lista de recursos e o escopo por papel, depois demonstrar casos permitidos e negados no ambiente autorizado. O projeto Docker usado pelo CI mantém a Data API desabilitada. |
| O ensaio verifica que `anon` e `authenticated` carecem dos privilégios de leitura/escrita nos sete recursos privados. A API possui testes de acesso a anexos por recurso. | Separar runtime de administração, migrar somente para direitos necessários às operações comprovadas e manter documentos, evidências e histórico acessíveis pelos fluxos aprovados. |
| O formato paginado da auditoria minimiza dados. A resposta legada mantém email e o histórico anterior pode conter informações pessoais. | Aprovar com o cliente prazo, descarte, exceções de preservação e transição do contrato legado. Evitar gravar corpos de requisição, hashes de autenticação ou bytes em logs. |

Para um rollout autorizado, capturar antes a matriz anterior, incluindo ACLs padrão por grantor e proprietário e configuração de API, e confirmar a recuperação da SCRUM-204. Ensaiar os grants mínimos e a retirada dos grants de clientes na mesma transação em uma cópia isolada. Uma falha antes do commit reverte a transação. Para voltar após o commit, restaurar somente permissões e configuração compatíveis com a matriz capturada, reexecutando os testes de operação, negação e acesso ao arquivo. O caso de regressão que voltaria a expor dados deve manter o acesso externo bloqueado e escalar ao responsável. A configuração do Supabase hospedado e a retenção definitiva continuam pendentes de validação.
