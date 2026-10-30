# Decisões iniciais

Estado consolidado #33: mecanismos entregues em #27–#32/#30 descritos no
[README](../README.md), [plano](./reorganization/plan.md) e
[validação](./reorganization/validation.md). CI executa checks de conteúdo/banco
e fluxos isolados; compilados deixam de ser rastreados. A exceção de branch/PR
únicos vale só para #22. Não houve mudança de regra de negócio na consolidação.

Estas decisões orientam a próxima entrega e podem evoluir. O código mostra o que está implementado; documentação não significa funcionalidade pronta.

## Como trabalhar com Lean

- Entregue uma pequena funcionalidade utilizável, obtenha feedback e ajuste.
- Faça PRs pequenos, com um objetivo e critério de aceite claro.
- Use os padrões existentes para decisões técnicas reversíveis. Registre a escolha no PR; não espere reunião para cada detalhe.
- Confirme dúvidas de negócio, acesso a dados ou mudanças que afetem outros módulos antes de implementar a parte dependente. Continue o trabalho independente.
- Acrescente documentação no mesmo PR da mudança, apenas quando o contrato ou a decisão mudar. Evite duplicar explicações do código.
- Não crie infraestrutura para necessidades hipotéticas. Extraia código compartilhado quando houver uso concreto.

## Base escolhida

| Tema | Decisão inicial |
| --- | --- |
| Repositório | Frontend e backend juntos, com npm workspaces e lockfile único. |
| Desenvolvimento | `npm ci` e `npm run dev` na raiz. |
| Backend | Uma aplicação modular; regras ficam no módulo responsável. |
| Frontend | Páginas por área de visualização, funcionalidades por domínio e recursos comuns em `shared/`. |
| Banco | PostgreSQL/Supabase, baseline e seed isolados em `backend/src/database/`; pool único postgres em `database/connection.ts`. |
| Autenticação | Usuários autenticados pelo PostgreSQL; JWT HS256 com expiração de oito horas; token temporário em `sessionStorage`, sem dados de usuário em `localStorage`. |
| API | Convenções mínimas em [api/README.md](./api/README.md). |
| Acesso | Mecanismo compartilhado; matriz evolui por funcionalidade em [permissoes.md](./permissoes.md). |
| Qualidade | Testes das regras e integrações alteradas; E2E dos fluxos relevantes. Veja [testing.md](./testing.md). |

## Evolução

Para mudar uma decisão, explique no PR o problema, a escolha e o impacto. Atualize esta página se a mudança afetar o squad. Uma nota curta basta; não é necessário criar um documento por decisão.

Ainda precisam de definição: política avançada de revogação, hospedagem, armazenamento de arquivos e regras de cada fluxo. Decida cada ponto na tarefa que precisar dele, sem bloquear o restante do projeto.

## Bootstrap e HTTP compartilhados — #28

As notas por ticket abaixo preservam decisões/evidências históricas. O estado
consolidado está no [plano](./reorganization/plan.md) e na
[validação](./reorganization/validation.md); próximos tickets registram a sequência
executada, não pendências atuais.

`server.ts` carrega a configuração da raiz antes do import dinâmico de `app.ts`.
A localização relativa serve a src e dist. Testes não carregam dotenv; recebem
somente fixtures e a identidade do harness #27. O pool único fica em
`database/connection.ts`; `config/db.ts` reexporta esse mesmo objeto enquanto os
módulos legados ainda o importam. Não há mudança de SQL ou esquema nesta tarefa.

SIGINT/SIGTERM interrompem HTTP, aguardam requisições (até 5s antes de fechar
conexões) e encerram o pool de forma idempotente (prazo de 5s). Erros de startup
recebem somente evento seguro; não se imprime a configuração recebida.

node:http permanece ativo. A tabela de despacho define caminhos exatos e métodos;
autorização de operações continua nos módulos. Leitores de corpo, envio JSON,
falhas técnicas, request ID e logging ficam em shared. Adaptadores conservam os
envelopes e mensagens legadas. Documentos mantêm JSON de 1 MiB, exceção explícita
aos 64 KiB gerais. Multipart é limitado antes de interpretar as partes.

A configuração TLS valida certificado/hostname por padrão; `DB_TLS=disable`
é aceito apenas para loopback explicitamente configurado. Parâmetros TLS
inseguros da URL são recusados; sslmode seguro é normalizado para a política comum.
O harness permite sem TLS somente o alvo isolado já verificado.

Não houve troca de framework, dependência nova ou mudança de regra operacional.
As divergências preservadas ficam em [reorganization/deferred.md](./reorganization/deferred.md).

## Segurança comum — #29

Separar JWT criptográfico, resolução de sessão no banco e autorização explícita
em jwt.ts/session.ts/authorization.ts. A consulta compartilhada de identidade
fica em usuarios.repository.ts; nenhuma rota protegida autoriza por claim antigo.
Não criar infraestrutura de sessões. Remover caminhos Express sem referências,
preservando node:http e a matriz existente. SOLICITANTE_INTERNO é o código real;
rótulos só existem na apresentação. JWT_SECRET exige 32 bytes UTF-8.

