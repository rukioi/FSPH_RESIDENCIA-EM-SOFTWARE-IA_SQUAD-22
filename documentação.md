# Documento de requisitos — Sistema de Gestão de Frota e Transporte

Documento de requisitos funcionais e não funcionais, versão 1.0.

> Este documento registra requisitos levantados e pontos a validar; não comprova que as funcionalidades já estejam implementadas. Para o estado atual e os limites da iniciativa, consulte o [README](./README.md) e as [pendências](./docs/reorganization/deferred.md).

> A numeração original das seções foi preservada: não há seção 4 no conteúdo de origem.

## 1 OBJETIVOS

### 1.1 Objetivo Geral

Desenvolver um sistema web que permita gerenciar de forma integrada as demandas de transporte da organização, proporcionando controle, rastreabilidade e eficiência na utilização de veículos e motoristas.

### 1.2 Objetivos Específicos

- Centralizar as solicitações de transporte em uma única plataforma.

- Controlar o cadastro e a situação dos veículos e motoristas.

- Estabelecer fluxo de aprovação para as solicitações de transporte.

- Organizar as demandas por tickets e acompanhar seus respectivos status.

- Registrar viagens, origem, destino, motorista, veículo e quilometragem.

- Permitir o registro de evidências fotográficas da quilometragem inicial e final.

- Acompanhar a utilização dos veículos e sua quilometragem.

- Registrar abastecimentos e gerar indicadores de consumo.

- Controlar documentos e vencimentos, especialmente a CNH dos motoristas.

- Tratar demandas do SVO de acordo com suas necessidades específicas.

- Disponibilizar dashboards e relatórios gerenciais.

- Permitir notificações relacionadas às demandas, documentos e ocorrências.

- Reduzir a complexidade operacional para os motoristas.

## 2 ESCOPO DO SISTEMA

O escopo inicial contempla a gestão das solicitações de transporte, aprovação, cadastro e controle de veículos e motoristas, organização das viagens, acompanhamento de quilometragem, documentação, abastecimento, anexos e evidências, notificações, indicadores e relatórios.

### 2.1 Escopo Inicial

- Gestão de usuários e permissões.

- Portal de solicitações de transporte.

- Fluxo de aprovação e recusa.

- Gestão de veículos.

- Gestão de motoristas.

- Gestão de viagens e tickets.

- Registro de quilometragem e fotografias.

- Controle básico de rotas e possíveis desvios, condicionado à disponibilidade de geolocalização.

- Fluxo específico para demandas SVO.

- Controle de abastecimentos e consumo.

- Controle de documentação e vencimentos.

- Gestão de anexos, observações e flags.

- Notificações.

- Dashboard gerencial.

- Relatórios e exportação em PDF.

- Histórico e auditoria.

## 3 ATORES E PERFIS DE USUÁRIO

**Administrador/Gestor** Responsável pela gestão da frota, solicitações, viagens, veículos, motoristas, aprovações, acompanhamento operacional, relatórios e configurações. No escopo inicial, ambos possuem as mesmas permissões operacionais.

**Motorista** Responsável pela execução das viagens atribuídas, realizando apenas os registros operacionais necessários, como identificação da demanda, quilometragem e evidências fotográficas.

**Solicitante Interno** Colaborador autorizado a registrar solicitações de transporte para atendimento de demandas institucionais.

**Solicitante Externo** Pessoa que pode registrar uma solicitação pelo portal público sem possuir conta interna.

**Sistema** Ator automático responsável por notificações, alertas de vencimento, atualização de status e demais processos automáticos.

## 5 REQUISITOS FUNCIONAIS

Os requisitos funcionais descrevem os serviços, comportamentos e funcionalidades que o sistema deverá disponibilizar aos seus usuários e aos processos automáticos.

### 5.1 Gestão de Acesso e Usuários

- **RF01** — Gestão de usuários O sistema deve permitir o cadastro, edição, consulta, ativação e desativação dos usuários internos.

