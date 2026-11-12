# Viagens institucionais — etapa inicial

`GET /api/viagens/minhas` exige sessão de MOTORISTA e retorna somente viagens vinculadas ao motorista associado ao usuário atual. Ordens SVO não são incluídas. Query estrita: `page` (padrão 1), `limit` (padrão 20, máximo 100) e `status` opcional. Resultado: `{data, meta: {page, limit, total}}`, ordenado por ID decrescente. Registros antigos podem ter status ou dados da solicitação nulos.

O agendamento institucional cria a viagem AGENDADA na mesma transação. Pedidos antigos sem viagem não são alterados automaticamente. Início, conclusão e validação final estão implementados. As fotos do odômetro são enviadas nas operações de início e conclusão; consulta e download de evidências também estão disponíveis.

## Execução

`PATCH /api/viagens/{id}/iniciar` e `PATCH /api/viagens/{id}/concluir` exigem MOTORISTA vinculado e corpo estrito `{"quilometragem":1000,"foto":{"nome":"odometro.png","tipo":"image/png","dadosBase64":"<base64>"}}`. Quilometragem é um inteiro não negativo; a foto deve ser JPEG ou PNG de até 1 MiB. Início aceita AGENDADA; conclusão aceita EM_TRANSPORTE. Os horários reais são registrados pelo servidor em America/Maceio. A quilometragem não pode ser inferior ao odômetro atual ou, na conclusão, ao valor inicial. Operações e auditoria são atômicas. Viagem inexistente ou de outro motorista retorna 404; estado incompatível ou recurso ocupado retorna 409.

A foto é obrigatória em cada transição: INICIAL no início e FINAL na conclusão. O momento é definido pelo servidor, e foto, estado, horário, quilometragem e auditoria são gravados na mesma transação. A conclusão passa imediatamente para CONCLUIDA e não depende de validação posterior. Recursos de viagens EM_ANDAMENTO continuam indisponíveis mesmo após o retorno previsto; a conclusão encerra essa ocupação e preserva outras reservas e bloqueios.

## Validação final

`PATCH /api/viagens/{id}/validar` permite ADM e GESTOR_FROTA. Sem corpo obrigatório; conteúdo enviado é ignorado. Somente viagem CONCLUIDA ainda não validada pode ser validada. O responsável vem da sessão, o instante é registrado pelo banco, e a auditoria é vinculada à solicitação na mesma transação. Uma repetição ou estado incompatível retorna 409; viagem inexistente retorna 404. A resposta inclui `id`, `status`, `validadaPorId` e `validadaEm` em UTC. Quilometragens e horários de execução permanecem inalterados.

A rota `PATCH /api/viagens/{id}/encerrar` utiliza o mesmo corpo, regras e transacao de `concluir`; ambas impedem conclusao duplicada.

`POST /api/viagens` exige ADM/GESTOR_FROTA e corpo estrito `{ "solicitacaoId": "123" }`. Retorna HTTP 200 com a viagem existente criada no agendamento. Pedido inexistente retorna 404; pedido sem viagem retorna 409 e exige analise manual, sem criar registros.

## Consultas

`GET /api/viagens/pendentes-validacao?pagina=1&limit=20` lista somente viagens concluidas ainda nao validadas; acesso restrito a ADM e GESTOR_FROTA.

`GET /api/viagens` é exclusivo de ADM/GESTOR_FROTA, com `page`, `limit`, `status`, `motoristaId`, `inicio` e `fim` opcionais. O período filtra o início real da viagem, em intervalo [inicio,fim), com datas ISO e offset; sem início real, a viagem só aparece em consultas sem filtro de período. Ordem por ID decrescente.

`GET /api/viagens/{id}` e `GET /api/viagens/{id}/historico` permitem gestão e motorista atribuído; viagem inexistente ou de outro motorista retorna 404. Histórico aceita page/limit e exibe apenas eventos realmente registrados de início, conclusão, validação e correção de quilometragem, vinculados pela solicitação; dataHora da auditoria não contém offset. O histórico específico considera somente os tipos estruturados de início, conclusão, validação e correção. O motorista visualiza apenas início e conclusão; validação e correção são restritas à gestão. Eventos antigos com tipo nulo permanecem no histórico geral da solicitação, conforme suas permissões, e não são classificados automaticamente. A migration de tipo_evento deve ser aplicada antes do código.

Horários de execução legados sem fuso são apresentados como locais de America/Maceio por hipótese; não há conversão dos registros.

## Consulta de evidências

`GET /api/viagens/{id}/evidencias` retorna metadados paginados sem bytes; `GET /api/viagens/evidencias/{id}` devolve a imagem original como anexo. ADM e GESTOR_FROTA podem consultar; MOTORISTA somente acessa evidências da viagem atribuída. Ausente ou inacessível retorna 404. O envio ocorre exclusivamente pelo motorista atribuído, junto ao início ou à conclusão; não há endpoint independente de upload.

## Correção justificada de quilometragem

`PATCH /api/viagens/{id}/corrigir-quilometragem` é exclusivo de ADM/GESTOR_FROTA e exige viagem CONCLUIDA, justificativa não vazia de até 2.000 caracteres e pelo menos um dos campos inteiros `kmInicial` ou `kmFinal`. Valores omitidos permanecem. A resposta registra valores anteriores e corrigidos, versão, autor, instante e `odometroAtualizado`. A viagem permanece concluída; motorista, veículo, horários, validação e fotos existentes são preservados.

Quando houver leitura posterior verificável, a correção histórica preserva o odômetro atual e precisa ser coerente com as leituras anteriores e posteriores conhecidas. Para alterar o km final da última leitura, o responsável deve enviar `confirmarOdometroAtual: true`, afirmando que o km final corrigido é a leitura atual conferida. O servidor só atualiza o veículo quando o valor cadastrado coincide com o km final anterior e a cronologia conhecida não aponta leitura posterior. Sem confirmação ou diante de divergência, retornará 409 sem registrar alteração.

O sistema compara viagens institucionais e ordens SVO em execução/concluídas e abastecimentos do veículo. Leituras sem horas suficientes, usos sobrepostos, ordem SVO ativa e abastecimento no período da viagem bloqueiam a correção para conciliação: a data do abastecimento não estabelece a ordem dentro do dia. Essa verificação conservadora não prova a inexistência de leituras externas não registradas.

`GET /api/viagens/{id}/correcoes` lista as versões, justificativas e autores somente para ADM/GESTOR_FROTA, com paginação. Correção, odômetro quando aplicável e auditoria são atômicos.


## Decisões de escopo das SCRUMs 170 a 173

- **SCRUM-170:** conforme decisão informada pelo líder Gabriel, ADM e GESTOR_FROTA selecionam os recursos e confirmam o agendamento, que cria a viagem automaticamente. O POST retorna a viagem já criada; não realiza uma segunda criação. Solicitações antigas sem viagem exigem análise manual.
- **SCRUM-171:** início e conclusão exigem quilometragem e foto do odômetro do motorista atribuído, como descrito acima. A conclusão é imediata e independe da validação posterior.
- **SCRUM-172:** conforme confirmação oficial informada pelo líder Gabriel, a correção de quilometragem pela gestão, com justificativa e histórico auditado, atende ao requisito de apontamento de divergência. Não é necessária uma rota separada de solicitação de correção ao motorista.
- **SCRUM-173:** conforme decisão informada pelo líder, a notificação de atribuição ao motorista atende ao escopo por enquanto. Lembretes programados dependem de nova definição e não estão implementados. A caixa e os avisos de reagendamento existentes permanecem documentados em [notificações](./notificacoes.md).