Status recebe estado desejado obrigatório e retorna 200 mesmo quando repetido.
Somente mudança efetiva grava o evento existente, na mesma transação com bloqueio.
É a quebra intencional do contrato PATCH sem corpo; o frontend muda junto.
Erros de validação novos usam o envelope comum; demais respostas legadas continuam
para #32. Perfis/estados/regras futuras não são implementados.

O papel backend remoto e a Data API não foram confirmados sem segredo. Portanto,
não criar migration ACL baseada em suposição. A estratégia mínima é testada por
papel runtime simulado no banco isolado e totalmente desfeita por rollback;
pré-condições de rollout ficam em [segurança](./seguranca.md). Snapshot/DER mantêm
a baseline auditada, sem edição manual. Próximo ticket: #31.

## Atividades existentes centralizadas — #31

Dependências verificadas na branch agregadora: #27 ea68b16, #28 acd0f6c,
#29 58dcbbf. O checkout agregador começou limpo e origin/main já era ancestral;
fetch foi executado sem misturar as alterações alheias do checkout main.

`auditoria.service.ts` define os cinco eventos existentes e suas descrições fechadas;
`auditoria.repository.ts` concentra INSERT e consulta de log_atividade. O serviço
recebe a transação do módulo chamador, não abre transação independente e não captura
falha para ignorá-la. Usuarios.repository passa a confirmar cadastro/edição/status
junto da atividade, com bloqueio do alvo em edição/status. SVO conserva sua
transação de solicitação/ordem/duas atividades e as mesmas descrições públicas.
Não se cria evento de despacho ou de outros endpoints.

O endpoint ADM usa os mecanismos comuns de sessão/autorização/erro. Paginação
técnica explícita recebe DTO camelCase mínimo e snapshot repeatable-read/read-only
para página/total. A ordem usa data_hora DESC NULLS LAST e id DESC como desempate.
Sem page/limit, o adaptador conserva array/campos legados, inclusive email; remoção
coordenada e geração de tipos ficam para #32. Horários mantêm serialização anterior,
sem inferir fuso histórico. As duas FKs e todo histórico permanecem inalterados.

Cadastro deixa de copiar email à descrição nova; mensagens usam ID e pt-BR.
O logger técnico continua separado, sem serializar objetos de erro ou payloads.
Não há schema/migration, dependência, configuração global ou ferramenta instalada.
Controllers Express e authMiddleware já haviam sido removidos pela #29, portanto
não foram recriados. UI demonstrativa, relatórios, retenção, imutabilidade, eventos
novos e regras futuras continuam em deferred.md, sem promessa de entrega funcional.

Além dos caminhos inicialmente listados, docs/api/README.md registra a alteração
do contrato global exigida pelo prompt; docs/reorganization/deferred.md registra
os adiamentos exigidos pela #22. tests/e2e/usuarios-sessao.spec.ts verifica os eventos
reais após cadastro/edição/status na tela existente, incluindo repetição sem evento,
nos três tamanhos já cobertos. Nenhuma tela/CSS foi alterada. Artefatos dist
recompilados historicamente rastreados não integram o commit.

As provas em auditoria.test.ts e auditoria-transacao.test.ts usam verifiedSql do
harness #27: identidade Docker, vínculo ao checkout e marcador do banco conferidos
antes de acesso; alvo fixo fsph-t1-isolated-2026/fsph_t1_baseline, sem URL arbitrária.
Testam 401/403, paginação/empates/NULL/vazio, array legado, mensagens e sentinelas.
Falhas de FK 23503 são produzidas pelo INSERT real da atividade dentro da transação
recebida, após a alteração de usuário ou criação SVO. O HTTP retorna erro genérico
e consultas reais comprovam rollback de usuário/hash/status/solicitação/ordem/logs.
Outro teste reverte uma transação do chamador após gravar atividade com sucesso.
Limpeza remove somente fixtures próprias no alvo isolado. Não há dados reais ou
escrita no Supabase compartilhado. Snapshot versionado orientou os campos usados.

### Verificação da #31 — 30/10/2026

| Comando | Resultado |
| --- | --- |
| npm run db:test:prepare | passou no alvo isolado confirmado |
| npm run test:db | 16 testes passaram |
| npm run db:docs:check | passou; sem drift de metadados/schema/DER |
| npm run lint | passou |
| npm run typecheck | passou; inclui testes backend |
| npm test | 146 testes passaram em 24 arquivos |
| npm run build | frontend/backend passaram |
| npm run test:e2e | 10 testes passaram; inclui consulta dos eventos reais após as ações de usuário |

