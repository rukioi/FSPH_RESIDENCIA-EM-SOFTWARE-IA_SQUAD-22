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
| POST /api/abastecimentos/{id}/comprovante | 201 `{data: MetadadosAnexo}` | Multipart compartilhado PDF/JPEG/PNG. |
| GET /api/abastecimentos/{id}/comprovante | 200 bytes PDF/JPEG/PNG | Último comprovante privado; fallback legado; ausente 404. |

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

## Comprovante compartilhado — SCRUM-187

`POST /api/abastecimentos/{id}/comprovante` recebe multipart com somente `arquivo`,
PDF/JPEG/PNG até 5 MiB. Reutiliza integralmente [SCRUM-194](./anexos.md): parser,
assinatura, nome seguro, vínculo validado, storage privado e auditoria transacional.
Retorna `201 {data: MetadadosAnexo}` com autor/instante do servidor. O ID do path
fixa o abastecimento; o form não pode substituí-lo. Sem cadastro existente: 404.

GET no mesmo caminho devolve o último anexo confirmado, com streaming, `nosniff`,
`attachment` e `private, no-store`. Lista/detalhe mantêm `comprovante_nome`, agora
obtido do último anexo compartilhado (uma consulta SQL com LATERAL, sem N+1).
Metadados completos/histórico de uploads: GET `/api/anexos?tipoRegistro=ABASTECIMENTO&registroId=…`.
Nenhum byte/URL pública é incluído no JSON.

Reenvio cria outro anexo e preserva o anterior. Não há remoção, sobrescrita,
retry automático ou idempotência inventada. Upload inválido, conexão interrompida
antes de completar o corpo e falha de auditoria não substituem o comprovante
anterior nem removem o abastecimento. Bytes/metadados/atividade são uma transação.

- 400: formulário/nome/vínculo inválido.
- 401/403: sessão/perfil atual; somente ADM/GESTOR_FROTA.
- 404: abastecimento ou comprovante inexistente.
- 413: arquivo/corpo/partes/campos excedentes.
- 415: não multipart, MIME não permitido ou assinatura incompatível.
- 500: falha técnica com rollback e mensagem genérica.

### Compatibilidade legada

O JSON opcional do cadastro `comprovante: {nome,tipo,dadosBase64}` permanece
JPEG/PNG até 1 MiB, com corpo até 1500 KiB e erros atuais. Sua tabela privada
`abastecimento_comprovante` não foi removida nem copiada. Sem anexo novo, GET usa
os bytes legados; seu autor/instante de upload não são inventados. Cadastro
legado e respectivo comprovante continuam atômicos.

O gate de compatibilidade autoriza somente adicionar PDF ao GET existente e
atualizar sua descrição. JPEG/PNG, status, perfis, headers e contratos dos outros
endpoints permanecem protegidos. O POST é uma operação nova.

A prova em `abastecimentos-anexos-s9.test.ts` usa HTTP → API → PostgreSQL real:
formatos, vínculo, SQL dos bytes, reconsulta, reenvio, 401/403/404/413/415,
falha real de auditoria e interrupção de conexão. Os testes legados permanecem.
O frontend do PR #61 foi incorporado ao fechamento integrado: download privado
PDF/JPEG/PNG funciona pelo cliente comum. O formulário de cadastro preserva o
comprovante legado JPEG/PNG até 1 MiB; ainda não há interface para upload multipart
PDF/reenvio da SCRUM-194. A API desse upload foi validada separadamente, sem alegar
que essa ação está disponível na tela.

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

## Integração do frontend / PR #61 — SCRUM-189/191

A entrega `182c1dc` foi aplicada localmente sem merge/commit. Telas preservadas,
com os ajustes de compatibilidade necessários: km NULL mostra “Não informada” no
cadastro, lista, detalhe e histórico; zero permanece `0 km`. Motorista e km vazios
são enviados como NULL, usando a validação RF40. Detalhe/histórico e indicadores
consomem os endpoints publicados e validam os schemas; erro não vira soma zero.
As rotas novas usam os mesmos perfis ADM/GESTOR_FROTA, com autorização efetiva no
backend. IDs negativos reservados ao seed são exibidos na coleção sem tentar gerar
links de detalhe positivo; o contrato dos caminhos não foi ampliado.

A lista principal mantém a consulta completa legada e os filtros/paginação visuais
do Gustavo. O histórico por veículo pagina/filtra no servidor. Indicadores exibem
agregados reais, custo/litro e km observados; consumo por distância continua
indisponível por regra pendente. O cadastro mantém o comprovante legado atômico,
sem transformar upload posterior em parte de uma transação inexistente.

Documentos, anexos genéricos, notas e Dashboard consolidado não possuem telas
publicadas nesse PR. Seus testes HTTP/PostgreSQL não equivalem a E2E dessas telas.
O registro da validação integrada e limites está em
[fechamento Sprint 9](../database/sprint9-abastecimentos.md).
