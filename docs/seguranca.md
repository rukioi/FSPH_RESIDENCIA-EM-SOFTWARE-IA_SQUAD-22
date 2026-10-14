# Segurança básica

Implemente estes controles junto da funcionalidade que precisa deles. A base atual ainda não possui autenticação, banco ou upload.

## Aplicação e dados

- Use HTTPS no ambiente publicado. Não exponha endpoints de negócio sem o controle descrito em [permissoes.md](./permissoes.md).
- Valide entradas no backend: campos aceitos, tipos, tamanhos e limites. Não aceite alterações de papel ou campos internos por envio genérico de objetos.
- Use consultas parametrizadas ou parâmetros da biblioteca de banco. Nunca monte SQL concatenando dados recebidos.
- Retorne erros úteis sem stack trace, SQL ou dados privados. Logs também não devem conter senhas, tokens ou documentos pessoais.
- Use dados fictícios no desenvolvimento e nos testes. Não versionar arquivos enviados, credenciais ou dados reais.

## Autenticação

A estratégia de sessão será definida na tarefa de autenticação e reutilizada por todos os módulos. Não crie implementações locais nem criptografia própria. Se houver senha local, use uma biblioteca mantida de hash de senhas; nunca texto puro ou hash rápido genérico.

Se a sessão usar cookies, configure `HttpOnly`, `Secure` em produção, `SameSite` adequado e proteção contra CSRF nas operações de alteração. Defina expiração, revogação e limite de tentativas de login na mesma entrega. CORS deve permitir apenas as origens necessárias; não substitui autorização.

## Arquivos e concorrência

- Ao implementar upload, limite tamanho e tipos, verifique o conteúdo e gere o nome no servidor. Não confie no caminho ou nome enviado pelo usuário.
- Armazene arquivos fora da área pública e autorize cada download. Vincule a evidência ao registro correto.
- Ao implementar alocação e mudança de status, use transações e controles no banco para impedir conflitos e duplicações; consultar disponibilidade antes de gravar não basta.

## Dependências e ambiente

Mantenha o lockfile e instale com `npm ci`. Não faça atualizações sem relação com a tarefa. Segredos ficam fora do Git e do frontend; assistentes seguem a proibição de acessar `.env*` do AGENTS.

Referência: [segurança de APIs REST da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html). Detalhes de retenção, backup e infraestrutura serão definidos nas tarefas correspondentes.

## Dashboard — KPIs (BE-02)

O endpoint de KPIs reutiliza a validação JWT compartilhada e os perfis autorizados da rota base do dashboard. Valida os parâmetros antes de consultar o banco, usa SQL parametrizado e retorna erro genérico em falhas de persistência. `DATABASE_URL` é usada somente no backend. Migrations são aplicadas explicitamente em banco de desenvolvimento; iniciar o servidor não altera o esquema. Os testes usam banco isolado em memória.
