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
| Responsável SVO | A confirmar por funcionalidade. |
| Gerente | A confirmar por funcionalidade. |
| Motorista | A confirmar por funcionalidade. |
| Solicitante | A confirmar por funcionalidade. |

Área de visualização não define automaticamente um papel nem uma hierarquia. A equivalência entre Administrador e Gestor citada nos requisitos deve ser considerada ao definir os papéis; não crie diferenças de acesso por conta própria.

## Ao entregar uma funcionalidade

Registre aqui quem pode fazer o quê e em quais registros; implemente e teste no mesmo PR. Apenas o acesso ainda indefinido precisa de confirmação — não é necessário preencher toda a matriz antes de trabalhar.

Organizações, vínculos e múltiplos papéis só entram no modelo se houver necessidade confirmada.
