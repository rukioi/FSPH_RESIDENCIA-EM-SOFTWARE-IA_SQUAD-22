# API — Abastecimentos / RF40 (SCRUM-185–188)

Fonte: SCRUM-179/180 e subtasks 185–188. OpenAPI, inventário e tipos são gerados
pelos scripts oficiais. Banco: [reconciliação RF40](../database/sprint9-abastecimentos.md).

## Identidade e rotas

Todas exigem Bearer JWT e usuário ativo com perfil atual **ADM/GESTOR_FROTA**
consultado no backend. ATENDENTE_SVO não ganha permissão de gestão: incluir veículos
`is_svo` não significa liberar o endpoint ao perfil SVO. Não há filtro de segurança
confiado ao React. Mantém autenticação/RBAC compartilhados e SQL parametrizado.

| Método/caminho | Sucesso | Observação |
| --- | --- | --- |
| POST /api/abastecimentos | 201 `{data: detalhe}` | Cadastro, autoria, auditoria e comprovante legado atômicos. |
| GET /api/abastecimentos | 200 `{data: []}` ou `{data: [], meta}` | Sem filtros reconhecidos preserva lista completa por id DESC. |
| GET /api/abastecimentos/{id} | 200 `{data: detalhe}` | Consulta persistida; ausente 404. |
| GET /api/veiculos/{id}/abastecimentos | 200 `{data: [], meta}` | Histórico cronológico por data ASC, id ASC. |
| GET /api/abastecimentos/indicadores | 200 `{data: indicadores}` | Agregado real sem inferência de consumo por distância. |
| GET /api/abastecimentos/{id}/comprovante | 200 bytes JPEG/PNG | Download privado legado; ausente 404. |

`id` no caminho é inteiro positivo até BIGINT; campos de referência também aceitam
IDs negativos reservados às fixtures. IDs e NUMERIC continuam strings nas respostas.
Datas dos registros mantêm a serialização ISO legada do driver; filtros são datas
civis `YYYY-MM-DD` inclusivas, sem mudança de fuso ou backfill histórico.

## Cadastro e detalhe

Corpo JSON (`CriarAbastecimentoRF40`):

- `veiculo_id`: obrigatório, número inteiro seguro ou string BIGINT; FK da frota toda.
- `data_abastecimento`: data civil válida, obrigatória.
- `litragem`, `valor_total`: positivos, no máximo 99999999.99 e duas casas decimais;
  número ou string decimal com ponto. Rejeita zero, negativos, NaN e precisão excedente.
- `motorista_id`: referência opcional/nula; se informada deve existir.
- `quilometragem`: opcional/nula, inteiro 0..2147483647; zero é observação real,
  NULL é ausência. Não atualiza odômetros/viagens nem deduz distância.
- `posto`: string até 255 caracteres, opcional/nula; vazio é preservado como NULL.
- `tanque_completo`: booleano opcional, padrão false; dado preservado sem fórmula de consumo.
- `comprovante`: contrato legado abaixo, opcional/nulo.

Campos extras seguem ignorados. `criado_por_id` enviado pelo cliente nunca é usado:
novos registros recebem o usuário autenticado. Legados permanecem com autoria NULL,
sem atribuir o cadastro antigo a um usuário fictício. A auditoria registra somente
“Registrou o abastecimento ID …”, sem CPF, contato, imagem ou payload pessoal.
Falha na imagem ou auditoria reverte o cadastro; sucesso só após commit no servidor.
Não existe chave de deduplicação aprovada: data/valor iguais não provam duplicidade.

Detalhe/lista incluem os campos antigos (`id`, `veiculo_id`, `motorista_id`, litros,
valor, km, data, `criado_em`, posto, tanque, `comprovante_nome`) e
`veiculo_placa`, `motorista_nome`, `criado_por_id`. Sem bytes, CPF, email ou hash.
O DTO de transporte legado `CriarAbastecimento` permanece exportado para migração
coordenada; as restrições atuais estão em `CriarAbastecimentoRF40`.
GET/POST mantêm `Abastecimentos`/`RespostaAbastecimento` para compatibilidade dos
consumidores. Autoria/campos adicionais são extensões opcionais nesses DTOs legados;
o servidor os retorna em todas as respostas atuais. O novo detalhe e o histórico
usam DTOs que exigem explicitamente esses campos, admitindo NULL nos dados históricos.

## Filtros e histórico

Coleção: `veiculoId`, `inicio`, `fim`, `pagina` e `limit`.
Histórico por veículo: `inicio`, `fim`, `pagina` e `limit`.
Datas inicial/final são independentes; se ambas presentes, início ≤ fim.

Com qualquer parâmetro reconhecido a coleção usa paginação: página 1, limite 20,
limite máximo 100, ordem data DESC/id DESC. `meta` mantém a convenção compartilhada
`{page, limit, total}`. Lista/total usam o mesmo snapshot PostgreSQL.
Parâmetro reconhecido vazio, repetido, inválido ou período invertido: 400.
Parâmetros desconhecidos da coleção continuam ignorados por compatibilidade.
Histórico sempre é paginado e ascendente; veículo ausente 404, veículo existente
sem registros retorna `data: []`, `meta.total: 0`. O histórico é a sequência real
por veículo, não uma timeline reconstruída no frontend.

