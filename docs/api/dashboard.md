
# API — Dashboard (BE-01)

## Endpoint

- Método: GET
- Rota: `/api/dashboard`
- Autenticação: JWT via `Authorization: Bearer <token>`
- Perfis autorizados: `ADM` e `GESTOR_FROTA`
- Corpo da requisição: não possui.

## Respostas

### 200 — Acesso autorizado

```json
{
  "data": {}
}
```

O objeto `data` está vazio nesta etapa. Os indicadores serão implementados nas tarefas específicas do Dashboard.

### 401 — Não autenticado

Ocorre quando o token está ausente, inválido ou expirado.

```json
{
  "error": {
    "code": "NAO_AUTENTICADO",
    "message": "Autenticação necessária."
  }
}
```

### 403 — Acesso negado

Ocorre quando o usuário está autenticado, mas não possui um dos perfis autorizados.

```json
{
  "error": {
    "code": "ACESSO_NEGADO",
    "message": "Acesso não permitido."
  }
}
```

## Exemplo de requisição

```http
GET /api/dashboard HTTP/1.1
Authorization: Bearer <token>
```

## Observação de integração

A autenticação compartilhada valida JWT HS256 com `sub`, `exp` e `JWT_SECRET` de pelo menos 32 bytes UTF-8. O contrato de login e consulta de sessão está em [auth.md](./auth.md). O painel do gestor usa `/api/dashboard/gestor`.

## Infraestrutura e rotas atuais — #28

As quatro consultas são exclusivamente GET, sem corpo, com Bearer e perfis
ADM/GESTOR_FROTA: `/api/dashboard`, `/api/dashboard/pendencias`,
`/api/dashboard/graficos` e `/api/dashboard/gestor`.
`/api/dashboard/kpis` não existe (404). Os cálculos existentes foram preservados.

### 200 — Outras consultas existentes

`/pendencias`:

```json
{"data":{"motoristas":[],"documentos":[]}}
```

`/graficos`:

```json
{"data":{"veiculosPorStatus":[],"solicitacoesPorStatus":[]}}
```

`/gestor`:

```json
{"data":{"veiculosPorStatus":[],"motoristasDisponiveis":0,"solicitacoesPorStatus":[],"proximasViagens":[]}}
```

`motoristasDisponiveis` conserva a contagem total atual; não foi redefinida a
regra de disponibilidade. Arrays acima ilustram banco sem resultados.

### 405 — Método diferente de GET

Cabeçalho `Allow: GET`.

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

### 500 — Falha de consulta

Exemplo de `/pendencias`; `/graficos` mantém `FALHA_INTERNA`, e `/gestor`
mantém `ERRO_INTERNO`, com as mensagens atuais de cada consulta.

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível consultar as pendências."}}
```

Não adiciona indicadores, filtros de período ou novo cálculo.

## Identidade comum — #29

Todas as rotas acima consultam usuário ativo e perfil atual do banco a cada
requisição, após validar JWT HS256/sub/exp e segredo mínimo de 32 bytes UTF-8.
Conta inativa/inexistente ou token inválido: 401 NAO_AUTENTICADO. Perfil efetivo
fora da lista existente: 403 ACESSO_NEGADO. Falha de consulta não usa claims como
fallback e recebe 500 do tratamento comum. As listas de permissão e operações
permanecem as documentadas acima. Ver [identidade compartilhada](./README.md#identidade-e-usuários--29).
