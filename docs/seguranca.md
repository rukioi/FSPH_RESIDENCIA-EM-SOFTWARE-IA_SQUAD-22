# Segurança básica

Implemente estes controles junto da funcionalidade que precisa deles. A base atual ainda não possui autenticação, banco ou upload.

## Aplicação e dados

- Use HTTPS no ambiente publicado. Não exponha endpoints de negócio sem o controle descrito em [permissoes.md](./permissoes.md).
- Valide entradas no backend: campos aceitos, tipos, tamanhos e limites. Não aceite alterações de papel ou campos internos por envio genérico de objetos.
- Use consultas parametrizadas ou parâmetros da biblioteca de banco. Nunca monte SQL concatenando dados recebidos.
- Retorne erros úteis sem stack trace, SQL ou dados privados. Logs também não devem conter senhas, tokens ou documentos pessoais.
- Use dados fictícios no desenvolvimento e nos testes. Não versionar arquivos enviados, credenciais ou dados reais.

## Autenticação

A autenticação local consulta `public.usuario` no PostgreSQL e compara a senha com bcrypt. Nunca use credenciais de conexão do banco para login da aplicação nem armazene senha em texto puro.

O backend emite JWT HS256 com `sub`, `iat` e `exp` de oito horas. `JWT_SECRET` é obrigatória e deve ter pelo menos 16 bytes; prefira 32 bytes ou mais para maior margem de segurança. Todos os módulos protegidos usam o validador compartilhado; token ausente, inválido ou expirado retorna 401 (`NAO_AUTENTICADO`), e perfil sem permissão retorna 403 (`ACESSO_NEGADO`).

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