- **RF02** — Autenticação O sistema deve permitir que usuários internos realizem autenticação utilizando credenciais de acesso.

- **RF03** — Controle de permissões O sistema deve controlar o acesso às funcionalidades e informações de acordo com as permissões do usuário.

- **RF04** — Gestão de perfis O sistema deve permitir a definição de perfis de acesso, contemplando inicialmente Administrador/Gestor e estrutura para futuras diferenciações.

- **RF05** — Identificação do solicitante O sistema deve registrar o usuário responsável pela criação ou intermediação de cada solicitação.

- **RF06** — Histórico de ações O sistema deve registrar as principais ações realizadas pelos usuários para fins de rastreabilidade e auditoria.

### 5.2 Gestão de Solicitações de Transporte

- **RF07** — Cadastro de solicitação O sistema deve permitir o registro de solicitações de transporte contendo as informações necessárias para o atendimento da demanda.

- **RF08** — Identificação do solicitante O sistema deve registrar os dados do solicitante, incluindo identificação por CPF quando aplicável.

- **RF09** — Origem da solicitação O sistema deve identificar se a solicitação foi realizada por usuário interno ou por solicitante externo.

- **RF10** — Intermediação de solicitação externa Solicitações externas devem ser disponibilizadas ao Administrador/Gestor para análise e eventual autorização.

- **RF11** — Classificação da demanda O sistema deve permitir classificar a solicitação conforme sua finalidade ou tipo de atendimento.

- **RF12** — Destino da demanda Toda solicitação de transporte deve possuir um destino informado.

- **RF13** — Data e horário O sistema deve permitir informar a data e o horário previstos para realização da demanda.

- **RF14** — Quantidade de passageiros O sistema deve permitir informar a quantidade de pessoas que serão transportadas.

- **RF15** — Observações O sistema deve permitir adicionar informações complementares à solicitação, como documentos ou objetos que deverão ser transportados.

- **RF16** — Consulta de solicitações O Administrador/Gestor deve poder consultar, filtrar e visualizar as solicitações registradas.

- **RF17** — Atualização da solicitação O Administrador/Gestor deve poder atualizar os dados de uma solicitação enquanto ela estiver em estado que permita alteração.

- **RF18** — Cancelamento O sistema deve permitir o cancelamento de solicitações, registrando o responsável e, quando aplicável, o motivo.

- **RF19** — Status da solicitação O sistema deve controlar o ciclo de vida da solicitação, contemplando estados como pendente, aprovada, recusada, agendada, em andamento, concluída e cancelada.

### 5.3 Aprovação das Solicitações

- **RF20** — Análise da solicitação O sistema deve disponibilizar as solicitações pendentes para análise do Administrador/Gestor responsável.

- **RF21** — Aprovação O Administrador/Gestor deve poder aprovar uma solicitação de transporte.

- **RF22** — Recusa O Administrador/Gestor deve poder recusar uma solicitação de transporte.

- **RF23** — Justificativa da recusa O sistema deve exigir uma justificativa quando uma solicitação for recusada.

- **RF24** — Registro da aprovação O sistema deve registrar quem realizou a aprovação ou recusa, bem como data e horário da ação.

- **RF25** — Impedimento de execução Uma solicitação não aprovada não deve avançar para a etapa de execução ou agendamento da viagem.

### 5.4 Gestão de Veículos

- **RF26** — Cadastro de veículos O sistema deve permitir cadastrar os veículos pertencentes ou disponibilizados para atendimento das demandas.

- **RF27** — Dados do veículo O cadastro deve permitir informar, no mínimo, placa, identificação, tipo/categoria e situação do veículo.

- **RF28** — Status do veículo O sistema deve permitir controlar a disponibilidade do veículo, incluindo situações como disponível, em viagem, em manutenção ou indisponível.

- **RF29** — Consulta de veículos O Administrador/Gestor deve poder consultar os veículos cadastrados e sua situação atual.

