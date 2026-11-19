# API — Abastecimentos (#30)

Os registros mantêm os campos e envelopes atuais. A #30 corrige a classificação
técnica de entrada e referência inexistente; o contrato global deriva da #32.

## Rotas

Autenticação: Bearer JWT. Perfis: ADM/GESTOR_FROTA.

| Método e caminho | Corpo | Sucesso existente |
| --- | --- | --- |
| GET /api/abastecimentos | query opcional | {data: array}, id DESC sem filtros; meta na consulta paginada |
| GET /api/abastecimentos/{id} | não | {data: registro com placa/nome}, 200 |
| GET /api/veiculos/{id}/abastecimentos | query opcional | {data: array, meta}, data ASC/id ASC |
| POST /api/abastecimentos | JSON | {data: registro}, 201 |
| GET /api/abastecimentos/{id}/comprovante | não | bytes PDF/JPEG/PNG, 200 |
| POST /api/abastecimentos/{id}/comprovante | multipart, somente arquivo | {data: MetadadosAnexo}, 201 |

Campos: veiculo_id, motorista_id, posto, litragem, valor_total, quilometragem e
data_abastecimento. O corpo deve ser objeto JSON. Motorista, quilometragem e
posto podem ser omitidos ou nulos; zero é uma quilometragem válida. Veículo e
data são obrigatórios, litros e valor devem ser positivos com até duas casas
decimais e quilometragem deve ser um inteiro não negativo. A autoria é obtida
da sessão autenticada, sem confiar em campos enviados pelo cliente. A consulta
inclui placa e nome do motorista quando disponíveis.

A comparação usa o mesmo veículo e a leitura válida de abastecimento mais recente
até a data civil informada (km não nulo e não negativo), na ordem já utilizada
pelos indicadores: data do abastecimento, instante de cadastro e ID. A leitura
anterior é reconsultada dentro da transação após adquirir o lock do veículo;
valor menor recebe `409 ODOMETRO_INCONSISTENTE`, igualdade é aceita. Um registro
com data futura não é tratado como leitura anterior de um cadastro retroativo.
Não há atualização nem inferência de odômetro do veículo.

O confronto com viagens corrigidas permanece exatamente como na main, inclusive
409 para contradição comprovável e ausência de ordem presumida entre viagem e
abastecimento quando só a data civil do mesmo dia está disponível.

## Consultas e histórico — SCRUM-186

A coleção aceita `veiculoId`, `inicio`, `fim`, `pagina` e `limit`. Datas civis
YYYY-MM-DD são inclusivas. Qualquer parâmetro reconhecido ativa paginação:
`meta: {page, limit, total}`, padrão 1/20, limite máximo 100, ordem data DESC/id DESC.
Sem parâmetros reconhecidos, mantém o formato completo e a ordem id DESC da main.
Parâmetros desconhecidos continuam ignorados; reconhecidos duplicados, datas
inválidas, intervalo invertido e paginação inválida retornam 400.

O histórico por veículo usa os mesmos filtros e paginação, em data ASC/id ASC;
`veiculoId` informado na query deve coincidir com o caminho. Veículo existente
sem registros retorna lista vazia/total zero; veículo ou detalhe ausente retorna
404. Total e página usam o mesmo snapshot PostgreSQL. Isso é histórico de
registros de abastecimento, não uma timeline reconstruída de eventos.

## Respostas

### 200 — Consulta (exemplo vazio)

```json
{"data":[]}
```

### 201 — Cadastro concluído

Exemplo fictício do formato retornado (valores ilustrativos, derivados das fixtures
do banco isolado; não constitui nova regra de preenchimento):

```json
{
  "data": {
    "id": "1",
    "veiculo_id": "1",
    "motorista_id": "1",
    "litragem": "10.50",
    "valor_total": "63.00",
    "quilometragem": 1000,
    "data_abastecimento": "2026-01-15T00:00:00.000Z",
    "criado_em": "2026-01-15T15:00:00.000Z",
    "posto": "Posto fictício"
  }
}
```

### 400 — Entrada inválida

JSON malformado:

```json
{"error": {"code": "JSON_INVALIDO", "message": "Envie um JSON válido."}}
```

Tipo/campo incompatível com as colunas atuais (inclui NOT NULL, formato numérico,
limite PostgreSQL e data inválida):

```json
{"error":{"code":"DADOS_INVALIDOS","message":"Confira os tipos e campos exigidos pelo cadastro atual de abastecimento."}}
```

### 401 — Sem sessão

```json
{"error": {"code": "NAO_AUTENTICADO", "message": "Autenticação necessária."}}
```

### 403 — Perfil sem permissão

```json
{"error": {"code": "ACESSO_NEGADO", "message": "Acesso não permitido."}}
```

### 404 — Referência inexistente ou caminho desconhecido

Veículo/motorista inexistente (FK 23503), sem informar constraint ou SQL:

```json
{"error":{"code":"REFERENCIA_INEXISTENTE","message":"Veículo ou motorista não encontrado."}}
```

Caminho desconhecido:

```json
{"error": {"code": "NAO_ENCONTRADO", "message": "Rota não encontrada."}}
```

### 405 — Método inválido

Inclui `Allow` com os métodos da linha correspondente na tabela de rotas.

```json
{"error": {"code": "METODO_NAO_PERMITIDO", "message": "Método não permitido."}}
```

### 413 — Limite de bytes excedido

```json
{"error": {"code": "CORPO_MUITO_GRANDE", "message": "Corpo da requisição muito grande."}}
```

### 415 — Tipo incompatível

