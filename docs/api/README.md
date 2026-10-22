# Convenções mínimas da API

Use este padrão nos novos endpoints. São decisões iniciais de integração; o servidor atual ainda responde 404 a todas as rotas.

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

Formato de erro nos endpoints implementados:

```json
{
  "error": {
    "code": "ENTRADA_INVALIDA",
    "message": "Confira os campos informados.",
    "fields": { "destino": "Informe o destino." }
  }
}
```

`fields` é opcional. `code` é estável para o frontend; `message` é legível em português. Centralize o tratamento em `backend/src/errors/` e as chamadas do frontend em `frontend/src/shared/services/` quando forem implementados.

## Documentação por entrega

No mesmo PR do endpoint, registre nesta pasta: método e caminho, entrada, resposta, permissão e um exemplo mínimo. Agrupe por módulo; não é necessário documentar toda a API antecipadamente ou adicionar ferramentas agora.

Mantenha mudanças compatíveis sempre que possível. Combine alterações que quebrem consumidores; introduza versionamento apenas quando necessário. Regras de acesso seguem [permissoes.md](../permissoes.md).
