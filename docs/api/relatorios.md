# Relatórios operacionais

RF71–RF75: consultas e exportações baseadas nos registros atuais do PostgreSQL/Supabase,
pela conexão única do backend. Não há migration, tabela de relatório, seed ou nova
conexão Supabase no navegador. Os arquivos são gerados em memória a partir da resposta
validada da API. Nenhum dado operacional é persistido no navegador.

## API e autorização

| Método e caminho | Perfil efetivo |
| --- | --- |
| GET /api/relatorios | ADM, GESTOR_FROTA |
| GET /api/relatorios/recursos | ADM, GESTOR_FROTA |
| GET /api/svo/relatorios | ATENDENTE_SVO |
| GET /api/svo/relatorios/recursos | ATENDENTE_SVO |

Os catálogos retornam somente `{data:{veiculos:[{id,placa,modelo}],motoristas:[{id,nome}]}}`.
Não aceitam parâmetros. Autorização antecede a consulta. Sem sessão: 401; perfil atual
negado: 403. Reutiliza JWT, sessão atual e controle de acesso comuns. Não concede a
motorista/solicitante acesso geral aos relatórios nem amplia acesso de ADM ao SVO.
As respostas usam `Cache-Control: no-store`.

Consulta de relatório: `inicio` e `fim` obrigatórios no formato YYYY-MM-DD, ambos
inclusivos, no máximo 366 dias. Na frota, `tipo` é obrigatório:

| Tipo | Registros e critério temporal |
| --- | --- |
| viagens | Execuções existentes em viagem; início real, ou saída prevista quando ainda não iniciada. |
| motoristas | Mesmas execuções, com filtro opcional de motorista. |
| solicitacoes | Solicitações existentes, por saída prevista e status da solicitação. |
| veiculos | Demandas com veículo atribuído, incluindo pedidos sem execução; saída prevista, ou início real nas viagens legadas sem pedido. |
| ocorrencias | Correções de quilometragem e respectivas justificativas; data de registro em America/Maceio. |
| abastecimentos | Registros por data do abastecimento; odômetro não é distância percorrida. |
| svo | Somente endpoint SVO (tipo padrão); início da coleta, ou criação da solicitação se não iniciada. |

`veiculoId` e `motoristaId` são BIGINT positivos em string, opcionais. `status` é
opcional e validado para o tipo; ocorrências/abastecimentos não têm filtro de status.
Para viagens/motoristas, a tela inicia em CONCLUIDA; o usuário pode escolher outro
estado ou todos. Demandas por veículo usam o status da execução quando houver,
senão o da solicitação. O filtro de veículo/motorista usa o recurso da execução
quando preenchido, ou o atribuído no pedido. Sem filtro de recurso, as listagens
apresentam registros individuais, não um agrupamento por entidade.

Parâmetros desconhecidos, repetidos, datas inválidas, status incompatível e IDs fora
do intervalo PostgreSQL retornam 400 DADOS_INVALIDOS. Mais de 5.000 registros retorna
422 RELATORIO_MUITO_GRANDE; não há truncamento silencioso. Reduza o período/filtros.
Ordenação decrescente por data e ID, com desempate determinístico. Uma consulta SQL
produz as linhas e o resumo calculado dessas mesmas linhas.

Exemplo: `GET /api/relatorios?tipo=viagens&inicio=2026-11-01&fim=2026-11-30&status=CONCLUIDA`

Resposta `{data:{tipo,titulo,inicio,fim,criterioPeriodo,geradoEm,filtros,colunas,linhas,resumo,observacoes}}`.
Colunas contêm chave, título e tipo; linhas são projeções explícitas com string,
número ou null. IDs/NUMERIC preservam string; odômetros e distâncias são números.
Datas civis são formatadas explicitamente pelo SQL, sem conversão do driver ou do
fuso do navegador. `geradoEm` é instante ISO UTC. O resumo informa registros,
quilometragem concluída conhecida e quantidade de concluídas sem km válido.

## Coerência e limites da fonte

Quilometragem soma somente `km_final - km_inicial` de execuções CONCLUIDA com
odômetros não negativos e não decrescentes. Zero registrado é diferente de null.
Na ausência de qualquer distância conhecida, o total permanece null. O status da
validação gerencial é exibido separadamente; conclusão não implica validação.
Solicitações sem execução não contam como viagem realizada. Não se usa o odômetro
atual do veículo como distância de um período.

A base atual não tem cadastro estruturado de desvios e outras ocorrências. O
relatório correspondente identifica explicitamente a cobertura de correções com
justificativa; não inventa eventos ou converte auditoria genérica em ocorrência.
Ordens SVO sem início nem criação vinculada não têm período conhecido e não entram
em consultas temporais. Não se retornam nome de falecido, endereço, contato,
observação médica, CPF, CNH, senha ou bytes de arquivos.

## Interface e exportações

Menu Relatórios e atalhos separados em solicitações, veículos, motoristas e
abastecimentos. SVO possui menu e endpoint próprios. Filtros ficam em memória;
alterá-los desabilita a exportação até nova geração. Leituras antigas são abortadas
e nunca substituem a consulta atual. Loading, vazio, erro/nova tentativa e geração
de arquivo são anunciados por status/alert. A tabela pagina 25 linhas localmente
após os filtros serem executados no backend; não há filtragem operacional local.

CSV: UTF-8 com BOM, separador ponto e vírgula, aspas/quebras de linha escapadas,
proteção de fórmulas em células textuais. Cabeçalho tabular na primeira linha;
datas inclusivas no nome do arquivo. Null vira célula vazia. XLSX real com aba
Dados e Informações (filtros, critério, horário de geração e observações), cabeçalho
fixo e filtro de coluna. Strings não viram fórmulas; BIGINT/NUMERIC não perdem precisão.
PDF com contexto, cabeçalho repetido, quebra de texto e numeração de página.
Todos exportam o snapshot completo, inclusive as linhas fora da página visível.
Bibliotecas ExcelJS, jsPDF e AutoTable são carregadas sob demanda na exportação.

## Verificação

- `npx vitest run --config vitest.relatorios.config.ts`: validação, resumo, limites,
  privacidade da projeção, CSV e reabertura de XLSX/PDF paginado; sem banco.
- `npx playwright test --config playwright.relatorios.config.ts`: aplicação em
  390/768/1280 px, teclado, paginação, filtros, recuperação de erro, acesso SVO e
  downloads completos, com API fictícia declarada. Capturas em test-results/relatorios.
- `backend/tests/integration/relatorios.test.ts`: HTTP e SQL reais exclusivamente
  no harness isolado, incluindo sessão/perfil atual, filtros, datas e totais.

Nesta execução o harness recusou a instância/volume preexistente sem comprovante
do checkout. A suíte padrão e provas HTTP/SQL isoladas não foram aprovadas; essa
limitação não é substituída pelos testes puros ou pela consulta do esquema remoto.

Resultados finais: 29 testes puros e 6 testes de interface passaram; typecheck,
lint, api:check, client:check e build passaram. PDF exportado reaberto com três
páginas e último registro presente; XLSX reaberto nos testes preserva tipos/IDs.
Capturas dos três tamanhos e PDF conferidas visualmente. A execução E2E geral
foi impedida pela porta 5173 já ocupada; o processo existente foi preservado.
