# Permissões

Esta é a referência única para decisões de acesso. A matriz de negócio ainda será preenchida com o responsável pelo produto, uma funcionalidade por vez.

## Padrão inicial

- Negue operações protegidas sem autorização explícita.
- Valide no backend a identidade, a ação permitida e o acesso ao registro. Conhecer um ID não concede acesso.
- Reutilize o mecanismo em `backend/src/security/` e os middlewares comuns. A regra específica do recurso permanece no módulo responsável.
- O frontend pode esconder ações indisponíveis, mas não decide a autorização.
- Aplique o mesmo controle a listas, detalhes, alterações e downloads.

Esses princípios seguem a orientação de [autorização da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Matriz a preencher

| Área de visualização | Ações e registros acessíveis |
| --- | --- |
| Administrador (`ADM`) | Dashboard administrativo, gestão de usuários e auditoria; também pode acessar as operações de gestor permitidas no backend. |
| Gestor (`GESTOR_FROTA`) | Dashboard, veículos, motoristas, documentos e abastecimentos. Não gerencia usuários nem acessa auditoria administrativa. |
| Responsável SVO (`ATENDENTE_SVO`) | Consulta veículos e motoristas e acessa as rotas operacionais do SVO conforme os endpoints implementados. |
| Motorista e solicitante | Sem rotas frontend autenticadas disponíveis nesta entrega. |

As regras são aplicadas no backend; o guarda de rotas no frontend melhora a navegação, mas não substitui autorização da API. Perfis sem tela inicial configurada não recebem acesso por fallback a páginas administrativas.

## Ao entregar uma funcionalidade

Registre aqui quem pode fazer o quê e em quais registros; implemente e teste no mesmo PR. Apenas o acesso ainda indefinido precisa de confirmação — não é necessário preencher toda a matriz antes de trabalhar.

Organizações, vínculos e múltiplos papéis só entram no modelo se houver necessidade confirmada.
