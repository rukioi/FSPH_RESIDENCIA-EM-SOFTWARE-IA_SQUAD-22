# SCRUM-179: integração de abastecimentos

A base da Sprint 8 e o PR #63 devem ser conciliados antes da entrega; um PR aberto não comprova integração.

- Preservar bloqueios transacionais, ordem existente e validação de quilometragem entre viagens, abastecimentos e SVO nos repositories, controllers e testes.
- Preservar registros do mesmo dia: sem horário, não presumir a ordem. Conflitos comprovados retornam 409; confirmação do odômetro sem ordem comprovável não pode atualizar o veículo.
- Conciliar as alterações do PR #63 de motorista e quilometragem opcionais com consultas, relatórios e contratos. Dados ausentes não representam zero nem autorizam inventar consumo.
- Preservar autenticação, controle de acesso e privacidade dos comprovantes; verificar o vínculo com a infraestrutura de anexos.
- Comparar versões de migration, inclusive 20261111000000, e confirmar com o responsável pelo banco o histórico aplicado. Não reescrever versões aplicadas nem executar migrations sobrepostas.
- Reexecutar testes reais de concorrência, rollback, mesmo dia e SVO após a conciliação, além dos contratos e relatórios. Os testes locais validam a base atual, não provam compatibilidade com alterações ainda não integradas.

Arquivos para conciliação:

- Sprint 8: backend/src/modules/viagens/viagens.correcao.repository.ts, backend/src/modules/viagens/quilometragem-abastecimento.ts e backend/src/modules/abastecimentos/abastecimentos.controller.ts.
- PR #63: backend/src/modules/abastecimentos/abastecimentos.repository.ts, abastecimentos.service.ts, abastecimentos.schemas.ts, abastecimentos.comprovante.ts e módulos de anexos.
- Verificar também backend/src/shared/contract/registry.ts, docs/api/abastecimentos.md, frontend/src/shared/services/abastecimentos.service.ts e os testes de contratos, relatórios e comprovantes.
- A migration 20261111000000_db_s9_01_abastecimentos_rf40.sql do PR #63 colide em versão com a migration Sprint 8 de tipo_evento. A solução depende da confirmação do histórico real pelo responsável, sem reescrever uma versão aplicada.

## Testes exclusivos da Sprint 9

A suíte padrão mantém seus testes existentes e não executa os dois testes PostgreSQL da Sprint 9. Eles usam configuração própria; não carregam arquivos de ambiente do desenvolvedor. Os testes estáticos não necessitam de banco:

    node --test backend/tests/database/sprint9-preflight-static.test.mjs backend/tests/database/s9-preflight-harness.test.mjs

Para preparar um ambiente novo, na raiz do checkout, instale as dependências do projeto, confirme que Docker está disponível e que a imagem local postgres:17 existe. O nome e volume fsph-s9-preflight-2026 e a porta local 55492 precisam estar livres. Não reutilize ou exclua recursos existentes. Execute uma única vez:

    node backend/tests/database/s9-preflight-provision.mjs

Esse comando é explícito: cria container e volume exclusivos, gera manifesto ignorado pelo Git para este checkout, define marcador, cria os papéis de teste e aplica as migrations versionadas exclusivamente no banco isolado, sem seed. Se houver recurso preexistente, manifesto, porta ocupada ou versões de migration duplicadas, interrompe; falhas podem deixar recursos criados para inspeção. Não copie manifestos nem ajuste o verificador para forçar a execução. Se já existir um ambiente válido desse checkout, não provisione novamente.

Com o container de preflight iniciado e sem outras conexões ao banco dedicado, execute:

    npx vitest run --config backend/tests/database/vitest-s9-preflight.config.mjs

O teste de concorrência usa o harness oficial e exige um perfil Sprint 9 vinculado ao checkout, com banco isolado já provisionado e acesso administrativo apropriado para fixtures. Por exemplo, somente após comprovar a identidade e disponibilidade do perfil `s9-integracao-segura`, no PowerShell:

    $env:FSPH_TEST_PROFILE = 's9-integracao-segura'
    npx vitest run --config backend/tests/integration/vitest-s9-concorrencia.config.mjs

Cada configuração confere a identidade Docker, checkout, porta, volume, nonce, marcador e ausência de conexões concorrentes antes dos testes. As consultas do preflight são somente leitura; testes de integração criam e limpam fixtures e um trigger temporário no banco exclusivo. Não execute esses comandos contra banco compartilhado. O CI padrão não provisiona nem executa automaticamente esse ambiente adicional; para validar esses testes em CI é necessário configurar uma etapa explícita com Docker e a imagem local exigida.