## Indicadores sem regra inventada (SCRUM-188 parcial)

Filtros aceitos: `veiculoId`, `inicio`, `fim`. Query estrita; paginação não se aplica
à soma. A mesma consulta atende frota comum e SVO. Totais e observações usam o
mesmo snapshot; filtros não alteram segurança ou autoria.

| Campo | Regra |
| --- | --- |
| `quantidade` | COUNT dos registros filtrados. |
| `totalLitros` | SUM(litragem), string decimal com duas casas. |
| `totalCusto` | SUM(valor_total), string decimal com duas casas. |
| `custoPorLitro` | SUM(valor_total)/SUM(litragem), NUMERIC no PostgreSQL, arredondado a quatro casas. Não é média simples dos preços. NULL sem denominador válido. |
| `periodoObservado` | Menor/maior data dos registros filtrados; ambos NULL sem registros. |
| `kmObservadosPorVeiculo` | Veículo, contagem de leituras com/sem km, menor/maior km observado (NULL sem leitura). Não representa distância percorrida. |
| `estado` | DISPONIVEL ou SEM_ABASTECIMENTOS. |
| `consumoPorDistancia` | `{valor:null, estado:"INDISPONIVEL", motivo:"REGRA_DE_NEGOCIO_PENDENTE"}`. |

Sem registros, somas zero e quantidade zero são resultados reais do agregado;
custo/litro permanece NULL. Falha de banco retorna erro, nunca totais zerados.
Leituras únicas, ausentes, repetidas ou regressivas não geram consumo, distância,
correção automática ou km fictício. O histórico conserva cada observação.

**Decisão pendente confirmada pelo responsável:** Jira/RF43 não definem quais litros
pertencem ao intervalo entre leituras, nem fórmula por tanque completo. Não calcular
km/L, L/100 km ou diferença de odômetro como consumo. A parte de consumo por distância
da SCRUM-188 **não está concluída**. Nenhum cálculo fica a cargo do frontend.

## Comprovante legado e bloqueio SCRUM-187

Preserva o JSON opcional `comprovante: {nome,tipo,dadosBase64}`, JPEG/PNG com assinatura
correspondente, até 1 MiB; corpo completo até 1500 KiB. Nome com até 255 caracteres,
sem separadores de caminho/controles; dados vazios, MIME/assinatura divergentes e
base64 inválido são 400 `ARQUIVO_INVALIDO`. Bytes validados são gravados como Buffer
em BYTEA e conferidos no download real. Nenhum backfill de arquivos antigos é feito.

Download usa `Content-Disposition: attachment`, `nosniff` e `Cache-Control: private,
no-store`, com a mesma sessão/RBAC. Tabela separada com FK e RLS, sem grants públicos.
Permissões históricas dos demais objetos não foram alteradas: rollout remoto depende
[das condições de segurança](../seguranca.md).

SCRUM-194 está A fazer e o contrato compartilhado de anexos ainda não existe nesta
main. Portanto **SCRUM-187 continua bloqueada** para PDF, API compartilhada, metadados
de anexo/autoria e erros específicos 413/415 de upload. Não foi criado segundo storage,
rota pública nem adaptação especulativa. O 415 atual é de Content-Type do corpo JSON,
e não comprova o futuro upload da SCRUM-194.

### O que já é verificável sem a SCRUM-194

- O comprovante é opcional no cadastro JSON, com **um arquivo por abastecimento**.
  `abastecimento_comprovante.abastecimento_id` é simultaneamente PK e FK; impede
  arquivo órfão ou dois arquivos no mesmo vínculo legado. A exclusão em cascata
  não publica nem autoriza uma operação de exclusão na API.
- Metadados existentes no banco: `abastecimento_id`, `nome` e `tipo`, além dos bytes.
  Lista/detalhe expõem `comprovante_nome`; o download identifica o MIME em
  `Content-Type`. A tabela não possui autor/instante próprios de upload. O
  `criado_por_id` retornado pertence ao **cadastro do abastecimento**, não é um
  novo metadado de anexo. Nenhum campo ou URL pública foi inventado.
- GET repetido de detalhe/download recupera os dados persistidos. Sessão inválida
  ou conta inativa: 401; perfil atual sem permissão: 403; registro/arquivo ausente:
  404. O JWT antigo não prevalece sobre o perfil atual no banco.
- Imagem com exatamente 1 MiB é aceita; acima disso, o legado retorna 400
  `ARQUIVO_INVALIDO`. O 413 `CORPO_MUITO_GRANDE` é o limite de **1500 KiB do JSON**;
  415 `TIPO_NAO_SUPORTADO` é Content-Type explícito diferente de application/json.
  Ausência desse header mantém a tolerância do leitor compartilhado legado.
