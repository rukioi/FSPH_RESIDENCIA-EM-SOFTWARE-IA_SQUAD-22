# Abertura institucional por ADM e Gestor — SCRUM-259

Regra confirmada pelo responsável das tarefas em 26/11/2026. RF05 e RF06 exigem autoria e rastreabilidade. RF08 e RF09 tratam do solicitante e da origem da demanda. RF10 prevê análise de solicitações externas pela gestão.

## Matriz de criação

| Sessão atual | Pode abrir? | Solicitante vinculado | Ator da criação |
| --- | --- | --- | --- |
| Solicitante interno ativo | Sim, conforme o contrato vigente | Próprio usuário da sessão | Próprio usuário da sessão |
| ADM ou gestor de frota ativo | Sim, em nome próprio | Próprio usuário da sessão | Próprio usuário da sessão |
| Motorista ou atendente SVO | Não | — | — |
| Sessão ausente, inválida ou inativa | Não | — | — |

## Regras comuns

- Reutilizar `POST /api/solicitacoes-viagem`. O corpo continua estrito. O ator autenticado, o protocolo e o estado inicial vêm do servidor.
- Gravar `solicitacao_viagem.solicitante_id` como vínculo do pedido e `log_atividade.usuario_id` como ator, com `tipo_evento = 'solicitacao_viagem_criada'` e `solicitacao_viagem_id` na mesma transação. Uma falha na atividade reverte a criação.
- O pedido inicia em `PENDENTE`. Aprovação e agendamento continuam sendo ações próprias. Na consulta do solicitante interno, o vínculo existente continua limitando lista, detalhe e histórico aos pedidos daquele usuário.
- `origem` no contrato atual significa local de partida. A abertura abordada aqui é interna. A identidade, os campos e o tratamento da origem externa precisam de definição de produto antes de qualquer suporte a esse fluxo.
- O corpo da [API](../api/solicitacoes.md) exige `origem`, `destino`, `finalidade`, `dataHoraSaida` e `qtdPassageiros`. Uma requisição com `solicitanteId`, `atorId` ou `status` recebe `400`. Sessão inválida recebe `401` e perfil fora da matriz recebe `403`.

## Integração e evidência

- A tela da SCRUM-256 envia o mesmo formulário institucional e pode exibir o nome da sessão como solicitante.
- Validar `201`, `400`, `401`, `403`, autoria persistida, visibilidade do pedido pelo vínculo e a regressão do solicitante no PostgreSQL isolado.