A execução inicial de regressão reproduziu ausência de paginação/validação e o
cadastro legado. Os testes de falha de atividade também foram executados contra
usuarios.routes da revisão anterior: três falharam porque esse caminho ainda não
usava a operação central; a fonte em desenvolvimento foi restaurada em finally.
Na implementação final, as falhas reais de FK causam rollback e todos os testes
passam. Uma seleção inicial por nome com acento não selecionou testes no terminal
Windows; foi corrigida para filtro ASCII antes da comparação. Não há .skip ou
expectativa afrouxada no código versionado.

Capturas de tabela em 390/768/1280 px foram conferidas visualmente e permanecem em
`test-results/usuarios-sessao-*/usuarios-<largura>.png`; os modais também foram
capturados pelo E2E em `novo-usuario-<largura>.png`. Sem rolagem horizontal na página;
a tabela conserva rolagem interna no celular. Essas evidências locais podem ser
anexadas ao PR final da #33. Nenhuma interface foi redesenhada.

Limites: prova local do PostgreSQL/harness, sem validação de produção. Histórico
antigo, timestamps e FKs não foram alterados. O adaptador sem paginação permanece
temporariamente completo e inclui email; o novo DTO não o inclui. Auditoria visual,
produto avançado e regras operacionais continuam fora do escopo. Não há PR
individual, merge, deploy ou fechamento de issue antes da aceitação do PR final.
Próximo ticket: #32; depois #30 e #33.

## Contrato global e piloto de veículos — #32

Dependências conferidas na branch agregadora: #27 ea68b16, #28 acd0f6c, #29
58dcbbf e #31 0feb939, com implementação/testes de banco, infraestrutura, identidade
atual e auditoria transacional presentes. origin/main é ancestral; fetch executado.
O checkout main anterior continha alterações alheias e foi preservado. A conversa
passou, com autorização, ao worktree agregador; a pasta graft não rastreada é
externa à tarefa e não entra no commit. Não houve delegação ou PR individual.

Zod 4 em módulos puros, registro global e OpenAPI 3.1 são a fonte do contrato de
29 operações. O mesmo registro fornece pathname/métodos ao dispatcher. Schemas
conservam diferenças reais: sucesso data/objeto/array, erros comuns/string/erro,
snake_case/camelCase e paginação opcional da auditoria. O manifesto fecha as 24
exceções sem runtime global; não autoriza novas rotas por prefixo. A API não ganha
versão nova ou comportamento de requisitos futuros.

Veículos separa HTTP, validação/regras existentes e SQL. DTOs projetam os 14 campos
conhecidos, sem SELECT/RETURNING *. Schemas validam entrada/saída; objetos Date
passam pela serialização JSON já usada, sem conversão de ID ou significado de
horário. Null/defaults, campos ignorados, atualização parcial, vínculo/fornecedor,
capacidades e estados preservados. Exclusão com FK conserva o 500 legado.

OpenAPI e inventário são gerados deterministicamente. json-schema-to-typescript
gera DTOs e bindings estáticos usados pelo cliente. openapi-typescript foi avaliado
mas recusado pelo npm porque declara peer TypeScript 5, enquanto o repo usa 6;
não houve force/legacy-peer-deps ou atualização de TypeScript. YAML é somente
serialização. Os checks não importam pool, app ou dotenv. A prova os executa em
subprocessos com allowlist de ambiente, sem banco/segredos.

O gate de compatibilidade é deliberadamente conservador: compara definições
existentes com HEAD e recusa qualquer alteração, inclusive algumas compatíveis.
Na primeira entrega não há baseline OpenAPI no HEAD; a partir do commit desta
tarefa ele passa a existir. Não é análise semântica completa nem aprovação
automática para quebrar consumidores. Mudança incompatível exige tarefa explícita.

O serviço de veículos usa bindings/tipos gerados e os mesmos schemas runtime; a
página mantém só o formulário e campos de apresentação dos painéis sem API.
Auth reutiliza tipos gerados, preservando um modelo visual para aliases históricos.
O cliente delega Bearer/401 ao adaptador existente e centraliza parsing/204,
serialização, cancelamento e erros com correlação do servidor. Schemas não expõem
conteúdo de falha de validação/SQL ao usuário. O adaptador de auditoria sem
paginação foi conservado porque removê-lo seria incompatível; migração dos demais
consumidores e tipos manuais continua na #30, sem reconstruir DTOs no piloto.

Arquivo adicional: `frontend/src/shared/api/generated/operations.ts` é o binding
gerado indispensável para o cliente escolher método/rota sem duplicação manual.
`scripts/tsconfig.json` inclui os geradores/checks na verificação estática da raiz,
além de frontend, backend e testes; não introduz outro processo de build.
`docs/reorganization/deferred.md` é exigido pela coordenação #22. Nenhuma migration,
enum, schema, perfil ou regra operacional foi modificada. Próximo ticket: #30;
somente #33 abre/reutiliza o PR final para main.
