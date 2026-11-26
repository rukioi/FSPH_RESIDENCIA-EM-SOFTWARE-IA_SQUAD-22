# Sprint 10 — Indicadores e alertas de manutenção

A tela compartilhada de ADM e Gestor de Frota consulta
`GET /api/manutencoes/indicadores` com o binding gerado. O painel usa a
referência de data civil e instante devolvida pelo PostgreSQL em
America/Maceio. A tela atualiza ao abrir, voltar do detalhe, mudar um
filtro compatível, repetir a consulta ou confirmar uma mutação.

| Card | Campo lido da API | Escopo |
| --- | --- | --- |
| Veículos em manutenção | estoqueAtual.veiculosEmManutencao | Veículos distintos |
| Agendadas | estoqueAtual.agendadas | Ocorrências atuais |
| Em andamento | estoqueAtual.emAndamento | Ocorrências atuais |
| Concluídas | periodo.concluidas | Conclusão efetiva |
| Atrasadas | estoqueAtual.atrasadas | Ocorrências atuais |
| Custo no período | periodo.custo.totalConhecido | Entrada planejada de não canceladas |

Veículo e tipo afetam o painel. Datas afetam Concluídas e Custo. Status,
busca e página pertencem à listagem. O custo decimal é formatado em pt-BR
sem conversão para ponto flutuante. O painel distingue zero informado,
custo desconhecido e ausência de ocorrências. As contagens indicam a
cobertura do custo conhecido.

Preventivas aparecem no banner amarelo quando o total confirmado é
positivo. Em zero, o painel segue diretamente para os filtros. O botão do
card Atrasadas expande links para ocorrências efetivamente identificadas
pelo servidor. As listas preservam a ordem, o total e o limite da API.
O status e a etiqueta de atraso da listagem continuam independentes.
Alertas visuais funcionam com emissão periódica desligada.

Links e retorno preservam filtros estruturados e página na URL. A busca
fica no estado de navegação, vinculada a uma impressão de mão única da
credencial de sessão. A credencial não é registrada no histórico. A
mesma sessão pode recarregar a página e usar voltar ou avançar. Outra
sessão ignora o estado de busca. Consultas antigas são abortadas ou
ignoradas. Painel e lista têm loading, erro e retry independentes; a
revogação remove os resultados privados.

## Execução local

Na raiz da worktree de integração, reservar 3000 e 5173 em loopback.
O PostgreSQL isolado é o perfil `s10-integracao-clean`, banco
`fsph_s10_integracao_clean`, porta 55520.

```powershell
$env:FSPH_TEST_PROFILE = 's10-integracao-clean'
$env:MANUTENCAO_ALERTAS_ATIVOS = 'false'
npm run db:test:start
node --import tsx tests/e2e/fixtures/test-environment.ts
```

Acesse http://127.0.0.1:5173/login. Use as contas sintéticas
`t1-adm@example.invalid` e `t1-gestor_frota@example.invalid` com a senha
documentada para o seed em [README do banco](./database/README.md).
Abra `/admin/manutencoes` ou `/gestor/manutencoes`. O backend escuta
em http://127.0.0.1:3000. Encerre o bootstrap no terminal com Ctrl+C.

O E2E usa `tests/e2e/manutencoes-indicadores.spec.ts` e
`tests/e2e/manutencoes.spec.ts`. Os logs desta rodada ficam em
`.test-db/s236/`. Usar a configuração de evidência local com captura,
vídeo e trace desligados. A confirmação AA integral e a coleta visual
e de Network ficam para a validação final.

## Roteiro manual

1. Comparar o cabeçalho, indicadores e cards com as referências em 390,
   768, 1280 e desktop amplo, com o menu aberto e recolhido. Percorrer os
   controles por teclado e avaliar contraste, foco e alvos.
2. Filtrar por um veículo sintético sem preventivas. Registrar uma
   preventiva elegível, editar seus campos, abrir seu detalhe no banner,
   iniciar e concluir. Conferir o banner aparecendo e desaparecendo,
   contagens, histórico, custo e persistência após recarregar.
3. Aplicar filtro de tipo e datas, depois status, busca e página. Abrir
   detalhe, usar Voltar/Avançar e recarregar. Conferir estado restaurado
   e consulta de indicadores limitada aos quatro parâmetros do contrato.
4. Abrir um atraso pela expansão do card. Conferir total, limite, status
   original, etiqueta de atraso e link. Cancelar outra ocorrência
   agendada e conferir sua exclusão do custo.