### 5.5 Gestão de Motoristas

- **RF30** — Cadastro de motoristas O sistema deve permitir cadastrar os motoristas autorizados a realizar as demandas.

- **RF31** — Dados do motorista O cadastro deve permitir armazenar informações de identificação e contato do motorista.

- **RF32** — Controle da CNH O sistema deve permitir registrar os dados da CNH do motorista e sua data de vencimento.

- **RF33** — Alerta de vencimento da CNH O sistema deve notificar o Administrador/Gestor quando a CNH estiver próxima do vencimento.

- **RF34** — Consulta de motoristas O Administrador/Gestor deve poder consultar os motoristas cadastrados e sua situação.

- **RF35** — Escalas O sistema deve possuir estrutura para cadastro e consulta de escalas dos motoristas, quando aplicável.

- **RF36** — Disponibilidade O sistema deve permitir identificar a disponibilidade do motorista para uma determinada demanda.

### 5.6 Gestão de Viagens e Demandas

- **RF37** — Criação de viagem O sistema deve permitir transformar uma solicitação aprovada em uma viagem/demanda operacional.

- **RF38** — Associação de motorista O Administrador/Gestor deve poder selecionar o motorista responsável pela viagem.

- **RF39** — Associação de veículo O Administrador/Gestor deve poder selecionar o veículo utilizado na viagem.

- **RF40** — Informações da viagem A viagem deve possuir origem, destino, data, horário, quantidade de passageiros e finalidade.

- **RF41** — Ticket da demanda O sistema deve gerar uma identificação única para cada demanda/viagem, permitindo seu acompanhamento.

- **RF42** — Acompanhamento do ticket O Administrador/Gestor deve acompanhar o status da demanda desde sua criação até sua conclusão.

- **RF43** — Início da viagem O sistema deve permitir registrar o início da viagem.

- **RF44** — Quilometragem final O sistema deve registrar a quilometragem do veículo ao final da viagem.

- **RF45** — Validação da viagem O Administrador/Gestor deve poder analisar e validar a viagem após sua conclusão.

- **RF46** — Correção/justificativa O sistema deve permitir registrar justificativas para ocorrências identificadas durante a viagem.

### 5.7 Gestão de Rotas e Desvios

- **RF47** — Registro de origem e destino O sistema deve registrar o ponto de saída e o destino previsto para cada viagem.

### 5.8 Serviço de Verificação de Óbitos — SVO

- **RF48** — Cadastro de demanda SVO O sistema deve permitir registrar demandas específicas relacionadas ao Serviço de Verificação de Óbitos.

- **RF49** — Identificação da demanda SVO O ticket deve ser identificado como pertencente ao fluxo SVO.

- **RF50** — Dados da ocorrência A demanda SVO deve permitir registrar informações específicas, incluindo endereço, nome da pessoa e dados relacionados à ocorrência.

- **RF51** — Transporte específico O sistema deve permitir utilizar veículos designados para atendimento das demandas SVO.

- **RF52** — Permissões SVO O sistema deve permitir restringir determinadas operações do fluxo SVO a usuários autorizados.

- **RF53** — Controle de atendimento O Administrador/Gestor deve poder acompanhar o status das demandas SVO.

- **RF54** — Capacidade do veículo O sistema deve permitir considerar a capacidade operacional específica dos veículos utilizados no SVO.

### Documentação da Frota e Motoristas

- **RF55** — Cadastro de documentação O sistema deve permitir registrar documentos relacionados aos veículos e motoristas.

- **RF56** — Vencimentos O sistema deve permitir registrar datas de vencimento dos documentos controlados.

- **RF57** — Alertas de vencimento O sistema deve notificar o Administrador/Gestor sobre documentos próximos do vencimento.

- **RF58** — Histórico documental O sistema deve manter histórico das alterações e atualizações dos documentos.

### 5.9 Anexos e Evidências

