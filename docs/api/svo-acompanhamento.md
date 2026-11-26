# Acompanhamento gerencial do SVO — SCRUM-266 / SCRUM-267

O RF53 permite que ADM e Gestor acompanhem o estado das demandas do SVO. O RF52 e a [matriz operacional](./svo-operacional-sprint7.md) mantêm atendimento, triagem, despacho e execução nos perfis responsáveis.

## GET /api/svo/acompanhamento

Sessão ativa com perfil efetivo `ADM` ou `GESTOR_FROTA`. A consulta lista todas as demandas do SVO para acompanhamento da gestão, com uma linha por solicitação. As rotas de consulta operacional preservam as permissões da SCRUM-145.

Aceita apenas `page` e `limit` como inteiros decimais positivos. Padrões de 1 e 20, limite máximo de 100 e deslocamento seguro. Parâmetros desconhecidos, repetidos ou fora dos limites retornam 400. O recorte inicial pode ser percorrido por paginação e não precisa de filtros clínicos ou operacionais.

Os itens são ordenados por data de criação decrescente, datas nulas no fim e ID decrescente no desempate. A página e o total usam o mesmo snapshot. Páginas além do fim retornam lista vazia com o total preservado.

## Resposta 200

```json
{
  "data": [
    {
      "protocolo": "SVO-42",
      "statusTriagem": "CONFIRMADA_SVO",
      "statusOrdem": "PENDENTE_ALOCACAO"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

- `protocolo` é o código persistido da solicitação.
- `statusTriagem` é o estado persistido de triagem. Um registro legado pode ter valor nulo.
- `statusOrdem` é o estado persistido da ordem vinculada. É nulo quando a ordem ou seu estado ainda não existe.
- A resposta é restrita a esses campos. A consulta exclui IDs internos, nomes, endereços, contatos, dados de saúde, equipe, anexos e histórico.

## Respostas de erro

O endpoint usa o envelope HTTP comum `error.code` e `error.message`.

| HTTP | Condição |
| --- | --- |
| 400 | Paginação inválida |
| 401 | Sessão inválida, ausente ou inativa |
| 403 | Perfil atual fora da matriz gerencial |
| 405 | Método diferente de GET |
| 500 | Falha inesperada na consulta |
