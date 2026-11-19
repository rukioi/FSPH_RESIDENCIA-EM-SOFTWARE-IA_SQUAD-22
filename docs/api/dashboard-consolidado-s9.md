# Dashboard consolidado — SCRUM-195

`GET /api/dashboard` oferece visões pelo perfil da sessão atual.

- **ADM e Gestor de Frota** recebem `data.visao: GESTAO`. Filas, frota e atividade vêm das consultas da SCRUM-164. A execução de viagens usa `viagem.data_inicio`, a mesma fronteira real do filtro da API S8. Próximas viagens são até dez agendadas com saída ainda futura no período selecionado, ordenadas por saída e ID.
- **Atendente SVO** recebe `data.visao: SVO`. Usa os repositórios da SCRUM-149 para contagens, filas e atividades. A visão exclui os dados documentais e de frota da gestão.
- Sem sessão a resposta é 401. Os demais perfis recebem 403. Os endpoints legados `/gestor`, `/graficos` e `/pendencias` mantêm formatos e acesso de gestão.

Gestão aceita `hoje`, `7d`, `30d` e `personalizado`, com começo inclusivo e fim exclusivo no fuso institucional já usado na SCRUM-164 e na S8. O SVO preserva `hoje`, `7d` e `30d`. As filas e a contagem de vencidos e vencimentos de hoje refletem o estado atual. Os documentos usam a data civil da consulta legada do PostgreSQL.

A contagem de viagens executadas inclui registros cujo início real cai no período. Uma solicitação planejada sem início real não aparece nessa contagem. Zero representa agregação sem linhas. Falhas nas fontes retornam 500. Cada módulo usa seu snapshot ao compor a resposta.

## Pendências de aceite

- IND-09. Documentos de veículo e CNHs a vencer incluem as fases MES, SEMANA e HOJE da janela RF46. O total exclui vencidos, que têm contagem própria. O período histórico de viagens não interfere na posição documental atual.
- Disponibilidade de motoristas. O indicador legado mantém a indisponibilidade quando falta escala/jornada confiável.
- Abastecimentos. A visão Gestão reutiliza os [indicadores da SCRUM-188](./abastecimentos.md#indicadores-de-abastecimentos--scrum-188) nos dias civis abrangidos pela seleção, em America/Maceio. A regra de consumo por distância continua pendente na SCRUM-188.
- A adoção no frontend está na SCRUM-199. A visão consolidada acrescenta campos ao antigo envelope vazio de `/api/dashboard`.