- **RF59** — Upload de arquivos O sistema deve permitir anexar arquivos às solicitações e demandas.

- **RF60** — Associação de arquivos Os arquivos devem ser vinculados à solicitação, viagem ou registro correspondente.

- **RF61** — Consulta de evidências O Administrador/Gestor deve poder consultar as evidências anexadas à demanda.

- **RF62** — Controle de acesso aos arquivos O sistema deve restringir o acesso aos documentos e fotografias conforme as permissões do usuário.

### Notificações

- **RF63** — Notificações internas O sistema deve apresentar notificações relacionadas às solicitações e viagens.

- **RF64** — Notificação de atribuição O sistema deve permitir notificar o motorista quando uma demanda for atribuída a ele.

### 5.10 Dashboard e Indicadores

- **RF65** — Dashboard gerencial O sistema deve disponibilizar um painel com indicadores da operação da frota.

- **RF66** — Quantidade de viagens O sistema deve apresentar a quantidade de viagens realizadas por período.

- **RF67** — Utilização dos veículos O sistema deve apresentar a quantidade de demandas atendidas por veículo.

- **RF68** — Quilometragem O sistema deve apresentar a quilometragem percorrida pelos veículos.

- **RF69** — Demandas pendentes O sistema deve apresentar solicitações pendentes de aprovação ou execução.

- **RF70** — Situação da frota O sistema deve apresentar a disponibilidade dos veículos.

### 5.11 Relatórios

- **RF71** — Relatório de viagens O sistema deve permitir gerar relatório das viagens realizadas.

- **RF72** — Relatório por veículo O sistema deve permitir consultar as demandas e quilometragem de determinado veículo.

- **RF73** — Relatório de motoristas O sistema deve permitir consultar viagens realizadas por motorista.

- **RF74** — Relatório de ocorrências O sistema deve permitir consultar desvios, justificativas e ocorrências registradas.

- **RF75** — Exportação O sistema deve permitir exportar relatórios, inicialmente em PDF, conforme escopo definido.

## 6 REQUISITOS NÃO FUNCIONAIS

Os requisitos não funcionais definem características de qualidade, segurança, desempenho, usabilidade, confiabilidade, manutenção e compatibilidade que deverão ser observadas na implementação do sistema.

### 6.1 Desempenho

- **RNF01** — Tempo de resposta As operações comuns do sistema devem apresentar tempo de resposta adequado em condições normais de utilização.

- **RNF02** — Consultas Consultas e filtros de registros devem ser executados sem degradação perceptível para o usuário em volumes esperados de dados.

### 6.2 Segurança

- **RNF03** — Autenticação segura O sistema deve utilizar mecanismos seguros de autenticação e gerenciamento de sessão.

- **RNF04** — Controle de acesso O acesso às funcionalidades e informações deve respeitar as permissões do usuário.

- **RNF05** — Proteção de dados Dados pessoais e informações operacionais devem ser protegidos contra acesso não autorizado.

- **RNF06** — Comunicação segura A comunicação entre cliente e servidor deve utilizar protocolo seguro, como HTTPS.

- **RNF07** — Proteção de arquivos Fotografias, documentos e demais arquivos devem possuir controle de acesso adequado.

### 6.3 Privacidade e Proteção de Dados

- **RNF08** — Proteção de dados pessoais O sistema deve tratar dados pessoais de acordo com a legislação aplicável, incluindo a LGPD.

- **RNF09** — Controle de acesso a dados Dados pessoais e informações sensíveis devem ser acessíveis somente aos usuários autorizados.

### 6.4 Usabilidade

- **RNF10** — Facilidade de uso A interface deve ser simples, objetiva e intuitiva, reduzindo a necessidade de treinamento.

- **RNF11** — Fluxo simplificado do motorista As operações destinadas aos motoristas devem exigir o menor número possível de etapas.

- **RNF12** — Interface responsiva O sistema deve funcionar adequadamente em computadores, tablets e smartphones.

