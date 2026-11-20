# Sanepav Learning 2.0

## Diagnóstico confirmado

Base de produção d871eb7, repositório riancarvalho2013-art/learning-sanepav, Railway celebrated-tranquility, serviço learning-sanepav. Endereço atual https://learning-sanepav-production.up.railway.app/. A consulta inicial de repositórios retornou vazia, mas o acesso ao repositório exato foi confirmado depois de sua identificação no Railway. A integração GitHub permite leitura e recusou gravação com 403. O navegador autenticado permitiu o incremento anterior.

O código usa JavaScript sem framework, Node 24 e SQLite nativo. Antes deste incremento, o frontend inteiro estava embutido em platform.mjs e o estado funcional era um JSON na tabela objects. Existiam autenticação, sessões, usuários, hierarquia, cursos, mídia, matrículas, missões, ponte SCORM, questionário simples, registros de PDI/metas/desempenho, feedback privado, Pulse identificada, elogios, rede social e notificações. Essas funções foram reaproveitadas. Os registros simples ainda não atendem à abrangência dos módulos 2.0.

O vídeo https://youtu.be/NaNP3VfCZ2U não pôde ser recuperado na análise anterior. Suas telas e jornadas específicas permanecem sem verificação. A referência oficial https://www.qulture.rocks/ confirma a conexão entre avaliações, PDI, aprendizagem, 1:1, feedback, clima, metas, sucessão e indicadores. O inventário detalhado fornecido pelo solicitante permanece o contrato de requisitos.

## Entrega de fundação

- Extração dos ativos em arquivos web-* editáveis e build reproduzível por asset-manifest.json e build.mjs. Rotas e identidade existentes são preservadas.
- Empresas, unidades, áreas e vínculos profissionais persistentes em SQLite, com chaves estrangeiras, validação, controle de revisão e auditoria. Cadastros antigos aguardam vínculo explícito com uma empresa.
- Cinco perfis reconhecidos pelo servidor. Administrador técnico configura usuários e estrutura. RH/DHO gerencia aprendizagem e acompanha seu escopo. Liderança acompanha a hierarquia de sua empresa. Diretoria consulta indicadores autorizados. Colaborador consulta sua experiência pessoal.
- Acesso consolidado de RH e diretoria depende de concessão explícita por empresa. Alterações invalidam versões em andamento do estado para impedir gravações com autorização desatualizada.
- Isolamento por empresa em hierarquia, reconhecimentos, feed social, comentários, reações e mídia social. Conteúdo privado de 1:1 e feedback permanece restrito aos participantes. O catálogo corporativo legado é compartilhado e o acesso do colaborador ao conteúdo continua dependente de matrícula.
- Interface de estrutura organizacional com cadastro, edição, arquivamento, reativação, vínculos, busca, ordenação, paginação e exportação CSV.
- Perfil profissional integrado aos dados de aprendizagem e desenvolvimento autorizados, organograma por relações de liderança e indicadores com definições explícitas. Métricas sem dados são exibidas como indisponíveis.
- Pesquisa global sobre pessoas, cursos e registros já autorizados. Contexto da empresa no cabeçalho. Cards com ações de consulta.
- Recuperação de acesso com token aleatório, armazenamento por hash, expiração em 30 minutos, consumo único, revogação de sessões, limite de solicitações e resposta sem confirmação da existência de conta.
- Novas senhas usam PBKDF2 SHA-256 com 600 mil iterações. Senhas legadas continuam verificáveis pelo fator original. Cookies HttpOnly, SameSite e Secure em produção são preservados.
- Limite de 256 KB para JSON na entrada HTTP e endpoint /healthz. A página principal recebe política de conteúdo e proteção contra enquadramento. A política de isolamento do SCORM é preservada.

## Arquivos e persistência

Arquivos principais alterados ou adicionados incluem platform.mjs, storage.mjs, domain.mjs, migrations.mjs, recovery.mjs, credentials.mjs, serve.mjs, build.mjs, asset-manifest.json, package.json, Dockerfile, arquivos web-* e suítes verify-*. A imagem executa npm test antes de ficar pronta para publicação.

