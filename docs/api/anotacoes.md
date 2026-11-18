# Anotações privadas — SCRUM-196 / RF48

`POST /api/anotacoes` recebe JSON estrito `{tipoRegistro,registroId,texto}`.
Vínculos: SOLICITACAO_VIAGEM, SOLICITACAO_SVO, VIAGEM, ORDEM_SVO, VEICULO.
Autor e instante não são campos de entrada: vêm da sessão e do PostgreSQL.
Texto simples de 1–2.000 caracteres após trim; controles são rejeitados, exceto
tabulação/quebra de linha. Nenhuma nota muda decisão, status ou justificativa.

`GET /api/anotacoes?tipoRegistro=VIAGEM&registroId=123&page=1&limit=20` retorna
`{data: Anotacao[],meta:{page,limit,total}}`, ordenado por instante/ID DESC.
Cada item contém ID, vínculo, texto, autorId e criadoEm. Não inclui nome, CPF,
email, token ou dados médicos do registro. Página 1–1.000.000; limite 1–100.
Queries extras/duplicadas são rejeitadas. Vazio é o resultado real da consulta.

Mesma [matriz dos anexos](./anexos.md): gestão em seus domínios, atendente no SVO,
solicitante somente no pedido próprio e motorista na viagem/ordem atribuída.
Perfil atual é reconsultado; propriedade é validada no backend sob lock.
Sem sessão: 401; perfil fora do domínio: 403; inexistente/registro alheio: 404;
entrada inválida: 400. Limites/tipo do JSON usam os 413/415 compartilhados.

POST retorna 201 após commit de nota + auditoria. Falha reverte ambos, sem nota
parcial. Repetir um POST confirmado acrescenta outra nota; não há deduplicação
heurística nem retry automático. Não existem PATCH/DELETE; histórico append-only.
Auditoria contém somente `Registrou anotação ID …`, nunca o texto da nota.

O texto é armazenado e servido como **dado JSON**, não HTML. O consumidor deve
renderizá-lo como texto (React/textContent), nunca innerHTML, e orientar uso mínimo
de dados pessoais/clínicos. Isso não pressupõe sanitização de conteúdo clínico
livre pelo servidor. Frontend permanece com Gustavo.

Prova: `backend/tests/integration/anotacoes-s9.test.ts`, dez testes HTTP→API→PG
reais, cinco vínculos, separação entre registros/atores, limite/controles,
texto com caracteres HTML, persistência, paginação, reenvio e falha transacional.