- **RNF13** — Clareza das informações Informações críticas como destino, horário, veículo, passageiro e status devem possuir destaque visual adequado.

- **RNF14** — Acessibilidade A interface deve considerar boas práticas de acessibilidade para facilitar a utilização por diferentes usuários.

- **RNF15** — Aprendizado As principais funcionalidades devem ser compreensíveis sem necessidade de treinamento técnico especializado.

### 6.5 Disponibilidade e Confiabilidade

- **RNF16** — Disponibilidade O sistema deve permanecer disponível durante os períodos necessários para a operação da organização.

- **RNF17** — Confiabilidade O sistema devemanter consistência das informações mesmo diante de falhas ou interrupções inesperadas.

- **RNF18** — Integridade das viagens O sistema não deve permitir que uma mesma viagem seja atribuída simultaneamente a veículos ou motoristas incompatíveis.

- **RNF19** — Continuidade operacional A solução deve ser projetada de forma aminimizar impactos de falhas de componentes e permitir retomada adequada da operação.

### 6.6 Integridade e Consistência dos Dados

- **RNF20** — Integridade referencial Os relacionamentos entre solicitações, viagens, motoristas e veículos devem preservar a integridade dos dados.

- **RNF21** — Consistência As alterações realizadas no sistema devem manter os registros consistentes entre as diferentes funcionalidades.

- **RNF22** — Unicidade Identificadores como placa do veículo e outros dados que necessitem de unicidade não devem possuir duplicidades indevidas.

- **RNF23** — Concorrência O sistema deve tratar operações simultâneas evitando conflitos ou duplicidade de atribuições.

### 6.7 Auditabilidade

- **RNF24** — Registro de ações Operações relevantes devem registrar usuário, data, horário e ação realizada.

- **RNF25** — Rastreabilidade Deve ser possível identificar o histórico de uma solicitação desde sua criação até sua conclusão.

- **RNF26** — Rastreabilidade da aprovação Aprovações e recusas devem possuir identificação do responsável e justificativa quando aplicável.

- **RNF27** — Proteção do histórico Registros de auditoria não devem ser alterados por usuários sem autorização.

### 6.8 Escalabilidade

- **RNF28** — Crescimento da frota A arquitetura deve permitir a inclusão de novos veículos sem necessidade de alterações estruturais significativas.

- **RNF29** — Crescimento de usuários O sistema deve suportar aumento do número de usuários e solicitações sem degradação significativa.

- **RNF30** — Crescimento de dados O banco de dados deve ser estruturado para suportar o crescimento contínuo do histórico de viagens, solicitações, imagens e relatórios.

### 6.9 Manutenibilidade

- **RNF31** — Arquitetura modular O sistema deve possuir arquitetura organizada em módulos, permitindo manutenção e evolução independente das funcionalidades.

- **RNF32** — Código documentado Componentes críticos e regras de negócio relevantes devem possuir documentação técnica adequada.

- **RNF33** — Evolução A arquitetura deve permitir incorporar novas funcionalidades, integrações e perfis de usuário sem necessidade de reestruturação completa.

### 6.10 Compatibilidade e Portabilidade

- **RNF34** — Compatibilidade web O sistema deve funcionar nos principais navegadores modernos.

- **RNF35** — Infraestrutura A aplicação deve possuir arquitetura compatível com o ambiente de infraestrutura definido para sua implantação.

### 6.11 Arquivos e Fotografias

- **RNF36** — Armazenamento seguro Fotografias e documentos devem ser armazenados de forma segura.

- **RNF37** — Validação de arquivos O sistema deve validar formatos e tamanhos de arquivos enviados pelos usuários.

- **RNF38** — Integridade O sistema deve garantir que os arquivos estejam vinculados ao registro correto.

### 6.12 Notificações

- **RNF39** — Confiabilidade das notificações As notificações devem ser processadas de maneira confiável, evitando perdas ou duplicidades indevidas.

