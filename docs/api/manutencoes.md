# API de manutenções de veículos — SCRUM-232

A autenticação usa Bearer JWT e consulta o perfil ativo da sessão. Todos os
endpoints são exclusivos de `ADM` e `GESTOR_FROTA`. O perfil alegado no JWT
não substitui o perfil efetivo do banco.

**Estado local da entrega.** As escritas estão conectadas à guarda transacional
da SCRUM-233. Um conflito de alocação retorna 409 e preserva os compromissos
existentes. A homologação institucional formal permanece pendente.

| Método e caminho | Entrada | Resposta de sucesso |
| --- | --- | --- |
| GET /api/manutencoes | Filtros e paginação | 200 página de resumos |
| GET /api/manutencoes/{id} | ID | 200 detalhe com ETag |
| GET /api/veiculos/{id}/manutencoes | ID do veículo e filtros da lista, exceto veiculoId | 200 página de resumos |
| GET /api/manutencoes/{id}/historico | ID e paginação | 200 página de eventos |
| POST /api/manutencoes | Dados de cadastro | 201 detalhe, Location e ETag após commit |
| PATCH /api/manutencoes/{id} | If-Match e campos de edição | 200 detalhe e ETag após commit |
| PATCH /api/manutencoes/{id}/status | If-Match e comando explícito | 200 detalhe e ETag após commit |

## Leituras

IDs são strings decimais BIGINT com sinal e faixa checada, inclusive fixtures
negativas. Caminho fora do padrão retorna 404. ID numérico fora da faixa retorna
400. Filtros aceitos: `veiculoId`, `tipo`, `status`, `inicio`, `fim`, `q`,
`page` e `limit`. Período filtra **entrada civil** com limites inclusivos em
`America/Maceio`. A data final isolada ou inicial isolada também é aceita.
Parâmetros desconhecidos, duplicados e período invertido retornam 400.

A busca literal por placa, descrição ou prestador ignora caixa, usa parâmetros,
preserva `%` e `_` como texto e aceita até 255 caracteres após aparar bordas.
Página padrão 1, limite padrão 20, máximo 100. Página e total vêm do mesmo
snapshot. Ordenação por entrada e ID decrescentes. Página além da última
mantém o total real. Veículo ou manutenção inexistente retorna 404 nas rotas
de detalhe ou histórico por recurso.

```json
{"data":[],"meta":{"page":1,"limit":20,"total":0}}
```

O resumo contém ID, veículo (ID, placa e vínculo), tipo, descrição, status,
entrada, conclusão prevista, prestador, custo e `atrasada`. O detalhe acrescenta
início, conclusão e cancelamento efetivos, quilometragem, observações, criação,
atualização e `versao`. A autoria aparece no histórico e na auditoria.
Atraso é derivado: agendada após o dia civil de entrada ou em andamento após o dia
civil da previsão. Concluída e cancelada não registram atraso corrente.

O histórico retorna apenas eventos persistidos, com ID, manutenção, evento,
estados, snapshots anteriores e posteriores, autor ID e instante do registro.
Os snapshots incluem datas civis, início, conclusão e cancelamento. Ordem por
`registrado_em DESC, id DESC`.

## Entradas de escrita e versão

Cadastro exige `veiculoId`, `tipo`, `descricao`, `entrada`,
`conclusaoPrevista` e `quilometragem`. Aceita `prestador`, `custo`,
`observacoes` e `iniciarImediatamente`. Status ordinário é AGENDADA.
Início imediato exige CORRETIVA e guarda. O servidor registra o início real.

```json
{"veiculoId":"-27003","tipo":"CORRETIVA","descricao":"Serviço sintético","entrada":"2026-12-10","conclusaoPrevista":"2026-12-10","quilometragem":0,"custo":"0.00"}
```

