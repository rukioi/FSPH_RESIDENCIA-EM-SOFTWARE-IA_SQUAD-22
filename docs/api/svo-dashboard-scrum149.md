# SCRUM-149 — indicadores operacionais SVO

As três rotas abaixo exigem JWT de usuário ativo com perfil `ATENDENTE_SVO` (401 sem sessão, 403 para outros perfis), retornam JSON real ou 500 em falha SQL, nunca um zero fictício. Parâmetros desconhecidos, duplicados ou inválidos: 400.

| GET | Query | Uso FE |
| --- | --- | --- |
| `/api/svo/dashboard` | `?periodo=hoje\|7d\|30d` (padrão hoje) | Cards IND-10 a IND-13 e distribuição IND-14. Resposta inclui `periodo`, `inicio`, `fim`, `indicadores` e `visaoGeral`. |
| `/api/svo/dashboard/filas` | sem parâmetros | Fila atual de triagem e de ordens aguardando despacho, com `total` e primeiros 10 itens operacionais, sem dados pessoais. |
| `/api/svo/dashboard/atividades` | `?limite=10` (1–50) | IND-07: log real ordenado por `data_hora DESC NULLS LAST, id DESC`. |

## Definições verificáveis

- IND-10 `aguardandoTriagem` conta **todos** os registros com estado `AGUARDANDO_TRIAGEM`, independentemente do filtro de período; indicador de fila atual.
- IND-11 `confirmadasSvo` conta decisões `CONFIRMADA_SVO` cujo `triado_em` está no intervalo civil local.
- IND-12 `ordensColeta` conta ordens SVO cujas solicitações foram confirmadas dentro do período. A ordem é inserida na **mesma transação** que escreve `triado_em` pela SCRUM-131; o banco legado não possui `ordem_coleta.criado_em`, portanto esse é o marcador temporal existente, não uma data inventada. Exclui ordens legadas sem confirmação conciliada.
- IND-13 `encaminhadasIml` conta decisões `ENCAMINHADA_IML` no período; **não** conta ordem para IML.
- IND-14 `visaoGeral` é distribuição pelo estado atual das solicitações **criadas no período** (`criado_em`) e expõe a categoria `semClassificacao` para históricos com `status_triagem=NULL`; não os converte para pendentes ou confirmados.
- IND-07 filtra exclusivamente as seis descrições fechadas e conhecidas do módulo SVO no `log_atividade`; não inclui ocorrências de transporte institucional. A tabela legada não contém FK SVO; atividades futuras com novas descrições exigem vínculo/auditoria estruturada. Não incluir dados médicos, CPF, email ou telefone.
- Corte temporal: `timezone('America/Maceio',CURRENT_TIMESTAMP)::date` do banco. `hoje` = dia corrente local; `7d` inclui seis dias anteriores; `30d` inclui 29 anteriores. Colunas históricas são `timestamp without time zone`: a definição assume persistência em horário civil local e necessita reconciliação operacional se houver registros legados em outro fuso.

Esse endpoint **não é** o dashboard institucional de `/api/dashboard/gestor`, cuja tarefa e permissões permanecem separadas. Não renderizar zeros de erro como dados válidos.

## Próximas verificações

Testar SQL com 0, 1 e múltiplas solicitações, triagens e ordens e comparar agregações SQL vs HTTP no PostgreSQL Docker isolado, além de 401/403/400, CI, tipos gerados e consumo FE SCRUM-133. Não considerar implementado/validado em produção antes desses testes.
