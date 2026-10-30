# Segurança básica

A base atual possui autenticação, PostgreSQL e upload. Os controles abaixo evoluem junto de cada funcionalidade.

## Aplicação e dados

- Use HTTPS no ambiente publicado. Não exponha endpoints de negócio sem o controle descrito em [permissoes.md](./permissoes.md).
- Valide entradas no backend: campos aceitos, tipos, tamanhos e limites. Não aceite alterações de papel ou campos internos por envio genérico de objetos.
- Use consultas parametrizadas ou parâmetros da biblioteca de banco. Nunca monte SQL concatenando dados recebidos.
- Retorne erros úteis sem stack trace, SQL ou dados privados. Logs também não devem conter senhas, tokens ou documentos pessoais.
- Use dados fictícios no desenvolvimento e nos testes. Não versionar arquivos enviados, credenciais ou dados reais.

## Autenticação

A autenticação local consulta `public.usuario` no PostgreSQL e compara a senha com bcrypt. Nunca use credenciais de conexão do banco para login da aplicação nem armazene senha em texto puro.

O backend emite JWT HS256 com `sub`, `iat` e `exp` de oito horas. `JWT_SECRET` é obrigatória e deve ter pelo menos 32 bytes UTF-8. Todos os módulos protegidos usam o validador compartilhado; token ausente, inválido ou expirado retorna 401 (`NAO_AUTENTICADO`), e perfil sem permissão retorna 403 (`ACESSO_NEGADO`).

O frontend guarda somente o token em `sessionStorage` enquanto a aba estiver aberta. Não armazena token nem dados de usuário em `localStorage`. A sessão é confirmada em `/api/auth/sessao`; sem sessão válida, páginas privadas redirecionam para `/login`. A checagem de rota no navegador não substitui as verificações de perfil no backend.

O login deve responder com mensagem genérica para credenciais inválidas (401). A mensagem `Não foi possível realizar o login.` indica falha interna durante consulta ao banco, comparação de hash ou emissão do JWT (500); verifique os logs do backend e a configuração de `DATABASE_URL`/`JWT_SECRET`, sem registrar senha, token ou URL de conexão.

Se a estratégia migrar para cookies, configure `HttpOnly`, `Secure` em produção, `SameSite` adequado e proteção contra CSRF nas operações de alteração. CORS deve permitir apenas as origens necessárias; não substitui autorização.

## Arquivos e concorrência

- Ao implementar upload, limite tamanho e tipos, verifique o conteúdo e gere o nome no servidor. Não confie no caminho ou nome enviado pelo usuário.
- Armazene arquivos fora da área pública e autorize cada download. Vincule a evidência ao registro correto.
- Ao implementar alocação e mudança de status, use transações e controles no banco para impedir conflitos e duplicações; consultar disponibilidade antes de gravar não basta.

## Dependências e ambiente

Mantenha o lockfile e instale com `npm ci`. Não faça atualizações sem relação com a tarefa. Segredos ficam fora do Git e do frontend; assistentes seguem a proibição de acessar `.env*` do AGENTS.

Referência: [segurança de APIs REST da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html). Detalhes de retenção, backup e infraestrutura serão definidos nas tarefas correspondentes.

## Infraestrutura técnica — #28

- TLS do PostgreSQL verifica certificado e hostname. Não há fallback com
  rejectUnauthorized:false. URL com sslmode inseguro é recusada. A exceção
  `DB_TLS=disable` exige host loopback (`localhost`, `127.0.0.1` ou `::1`).
  Não use essa exceção para túnel que encaminhe a banco remoto. Certificado de CA
  privada deve ser confiado pelo runtime (por exemplo NODE_EXTRA_CA_CERTS no
  processo), mantendo verificação; a CA/certificação do ambiente publicado não foi
  inspecionada nesta execução. Falhas de confiança exigem corrigir a cadeia.
- O logger usa allowlist: evento fechado, UUID de correlação gerado pelo servidor
  e códigos técnicos conhecidos. Não serializa message/detail/cause, corpo, URL,
  credenciais, objetos do driver ou dados pessoais. Avisos do pool não são
  impressos. Os controllers legados também usam o logger técnico.
- Toda resposta HTTP recebe X-Request-Id local. Nenhum identificador arbitrário
  recebido do cliente é refletido no log.
