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
| Banco | PostgreSQL com driver `pg` e conexão por `DATABASE_URL` na BE-02; migrations e seeds em `backend/src/database/`. Testes de SQL em PostgreSQL embarcado (PGlite), isolado em memória. |
| API | Convenções mínimas em [api/README.md](./api/README.md). |
| Acesso | Mecanismo compartilhado; matriz evolui por funcionalidade em [permissoes.md](./permissoes.md). |
| Qualidade | Testes das regras e integrações alteradas; E2E dos fluxos relevantes. Veja [testing.md](./testing.md). |

## Evolução

Para mudar uma decisão, explique no PR o problema, a escolha e o impacto. Atualize esta página se a mudança afetar o squad. Uma nota curta basta; não é necessário criar um documento por decisão.

Ainda precisam de definição: sessão/autenticação, acesso ao banco, hospedagem, armazenamento de arquivos e regras de cada fluxo. Decida cada ponto na tarefa que precisar dele, sem bloquear o restante do projeto.
