# SVO — Operação de frota e execução (SCRUM-132, 145, 147 e 148)

## Autorização (backend, nunca apenas no React)

- Todas as rotas exigem JWT de usuário **ativo**. `ATENDENTE_SVO` consulta elegibilidade, capacidade, realiza despacho e cancela uma ordem aberta.
- `MOTORISTA` acessa exclusivamente suas ordens através de `motorista.usuario_id` (usuário persistido na sessão), sem poder alterar/consultar ordem atribuída a outro motorista. Não existe novo perfil `EQUIPE_SVO`, nem autenticação da população.
- `401` sem autenticação, `403` por perfil, `404` para ID ausente ou ordem não pertencente ao motorista, `400` para corpo/ID/parâmetro inválidos, `409` por guarda de estado/capacidade/conflito. Erros internos não expõem SQL nem dados pessoais.

## Endpoints para o frontend (8 novas operações e despacho legado reforçado)

| Método | Rota | Perfil | Resposta e uso |
| --- | --- | --- | --- |
| GET | `/api/svo/recursos-disponiveis` | ATENDENTE_SVO | `{motoristas:[{id,nome}],veiculos:[{id,placa,modelo,ocupacao,capacidade,disponivel}]}`; consulta informativa sem parâmetros |
| GET | `/api/svo/veiculos/{id}/ocupacao` | ATENDENTE_SVO | `{id,placa,ocupacao,capacidade:4,disponivel}`; lotação atual |
| GET | `/api/svo/ordens-coleta/minhas` | MOTORISTA | `{data:[{id,codigo,solicitacaoCodigo,status,quantidadeCorpos,veiculoId,kmInicial,kmFinal,enderecoRemocao,dataInicio,dataFim}]}` |
| GET | `/api/svo/ordens-coleta/minhas/{id}` | MOTORISTA | Detalhe mínimo da própria ordem; 404 para ordem alheia |
| PATCH | `/api/svo/ordens-coleta/{id}/iniciar` | MOTORISTA | `{"kmInicial":100}`; apenas EM_DESLOCAMENTO com `data_inicio=NULL` |
| PATCH | `/api/svo/ordens-coleta/{id}/etapa` | MOTORISTA | Sem body; EM_DESLOCAMENTO iniciada → EM_TRANSPORTE |
| PATCH | `/api/svo/ordens-coleta/{id}/concluir` | MOTORISTA | `{"kmFinal":110}`; EM_TRANSPORTE → CONCLUIDA se kmFinal≥kmInicial |
| PATCH | `/api/svo/ordens-coleta/{id}/cancelar` | ATENDENTE_SVO | `{}`; ordem aberta → CANCELADA, libera ocupação |

A rota existente `PATCH /api/svo/ordens-coleta/{id}/despachar`, perfil `ATENDENTE_SVO`, recebe `{"motoristaId":38110,"veiculoId":38120}` e mantém o envelope legado `id`, `motorista_id`, `veiculo_id`, `status='EM_DESLOCAMENTO'`. **Não confundir o estado de despacho EM_DESLOCAMENTO com a execução iniciada:** o `PATCH /iniciar` registra `data_inicio` e km inicial. Não inventamos estado `PRONTA_PARA_INICIAR` no enum de ordem.

## Regras e concorrência

1. Veículo elegível é uma **Chevrolet S10 própria**, marcada `is_svo=TRUE`, em estado `DISPONIVEL`, com capacidade cadastrada de pelo menos quatro e sem documentos registrados vencidos/irregulares. Motorista precisa estar `DISPONIVEL`, ter CNH não vencida e usuário ativo no papel `MOTORISTA`. A ausência de cadastro de documento específico não comprova regularidade completa: conferência documental permanece atividade da gestão.
2. Somente solicitações `CONFIRMADA_SVO` com `ordem_coleta.quantidade_corpos` explícita entre 1 e 4 podem ser despachadas. Ordens legadas com quantidade `NULL` não são presumidas como um corpo.
3. A ocupação é a **soma da quantidade de corpos** das ordens em `EM_DESLOCAMENTO` ou `EM_TRANSPORTE` vinculadas à mesma S10; ela começa no despacho e é liberada com conclusão ou cancelamento. `0..4`, jamais `5/4`.
4. O PATCH de despacho bloqueia a linha da ordem, depois do motorista e do veículo (`FOR UPDATE`) antes de recalcular lotação e confirmar a alocação. Um segundo pedido concorrente revalida a ocupação após adquirir o lock; retorna 409 sem gravação parcial.
5. Reservas institucionais ativas ou futuras (`AGENDADA`, `PRONTA_PARA_INICIAR`, `EM_ANDAMENTO`) impedem usar recurso SVO, pois não existe horário confiável de retorno. Um motorista não assume duas ordens ativas simultâneas; uma S10 pode compartilhar capacidade física entre ordens distintas até o teto de quatro se houver outros motoristas aptos. As verificações de disponibilidade da frota institucional continuam bloqueando SVO ativo.
6. A execução de ordem é autorizada exclusivamente pelo vínculo motorista-usuário e atualiza status, quilometragem e eventos auditados na mesma transação. Transição repetida ou fora de ordem retorna 409.
7. Datas civis `timestamp without time zone` são apresentadas sem `Z`, sem conversão de fuso. IDs BIGINT são strings nas novas operações.

## Limitações explícitas para a review

- A base atual contém colunas `foto_odometro_inicio`/`foto_odometro_fim` como `varchar(255)`, mas **não possui um serviço de upload/armazenamento privado com associação auditável e controle de acesso por ordem**. Este pacote não implementa uploads nem afirma cumprir as evidências fotográficas RN10/RNF17–19. A solução depende de integração com módulo de evidências ou migration/API versionada em tarefa apropriada. Não aceitar URL livre ou Base64 como substituto de comprovante armazenado.
- A verificação de escala/jornada e da regularidade documental exige fonte persistida e regras validadas; o schema atual só permite validar status, CNH, documentos de veículo existentes e conflitos. Não mostrar elegibilidade como autorização garantida: o PATCH revalida tudo.
- Sem nova migration e sem escrita no Supabase compartilhado. Se o cadastro das três S10 estiver com `capacidade_obitos=0` ou sem vínculo com MOTORISTA ativo, corrigir **os dados via gestão aprovada**, não criar defaults ou seeds nesta entrega. A API deve falhar fechada.
- O histórico SVO está baseado em descrições exatas do `log_atividade`, pois a tabela legada não possui FK específica para ordem SVO. Eventos novos são acrescentados ao catálogo fechado; futura estrutura de auditoria pode adotar FK versionada.

## Verificações e evidências necessárias

- Banco Docker isolado: executar `npm run test:db` e `npm test`, cobrindo 0/4, 3/4, 4/4, tentativa 5ª, cancelamento, conclusão, acesso alheio, 400/401/403/404/409 e concorrência. Obter prints Thunder Client e comparar com SELECT de leitura.
- Contratos: `npm run api:generate`, `npm run client:generate`, `npm run api:check`, `npm run client:check`.
- Geral: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`; testar portas 3000/5173 livres e manter o banco isolado ligado.
- Documentar resultado e pendência de fotos antes de declarar SCRUM-148 totalmente concluída.