5. Em cenários sintéticos, conferir conflito com reserva, disponibilidade
   institucional e SVO e preservação de compromissos. Conferir login
   autorizado e proibido e recuperação da falha de rede.
6. Conferir a caixa de notificações existente. A ativação do emissor para
   uma prova dedicada exige ambiente isolado e não faz parte do roteiro
   de indicadores com emissão desligada.

## Checklist integrado

| Tarefa | Evidência para a validação final |
| --- | --- |
| SCRUM-230 | Especificação, DER conceitual, estados, conflitos, pendências e evidências indicadas pelo Jira |
| SCRUM-231 | Instalação limpa, upgrade, ACL/RLS, constraints, autoria, rollback e hashes |
| SCRUM-232 | Contratos, sete endpoints, autorização, ETag/If-Match, auditoria, histórico e concorrência |
| SCRUM-233 | Locks e guardas bilaterais para reservas, instituição, viagem ativa e SVO |
| SCRUM-234 | Agregados, custo, limites, revisões, emissor, idempotência, primeira leitura e rollback |
| SCRUM-235 | Cadastro, edição, transições, histórico, veículo, conflito de versão e reload |
| SCRUM-236 | Cards, banner, atraso, recortes, reserva, falha de rede, persistência, acesso e responsividade |

Relacionar logs, comandos, SHA, perfil e resultado por cenário. Depois
da aprovação manual, reunir capturas 390/768/1280, teclado/foco e Network
sanitizado, sem credenciais ou dados privados. O runtime compartilhado,
a homologação FSPH e as pendências anteriores do portal do motorista
continuam registrados em suas respectivas frentes.

## Resultados locais

| Verificação | Resultado | Saída | Log em .test-db/s236/ |
| --- | --- | --- | --- |
| Vitest geral | 1.375 aprovados, cinco casos legados filtrados | 0 | geral.log |
| Banco | 182 aprovados, cinco casos legados filtrados | 0 | banco.log |
| Frontend focado | 21 aprovados, com sobreposição ao geral | 0 | focado-entrega.log |
| E2E com PostgreSQL real | Nove cenários SCRUM-236 e dez regressões SCRUM-235 | 0 | e2e-entrega.log |
| Typecheck, build, contratos, schema e diff | Aprovados | 0 | estaticos-exit.log e estaticos-final.log |
| Lint | TripPlaceholderScreen sem uso, pendência da main | 1 | lint-final.log |

O E2E confirmou quatro larguras, navegação por teclado, expansão,
amostra de contraste do banner, alvos medidos e ausência de overflow.
Nenhuma captura foi coletada. Os quatro E2E conhecidos do portal do
motorista não foram reexecutados nesta rodada.

## Validação da candidata consolidada — 26/11/2026

Base Git `1a1a7b2`. A worktree candidata preserva a cadeia de 18
migrations e exclui as duas flags de smoke da aplicação. Os resultados
das rodadas anteriores acima foram mantidos como registro histórico.

| Verificação | Resultado na candidata |
| --- | --- |
| Lint, typecheck e build | Aprovados. O build informou aviso de tamanho de chunks. |
| OpenAPI, cliente, schema, DER e metadados | `api:check`, `client:check` e `db:docs:check` aprovados. |
| Banco real isolado | Instalação limpa das 18 migrations e 214 testes aprovados em `s10-candidata-clean`. |
| Suíte geral e revalidação | Primeira execução com 1.433 aprovados e quatro falhas. A revalidação cobriu os arquivos afetados, com 24 testes de alertas/cron aprovados e o rollback da SCRUM-231 aprovado na suíte de banco. A suíte geral não foi repetida integralmente após os ajustes. |
| E2E com PostgreSQL isolado | 19 casos de Manutenções e Indicadores aprovados após incluir `s10-candidata-e2e` na lista de perfis aceitos. Os oito casos focados de Solicitações do Gestor e despacho SVO já haviam passado nesse mesmo perfil. |

Os testes usaram PostgreSQL local comprovado pelo harness, nas portas
55527 e 55528. Nenhuma conexão com o Supabase foi feita nesta etapa.

No ambiente compartilhado, o responsável já havia confirmado a aplicação
manual das 18 migrations e a validação visual com o smoke da worktree
consolidada. Essa validação antecede a candidata e não comprova execução
do cron ou novas escritas nela. A chave do Storage foi rejeitada pelo
gateway na conferência das fotos de veículos. O ponto segue separado da
entrega de Manutenções.
