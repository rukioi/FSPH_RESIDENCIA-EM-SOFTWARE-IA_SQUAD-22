# Decisões iniciais

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

Ainda precisam de definição: revogação de sessões antes da expiração, hospedagem, armazenamento de arquivos e regras de cada fluxo. Decida cada ponto na tarefa que precisar dele, sem bloquear o restante do projeto.

## Bootstrap e HTTP compartilhados — #28

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
