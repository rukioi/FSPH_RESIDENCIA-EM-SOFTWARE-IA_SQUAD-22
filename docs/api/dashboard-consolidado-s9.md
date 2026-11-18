# Dashboard consolidado — SCRUM-195

`GET /api/dashboard` oferece visões pelo perfil da sessão atual.

- **ADM e Gestor de Frota** recebem `data.visao: GESTAO`. Filas, frota e atividade vêm das consultas da SCRUM-164. A execução de viagens usa `viagem.data_inicio`, a mesma fronteira real do filtro da API S8. Próximas viagens são até dez agendadas com saída ainda futura no período selecionado, ordenadas por saída e ID.
- **Atendente SVO** recebe `data.visao: SVO`. Usa os repositórios da SCRUM-149 para contagens, filas e atividades. A visão exclui os dados documentais e de frota da gestão.
- Sem sessão a resposta é 401. Os demais perfis recebem 403. Os endpoints legados `/gestor`, `/graficos` e `/pendencias` mantêm formatos e acesso de gestão.

Gestão aceita `hoje`, `7d`, `30d` e `personalizado`, com começo inclusivo e fim exclusivo no fuso institucional já usado na SCRUM-164 e na S8. O SVO preserva `hoje`, `7d` e `30d`. As filas e a contagem de vencidos e vencimentos de hoje refletem o estado atual. Os documentos usam a data civil da consulta legada do PostgreSQL.

A contagem de viagens executadas inclui registros cujo início real cai no período. Uma solicitação planejada sem início real não aparece nessa contagem. Zero representa agregação sem linhas. Falhas nas fontes retornam 500. Cada módulo usa seu snapshot ao compor a resposta.

## Pendências de aceite

- IND-09. Os vencidos e vencimentos do dia estão disponíveis. A janela de documentos a vencer e alertas depende da decisão RF46 da SCRUM-193.
- Disponibilidade de motoristas. O indicador legado mantém a indisponibilidade quando falta escala/jornada confiável.
- Abastecimentos. A resposta informa `FONTE_SCRUM_188_PENDENTE` até que o agregador seja integrado. A regra de consumo por distância continua na SCRUM-188.
- A adoção no frontend está na SCRUM-199. A visão consolidada acrescenta campos ao antigo envelope vazio de `/api/dashboard`.