- **RNF40** — Não bloqueio Falhas no envio de uma notificação não devem impedir a execução das demais funcionalidades do sistema.

- **RNF41** — Configurabilidade A arquitetura deve permitir a inclusão de diferentes canais de notificação futuramente.

### 6.13 Observabilidade

- **RNF42** — Registro de erros O sistema deve registrar erros técnicos para facilitar diagnóstico e manutenção.

- **RNF43** — Monitoramento A infraestrutura deve permitir monitorar disponibilidade e funcionamento dos principais serviços.

- **RNF44** — Logs técnicos Eventos técnicos relevantes devem ser registrados para auxiliar na investigação de falhas.

## 7 REGRAS DE NEGÓCIO

As regras de negócio representam decisões e condições da operação que devem ser respeitadas pelo sistema independentemente da tecnologia utilizada.

- **RN01** — Toda solicitação deve passar por aprovação antes da execução.

- **RN02** — Uma solicitação recusada deve possuir justificativa.

- **RN03** — Toda viagem deve possuir um destino definido.

- **RN04** — Uma viagem deve estar associada a um motorista e a um veículo.

- **RN05** — Um motorista pode estar vinculado a mais de um veículo.

- **RN06** — Um veículo pode atender diversas demandas ao longo do tempo, mantendo seu histórico de utilização.

- **RN07** — O motorista não é responsável pelo cadastro ou manutenção de sua documentação.

- **RN08** — O sistema deve alertar o Administrador/Gestor sobre a proximidade do vencimento da CNH.

- **RN09** — A quilometragem inicial e final deve ser registrada para permitir o acompanhamento da utilização do veículo.

- **RN10** — A quilometragem inicial e final deve, quando aplicável, possuir evidência fotográfica.

- **RN11** — O Administrador/Gestor realiza a validação final da viagem após sua conclusão.

- **RN12** — Demandas SVO devem possuir identificação e fluxo específico.

- **RN13** — Solicitações externas devem passar pela análise de um responsável interno antes de serem autorizadas.

- **RN14** — O motorista deve receber somente as informações necessárias para execução da demanda.

- **RN15** A solução deve priorizar simplicidade operacional para o motorista devido à baixa utilização de dispositivos móveis observada na operação.

- **RN16** — Informações relacionadas a documentos, passageiros, ocorrências e demandas devem respeitar as permissões de acesso estabelecidas.

- **RN17** — O histórico de solicitações e viagens deve permanecer disponível para consulta e geração de relatórios.

## 8 REQUISITOS DE INTEGRAÇÃO

As integrações abaixo representam capacidades previstas ou condicionadas à definição da arquitetura e dos serviços externos.

- **RI01** — API A solução deverá possuir API para comunicação entre a interface da aplicação, backend e serviços necessários.

- **RI02** — WhatsApp — evolução A integração com WhatsApp será considerada funcionalidade futura/Plus e não constitui requisito obrigatório do MVP.

## 9 RESTRIÇÕES TÉCNICAS

As tecnologias abaixo foram indicadas como referência para a implementação inicial do sistema.

- Frontend React

- Backend Node.js

- Linguagem TypeScript

- Banco de Dados PostgreSQL

- Containerização Docker

## 10 REQUISITOS DE EVOLUÇÃO / PLUS

Os itens desta seção foram identificados durante o levantamento como oportunidades de evolução. Eles não devem ser considerados obrigatórios para a primeira versão, salvo decisão posterior de escopo.

- **RF-F01** — Integração com WhatsApp Enviar automaticamente informações e atualizações das demandas aos motoristas por WhatsApp.

- **RF-F02** — Interação via WhatsApp Permitir ações simplificadas do motorista, como aceitar, recusar ou finalizar uma demanda.

- **RF-F03** — Rastreamento avançado Realizar acompanhamento mais detalhado da localização dos veículos durante a viagem.

- **RF-F04** — Otimização de rotas Calcular rotas mais eficientes considerando distância, tempo e múltiplos pontos.

