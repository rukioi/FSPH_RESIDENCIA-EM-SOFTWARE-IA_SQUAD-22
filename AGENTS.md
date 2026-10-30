# Regras de colaboração

Vale para pessoas e para assistentes de IA (Claude Code, Codex, Cursor e outros). **Leia este arquivo inteiro antes de alterar qualquer arquivo.** A leitura não é opcional: ela existe para o time não repetir os erros já apontados nos pull requests.

Antes de codar, leia também:

1. [README.md](./README.md)
2. [docs/decisions.md](./docs/decisions.md)
3. [docs/api/README.md](./docs/api/README.md) e o contrato do módulo em `docs/api/`, quando existir
4. [docs/permissoes.md](./docs/permissoes.md)
5. [docs/seguranca.md](./docs/seguranca.md)
6. [docs/testing.md](./docs/testing.md)

Se a tarefa lê ou grava dado, confira o esquema real do Supabase (PostgreSQL) antes de escrever a consulta. Não invente tabela, coluna, enum ou status.

Os documentos referenciados ainda podem estar pendentes. Não invente seu conteúdo nem os crie sem uma tarefa que os solicite.

## 1. Regra principal: faça só o que a tarefa pede

- Cada mudança nasce de **uma tarefa** do backlog. A tarefa lista os arquivos, o checklist e o critério de aceite. Esse é o escopo.
- **Não** faça refatorações, renomeações, reformatações, atualizações de dependência ou melhorias que a tarefa não pediu, mesmo que pareçam boas. Anote no PR, na seção "Fora do escopo", e siga.
- Se a tarefa exigir tocar um arquivo que ela não lista, explique o porquê no PR.
- Se a tarefa estiver ambígua ou conflitar com [docs/decisions.md](./docs/decisions.md), **pare e pergunte** antes de codar. Não invente regra de negócio.
- Prefira a menor mudança que atende ao critério de aceite. Código que a tarefa não exige é código que alguém precisa revisar.

## 2. Fluxo obrigatório

```text
tarefa → atualizar main local → branch de trabalho → alteração + testes → push da branch → PR para main → revisão → merge (feito pelo responsável do projeto)
```

