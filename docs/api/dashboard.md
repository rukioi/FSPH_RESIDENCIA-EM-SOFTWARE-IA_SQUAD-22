
# API — Dashboard (BE-01)

## Endpoint

- Método: GET
- Rota: `/api/dashboard`
- Autenticação: JWT via `Authorization: Bearer <token>`
- Perfis autorizados: `ADMINISTRADOR` e `GESTOR_FROTA`
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

A validação JWT utiliza `jose`, algoritmo HS256 e a variável de ambiente `JWT_SECRET`.

Essa configuração deverá ser compatibilizada com a estratégia de autenticação compartilhada do projeto quando ela for definida. Não há emissão de tokens nesta entrega.
