
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

## KPIs (BE-02)

`GET /api/dashboard/kpis?periodo=hoje`

Reutiliza o JWT e os perfis `ADMINISTRADOR` e `GESTOR_FROTA` do dashboard.
Não há modelo de organizações ou vínculos nesta entrega; os indicadores abrangem as tabelas da instalação.

### Entrada e regras de contagem

- `periodo`: `hoje`, `7dias` ou `30dias`. Quando omitido, usa `hoje`.
- Valores vazios, inválidos, parâmetros repetidos e parâmetros desconhecidos retornam 400.
- Datas seguem `America/Sao_Paulo`. O intervalo inclui o início do primeiro dia e exclui o início do dia seguinte a hoje.
- `chamadosPendentes`: registros de `chamados` com `status = 'PENDENTE'` e `criado_em` no período. Sete e trinta dias incluem hoje e os seis ou vinte e nove dias anteriores.
- `viagensHoje`: registros de `viagens` com `agendada_em` no dia atual, independentemente do período.
- `veiculosDisponiveis` e `motoristasDisponiveis`: registros com `status = 'DISPONIVEL'` no momento da consulta, sem filtro de período.

Essas regras foram confirmadas pelo solicitante da BE-02. A consulta usa uma única instrução SQL para manter as quatro contagens no mesmo snapshot, sem carregar registros individuais.

### Resposta 200

```json
{
  "data": {
    "chamadosPendentes": 3,
    "viagensHoje": 2,
    "veiculosDisponiveis": 4,
    "motoristasDisponiveis": 5
  }
}
```

Tabelas vazias retornam contadores numéricos iguais a zero. Os erros 401 e 403 seguem o contrato acima.
Entrada inválida retorna 400 com `error.code = 'ENTRADA_INVALIDA'`.
Falha de conexão, banco não configurado ou migration pendente retorna 500 com `error.code = 'ERRO_INTERNO'`, sem detalhes internos.

### Preparação do banco local e conferência manual

Use um banco PostgreSQL local vazio, exclusivo de desenvolvimento. Configure `DATABASE_URL` e `JWT_SECRET` no ambiente do processo; o backend não carrega arquivos `.env` automaticamente.
Execute uma única vez a migration a partir da raiz, usando o cliente PostgreSQL:

```powershell
psql --dbname "$env:DATABASE_URL" --set ON_ERROR_STOP=1 --file backend/src/database/migrations/001_dashboard_kpis.sql
npm run dev
```

A migration cria somente os campos necessários aos contadores. Não cria usuários, organizações, alocações ou regras de transição de status. Não é executada automaticamente ao iniciar a aplicação.

No Postman ou Thunder Client, envie os três valores de período com `Authorization: Bearer <token>` (HS256, `sub`, `perfil` autorizado e expiração válidos, assinado com o segredo local). Compare com as consultas abaixo no mesmo banco e dia:

```sql
-- Troque 7 por 1 para hoje ou por 30 para trinta dias.
WITH referencia AS (
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date AS hoje
)
SELECT count(*) FROM chamados, referencia
WHERE status = 'PENDENTE'
  AND criado_em >= ((hoje - (7 - 1))::timestamp AT TIME ZONE 'America/Sao_Paulo')
  AND criado_em < ((hoje + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');

SELECT count(*) FROM viagens
WHERE (agendada_em AT TIME ZONE 'America/Sao_Paulo')::date
  = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
SELECT count(*) FROM veiculos WHERE status = 'DISPONIVEL';
SELECT count(*) FROM motoristas WHERE status = 'DISPONIVEL';
```

Os testes de integração aplicam a migration e executam as consultas em PostgreSQL embarcado (PGlite), isolado e em memória, sem usar `DATABASE_URL` ou dados reais. A conexão de rede do driver `pg` com um servidor externo deve ser conferida no ambiente local acima.
