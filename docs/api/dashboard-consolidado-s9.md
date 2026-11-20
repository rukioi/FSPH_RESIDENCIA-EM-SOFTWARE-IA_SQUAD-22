# Dashboard consolidado — SCRUM-195

`GET /api/dashboard` oferece visões pelo perfil da sessão atual.

- **ADM e Gestor de Frota** recebem `data.visao: GESTAO`. Filas, frota e atividade vêm das consultas da SCRUM-164. A execução de viagens usa `viagem.data_inicio`, a mesma fronteira real do filtro da API S8. Próximas viagens são até dez agendadas com saída ainda futura no período selecionado, ordenadas por saída e ID.
- **Atendente SVO** recebe `data.visao: SVO`. Usa os repositórios da SCRUM-149 para contagens, filas e atividades. A visão exclui os dados documentais e de frota da gestão.
- Sem sessão a resposta é 401. Os demais perfis recebem 403. Os endpoints legados `/gestor`, `/graficos` e `/pendencias` mantêm formatos e acesso de gestão.

Gestão e SVO aceitam `hoje`, `7d`, `30d` e `personalizado` em `GET /api/dashboard`. Para o personalizado, envie `inicio` e `fim` em ISO 8601 com offset explícito, com duração de até 31 dias. As agregações usam começo inclusivo e fim exclusivo no fuso America/Maceio.

No SVO, o período limita triagens, ordens geradas e a coorte de solicitações. A fila atual e as atividades recentes continuam independentes do filtro. `operacional.inicio` e `operacional.fim` repetem os instantes ISO informados no personalizado. Para Hoje, 7d e 30d, continuam sendo as datas civis inicial e final inclusivas. A rota `/api/svo/dashboard` conserva seus três períodos originais.

As filas de gestão e as contagens de documentos vencidos e vencendo hoje refletem o estado atual. Os documentos usam a data civil da consulta legada do PostgreSQL.

A contagem de viagens executadas inclui registros cujo início real cai no período. Uma solicitação planejada sem início real não aparece nessa contagem. Zero representa agregação sem linhas. Falhas nas fontes retornam 500. Cada módulo usa seu snapshot ao compor a resposta.

## Disponibilidade provisória de motoristas

A visão de ADM e Gestor retorna `disponibilidadeMotoristas` com `estado: PROVISORIA`, `candidatos` e `motivo: SEM_ESCALA_E_MATRIZ_CNH`. O total é informativo e inclui apenas motoristas com status atual `DISPONIVEL`, conta ativa de motorista, CNH preenchida e validade que cobre hoje e o último dia civil da janela.

A consulta reutiliza os bloqueios de alocação existentes. Ordens SVO em deslocamento ou transporte, viagens institucionais em andamento e reservas com sobreposição retiram o motorista do total. Reservas ativas sem retorno confiável bloqueiam de forma conservadora. O período é inclusivo no início e exclusivo no fim. O contador usa o cadastro atual e serve para identificar candidatos às consultas de gestão.

Escala, jornada e aptidão para um veículo específico ainda exigem confirmação. O campo `gestao.motoristasDisponiveis` e as regras de despacho preservam a semântica anterior. A API fornece só o total, sem dados pessoais.

## Outros indicadores e integração

- IND-09. Documentos de veículo e CNHs a vencer incluem as fases MES, SEMANA e HOJE da janela RF46. O total exclui vencidos, que têm contagem própria. O período histórico de viagens não interfere na posição documental atual.
- Abastecimentos. A visão Gestão reutiliza os [indicadores da SCRUM-188](./abastecimentos.md#indicadores-de-abastecimentos--scrum-188) nos dias civis abrangidos pela seleção, em America/Maceio. O consumo usa trechos cheio a cheio em km/L e informa dados insuficientes quando a janela não contém um trecho válido.
- A adoção no frontend está na SCRUM-199. A visão consolidada acrescenta campos ao antigo envelope vazio de `/api/dashboard`.