A migração 1 adiciona companies, units, departments, people, person_organizations, company_access, domain_audit, password_resets, password_reset_requests e schema_migrations. A tabela people guarda referências aos IDs já existentes. Os dados profissionais antigos continuam na fonte original, sem uma segunda cópia autoritativa. As novas entidades organizacionais ficam exclusivamente nas tabelas relacionais.

A gravação do estado legado e a projeção de IDs usam a mesma transação. O snapshot pre-foundation-v1.sqlite é criado junto ao banco, em backups/, antes de migrações e novas gravações. Inclui dados presentes em WAL e tem permissão 0600. Reinícios preservam o snapshot. A cópia compartilha o volume e não substitui backup externo. O banco e o volume existentes devem ser reutilizados.

migrations.mjs contém rollbackFoundation para reversão explícita por operador, após backup. A reversão remove as entidades novas e preserva objects. Restaurar integralmente o snapshot exige um procedimento de manutenção com a aplicação parada. Nenhuma reversão automática é executada em produção.

## Testes

npm test executa o build e as suítes de privacidade, backup, fundação e recuperação. As verificações cobrem autenticação, hierarquia, bloqueio, cursos, questionário, ponte SCORM, edição por autor, registros privados, sete respondentes, backup com WAL e arquivos binários, integridade do SQLite, permissões, cinco perfis, empresas, vínculos, concorrência por revisão, revogação de escopos, isolamento social, migrações reversíveis, token por hash, expiração, uso único concorrente e revogação de sessões.

A homologação visual usa um ambiente local isolado com contas e empresas de teste identificadas na interface. O mecanismo de sessão de teste fica fora do repositório e não é publicado. Foram verificados cadastro de unidade, atualização de vínculo e painel da diretoria por escopo. As demais verificações visuais continuam em execução. A conformidade WCAG completa, carga, pentest e a conformidade completa de SCORM ainda não foram demonstradas.

## Configuração da recuperação

RESEND_API_KEY e EMAIL_FROM precisam estar configuradas para envio real. APP_ORIGIN define o endereço HTTPS usado no link de recuperação. Sem provedor válido, a interface informa que a recuperação está indisponível e orienta contato com a administração. Os testes de entrega usam uma função isolada e nunca enviam e-mails reais.

## Situação dos módulos

| Módulo | Situação após a fundação |
| --- | --- |
| Home e dashboards | Base funcional preservada, contexto e painel executivo inicial adicionados. Pendentes todos os indicadores e jornadas por perfil. |
| LMS/LXP | Ciclo de publicação, arquivamento, reativação, histórico e revisões implementados sobre a base existente. Pendentes aulas relacionais, pré-requisitos completos, tentativas, certificados PDF verificáveis, turmas e presença. |
| Avaliação de desempenho | Registros legados preservados. Pendentes ciclos, formulários parametrizáveis, pesos, avaliadores e calibração. |
| 9Box | Matriz simples preservada. Pendentes critérios configuráveis, sessões e histórico próprio. |
| PDI | Registros e vínculos preservados. Pendentes ações estruturadas, competências, 70-20-10 e evidências. |
| 1:1 | Registros privados preservados. Pendentes agenda, recorrência, tarefas e notas privadas separadas. |
| Feedback e reconhecimento | Base privada e mural preservados, com escopo organizacional. Pendentes solicitações e modelos estruturados. |
| Clima | Pulse identificada preservada. Pesquisas anônimas e proteção contra reidentificação continuam pendentes. |
| Objetivos e OKRs | Registros existentes preservados. Pendentes ciclos, alinhamento e múltiplos resultados-chave. |
| People Analytics | Indicadores iniciais documentados por escopo e CSV. Pendentes séries temporais, XLSX, PDF e efetividade. |
| Perfil | Dados profissionais e histórico autorizado integrados. Competências e certificados dependem das etapas seguintes. |
| Organograma e sucessão | Relações organizacionais acessíveis. Sucessão e prontidão continuam pendentes. |
| IA | Integração ausente, sem respostas simuladas ou envio externo de dados de RH. |
| Programas DNA | Conteúdo e missões existentes preservados. Administração completa dos programas permanece pendente. |
| Administração | Empresas, unidades, áreas, vínculos e escopos implementados. Pendentes importação, grupos, retenção e calendários. |

