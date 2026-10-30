# API — Autenticação

## POST `/api/auth/login`

- Autenticação: pública.
- Corpo: `{ "email": "usuario@example.com", "senha": "..." }`.
- Perfis: definidos pelo registro ativo de `public.usuario`.

### 200 — Login concluído

```json
{
  "token": "<jwt>",
  "usuario": {
    "id": 42,
    "nome": "Nome do usuário",
    "email": "usuario@example.com",
    "perfil": "GESTOR_FROTA"
  }
}
```

O token é HS256, contém `sub`, `iat` e `exp` (oito horas). `JWT_SECRET` deve ter pelo menos 16 bytes; recomenda-se 32 bytes ou mais.

### 400 — Campos ausentes

```json
{
  "error": {
    "code": "ENTRADA_INVALIDA",
    "message": "E-mail e senha são obrigatórios."
  }
}
```

### 401 — Credenciais inválidas ou conta inativa

```json
{
  "error": {
    "code": "CREDENCIAIS_INVALIDAS",
    "message": "E-mail ou senha inválidos."
  }
}
```

### 500 — Falha interna

```json
{
  "error": {
    "code": "ERRO_INTERNO",
    "message": "Não foi possível realizar o login."
  }
}
```

## GET `/api/auth/sessao`

- Autenticação: `Authorization: Bearer <token>`.
- Perfis: qualquer perfil reconhecido e ativo no JWT.
- Corpo: não possui.

### 200 — Sessão válida

```json
{
  "data": {
    "id": "42",
    "email": "usuario@example.com",
    "nome": "Nome do usuário",
    "perfil": "GESTOR_FROTA"
  }
}
```

### 401 — Token ausente, inválido ou expirado

```json
{
  "error": {
    "code": "NAO_AUTENTICADO",
    "message": "Autenticação necessária."
  }
}
```

## Exemplo mínimo de login

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{"email":"usuario@example.com","senha":"<senha>"}
```

O usuário e o hash da senha ficam no PostgreSQL. O frontend mantém somente o JWT em `sessionStorage` durante a aba aberta; não usa `localStorage`. Uma falha interna (500) não significa senha incorreta: verifique a disponibilidade do banco e a configuração de `JWT_SECRET` nos logs do backend, sem expor credenciais.

## O que a entrega não faz

- Não cria contas nem redefine senhas neste endpoint.
- Não mantém tabela de sessões ou revoga JWT antes da expiração.
- Não substitui a autorização por perfil aplicada em cada rota protegida.

## Infraestrutura de login e sessão — #28

### 405 — Método inválido

`Allow: POST` no login; `Allow: GET` na sessão.

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

### 400 — JSON malformado

```json
{"error":{"code":"JSON_INVALIDO","message":"Envie um JSON válido."}}
```

### 413 — Corpo maior que 64 KiB

```json
{"error":{"code":"CORPO_MUITO_GRANDE","message":"Corpo da requisição muito grande."}}
```

### 415 — Tipo explícito diferente de application/json

```json
{"error":{"code":"TIPO_NAO_SUPORTADO","message":"Envie o corpo como application/json."}}
```

### 429 — Limite de tentativas

```json
{"error":{"code":"LIMITE_LOGIN","message":"Muitas tentativas. Aguarde e tente novamente."}}
```

O login admite dez tentativas por 60 segundos por endereço IP do transporte,
incluindo tentativas inválidas/malformadas e logins bem-sucedidos. Respostas 429
incluem `Retry-After` em segundos. Configurações inteiras positivas:
`LOGIN_RATE_LIMIT` (10, máximo 10000), `LOGIN_RATE_WINDOW_MS` (60000, máximo
3600000), `LOGIN_RATE_MAX_ORIGINS` (10000, máximo 100000).

A estrutura por instância da aplicação tem capacidade fixa. Ao lotar, novas origens
recebem 429 até a primeira expiração; entradas ativas não são descartadas para
permitir contorno. A janela não se renova a cada tentativa bloqueada.
Não é um limite global/distribuído. `Forwarded` e `X-Forwarded-For` são ignorados.
Atrás de proxy, clientes que compartilham o mesmo transporte compartilham a cota;
o proxy deve aplicar seu próprio limite confiável. Não há modo de confiar em
cabeçalhos do cliente nesta entrega.
