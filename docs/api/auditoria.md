# API — Auditoria (#31)

## GET /api/admin/auditoria/logs

Autenticação: Bearer JWT, sessão ativa e perfil efetivo ADM, pelos mecanismos
compartilhados da #29. Sem corpo. Não há permissão nova ou consulta pública.

Paginação técnica opcional: `page` inteiro positivo (padrão 1), `limit` inteiro
positivo até 100 (padrão 20). Informar qualquer um ativa o envelope paginado.
Duplicatas, vazio, decimais, sinais e valores/offset fora do inteiro seguro
JavaScript retornam 400. Parâmetros desconhecidos continuam ignorados; não são filtros.
Página além do fim retorna data vazio com o total real.

Ordenação: `data_hora DESC NULLS LAST, id DESC`. Página e total são lidos na mesma
transação read-only/repeatable-read. Requisições de páginas diferentes são snapshots
independentes; inserções entre requisições podem deslocar offsets. Não há cursor.

## 200 — Consulta paginada

```json
{
  "data": [{
    "id": "123",
    "usuarioId": "12",
    "descricao": "Criou o usuário ID 13",
    "dataHora": "2026-10-30T12:00:00.000Z",
    "usuarioNome": "Usuário fictício"
  }],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

IDs são strings decimais (BIGINT), sem conversão para number. usuarioId,
usuarioNome e dataHora admitem null; nome vem de LEFT JOIN com o usuário atual,
não é um retrato histórico. Não retorna email, perfil, hash ou payload nesse DTO.
`dataHora` conserva a serialização ISO do driver já usada pelo endpoint anterior.
O banco armazena timestamp sem fuso: o `Z` serializado não comprova o fuso de
origem. Nenhuma linha histórica é convertida ou regravada nesta tarefa.

Exemplo vazio: `{"data":[],"meta":{"page":1,"limit":20,"total":0}}`.

### Adaptador de compatibilidade sem page/limit

Conserva array completo (sem limite), nomes de campos e serialização antigos:

```json
[{
  "id": "123",
  "usuario_id": "12",
  "descricao": "Criou o usuário ID 13",
  "data_hora": "2026-10-30T12:00:00.000Z",
  "usuario_nome": "Usuário fictício",
  "usuario_email": "fixture@example.invalid"
}]
```

Os campos são explícitos; não há mais SELECT l.*. Array vazio: `[]`.
O email permanece somente no adaptador legado protegido para evitar remoção
silenciosa de campo. Novos consumidores devem usar paginação. #32 tratará a
unificação/geração do contrato; a UI estática atual não foi integrada aqui.

## 400 — Paginação inválida

```json
{"error":{"code":"ENTRADA_INVALIDA","message":"Informe page e limit como inteiros positivos; limit deve ser no máximo 100."}}
```

## 401 — Sem sessão válida ou conta inativa/inexistente

```json
{"error":{"code":"NAO_AUTENTICADO","message":"Autenticação necessária."}}
```

## 403 — Perfil atual sem permissão

```json
{"error":{"code":"ACESSO_NEGADO","message":"Acesso não permitido."}}
```

## 404 — Caminho desconhecido

```json
{"error":{"code":"NAO_ENCONTRADO","message":"Rota não encontrada."}}
```

## 405 — Método inválido

Cabeçalho `Allow: GET`. 404/405 são encerrados pelo despacho comum antes da sessão;
o handler também encerra essas condições quando chamado diretamente.

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

## 500 — Falha inesperada

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível concluir a requisição."}}
```

Erros não retornam SQL, detail do driver, stack ou dados pessoais. Logger técnico
continua separado, com allowlist e request ID, conforme a #28.

## Exemplo mínimo da requisição

```http
GET /api/admin/auditoria/logs?page=1&limit=20 HTTP/1.1
Authorization: Bearer <token>
```

## Eventos existentes centralizados

| Operação | Descrição nova | Transação |
| --- | --- | --- |
| Cadastro de usuário | Criou o usuário ID n | Usuário + atividade |
| Edição de usuário | Atualizou os dados do usuário ID n | Usuário + atividade |
| Status efetivamente alterado | Alterou o status do usuário ID n para Ativo/Inativo | Usuário + atividade; repetição sem evento |
| Confirmação SVO | Solicitação #SVO-n confirmada na ligação | Solicitação + ordem + duas atividades |
| Ordem gerada no cadastro SVO | Ordem de coleta #OC-n gerada para #SVO-m | Mesma transação SVO |

Preserva usuario_id/descricao/data_hora e as duas FKs atuais. Descrições novas de
usuário passam a pt-BR e usam ID em vez de email; as SVO permanecem compatíveis.
Nenhum backfill, atualização ou exclusão de histórico. Texto histórico pode conter
dados que o código antigo gravava; a consulta administrativa continua protegida e
não reescreve essas mensagens. Não é uma promessa de anonimização retroativa.

## O que a entrega não faz

Sem eventos novos de login/negação/despacho, filtros de domínio, busca avançada,
dashboard, relatórios, trilha imutável completa, retenção automática, monitoramento
ou garantia 24x7. Não altera FKs, schema, permissões ou requisitos operacionais.

## Consumo visual — #30

A tela existente permanece identificada como **demonstração**, com dados
ilustrativos e filtros locais sobre essas fixtures. Não atribui a registros reais
perfil, resultado, módulo ou tipo de evento que o DTO mínimo não fornece. A adoção
da consulta paginada em uma visualização apropriada fica adiada; o endpoint atual,
seus formatos, acesso ADM e histórico persistido foram preservados.
