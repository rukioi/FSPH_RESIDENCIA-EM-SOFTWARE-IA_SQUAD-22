# Anexos privados — SCRUM-194

Infraestrutura comum de SCRUM-192/194. Não substitui fotos obrigatórias de
execução de viagem, nem permite atualizar seus estados por upload genérico.
Reutiliza o parser multipart de documentos e os mecanismos de sessão/auditoria.

## Operações

- `POST /api/anexos`: multipart com `tipoRegistro`, `registroId` e um único
  `arquivo`. `201 {data: MetadadosAnexo}` somente depois do commit.
- `GET /api/anexos?tipoRegistro=VEICULO&registroId=123&page=1&limit=20`:
  `{data: MetadadosAnexo[], meta: {page,limit,total}}`. Limite 1–100, página
  1–1.000.000; ordem `criado_em DESC, id DESC`. Total/página no mesmo snapshot.
- `GET /api/anexos/:id`: bytes autenticados com streaming/backpressure,
  `Content-Disposition: attachment`, `Cache-Control: private, no-store` e
  `X-Content-Type-Options: nosniff`. Não retorna URL pública.

Campos/queries desconhecidos ou duplicados são rejeitados. IDs positivos BIGINT
são strings. Autor e instante vêm do servidor. O DTO inclui ID, nome, tipo,
tamanho, SHA-256 e vínculo, sem bytes, chave de armazenamento ou dados pessoais
do autor. Não existe exclusão/edição de anexos: depende de regra aprovada.

O gerador de cliente reconhece uploads somente multipart como `FormData` e
downloads como `Blob`. O frontend manual permanece reservado ao Gustavo:
usar `requestApi` com `FormData`, sem forçar Content-Type (boundary do navegador).
O helper `executeApi` atual é JSON e não deve serializar FormData. O download
genérico PDF também exige adaptação do consumidor; o helper legado de imagens
aceita apenas JPEG/PNG. Não foram alteradas telas/serviços nesta entrega.

## Matriz de acesso por registro

| tipoRegistro | Acesso a upload, lista e download |
| --- | --- |
| SOLICITACAO_VIAGEM | ADM/GESTOR_FROTA; solicitante somente no próprio pedido |
| SOLICITACAO_SVO | ATENDENTE_SVO |
| VIAGEM | ADM/GESTOR_FROTA; motorista vinculado atualmente à viagem |
| ORDEM_SVO | ATENDENTE_SVO; motorista vinculado atualmente à ordem |
| ABASTECIMENTO, VEICULO, MOTORISTA, DOCUMENTO_VEICULO | ADM/GESTOR_FROTA |

Consulta simples de frota pelo SVO não concede acesso documental/CNH. O perfil
efetivo e a conta ativa são consultados a cada requisição. Reatribuição do
motorista revoga o acesso ao anexo anterior; conhecer seu ID não autoriza download.
Não existe modelo de organização/multitenancy artificial.

## Validação, atomicidade e limites

PDF, JPEG e PNG com MIME compatível com assinatura; até **5 MiB** por arquivo.
O parser limita também corpo total, número/tamanho dos campos e partes. O corpo
é limitado em memória; o download é emitido em blocos de 64 KiB. Assinatura não
equivale a antivírus ou decodificação integral. Nome não pode conter caminhos,
separadores, controles ou exceder 255 caracteres; nunca é usado como caminho/header.

Bytes privados e metadados ficam em `anexo`, com FK explícita para um único
registro. A autorização bloqueia o registro durante a operação. Upload e
`log_atividade` compartilham a transação: falha reverte ambos, sem storage externo
órfão. Auditoria contém apenas `Anexou arquivo ID …`; não contém nome/arquivo,
CPF, token ou conteúdo. Cada POST confirmado acrescenta um anexo; não há retry
automático nem promessa de idempotência/deduplicação de uploads.

| Status | Situação |
| --- | --- |
| 400 | Campos, vínculo, ID ou nome inválidos |
| 401 | Sem sessão válida, usuário ausente/inativo |
| 403 | Perfil fora da matriz |
| 404 | Registro/anexo ausente ou registro de outro solicitante/motorista |
| 413 | Limite de arquivo/corpo/partes/campos excedido |
| 415 | Não multipart, MIME não permitido ou assinatura incompatível |
| 500 | Falha técnica, com mensagem genérica e rollback |

Inacessível por propriedade retorna o mesmo 404 de inexistência, seguindo os
contratos atuais de viagem/SVO; perfil indevido recebe 403. Não há mutação de
estado/versionamento que exija 409 neste endpoint append-only.

## Evidência

`backend/tests/integration/anexos-s9.test.ts`: HTTP → API → PostgreSQL pelo
harness oficial, sem mocks de API/SQL. Cobre oito FKs, persistência, reconsulta,
downloads, perfil efetivo, propriedade, reatribuição, arquivos falsificados,
5 MiB/excedente, caminhos, paginação e falha real de auditoria com rollback.
Fixtures sintéticas são removidas no teardown; seed/banco remoto não são usados.