- Falha na imagem/auditoria reverte a transação inteira. A prova inclui falha de
  auditoria **após a inserção da imagem**, sem cadastro, arquivo ou atividade
  remanescentes, tanto em erro 500 quanto em conflito transacional 409. Interrupção
  durante a leitura do JSON não confirma cadastro parcial.
- Validação legada verifica assinatura JPEG/PNG; isso não equivale a comprovar
  decodificação integral de qualquer imagem ou suporte a PDF.

### Ponto exato que impede concluir a SCRUM-187

É necessário publicar e integrar o contrato da **SCRUM-194**, dependente do modelo
da SCRUM-192: forma de upload compartilhado, vínculo ao recurso, metadados/autoria,
armazenamento privado e regras de autorização/download. Só então será possível
implementar e validar PDF/JPEG/PNG no fluxo compartilhado, limites e erros 413/415
específicos do arquivo, reenvio/substituição e compensação de falhas desse fluxo.
As rotas propostas no Jira não são contratos entregues. Não se cria antecipadamente
`POST /api/abastecimentos/{id}/comprovante`, novo storage ou DTO de anexo especulativo.

### Cobertura independente da fórmula — SCRUM-188

A parte não ambígua está implementada e testada: quantidades, litros/custos em
NUMERIC, custo/litro ponderado, período observado, leituras de km, filtros inclusivos
e independentes por data/veículo, frota comum e SVO. Os novos cenários isolados de
0/1/3 registros não dependem dos cadastros de outro teste. Preços/litros diferentes
comprovam `SUM(custo)/SUM(litros)`, distinguindo-o de uma média simples e de erros
de ponto flutuante. Km ausente/repetido/regressivo conserva as observações e a
cronologia, sem modificar o veículo.

O estado geral `SEM_ABASTECIMENTOS` significa consulta real vazia; `DISPONIVEL`
significa que os agregados existentes podem ser exibidos, **não** que consumo por
distância esteja calculável. Este continua com valor null e motivo de regra pendente
em todos os casos, inclusive com três leituras. Falha do repositório é propagada,
não convertida em zero/vazio. Sua prova unitária usa injeção de falha, separada dos
testes reais HTTP/PostgreSQL de valores e persistência.

Para concluir a SCRUM-188 falta a regra aprovada que defina leituras comparáveis,
os litros associados a cada intervalo, unidade/arredondamento do consumo e como
tratar ausências/inconsistências. Depois dela, implementar o cálculo e seus testes
reais e atualizar o contrato. Não foi assumido tanque cheio, km/L ou L/100 km.

## Erros

Envelope comum `{error:{code,message}}`, sem SQL, stack ou payload privado:

| HTTP | Condição/código |
| --- | --- |
| 400 | DADOS_INVALIDOS (entrada/query); JSON_INVALIDO; ARQUIVO_INVALIDO legado. |
| 401 | NAO_AUTENTICADO: JWT ausente/inválido, conta ausente/inativa. |
| 403 | ACESSO_NEGADO: perfil atual fora de ADM/GESTOR_FROTA. |
| 404 | NAO_ENCONTRADO (detalhe/arquivo); REFERENCIA_INEXISTENTE (veículo/motorista/autor). |
| 409 | CONFLITO no cadastro por conflito transacional 40001/40P01; nada foi confirmado. Não é deduplicação por heurística. |
| 405 | METODO_NAO_PERMITIDO + Allow, aplicado antes de auth pelo dispatcher comum. |
| 413 | CORPO_MUITO_GRANDE pelo limite do JSON. |
| 415 | TIPO_NAO_SUPORTADO, corpo deve ser application/json. |
| 500 | ERRO_INTERNO, falha inesperada; não se apresenta como sucesso ou lista vazia. |

## Exemplos para integração (fixtures isoladas, não dados de produção)

```json
{"veiculo_id":91861,"litragem":"12.34","valor_total":"56.78","data_abastecimento":"2026-10-03","quilometragem":null}
```

```http
GET /api/abastecimentos?veiculoId=91861&inicio=2026-10-01&fim=2026-10-31&pagina=1&limit=20
GET /api/veiculos/91861/abastecimentos?pagina=1&limit=20
GET /api/abastecimentos/indicadores?veiculoId=91861&inicio=2026-10-01&fim=2026-10-31
```

Aplicar o token recebido pelo login real como Bearer, sem versioná-lo. Exemplos são
o formato dos cenários HTTP→API→PostgreSQL em `abastecimentos-s9.test.ts`, não mocks.
Os testes removem seus próprios registros ao terminar; esses IDs não são dados de apresentação.

## Handoff para Gustavo / SCRUM-189/191

Tipos/registros foram gerados pelos comandos oficiais. Nenhuma tela foi alterada.
A célula de km em `frontend/src/pages/abastecimentos/Abastecimentos.tsx` precisa
tratar NULL como “Não informada”; `numero.format(null)` não pode produzir falso zero.
Esse ajuste foi explicitamente reservado ao Gustavo. Usar os novos DTOs/endpoints
para filtros/histórico/indicadores; não recalcular consumo no React nem tratar ausência
como zero. O fluxo frontend completo só pode ser aceito após essa integração.