Datas planejadas são YYYY-MM-DD válidas e inclusivas. O limite exclusivo é a
meia-noite local do dia civil seguinte à previsão. Datas operacionais de
correção usam ISO 8601 com offset e precisão de microssegundos no banco.
Descrição até 2.000 caracteres, prestador até 255, observações até 2.000 e
quilometragem de 0 a 2.147.483.647. Textos preenchidos precisam conter conteúdo
após aparar bordas. Custo é uma string decimal finita não negativa ou null.
No PATCH, omissão mantém a informação, null limpa campo opcional e "0" mantém
zero conhecido. Objetos estritos recusam autoria, veículo em edição, status e
metadados internos.

O PATCH de edição é parcial e não vazio. Tipo, descrição, datas planejadas,
quilometragem, prestador, custo e observações são editáveis nos quatro estados.
Correções de instantes de início e conclusão são admitidas em CONCLUIDA.
O veículo permanece fixo.

Ambos os PATCHes exigem If-Match com o ETag devolvido pelo detalhe. Token
ausente ou inválido retorna 400. Revisão obsoleta em escrita conectada
retorna 409. O token é derivado de `atualizado_em` com microssegundos. A
comparação ocorre sob locks. A versão avança a cada alteração efetiva.

| Estado anterior | Ação | Estado posterior |
| --- | --- | --- |
| AGENDADA | INICIAR | EM_ANDAMENTO |
| AGENDADA | CANCELAR | CANCELADA |
| EM_ANDAMENTO | CONCLUIR | CONCLUIDA |
| CONCLUIDA | REABRIR | AGENDADA ou EM_ANDAMENTO |
| CANCELADA | REATIVAR | AGENDADA ou EM_ANDAMENTO |

O início antecipado exige disponibilidade. Cancelar não exige motivo.
`alteracoes` permite editar campos de negócio junto à ação, inclusive novas
datas planejadas, sem sucesso parcial. Mudança de janela ativa, início,
reativação e reabertura passam pela guarda com o estado e a janela resultantes.

```json
{"acao":"REATIVAR","destino":"AGENDADA","alteracoes":{"entrada":"2026-12-10","conclusaoPrevista":"2026-12-11"}}
```

## Transações e erros

A ordem de lock é veículo e depois ocorrência. A guarda recebe a mesma
transação, veículo bloqueado, ocorrência atual, janela, destino e operação.
Mudança corrente, histórico e auditoria confirmam em conjunto. A trilha própria
registra CONCLUSAO, CORRECAO_DATAS, REABERTURA, CANCELAMENTO e REATIVACAO.
A auditoria comum identifica ato, manutenção e autor real, com o instante da
mutação e os pares antes/depois de tipo e datas alteradas. O feed usa esses
campos de forma explícita, sem incluir texto livre, observações ou custos.
O log geral não possui FK de manutenção nem campos de auditoria estruturada
para tipo. Consulta estrutural desses dados por ciclo exige decisão separada.

Erros seguem `{error:{code,message,fields?}}` e `X-Request-Id`. Códigos
principais: 400 DADOS_INVALIDOS, 401 NAO_AUTENTICADO, 403 ACESSO_NEGADO,
404 NAO_ENCONTRADO, 409 ESTADO_INCOMPATIVEL, VERSAO_DESATUALIZADA ou CONFLITO_ALOCACAO e 500 ERRO_INTERNO. JSON inválido, corpo acima de 64 KiB, tipo de
mídia e métodos não suportados usam os tratamentos comuns. Erros técnicos
não incluem SQL, nomes de constraints ou stack.

## Disponibilidade na SCRUM-233

O cadastro, a reativação, a reabertura, o início e a edição da janela de
manutenção ativa revalidam a alocação depois do lock do veículo, em READ
COMMITTED. A janela civil em America/Maceio inclui o dia de conclusão
previsto e termina na meia-noite local seguinte. Uma janela vencida ainda
bloqueia, e uma ocorrência em andamento bloqueia até sua conclusão.

Manutenções podem se sobrepor e permanecer em andamento simultaneamente.
Concluir ou cancelar em uma transição válida remove somente o impedimento
daquela ocorrência. O status manual do veículo continua independente.

A guarda preserva reservas conhecidas incompatíveis. Cadastro futuro como
AGENDADA é permitido durante viagem ou SVO ativo com fim incerto, mas iniciar
a manutenção exige que o veículo tenha saído de uso. Editar uma janela que
mantenha um conflito legado conhecido retorna 409. A eventual exceção para
redução de conflito depende de decisão posterior.