- Limites de JSON/multipart, 400/413/415 e política de método/405 estão no
  [contrato comum](./api/README.md#infraestrutura-http--28).
- Login tem cota por IP do transporte, por processo: 10 tentativas/60s, estrutura
  máxima de 10000 origens, 429 e Retry-After. Configuração e limites superiores
  estão em [auth.md](./api/auth.md). Não confia em Forwarded/X-Forwarded-For;
  atrás de proxy, usuários podem compartilhar cota. Proteção global deve ser
  configurada na infraestrutura confiável; não foi implementado cache distribuído.

Auditoria de domínio foi centralizada na #31 (seção abaixo). A #28
não modifica ACL/RLS ou o Supabase remoto. O certificado/chave em tests/unit/fixtures
é artificial, gerado somente para provar rejeição TLS, sem uso operacional.

## Identidade e autorização atuais — #29

JWT é validado somente em `security/jwt.ts`: HS256, assinatura, `sub` não vazio,
`exp` numérico obrigatório e futuro, perfil reconhecido, segredo de no mínimo
32 bytes UTF-8. Aliases históricos de perfil continuam aceitos na fronteira JWT;
novos tokens usam os códigos persistidos (inclusive SOLICITANTE_INTERNO).
Segredo com 16–31 bytes deixa de funcionar: configure o processo com segredo
adequado antes de rollout; tokens assinados com segredo trocado exigem novo login.
Nenhum segredo existente foi lido ou modificado nesta execução.

`security/session.ts` consulta a operação `consultarIdentidade` do repositório de
usuários em toda requisição protegida, sem cache. Retorna somente id, nome, email
e perfil atual. Usuário inexistente, ativo diferente de true ou perfil não
reconhecido: 401. O JWT identifica o usuário; a lista de perfis da rota aplica-se
ao perfil atual do banco, por `security/authorization.ts`, retornando 403 quando
necessário. Falha do banco não autoriza nem usa claim antigo: retorna 500 pelo
tratamento comum. A verificação vale para a próxima requisição; não interrompe
operações que já passaram pela autorização. Não há tabela de sessões, refresh,
cache, token_version ou política de revogação avançada.

Os controllers Express de auth/usuários/auditoria e authMiddleware não tinham
imports nem rotas montadas no código fonte ou testes. Foram removidos; node:http
continua sendo o único caminho. As listas explícitas de acesso foram preservadas.
O frontend consulta sessão pela API e guarda somente token em sessionStorage.

Usuários aceitam somente nome/email/perfil/senha no cadastro/edição e somente
`{ativo:boolean}` no status. Campos internos são rejeitados. A alteração de status
bloqueia o usuário com FOR UPDATE; mudança e evento existente compartilham
transação. Repetir o estado retorna 200 sem novo UPDATE/evento. Cadastro/edição
também confirmam usuário e atividade na mesma transação desde a #31.

### Acesso direto ao PostgreSQL e limite de rollout

O snapshot auditado #27 comprova RLS desligada, ausência de policies e grants
amplos para anon/authenticated nas dez tabelas. Não comprova exposição Data API,
papel usado pelo backend publicado, memberships/heranças nem configuração de
schemas expostos. O código recebe DATABASE_URL do processo e não declara um
papel runtime verificável sem credenciais. Não se inferiu que postgres ou
service_role seja esse papel; nenhuma credencial foi acessada.

A prova local `backend/tests/security/direct-data-access.test.ts` usa somente o
harness #27 e uma transação com rollback: revoga acesso direto de PUBLIC/anon/
authenticated em tabelas e sequências e seus default privileges de postgres e
supabase_admin; concede CRUD/uso de sequências a papel runtime fictício explícito,
NOLOGIN/NOINHERIT/NOSUPERUSER. Testa consultas/escritas realmente como anon,
authenticated e runtime, incluindo negação de hash/dado médico e TRUNCATE e
preservação da leitura de identidade/escrita runtime. O papel não é proprietário
nem BYPASSRLS. A transação desfaz todas as mudanças, inclusive o papel artificial.
Não foram inventadas policies ou auth.uid.

Essa é uma estratégia técnica ensaiada, não uma ACL implantável remotamente.
Antes de rollout, o responsável deve confirmar o papel backend, suas memberships,
grants por coluna/defaults e exposição da Data API por metadados/configuração;
aprovar ACL explícita que preserve esse papel e testar todos os módulos com ele.
Sem essa confirmação, não há migration de ACL, alteração de snapshot/DER ou
aplicação remota nesta tarefa. A baseline continua reproduzindo o estado auditado,
com a exposição potencial já documentada. A prova não garante o ambiente remoto.

## Atividades existentes — #31

`auditoria.service.ts` aceita somente os cinco eventos já existentes, identificadores
BIGINT validados e o estado booleano conhecido. As descrições são modelos fechados
em pt-BR; não recebem texto livre, email, senha/token, CPF, telefone, dados médicos
ou payload completo. Cadastro/edição/status de usuário e criação SVO passam sua
transação à gravação compartilhada. Falha de atividade reverte a escrita do módulo;
não há captura que ignore uma falha para confirmar metade da operação.

O logger técnico da #28 continua separado do histórico de negócio. O endpoint
continua somente ADM com sessão atual. DTO paginado exclui email; adaptador sem
paginação conserva campos legados documentados pela #32. Histórico anterior pode conter email
nas descrições; não houve limpeza/backfill nem anonimização retroativa.
As duas FKs foram preservadas; retenção/imutabilidade, política de exclusão,
novos eventos e auditoria avançada exigem tarefa própria.