- Antes de **iniciar cada tarefa**, confira se o diretório está limpo e atualize a referência remota: `git fetch origin`.
- Confirme que a `main` local corresponde à remota: `git switch main` e `git pull --ff-only origin main`. Inicie a tarefa somente depois disso; crie sua branch de trabalho a partir dessa `main` atualizada.
- Se a tarefa já tiver uma branch, atualize-a com a `main` antes de continuar ou abrir PR. Preserve o trabalho existente e resolva conflitos sem descartar alterações.
- Cada integrante trabalha e publica em sua própria branch de tarefa. O pull request tem como destino a `main`; somente o responsável do projeto faz o merge.
- Branch: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`, `test/<slug>`. Um assunto por branch.
- Commits em inglês, no imperativo, explicando o porquê (`fix: keep the seller filter after reload`).
- PR em português, usando o template (`.github/pull_request_template.md`), com o checklist preenchido e o link da tarefa.
- **Nunca** faça merge, push direto na `main`, `vercel deploy --prod`, `vercel promote` ou alteração no banco de produção. O responsável do projeto decide e executa o merge.
- Antes de abrir o PR, confirme que a branch contém as alterações atuais da `main` e resolva conflitos sem descartar o trabalho de outras pessoas. Não use force push.

## 3. Verificação antes do PR

```bash
npm run lint
npm run typecheck
npm test                 # unitários + integração
npm run build
npm run test:e2e         # quando a tarefa toca telas, rotas ou fluxos
```

- Toda regra de negócio nova ou corrigida ganha teste. Correção de bug começa por um teste que falha.
- Rota de API nova ou alterada: teste de integração em `backend/tests/integration/` cobrindo sem sessão (401), papel errado ou vínculo inativo (403), outra organização (nunca vaza dados), entrada inválida (400) e caminho feliz.
- Tela alterada: confira no preview em 390 px, 768 px e 1280 px e anexe capturas ao PR.
- Detalhes e exemplos em [docs/testing.md](./docs/testing.md).
- Não desligue, pule (`.skip`) ou afrouxe teste para o CI passar. Se um teste antigo estiver errado, corrija e explique no PR.
- Se os comandos ou a infraestrutura de verificação ainda não existirem, registre essa limitação explicitamente. Não declare a tarefa concluída sem executar a verificação desta seção.
- Mock de banco não prova integridade. Quando a tarefa lê ou grava dado, o PR registra a conferência em um PostgreSQL de teste isolado: esquema, restrições e caminho feliz. Não use o Supabase compartilhado de produção para essa prova.

## 4. Organização do repositório

- Frontend e backend ficam juntos no repositório, em `frontend/` e `backend/`.
- A raiz `frota-svo/` deve oferecer `npm run dev` para iniciar frontend e backend juntos. Os comandos da seção 3 também devem ser executáveis a partir dessa raiz.
- A estrutura deve comportar visualizações distintas para Responsável SVO, Gerente e Motorista, com páginas e layouts próprios quando necessários e componentes compartilhados quando apropriado.
- A existência dessas visualizações não define permissões, hierarquia de perfis ou regras de negócio. Essas decisões serão documentadas posteriormente.
- Migrations e seeds ficam centralizados em `backend/src/database/`. Não mantenha versões concorrentes do esquema do banco.

## 5. Centralização e padrões obrigatórios

- Regras de negócio devem ficar nos módulos responsáveis do backend, em `backend/src/modules/`. Não duplique a mesma regra em controllers, páginas ou outros módulos; reutilize a operação responsável.
- Contratos e convenções de endpoints têm uma fonte de referência em [docs/api/README.md](./docs/api/README.md). Use o padrão inicial e detalhe os contratos conforme as funcionalidades forem entregues.
- A comunicação HTTP do frontend deve usar a infraestrutura compartilhada em `frontend/src/shared/services/`, respeitando os contratos definidos.
- Autenticação, autorização e controles de segurança devem usar mecanismos compartilhados do backend. Não implemente soluções independentes por tela ou endpoint.
- A matriz de acesso é centralizada em [docs/permissoes.md](./docs/permissoes.md) e o padrão de segurança em [docs/seguranca.md](./docs/seguranca.md). As permissões de negócio serão definidas por funcionalidade.
- Ocultar controles no frontend não substitui a autorização no backend. Toda operação protegida deve passar pelo mecanismo central de autorização.
- Use os padrões iniciais para avançar. Decisões técnicas reversíveis dentro da tarefa podem ser registradas no PR. Quando faltar uma definição de negócio, permissão ou mudança que afete outros módulos, pergunte antes de implementar a parte dependente e continue o trabalho independente.
- Não crie os documentos, mecanismos ou abstrações desta seção sem uma tarefa que solicite sua implementação.

## 6. Interface

- Textos da interface em português do Brasil, claros e sem jargão técnico.
- Responsivo em 390 px (celular), 768 px (tablet) e 1280 px (desktop), sem rolagem horizontal e com alvos de toque de pelo menos 40 px.
- Estilos em `frontend/src/app/<modulo>.css`. Reaproveite os tokens e componentes existentes; não crie uma nova paleta, fonte ou camada global de CSS sem tarefa para isso.
- Toda ação mostra estado de carregamento, sucesso e erro acionável. Nada aparece como salvo antes de o servidor confirmar.
- Acessibilidade: rótulos em campos, `aria-label` em botões só com ícone, foco visível, contraste AA.

## 7. Documentação e evolução

- [docs/decisions.md](./docs/decisions.md) registra as decisões iniciais e como evoluí-las com entregas pequenas.
- Atualize contratos de API, segurança e permissões no mesmo PR em que a definição mudar. Não é necessário fechar toda a documentação antes de desenvolver.
- As verificações de organização e vínculo da seção 3 dependem da definição correspondente; não introduza esse modelo de dados apenas por ele aparecer no checklist.

## 8. O que um assistente de IA não deve fazer

- Não executar comandos destrutivos (`rm -rf`, `git reset --hard`, `git push --force`, `drop table`) nem comandos contra produção.
- Não ler, imprimir ou copiar o conteúdo de `.env*`, chaves ou tokens.
- Não instalar ferramentas globais nem alterar configurações do usuário.
- Não criar arquivos de documentação, scripts ou abstrações que a tarefa não pediu.
- Não declarar uma tarefa concluída sem ter rodado a verificação da seção 3. Diga exatamente o que foi testado e o que não foi.

## 9. Banco de dados

Dado operacional e persistente deve entrar e sair pelo Supabase (PostgreSQL), que é a fonte de verdade da aplicação. A conexão é uma só: `backend/src/database/connection.ts`, com `DATABASE_URL` apontando para o Supabase. O servidor carrega o `.env` da raiz antes de importar essa conexão.

- Não persista dados da aplicação em `localStorage`, arquivos locais ou outro armazenamento no navegador; grave e consulte esses dados no Supabase. Estado transitório de interface pode permanecer em memória.
- O frontend acessa os dados pela API e pelos serviços compartilhados; não crie outro cliente de banco nem faça consultas SQL no frontend.
- Confirme tabela, coluna, chave, enum e status no banco antes de escrever a consulta. Não invente esquema.
- Use o status que o banco já define. Motorista e veículo só entram em despacho quando esse status permite. A ordem só muda a partir do status que a tarefa descreve.
- Mudança de status e alocação ficam na mesma transação, com bloqueio das linhas. Consultar disponibilidade fora da transação não basta.
- Não crie migration se a transação e as restrições atuais resolvem o caso. Migration nova fica em `backend/src/database/`.
- Use consulta parametrizada. Não concatene dado recebido no SQL.
- Erro de domínio conhecido não vira HTTP 500. Referência inexistente é 404. Conflito de estado ou alocação é 409. Chave estrangeira (`23503`) e unicidade (`23505`) seguem esses códigos.
- Uma falha de requisição não derruba o processo. Limite o corpo em bytes e leia dentro do tratamento de erro. Acima do limite, responda 413.
- Número, lista ou gráfico fixos na tela são demonstração. A tarefa precisa autorizar, e a interface mostra que o dado não veio do banco.
- Mock não prova o banco. A conferência do esquema e do caminho feliz usa PostgreSQL de teste isolado. Não grave teste no Supabase compartilhado.
- Declare `postgres` em `backend/package.json`. Não crie outro cliente nem consulta SQL no frontend. Não imprima `DATABASE_URL` nem senha.

## 10. Contrato de API

Endpoint novo ou alterado atualiza `docs/api/<modulo>.md` no mesmo PR. A estrutura segue [docs/api/dashboard.md](./docs/api/dashboard.md) e as convenções de [docs/api/README.md](./docs/api/README.md). O contrato descreve só o que o código faz.

Cada arquivo traz, nesta ordem:

1. Título com o módulo e o identificador da tarefa.
2. Método, rota, autenticação, perfis autorizados e presença de corpo.
3. Uma seção por status HTTP, com o JSON de exemplo.
4. Exemplo mínimo da requisição.
5. O que a entrega não faz.

- Erro usa `{ "error": { "code", "message", "fields" } }`. `code` é estável. `message` é português claro. `fields` só aparece quando aponta um campo.
- Consulta ou criação com sucesso usa `{ "data": ... }`. Lista usa `page`, `limit` e `meta`.
- Propriedades em `camelCase`. Data com hora em ISO 8601 com fuso. Data sem hora em `YYYY-MM-DD`.
- Não invente perfil, filtro ou campo ausente da tarefa e do banco. Se o contrato e o código divergirem, o PR corrige os dois.

## 11. Revisão

Estes cuidados já foram exigidos nos pull requests #1 a #10. Aplique na implementação.

- `JWT_SECRET` tem pelo menos 32 bytes. Token sem `exp` é inválido. A verificação fica em `backend/src/security/`. Sem sessão, 401. Perfil errado, 403.
- Compare a rota pelo caminho, não pela URL inteira. Ao acrescentar um módulo, preserve os endpoints já existentes.
- Valide o JSON da API antes de guardar na tela. Resposta de uma busca anterior não substitui a busca atual.
- Carregamento usa `role="status"`. Erro usa `role="alert"`.
- Menu fechado sai do foco (`inert` e `aria-expanded`). No celular, escolher um item fecha o menu.
- Layout em 390, 768 e 1280 px, sem corte por `transform` nem margem negativa. `prefers-reduced-motion` aponta para o componente certo.
- Estilo fica no CSS do módulo. Texto de espaço reservado sai quando o bloco real entra. Plural, cor e selo de demonstração correspondem ao dado exibido.
- Uma tarefa por branch. Não substitua arquivo de outro módulo com upload genérico.
- JSDoc útil nas funções exportadas que o PR altera. Comentário vazio não conta.
- O corpo do PR diz o que foi conferido no banco e o que ficou sem essa prova.

Pendências já conhecidas, até serem entregues na tarefa correspondente:

- Exigir o tamanho mínimo do `JWT_SECRET` e o claim `exp` no código.
- Publicar o contrato do módulo SVO no formato da seção 10.
- Provar o despacho com duas transações concorrentes em banco de teste.
- Ligar os widgets fictícios à API do banco, ou marcar na tela que são demonstração.
- Resolver os apontamentos abertos do PR #9 antes do merge.