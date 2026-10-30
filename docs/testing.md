# Testes e verificação

Teste o comportamento que pode quebrar a entrega. Prefira poucos testes úteis a testes que repetem a implementação.

## Comandos na raiz

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e  # quando alterar telas, rotas ou fluxos
```

Para preparar o navegador uma vez: `npx playwright install chromium`. O E2E inicia os serviços; mantenha 3000 e 5173 livres.

## Onde e o que testar

| Tipo | Local | Cobertura mínima |
| --- | --- | --- |
| Unitário | `*.test.ts` junto ao código | Regra nova ou corrigida, incluindo casos limite. |
| Integração | `backend/tests/integration/` | HTTP, autorização, validação e persistência quando existir. |
| E2E | `tests/e2e/` | Caminho principal do fluxo alterado. |

- Bug: reproduza em um teste que falha, corrija e execute novamente.
- API protegida: cubra 401 sem sessão, 403 sem permissão ou com vínculo inativo quando houver esse conceito, 400 para entrada inválida e sucesso.
- Cubra acesso a registros fora do alcance do usuário. Teste outra organização somente se esse modelo for adotado; não crie multitenancy para satisfazer um checklist.
- Na alteração de tela, confira 390, 768 e 1280 px, foco e uso por teclado. Anexe capturas ao PR; o E2E atual salva em `test-results/`.
- Use dados fictícios e banco de testes isolado quando a persistência for implementada. Nunca execute testes contra produção.
- Não use `.skip` nem enfraqueça expectativas para passar. Explique no PR qualquer teste antigo corrigido.

## Evidência no PR

Liste os comandos executados, o resultado e o que não foi verificado. Para documentação, rode lint, typecheck, testes e build conforme o AGENTS; E2E é dispensável se telas, rotas e fluxos não mudaram.

A autenticação possui testes unitários do contrato JWT e testes de integração da rota de sessão, incluindo 401 sem token, 403 para perfil não autorizado e sucesso com token válido. O E2E cobre o redirecionamento de rotas privadas para o login; ele exige Chromium instalado e pode ser dispensado quando a alteração não envolver telas ou fluxos.