- **RF-F05** — Análise geoespacial Utilizar técnicas de agrupamento, como DBSCAN, para análise de pontos/localizações e apoio à definição de rotas.

- **RF-F06** — Agente de atendimento Disponibilizar agente automatizado para atendimento e tratamento de solicitações.

- **RF-F07** — Portal público avançado Evoluir o portal sem login para um canal completo de abertura e acompanhamento de solicitações.

- **RF-F08** — Dashboard por perfil Disponibilizar dashboards específicos conforme o perfil e área do usuário.

- **RF-F09** — Geolocalização avançada Apresentar visualização dos deslocamentos realizados e pontos visitados em mapa.

## 11 CRITÉRIOS DE ACEITAÇÃO

Os requisitos deverão ser validados por meio de testes funcionais, testes de integração e validação com os usuários responsáveis. Como critérios gerais de aceitação, considera-se necessário:

- Todas as funcionalidades definidas como MVP deverão estar implementadas e acessíveis conforme o perfil autorizado.

- Uma solicitação deverá poder percorrer o fluxo de criação, aprovação, agendamento, execução e conclusão.

- Solicitações recusadas deverão registrar justificativa.

- Viagens deverão manter associação consistente entre solicitação, motorista e veículo.

- Quilometragens inicial e final deverão ser registradas e vinculadas à viagem.

- Evidências fotográficas deverão permanecer vinculadas ao respectivo registro.

- O Administrador/Gestor deverá conseguir acompanhar as demandas e consultar seu histórico.

- Os principais indicadores deverão ser apresentados em dashboard.

- Os relatórios previstos deverão ser gerados conforme os filtros selecionados.

- As permissões de acesso deverão impedir operações não autorizadas.

- Os fluxos destinados ao motorista deverão ser validados quanto à simplicidade de uso.

## 12 MATRIZ DE RASTREABILIDADE

A matriz de rastreabilidade relaciona os principais objetivos do sistema aos grupos de requisitos responsáveis por atendê-los. A matriz poderá ser detalhada em versões posteriores, à medida que os casos de uso e critérios de aceitação forem formalizados.

- **OBJ01** — Centralizar solicitações RF07–RF19

- **OBJ02** — Controlar frota e motoristas RF26–RF36

- **OBJ03** — Controlar aprovação RF20–RF25

- **OBJ04** — Acompanhar viagens RF37–RF46

- **OBJ05** — Acompanhar rotas RF47

- **OBJ06** — Atender demandas SVO RF48–RF54

- **OBJ07** — Controlar documentação RF55–RF58

- **OBJ08** — Gerenciar evidências RF59–RF62

- **OBJ09** — Disponibilizar notificações RF63–RF64

- **OBJ10** — Disponibilizar indicadores RF65–RF70

- **OBJ11** — Disponibilizar relatórios RF71–RF75

- **OBJ12** — Garantir rastreabilidade RF05–RF06; RNF24–RNF27

## 13 OBSERVAÇÕES E PONTOS A VALIDAR

Alguns pontos identificados no levantamento dependem de decisões posteriores de negócio ou de viabilidade técnica. Recomenda-se validá-los antes do congelamento do escopo.

- Definir os campos obrigatórios do ticket de solicitação.

- Definir o fluxo exato do portal público sem login e os dados mínimos exigidos para identificação por CPF.

- Definir o prazo considerado para alerta de vencimento da CNH e demais documentos.

- Definir o método e a precisão esperada para identificação de desvios de rota.

- Definir a política de retenção das fotografias e documentos.

- Definir o fluxo operacional específico do SVO e suas permissões.

- Definir se as escalas dos motoristas estarão efetivamente no MVP.

- Definir os indicadores e filtros finais do dashboard.

- Definir os critérios de geração dos relatórios em PDF.

- Definir quais funcionalidades de geolocalização e otimização de rota permanecerão no MVP ou serão classificadas como Plus.
