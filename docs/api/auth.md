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