A entrega é um incremento de fundação. O projeto completo continua em evolução e os quinze módulos ainda não satisfazem todos os critérios de aceite.


## Homologação da fundação — 19/11/2026

A fundação foi publicada no ambiente homologacao do mesmo projeto Railway, com serviço c64a10c1-6898-4e91-aeab-42d69a3f57e1 e volume próprio 478eff6f-e337-4c4f-8bdf-f2b330ec3c4b montado em /data. O volume de produção não foi copiado nem substituído. URL: https://angelic-serenity-homologacao.up.railway.app/.

O deploy 8dda8616-ee92-440d-8bc0-118ab660a653, commit remoto 1219ea3ec8d68f5078656c1d64a792c08d980272, ficou Active/Deployment successful. O Docker executou as quatro suítes da fundação e o healthcheck /healthz foi aprovado. A página inicial publicada foi verificada. O PR #1 permanece sem merge na produção.

## Incremento Learning 01 — ciclo de publicação

Cursos novos são salvos como rascunhos. Publicação, arquivamento e reativação exigem Administrador ou RH/DHO, revisão atual e validação no servidor. Cursos legados sem esses campos continuam publicados, revisão zero. Nenhuma conversão destrutiva é necessária.

O catálogo mostra status, filtro e histórico por curso. Edições e mudanças de status incrementam a revisão; gravações desatualizadas recebem 409. Leitura e Link podem ter o conteúdo editado pela interface. O histórico registra autor, evento, data e revisão, sem ser um sistema de restauração de versões do conteúdo. Versões imutáveis para certificação ainda são uma pendência.

Rascunhos e cursos arquivados não recebem matrículas novas. Arquivamento preserva os participantes, o progresso e o acesso ao conteúdo já atribuído. A atribuição de uma missão com curso indisponível falha por completo, sem matrículas parciais. RH pode atribuir cursos publicados ao seu escopo organizacional, sem precisar ter uma matrícula prévia.

Os dados adicionais ficam no curso original, dentro de objects/system/state-v1. Não foram criadas tabelas ou cadastros paralelos para cursos. A migração relacional completa do domínio de aprendizagem continua pendente.

Arquivos deste incremento: learning.mjs, platform.mjs, web-app.js, verify-learning.mjs, verify-privacy.mjs, package.json e openapi.json. verify-learning.mjs usa APIs reais e SQLite em disco para verificar permissões, estados, conflito de revisão, integridade da atribuição de missões e persistência. A interface foi testada com contas sintéticas isoladas: criar rascunho, publicar, arquivar e consultar histórico. Esses dados de teste não são publicados no Railway.

## Ativação de novos ambientes

O código de ativação padrão herdado foi removido. Um ambiente sem contas precisa de SETUP_KEY exclusiva nas variáveis do serviço, com 32 a 128 caracteres de letras, números, hífen ou sublinhado. A chave deve ser criada pelo operador e não deve ser enviada no chat ou incluída no repositório. Depois do redeploy, acessar /ativar, informar a chave e criar a conta inicial. Após ativação, SETUP_KEY pode ser removida: as contas existentes continuam autenticando normalmente.

Sem chave, a página mostra a configuração pendente e o servidor bloqueia a primeira conta. verify-bootstrap.mjs testa o servidor HTTP real: bloqueio sem chave, proteção de origem, ativação autorizada e preservação de login após reinício sem chave. O provedor de recuperação por e-mail permanece não configurado na homologação.

Próximos incrementos: aulas e trilhas estruturadas, pré-requisitos, tentativas, certificados verificáveis e programas DNA. Os demais módulos continuam com o estado indicado na matriz acima. A validação autenticada no Railway depende da configuração de ativação e da primeira conta pelo operador.


## Visibilidade da evolução

A página Evolução da plataforma, disponível para Administrador e RH/DHO, apresenta a situação dos quinze módulos, as limitações da versão em execução e atalhos para os módulos existentes. Não considera bases legadas como módulos 2.0 concluídos.