```json
{"error": {"code": "TIPO_NAO_SUPORTADO", "message": "Envie o corpo como application/json."}}
```

### 500 — Falha inesperada

Exemplo do fallback comum. Controllers preservam mensagens genéricas próprias; nenhum erro bruto é retornado.

```json
{"error": {"code": "ERRO_INTERNO", "message": "Não foi possível concluir a requisição."}}
```

## Exemplo mínimo

```http
GET /api/abastecimentos HTTP/1.1
Authorization: Bearer <token>
```

## O que a entrega não faz

Não muda permissões, estados ou o cálculo de consumo. Limites, request ID e erros técnicos seguem
[infraestrutura comum](./README.md#infraestrutura-http--28).

## Identidade comum — #29

Todas as rotas acima consultam usuário ativo e perfil atual do banco a cada
requisição, após validar JWT HS256/sub/exp e segredo mínimo de 32 bytes UTF-8.
Conta inativa/inexistente ou token inválido: 401 NAO_AUTENTICADO. Perfil efetivo
fora da lista existente: 403 ACESSO_NEGADO. Falha de consulta não usa claims como
fallback e recebe 500 do tratamento comum. As listas de permissão e operações
permanecem as documentadas acima. Ver [identidade compartilhada](./README.md#identidade-e-usuários--29).


## Tanque completo e comprovante

O POST aceita `tanque_completo` booleano opcional (padrão `false`) e
`comprovante` opcional ou nulo: `{"nome":"foto.png","tipo":"image/png","dadosBase64":"..."}`.
São aceitos JPEG e PNG com assinatura correspondente e até 1 MiB de bytes; o
JSON completo é limitado a 1500 KiB. Nome deve ter até 255 caracteres e não
pode conter separadores de caminho ou caracteres de controle. Entrada inválida
recebe 400; corpo acima do limite recebe 413. O registro e a imagem são gravados
na mesma transação. Cadastro legado continua válido.

A lista e o cadastro retornam `tanque_completo` e `comprovante_nome` (null
quando ausente), sem retornar a imagem. O GET de comprovante exige a mesma
sessão e os mesmos perfis ADM/GESTOR_FROTA, retorna bytes com Content-Type do
arquivo, ou 404 quando ausente. O comprovante legado fica em tabela separada com RLS ativada
sem grants aos papéis públicos; confirme o papel de execução do backend e a
segurança da Data API antes de aplicar em ambiente remoto.

### Comprovante compartilhado — SCRUM-187

O POST de comprovante vincula exclusivamente pelo ID do caminho; rejeita campos
extras no multipart. Usa [anexos compartilhados](./anexos.md), PDF/JPEG/PNG por
assinatura até 5 MiB, validação do recurso, nome seguro e auditoria na mesma
transação. Erros: 400/401/403/404/413/415/500. Falha parcial reverte o novo anexo
sem apagar o comprovante anterior ou o abastecimento.

GET, detalhe e listagem usam o último anexo confirmado (`criado_em DESC,id DESC`),
com fallback para a imagem legada. Upload anterior permanece acessível pela API
autorizada de anexos. Downloads são privados, `nosniff`, `attachment`, sem cache
ou URL pública. O consumidor de abastecimentos aceita PDF e 5 MiB; os demais
consumidores do helper de imagens conservam JPEG/PNG e 1 MiB. Nenhuma tela foi
substituída. O cadastro JSON/limite de 1 MiB permanece inalterado.

O cadastro retorna 409 quando a quilometragem contradiz comprovadamente uma viagem corrigida do veículo. A coincidência de data, sem horário que determine a ordem, não impede o registro.

## Indicadores de abastecimentos — SCRUM-188

`GET /api/abastecimentos/indicadores` exige sessão ADM ou GESTOR_FROTA. Aceita
`veiculoId`, `inicio` e `fim` opcionais. As datas são civis, válidas e inclusivas.
Veículo inexistente retorna 404. Campos desconhecidos, repetidos e intervalos
invertidos retornam 400. A consulta inclui frota geral e SVO conforme os registros.

`data` informa quantidade, totais de litros e custo, custo médio por litro com
quatro casas decimais, primeiro e último dia observado e contagem e faixa de
leituras de odômetro por veículo. Os acumulados usam NUMERIC no PostgreSQL e
são transportados como strings decimais. Período vazio retorna
`SEM_ABASTECIMENTOS`, com custo por litro e datas observadas nulos. Zero de km
registrado é uma leitura. Km mínimo e máximo descrevem as leituras e não
representam distância percorrida.

O consumo usa o método cheio a cheio, em `km/L`. Cada trecho vai de um
registro de tanque completo até o próximo do mesmo veículo. Os dois marcos
precisam estar no período consultado. Divide-se a diferença de odômetro pela
soma dos litros posteriores à abertura até o fechamento, incluindo parciais.

A ordem é data do abastecimento, instante de cadastro quando disponível e ID.
Leituras ausentes ou regressivas dentro do trecho, distância zero e litros não
positivos descartam o trecho. O odômetro repetido dentro de um trecho ainda
permite o cálculo se os marcos tiverem diferença positiva e não houver regressão.
Trechos abertos e abastecimentos anteriores ao primeiro tanque completo não
entram na conta. Sem trecho válido, o estado é `DADOS_INSUFICIENTES`, com
valor nulo. Com trecho válido, o estado é `DISPONIVEL` e o valor é uma string
decimal de quatro casas. A resposta traz o agregado por veículo e, no total,
a divisão entre a soma dos quilômetros e a soma dos litros dos trechos válidos.

A SCRUM-186 é responsável pela API de histórico por veículo e pelo cadastro RF40.
