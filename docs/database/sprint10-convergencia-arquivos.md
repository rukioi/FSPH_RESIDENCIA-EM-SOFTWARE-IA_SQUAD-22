# Convergência de arquivos legados · SCRUM-244

Inventário da revisão `d93253d`, baseada no [schema](./schema.sql), no
[catálogo versionado](./schema-metadata.json) e nos consumidores vigentes. A
checagem `npm run db:docs:check` compara esses artefatos com o PostgreSQL Docker
isolado. A [SCRUM-245](https://unit-tiradentes.atlassian.net/browse/SCRUM-245)
usa esta matriz para ensaiar a cópia. A mudança de leitura ou escrita da API
depende da [SCRUM-223](https://unit-tiradentes.atlassian.net/browse/SCRUM-223).

## Origens e equivalência

| Origem e identidade | Equivalência no armazenamento comum | Restrições e exceções |
| --- | --- | --- |
| `documento_veiculo.id` (PK BIGINT), `veiculo_id` (FK anulável), `arquivo_dados bytea`, `arquivo_nome varchar(255)`, `arquivo_tipo varchar(100)` (os três anuláveis). | Bytes → `dados`, nome → `nome`, MIME → `tipo`. Vínculo por `anexo.documento_veiculo_id`, preservando o ID do documento e sua FK para o veículo. Validade, tipo documental e situação ficam no documento. | Um arquivo opcional por documento no legado. Multipart aceita PDF/JPEG/PNG até 5 MiB. A tabela não guarda autor ou instante do arquivo. Colunas ausentes, veículo sem vínculo, assinatura incompatível e bytes gravados como texto hexadecimal ficam fora do piloto. Não usar o autor ou instante de uma versão documental sem evidência que ligue aquela versão aos bytes. |
| `abastecimento_comprovante.abastecimento_id` (PK BIGINT e FK com ON DELETE CASCADE), `nome text`, `tipo text`, `dados bytea` obrigatórios. | Nome, MIME e bytes para as colunas homônimas. Vínculo por `anexo.abastecimento_id`. A ponte mantém uma correspondência por ID de abastecimento para o comprovante legado. | Um comprovante legado por abastecimento. CHECK de nome de 1 a 255 caracteres, JPEG/PNG e 1 a 1.048.576 bytes. A linha não tem autoria ou instante. `abastecimento.criado_por_id` pode ser nulo e é autoria do cadastro. `data_abastecimento` é data civil e `criado_em` do abastecimento é timestamp sem fuso. Só incluir se houver prova verificável de autoria e instante do arquivo. |
| `viagem_evidencia.id` (PK BIGINT), `viagem_id` e `enviado_por_id` (FKs obrigatórias), `momento text`, `versao integer`, `nome text`, `tipo text`, `dados bytea` e `criado_em timestamptz` obrigatórios. | `viagem_id` → `anexo.viagem_id`, `enviado_por_id` → `autor_id`. Copiar `criado_em`, nome, MIME e bytes. A ponte guarda o ID da evidência. Momento e versão continuam no domínio, consultados a partir da evidência de origem. | `UNIQUE (viagem_id, momento, versao)`, momento INICIAL/FINAL e versão ≥1. JPEG/PNG de 1 a 1.048.576 bytes, com validação de imagem no fluxo de execução. Cada versão preserva o ID, o autor e o resultado dos validadores do domínio. |
| `anexo.id` BIGINT, PK, `chave uuid` única, `nome`, `tipo`, `tamanho`, `sha256`, `dados`, `autor_id` (FK) e `criado_em timestamptz` obrigatórios. | Já é o armazenamento comum. Reaproveitar os IDs existentes e conservar os oito vínculos explícitos por FK. | Exatamente um vínculo preenchido. Nome seguro, PDF/JPEG/PNG conforme assinatura, até 5.242.880 bytes. CHECKs amarram tamanho e SHA-256 aos bytes. Várias linhas por vínculo são permitidas. O hash prova integridade e não identifica o arquivo para efeito de unicidade ou autorização. |

As colunas `viagem.foto_odometro_inicio/fim` e
`ordem_coleta.foto_odometro_inicio/fim` são referências textuais opcionais.
Ficam fora da cópia BYTEA. O piloto não interpreta o texto como URL, Base64,
propriedade, horário ou prova de foto. `motorista` guarda os dados da CNH,
enquanto `documento_historico.anexo_id` já é uma referência composta do
histórico ao anexo do mesmo motorista ou documento veicular. Preservar essas
FKs, as duas unicidades por cadastro e versão, e o significado de versão zero.
Permanecem fora da consolidação os arquivos de Storage referentes à imagem
cadastral de veículos.

## Consumidores e contratos a preservar

| Origem | Escrita e leitura atuais | Invariante para a etapa de API |
| --- | --- | --- |
| Documento veicular | `POST /api/documentos` JSON/multipart grava no cadastro. As consultas de documento, pendências e histórico retornam metadados. `PATCH /api/documentos/:id` registra versão com anexo opcional do mesmo documento/CNH. | Manter datas civis, campos e envelopes, versão do histórico e acesso ADM/GESTOR_FROTA. A cópia do BYTEA não cria uma versão nem vincula arquivo a um histórico anterior. [Documentos](../api/documentos.md) · [Consulta e histórico](../api/documentos-s9.md) |
| Comprovante de abastecimento | Cadastro JSON com imagem grava no legado. Upload multipart específico grava em `anexo`. GET de comprovante, detalhe e listagem consultam o último anexo por `criado_em DESC, id DESC`, com fallback para o legado. | Manter a prioridade do anexo já confirmado, a imagem legada única, os limites de cada entrada, o download privado e o escopo ADM/GESTOR_FROTA. Evitar que uma cópia se torne o anexo corrente apenas pela data da cópia. [Abastecimentos](../api/abastecimentos.md) |
| Foto de viagem | Motorista vinculado envia a foto com km no início/conclusão. O GET de evidências usa ID próprio; lista mantém momento e versão. ADM/GESTOR_FROTA e o motorista atualmente vinculado podem consultar. | Preservar transação do estado, km, bytes e atividade. Um upload genérico de VIAGEM não satisfaz a evidência obrigatória. O GET legado volta aos bytes de origem se a ponte estiver desativada. [Viagens](../api/viagens.md) |
| Anexo compartilhado | POST multipart, listagem paginada por vínculo e GET privado por ID com autorização por recurso e sessão atual. | Manter envelope, chave privada, headers e política por vínculo. Copiar arquivos para um ambiente de ensaio que não sirva a aplicação. Uma futura cópia publicada depende de revisão do comportamento de listagem, download e ordenação. [Anexos](../api/anexos.md) |

## Desenho do piloto

1. **Preparar.** Manter as fontes e o destino privado existentes. No ensaio da
   SCRUM-245, criar a ponte no banco descartável. Começar pelas fotos de
   viagem com autoria e data explícitas. Registrar os documentos/comprovantes
   inelegíveis por categoria, em contagens sem dados pessoais.
2. **Copiar e conferir.** Chave de reexecução por origem e ID. A ponte de viagem
   deve ter PK no ID da evidência e UNIQUE no ID do anexo. Para impedir vínculo
   cruzado, propor referências compostas `(evidencia_id, viagem_id)` e
   `(anexo_id, viagem_id)` com os respectivos pares únicos nas duas tabelas.
   Para futuras pontes de documento e comprovante, usar os pares do próprio
   documento ou abastecimento. Proteger a ponte com RLS e retirar grants de
   PUBLIC, anon e authenticated, preservando as ACLs das tabelas atuais. O
   anexo e sua ponte são inseridos na mesma
   transação. Comparar por origem nome, MIME, autoria, timestamp, vínculo,
   tamanho, SHA-256 e bytes e comprovar que um retry não duplica a cópia.
3. **Decidir o corte.** Antes de ligar a ponte na aplicação, provar fallback,
   autorização por recurso, ordenação e IDs. Definir separadamente a janela
   de retenção. Para retornar, desativar a ponte de leitura e recuperar os
   bytes originais da fonte preservada. Um rollback de esquema com arquivos
   novos deve recusar perda de dados e exigir backup/restauração verificados.
   Exclusão física e rollout remoto dependem de aprovação própria.

O piloto usa as mesmas restrições de assinatura e nome do destino e a
validação mais estrita da origem quando houver. Nome incompatível,
metadado ausente, referência sem vínculo ou divergência de bytes mantém a
linha na fonte. A hora do ensaio pode ser metadado técnico do lote, sem
preencher `anexo.criado_em` no lugar da hora comprovada do arquivo.

## Estimativa de capacidade

Durante a coexistência, o acréscimo lógico de payload é a soma de
`octet_length` dos arquivos elegíveis a copiar. Em um lote de 1.000 fotos de
viagem no limite de 1 MiB, seriam até 1.000 MiB de payload novo, além do
espaço das tabelas, índices, TOAST, WAL e backup. Medir o acréscimo físico de
`pg_total_relation_size` no ensaio e dimensionar WAL e janelas antes de
propor rollout. O número de arquivos elegíveis no ambiente compartilhado
continua sem medição. Planejar margem para a coexistência das duas cópias,
sem pressupor deduplicação por hash.

## Execução da SCRUM-245

```sh
npm run db:test:start
npm run db:test:prepare
npm run db:test:file-pilot
npm run db:docs:check
npm run test:db
```

O comando e o CI verificam container, marcador e hashes do histórico antes
de criar um banco descartável. Ele é montado com as migrations e comparado
com a instalação limpa. O script aplica a ponte dentro dessa cópia
descartável. O [SQL de cópia](../../backend/tests/database/fixtures/scrum-245-copy.sql)
transfere somente as evidências selecionadas pelo validador de viagem e pelas
regras atuais de nome. O mesmo lote pode rodar novamente sem criar um segundo
anexo para uma evidência. O hash idêntico entre viagens gera IDs e vínculos
distintos.

As [fixtures](../../backend/tests/database/fixtures/scrum-245-files.sql)
incluem duas versões da foto inicial, uma foto com os mesmos bytes em outra
viagem, um PNG truncado, um nome incompatível, um documento PDF legado, um
comprovante legado e um anexo documental existente. A validação confere
ausência de cópia por falta de proveniência ou arquivo inválido. Também
confere os hashes e vínculos, incluindo a recusa de cruzar viagens ou
associar ao histórico o anexo de outro documento. A ponte tem RLS habilitada
e os papéis `anon` e `authenticated` têm a leitura recusada em SQL.

O rollback da ponte vazia recupera o catálogo original. Com cópias já
confirmadas, a guarda recusa a reversão e preserva a origem, os bytes e a
correspondência de IDs. Uma falha simulada antes do commit comprova o
rollback atômico da inserção. O backup do estado pós-cópia é restaurado em
outro banco descartável, com comparação de schema, permissões, contagens e
SHA-256. O log registra volume lógico copiado, variação física, tempos de
backup e restore e as exclusões por categoria.

## Regressão binária e transição de leitura · SCRUM-247

Os caminhos, perfis e códigos estão no [inventário de API](../api/inventory.md)
e no [OpenAPI](../api/openapi.yaml). A regressão usa fixtures HTTP e SQL no
PostgreSQL Docker, junto de `npm test`, e compara bytes, SHA-256, tamanho e
headers com o comportamento de cada rota.

| Download | Origem e consumidor | Contrato preservado no ensaio |
| --- | --- | --- |
| `GET /api/abastecimentos/{id}/comprovante` | Último anexo compartilhado para o abastecimento. Na ausência dele, imagem legada única. Consumido pela listagem e pelo detalhe via `abastecimentos.service.ts`. | PDF/JPEG/PNG no anexo e JPEG/PNG no legado. O nome fixo do header é `arquivo` ou `comprovante` conforme a fonte. Dois envios concorrentes preservam o histórico e a resposta segue a ordenação confirmada em SQL. |
| `GET /api/anexos/{id}` | Anexo comum, incluindo o `anexoId` de uma versão documental. Consumido pela interface de anexos por `anexos.service.ts`. | PDF/JPEG/PNG, `attachment; filename="arquivo"`. O download valida sessão, perfil e vínculo atuais. O histórico mantém o ID do mesmo documento e a autorização continua por registro. |
| `GET /api/viagens/evidencias/{id}` | Evidência original versionada em `viagem_evidencia`, disponível no cliente gerado. | JPEG/PNG, `attachment; filename="evidencia"`. As duas versões mantêm os IDs, a autoria, o momento e os bytes originais de cada versão. A reatribuição revoga o acesso do motorista anterior e libera o do motorista atual. |

Os downloads mantêm `Cache-Control: private, no-store`,
`X-Content-Type-Options: nosniff`, tipo e comprimento do arquivo. O ensaio
verifica ausência de redirecionamento e de header `Location`. Para o
comprovante, a autorização vem antes das fontes. Se a consulta do anexo
compartilhado falhar, a resposta é 500 mesmo com uma imagem legada válida.
Quando a consulta volta a funcionar, a mesma prioridade é confirmada sem
nova escrita.

### Etapas propostas para troca de origem

1. **Preparar em ambiente autorizado.** Verificar histórico, ACL/RLS, papel
   runtime, capacidade para coexistência e recuperação do backup. A ponte de
   fotos ainda existe só no piloto descartável. Uma eventual ponte persistente
   requer migration revisada, prova de upgrade e evidência equivalente à do
   piloto. Continuar a registrar novas versões no fluxo de origem.
2. **Comparar antes da ativação.** Em lote pequeno, conferir vínculo, papel
   atual, IDs do domínio, momento, versão, autor, data e paridade de bytes,
   MIME, tamanho e SHA-256. Manter contagens por motivo de exclusão sem
   exportar arquivos ou dados pessoais. Preservar os nomes de download e a
   política de cache de cada rota. Uma evidência de domínio mantém sua
   autorização mesmo que tenha cópia em `anexo`.
3. **Ativar por domínio após aprovação.** Manter a escolha de origem
   reversível. Ausência de mapeamento para um recurso autorizado pode usar os
   bytes da origem. Negação, FK incompatível, divergência de integridade e erro
   de banco precisam ser observáveis e devem interromper a leitura pela ponte.
   Medir a taxa de fallback, falhas e divergências antes de ampliar o lote.
4. **Retornar se houver regressão.** Restaurar a leitura do domínio pela
   origem preservada, manter as duas cópias e repetir as verificações de
   autorização e integridade. Para reversão de esquema com dados, usar a
   guarda e o procedimento de backup e restore. Excluir arquivos ou tabelas
   depende de decisão de retenção e autorização específica. O ensaio atual
   comprova a leitura legada, a prioridade real do comprovante e a recuperação
   do piloto, com a transição de fotos reservada a uma implantação aprovada.
