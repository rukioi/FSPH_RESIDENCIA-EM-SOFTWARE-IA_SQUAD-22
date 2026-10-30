# Consolidação da base atual — #22 / #33

Objetivo: organizar o código existente e tornar verificáveis banco, HTTP, identidade,
auditoria e consumo frontend. O documento de requisitos orienta tarefas futuras;
não é checklist funcional desta entrega. #23–#26 estão adiadas, sem bloquear este plano.

## Sequência e mapa

| Issue | Commit | Principais caminhos e resultado |
| --- | --- | --- |
| #27 | ea68b16 | database/, docs/database/, testes: baseline fiel e harness isolado |
| #28 | acd0f6c | server/config/shared/http: bootstrap ordenado, pool único, TLS/corpos/logs |
| #29 | 58dcbbf | security/, usuarios/: identidade atual, matriz preservada e status explícito |
| #31 | 0feb939 | auditoria/, usuarios/, svo/: cinco eventos existentes transacionais |
| #32 | 7c29a2c | contract/, schemas, scripts, shared/api: 29 operações e piloto de veículos |
| #30 | d38be98 | shared/services/api/types, páginas/E2E: consumo validado e estado remoto |
| #33 | commit com assunto `ci: consolidate verified refactoring in the shared pull request (#33)` | instruções/docs/workflow e retirada de dist do índice |

Branch única excepcional: chore/reorganizacao-global-2026. Destino: main.
Reutilizar exclusivamente o [PR #34](https://github.com/rukioi/FSPH_RESIDENCIA-EM-SOFTWARE-IA_SQUAD-22/pull/34),
reescrevendo a descrição para o resultado final. Sem PR por ticket, merge, deploy
ou fechamento automático antes de aceitação.

## Execução da #33

1. Conferir implementações/evidências das dependências, fetch e ancestralidade da base.
2. Consolidar instruções hierárquicas e corrigir afirmações obsoletas sem mudar API/negócio.
3. Executar CI em runner novo com Node 24, npm ci, harness exclusivo e Chromium.
4. Reutilizar checks de conteúdo/coverage existentes, demonstrar drift controlado,
   retirar compilados só do índice e preservar arquivos locais/alheios.
5. Registrar [validação](./validation.md), capturas e [retorno](./rollback.md),
   publicar commit e acompanhar checks do PR único; rascunho se faltar gate obrigatório.

## Fronteiras e rollout

Configuração → app/registro de rotas → sessão/autorização → módulo → pool único.
Auditoria recebe a transação do módulo. Frontend usa cliente/serviços/DTOs comuns;
regras permanecem no backend. Registro puro gera OpenAPI e tipos sem conexão/segredo.

Não há migration nova na #33. Baseline não se aplica sobre banco existente sem
reconciliação. Grants/RLS/Data API exigem confirmação externa conforme
[segurança](../seguranca.md). CODEOWNERS/proteção de branch dependem de responsáveis
e configuração confirmados; não inventar equipes nem alterar settings remotos.
Pendências funcionais e legados em [deferred](./deferred.md).
