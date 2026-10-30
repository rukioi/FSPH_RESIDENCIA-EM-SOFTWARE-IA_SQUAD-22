# API — Autenticação (#29)

## Rotas e identidade

| Método e caminho | Autenticação/perfis | Corpo |
| --- | --- | --- |
| POST /api/auth/login | pública; usuário ativo em public.usuario | JSON {email,senha} |
| GET /api/auth/sessao | Bearer JWT; usuário ativo e perfil reconhecido atual no banco | não |

JWT HS256 contém sub, iat, exp (oito horas) e perfil. JWT_SECRET exige no mínimo
32 bytes UTF-8. Assinatura/algoritmo/sub/exp/perfil inválidos não autenticam.
Aliases históricos continuam aceitos no JWT; novos tokens usam enum real:
ADM, GESTOR_FROTA, SOLICITANTE_INTERNO, MOTORISTA e ATENDENTE_SVO.

Cada requisição protegida consulta identidade atual, sem cache. Conta inexistente,
inativa ou perfil não reconhecido recebe 401. Sessão retorna nome/email/perfil
atuais, sem confiar nos valores antigos do JWT. Outras rotas aplicam suas listas
explícitas ao perfil efetivo (403 ACESSO_NEGADO); /sessao aceita os cinco perfis.
Não há página inicial administrativa por fallback para motorista/solicitante.

## Respostas

### 200 — Login

```json
{"token":"<jwt>","usuario":{"id":"42","nome":"Nome fictício","email":"usuario@example.invalid","perfil":"GESTOR_FROTA"}}
```

Senha é comparada por bcrypt; hash nunca integra a resposta.

### 200 — Sessão

```json
{"data":{"id":"42","nome":"Nome fictício","email":"usuario@example.invalid","perfil":"GESTOR_FROTA"}}
```

DTO mínimo: id, nome, email e perfil; sem ativo, senha_hash ou criado_em.

### 400 — Campos inválidos no login

```json
{"error":{"code":"ENTRADA_INVALIDA","message":"E-mail e senha são obrigatórios."}}
```

JSON malformado usa:

```json
{"error":{"code":"JSON_INVALIDO","message":"Envie um JSON válido."}}
```

### 401 — Login com credenciais inválidas ou conta inativa/inexistente

```json
{"error":{"code":"CREDENCIAIS_INVALIDAS","message":"E-mail ou senha inválidos."}}
```

### 401 — Sessão ausente/inválida/expirada ou usuário inativo/inexistente

```json
{"error":{"code":"NAO_AUTENTICADO","message":"Autenticação necessária."}}
```

Configuração de segredo insuficiente também não autentica a sessão.

### 405 — Método incompatível

Allow: POST no login; Allow: GET na sessão.

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

### 413 — Corpo maior que 64 KiB

```json
{"error":{"code":"CORPO_MUITO_GRANDE","message":"Corpo da requisição muito grande."}}
```

### 415 — Tipo explícito diferente de application/json

```json
{"error":{"code":"TIPO_NAO_SUPORTADO","message":"Envie o corpo como application/json."}}
```

### 429 — Limite de login

```json
{"error":{"code":"LIMITE_LOGIN","message":"Muitas tentativas. Aguarde e tente novamente."}}
```

Retry-After em segundos. Dez tentativas por 60s por IP do transporte, incluindo
sucessos e corpos inválidos. Configurações inteiras positivas: LOGIN_RATE_LIMIT
(10, máximo 10000), LOGIN_RATE_WINDOW_MS (60000, máximo 3600000),
LOGIN_RATE_MAX_ORIGINS (10000, máximo 100000). Ao lotar, novas origens recebem
429 até expirar a primeira entrada; entradas ativas não são descartadas. Tentativa
bloqueada não renova janela. Limite por processo, sem cache distribuído ou confiança
em Forwarded/X-Forwarded-For. Atrás de proxy, clientes podem compartilhar cota;
a infraestrutura deve aplicar seu próprio limite confiável.

### 500 — Login

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível realizar o login."}}
```

Inclui falha de banco, bcrypt ou configuração de JWT_SECRET. Não indica senha
incorreta. Logs não incluem corpo, hash, token ou URL de conexão.

### 500 — Consulta de sessão indisponível

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível concluir a requisição."}}
```

Falha de banco não autoriza por fallback ao JWT. A próxima requisição refaz a consulta.

## Exemplo mínimo

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{"email":"usuario@example.invalid","senha":"<senha>"}
```

O frontend guarda somente JWT em sessionStorage durante a aba aberta; confirma
sessão pela API. Não armazena usuário/token em localStorage. Os detalhes técnicos
comuns estão em [README.md](./README.md).

## O que a entrega não faz

Não cria contas ou redefine senhas no login. Não cria tabela de sessões, refresh,
cache, token_version ou revogação avançada. Estado ativo/perfil atual são verificados
por requisição; não interrompem operação que já passou pela autorização. Não
expande a matriz de negócio nem confirma configuração remota da Data API.