## Indicadores e alertas de manutenção — SCRUM-234

`GET /api/manutencoes/indicadores` exige sessão ativa com perfil efetivo
`ADM` (administrador) ou `GESTOR_FROTA`. Aceita apenas `inicio`, `fim`,
`veiculoId` (BIGINT como string) e `tipo` (`PREVENTIVA` ou `CORRETIVA`).
Datas civis reais usam AAAA-MM-DD em America/Maceio. Limites são opcionais
e independentes. Datas iguais abrangem o dia inteiro. O fim civil informado
é inclusivo e convertido para a meia-noite local seguinte, exclusiva,
serializada como instante UTC. Para 9999-12-31 a resposta usa ano expandido
`+010000`. Sem fim, `fimExclusivo` é null.

A resposta tem os grupos `referencia`, `filtros`, `estoqueAtual`, `periodo`
e `alertas`. O relógio vem do PostgreSQL e a resposta usa um único snapshot.

| Campo | Recorte |
| --- | --- |
| estoqueAtual.veiculosEmManutencao | União de IDs de veículos com ocorrência em andamento e veículos com status manual EM_MANUTENCAO. Com filtro de tipo, conta somente veículos com ocorrência em andamento do tipo selecionado. |
| estoqueAtual.agendadas, emAndamento, atrasadas | Contagens de ocorrências atuais. Agendadas atrasam após o dia de entrada, e as em andamento após o dia de conclusão prevista. Estados terminais ficam fora de atrasadas. |
| periodo.concluidas | Ocorrências atualmente CONCLUIDA, pela conclusão efetiva. Reabertura retira a ocorrência desse total enquanto aberta e preserva o histórico. |
| periodo.custo | Ocorrências AGENDADA, EM_ANDAMENTO ou CONCLUIDA pela entrada planejada. Soma NUMERIC no banco e total decimal em string. NULL representa custo desconhecido; zero informado conta como conhecido. |
| alertas.preventivasProximos7Dias | PREVENTIVA e AGENDADA, da data civil de referência inclusiva até a referência + 7 dias exclusiva. |
| alertas.atrasos | Mesmo critério e mesma referência da contagem de atrasadas. |

Estoque e alertas aplicam veículo e tipo, independentemente do período.
Cada grupo de alertas retorna total exato e até 20 itens com ID, veículo
(ID e placa), tipo, status, entrada e conclusão prevista. Preventivas
ordenam por entrada e ID. Atrasos ordenam pela data responsável pelo
atraso e ID. Atraso exibido e impedimento de alocação têm regras próprias.

Custos de 500.00, NULL e 0.00 retornam
`{"totalConhecido":"500.00","comCustoInformado":2,"comCustoDesconhecido":1}`.
Sem custos conhecidos, o total é null. As contagens distinguem falta de
ocorrências de ocorrências com custo desconhecido. As chaves temporais
`criterioConcluidas` e `criterioCusto` retornam `CONCLUSAO_EFETIVA` e
`ENTRADA_PLANEJADA`, respectivamente.

Respostas comuns: 200, 400 DADOS_INVALIDOS (inclusive filtros duplicados,
vazios, desconhecidos e intervalo invertido), 401 NAO_AUTENTICADO,
403 ACESSO_NEGADO, 404 NAO_ENCONTRADO para veículo inexistente e
500 ERRO_INTERNO sanitizado em falha de leitura. O dispatcher preserva
405 e Allow para métodos incompatíveis. Veículo existente sem ocorrências
retorna 200. O GET é somente leitura e não gera avisos na caixa.


### Revisões de emissão

O GET de indicadores permanece somente leitura e usa os mesmos critérios
civis do emissor. A revisão por ocorrência e alerta participa da mesma
transação da atualização, histórico e auditoria. Reabertura, reativação,
saída da elegibilidade em reagendamento e saída durante INICIAR seguem
as regras do [emissor](./notificacoes.md#alertas-de-manutenção--scrum-234).
