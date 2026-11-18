# Documentos e CNH — SCRUM-193 (parcial)

O cadastro permanece em `documento_veiculo` e `motorista`. As rotas legadas
`GET/POST /api/documentos`, `/pendencias` e CRUD de motoristas continuam com
seus envelopes/campos; seus alertas de 30 dias não representam a nova RF46.
Novos contratos não exigem alterações nas telas atuais do Gustavo.

## Consulta e histórico

- `GET /api/documentos/consulta`: coleção paginada, preservando a coleção legada
  sem paginação. Filtros: `tipo=DOCUMENTO_VEICULO|CNH_MOTORISTA`, `veiculoId`,
  `motoristaId`, `situacao=VENCIDO|HOJE|A_VENCER`, `inicio`, `fim`, `page`, `limit`.
  Validade é data civil inclusiva; ordenação validade/tipo/ID. A_VENCER significa
  qualquer data futura, **sem** janela de alerta presumida. Data-base: CURRENT_DATE
  do PostgreSQL; não se infere o fuso de futuros alertas RF46. Total/página no mesmo snapshot.
- `GET /api/documentos/:id?tipo=…`: cadastro atual, validade civil, versão,
  vínculo e campos documentais mínimos. CNH completa só para ADM/GESTOR_FROTA;
  sem CPF, telefone/email. Tipo padrão DOCUMENTO_VEICULO evita colisão entre IDs.
- `GET /api/documentos/:id/historico?tipo=…&page=1&limit=20`: versões reais DESC,
  incluindo autorId/criadoEm/anexoId, sem reconstruir eventos do passado.

Sem histórico anterior: versão atual 0, histórico vazio. Isso não inventa a
autoria/data do cadastro legado. Validade é obrigatória nos dois modelos atuais;
não se aceita arquivo sem vencimento como documento por hipótese. Anexo genérico
pode existir sem validade, conforme SCRUM-194.

## Escrita e concorrência

`PATCH /api/documentos/:id?tipo=…`: JSON estrito com `versao` atual obrigatória,
`dataValidade` válida; documento permite `tipoDocumento`; CNH permite `numeroCnh`
e `categoriaCnh` A/B/C/D/E. `anexoId` opcional/nulo deve apontar para arquivo privado
do mesmo documento/motorista. Não move o documento para outro veículo ou motorista.

Registro bloqueado com FOR UPDATE; versão antiga: 409. Atualização, snapshot e
auditoria são atômicos. Datas impossíveis (inclusive fevereiro/meses de 30 dias)
retornam 400 antes do SQL. Campos de outro tipo/autor injetado também são 400.
Ausente/anexo de outro cadastro: 404. Erros técnicos não confirmam gravação.

Cadastros legados de documento/CNH capturam a primeira versão a partir desta
entrega. Alterar CNH pelo CRUD de motoristas também captura nova versão quando
os campos documentais mudam, com lock e auditoria na mesma transação. Alterar
apenas contato/nome não fabrica evento documental. Históricos existentes são
preservados e suas FKs podem impedir exclusão física do cadastro; não existe
exclusão de histórico nem política nova de descarte. Corrigida a gravação multipart
legada para Buffer/BYTEA: antes o texto hexadecimal era persistido como bytes de
texto. Não há backfill ou reparo automático de arquivos históricos.

Todas essas operações exigem **ADM/GESTOR_FROTA** atual. Motorista/solicitante/SVO:
403; sem sessão válida: 401. Motorista não edita sua própria CNH.

## Bloqueio restante

**SCRUM-193 não está concluída.** RF46 ainda não define “1 mês”, fuso e frequência/
deduplicação. Não foi criado `/api/documentos/alertas`, scheduler ou novo disparo.
Preservadas notificações/pendências legadas. Após decisão aprovada, implementar
somente a regra restante e provar os limiares/dedupe no isolado.

Prova atual: `documentos-s9.test.ts` (14 testes reais), mais os consumidores
legados de documentos/motoristas. Comprova persistência, SQL, dois tipos,
concorrência 200/409, arquivos cruzados, bytes, datas inválidas e rollback.
