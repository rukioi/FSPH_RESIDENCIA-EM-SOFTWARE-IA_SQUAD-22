# Convenções mínimas da API

Use este padrão nos novos endpoints. Os contratos implementados devem descrever o comportamento real de cada rota.

## Rotas e dados

- Base `/api`, recursos no plural, em português sem acentos: `/api/veiculos`, `/api/solicitacoes/:id`.
- `GET` consulta, `POST` cria, `PATCH` altera parcialmente e `DELETE` remove quando a regra permitir. `GET` não altera estado.
- Uma ação de negócio pode ter uma rota explícita, como `POST /api/solicitacoes/:id/aprovar`. O exemplo não define sua permissão ou regra.
- JSON com propriedades em `camelCase`; datas e horários em ISO 8601 com fuso explícito. Datas sem horário usam `YYYY-MM-DD`.
- Consulta ou criação de um recurso retorna `{ "data": ... }`. Resposta 204 não tem corpo.
- Listas usam `page` (padrão 1) e `limit` (padrão 20, máximo 100); valide inteiros positivos. Retorne `{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0 } }` com ordenação determinística.
- Filtros e campos aceitos devem ser declarados no contrato. Não carregue listas completas para filtrar no navegador.

## Respostas

| Código | Uso |
| --- | --- |
| 200 / 201 / 204 | Consulta ou alteração / criação / sucesso sem corpo. |
| 400 | Entrada inválida. |
| 401 | Sessão ausente ou inválida. |
| 403 | Usuário sem autorização para a operação. |
| 404 | Recurso inexistente ou ocultado para não revelar dados fora do alcance do usuário. |
| 409 | Conflito de estado ou alocação. |
| 413 | Corpo da requisição maior que o limite aceito. |
| 500 | Falha inesperada, sem detalhes internos na resposta. |

Formato padrão de erro nos endpoints protegidos:

```json
{
  "error": {
    "code": "ENTRADA_INVALIDA",
    "message": "Confira os campos informados.",
    "fields": { "destino": "Informe o destino." }
  }
}
```

`fields` é opcional. `code` é estável para o frontend; `message` é legível em português. A autenticação usa `NAO_AUTENTICADO` para 401 e `ACESSO_NEGADO` para 403. As chamadas autenticadas do frontend usam `frontend/src/shared/services/auth.service.ts`.

## Documentação por entrega

No mesmo PR do endpoint, registre nesta pasta: método e caminho, entrada, resposta, permissão e um exemplo mínimo. Agrupe por módulo; não é necessário documentar toda a API antecipadamente ou adicionar ferramentas agora.

Mantenha mudanças compatíveis sempre que possível. Combine alterações que quebrem consumidores; introduza versionamento apenas quando necessário. Regras de acesso seguem [permissoes.md](../permissoes.md).

## Infraestrutura HTTP — #28

A convenção acima é o alvo. Os envelopes existentes, nomes snake_case, listas sem
paginação e datas serializadas pelo driver continuam compatíveis nesta etapa;
a geração/unificação do contrato pertence à #32.

- Cada resposta recebe `X-Request-Id`, UUID gerado no servidor. IDs enviados pelo
  cliente e cabeçalhos de encaminhamento não são confiados nem registrados.
- Despacho usa pathname (query string não altera a rota). Caminho desconhecido:
  404; método incompatível em caminho conhecido: 405 com `Allow` dos métodos reais,
  antes da autenticação. Nenhuma operação protegida é executada nesse caso.
- JSON: 64 KiB em bytes por padrão. `/api/documentos` conserva override de 1 MiB.
  `Content-Type: application/json` aceita parâmetros como charset; ausência do
  cabeçalho permanece tolerada por compatibilidade. Outro tipo explícito: 415.
- Upload de documentos: um arquivo PDF/JPEG/PNG até 5 MiB; até dez campos de
  4 KiB cada, onze partes no total e corpo total até 5 MiB + 64 KiB. Excesso: 413;
  estrutura/conteúdo inválido: 400. A assinatura do arquivo continua validada.
- JSON malformado: 400 `JSON_INVALIDO`; corpo excessivo: 413
  `CORPO_MUITO_GRANDE`; mídia incompatível: 415 `TIPO_NAO_SUPORTADO`.
  O SVO conserva `{ "erro": "mensagem" }` nas falhas de corpo.
- 413/415 encerram a conexão após enviar a resposta. Aborto de transporte não
  tenta escrever em socket encerrado. Erro inesperado retorna 500 genérico;
  se cabeçalhos já saíram, a conexão é encerrada, sem resposta pendurada.
- Login: 429 `LIMITE_LOGIN`, com `Retry-After` em segundos. Ver [auth.md](./auth.md).

Exemplo de 405 (o cabeçalho `Allow` depende da rota):

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

Os contratos por módulo registram o recorte técnico alterado pela #28; não
introduzem paginação, perfis, estados ou novas regras operacionais.

## Identidade e usuários — #29

Todas as famílias protegidas usam JWT comum (HS256, sub/exp/perfil reconhecidos,
JWT_SECRET com no mínimo 32 bytes UTF-8), seguido de consulta sem cache de usuário
ativo/perfil atual. Sessão ausente/inválida, conta inativa/inexistente: 401;
perfil efetivo sem permissão: 403. Falha de consulta não usa fallback de claims.
As listas de permissão permanecem as existentes. Ver [auth.md](./auth.md).

`PATCH /api/admin/usuarios/:id/status` passa a exigir JSON `{ "ativo": true }`
ou false, sem toggle. Repetir estado retorna 200 sem novo evento. Cadastro/edição
usam enum real, inclusive SOLICITANTE_INTERNO, e rejeitam campos extras/internos.
Esta quebra deliberada é aplicada em conjunto no frontend. Envelopes de sucesso
legados, datas e paginação continuam para #32. Ver [usuarios.md](./usuarios.md).

## Consulta de atividades — #31

`GET /api/admin/auditoria/logs?page=1&limit=20` oferece paginação técnica (limit
máximo 100), DTO mínimo camelCase e `{ data, meta: { page, limit, total } }`.
Página/total usam o mesmo snapshot; ordem: data_hora DESC NULLS LAST, id DESC.
Sem page e limit, o adaptador conserva o array completo e os campos legados
explicitamente projetados. A remoção desse adaptador e a geração do contrato ficam
para #32. Detalhes em [auditoria.md](./auditoria.md). Não há novos eventos, perfis,
filtros de domínio ou conversão de horários históricos.
