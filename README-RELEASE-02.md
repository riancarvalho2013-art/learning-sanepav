# Learning Sanepav 3.0 — Incremento 02: Descobertas e eventos LXP

**Branch-alvo:** `homologacao-dna`  
**Base confirmada:** commit `5953cf8426b9116f95eda536de42f69be71df899` (23/11/2026).  
**Ambiente:** Node.js 24 e SQLite nativo.  
**Importante:** esta entrega ainda **não está implantada** no GitHub/Railway; o conector GitHub retornou 403 para operações de escrita.

## Objetivo e escopo efetivamente implementado

Esta versão prepara a trilha analítica da LXP sem reconstruir o LMS, alterar o banco legado ou tocar no runtime SCORM V3 validado pelo usuário.

- **Minha lista**: favoritar/desfavoritar cursos publicados; favoritos persistidos em SQLite por usuário. Listagem de conteúdos salvos e sugestões simples baseadas nas trilhas dos cursos previamente concluídos (sem uso de IA).
- **Avaliar cursos**: nota de 1 a 5 por usuário, somente após matrícula concluída; atualização de nota permitida; não inventa avaliações anteriores.
- **Eventos analíticos registrados a partir da implantação**: abertura do catálogo, submissão de pesquisa pela tecla Enter e cliques solicitando abertura de aula. **Clique não é início nem conclusão comprovada de aprendizagem.** Progresso e aprovação seguem exclusivamente as fontes originais do LMS/SCORM.
- **Descobertas LXP**: painel gerencial com usuários únicos que interagiram, total de eventos por tipo, favoritos e avaliações atuais, nota média e série por dia. Os filtros temporais aplicam-se aos **eventos**; favoritos e avaliações são indicadores de estoque atual.
- **Segurança e dados**: identificação sempre derivada do cookie HttpOnly autenticado; origem obrigatória para mutações; validação de autorização por curso; somente administradores/RH/gestores autorizados consultam agregados; líderes limitados às próprias equipes; empresas fora do escopo bloqueadas; recortes com menos de cinco pessoas ocultos.
- **Integridade**: eventos UUID idempotentes e supressão de interações repetitivas dentro de janelas curtas; não armazena termos de busca nem e-mails no ledger.
- **Migração**: na primeira chamada autenticada ao módulo, migração **aditiva e versionada (versão 1)**, registrada em `lxp_discovery_migrations`, cria `lxp_discovery_events`, `lxp_discovery_bookmarks`, `lxp_discovery_ratings` e índices. A conexão usa a mesma `LEARNING_DB` da plataforma.

## Arquivos de código a enviar (8)

**Substituir os 4 existentes na raiz do repositório:**
1. `serve.mjs`
2. `web-index.html`
3. `asset-manifest.json`
4. `package.json`

**Adicionar 4 novos na raiz:**
5. `learning-discovery-v4.mjs`
6. `web-discovery-v4.js`
7. `web-discovery-v4.css`
8. `verify-discovery-v4.mjs`

Os arquivos `README-RELEASE-02.md` e `INVENTARIO-INCREMENTO-02.md` são documentação, e também podem ser adicionados. Não substitua `platform.mjs`, `scorm-v3.mjs`, `lxp-v2.mjs`, `reports-v3.mjs` ou o banco de dados.

## Protocolo de implantação seguro

1. **Railway production:** conferir se o serviço de produção está ligado a `main`, sem alterações pendentes que apontem para `homologacao-dna`. **Não aplicar alterações na produção.**
2. Fazer snapshot/backup verificável do volume SQLite de **homologação** antes do primeiro acesso da versão nova. Não publicar `.sqlite` ou `.env` no GitHub.
3. Em `https://github.com/riancarvalho2013-art/learning-sanepav/tree/homologacao-dna`, usar `Add file → Upload files`, selecionar os **8 arquivos de código** (e opcionalmente os dois `.md`) e confirmar **Commit directly to the homologacao-dna branch**.
4. Mensagem do commit: `Learning 3.0 — Descobertas LXP V4 e eventos auditáveis`.
5. Em **Railway → homologacao → angelic-serenity → Deployments**, verificar o build/testes; não usar deploy da produção.
6. O Dockerfile da plataforma roda `npm test` no Node 24. Verificar se o build passou, incluindo o novo `verify-discovery-v4.mjs`. Um teste isolado também pode ser executado com `node verify-discovery-v4.mjs`.
7. Acessar a homologação com perfil administrativo e validar os itens abaixo. O módulo cria suas tabelas apenas após a primeira chamada autenticada.

## Critérios de aceitação para homologação

- [ ] Clicar em `Minha lista` abre uma nova página com favoritos e sugestões sem elementos sobrepostos.
- [ ] Favoritar um curso publicado; atualizar a página; confirmar que permaneceu salvo; desfavoritar.
- [ ] Concluir um curso (utilize um curso de teste) e atribuir uma nota; atualizar a página; confirmar a mesma nota.
- [ ] Tentar avaliar um curso não concluído: servidor deve recusar.
- [ ] Abrir `Descobertas LXP` como gestor autorizado, aplicar período e alternar empresa; verificar contagens sem replicação por múltiplos cliques.
- [ ] Trocar para usuário de outra empresa sem permissão e confirmar acesso negado a agregados externos.
- [ ] Verificar que recortes com menos de cinco pessoas mostram aviso, não dados individuais.
- [ ] Acessar o mesmo SCORM V3 que já funcionou, garantir imagens, vídeos, interação, conclusão e retomada; os arquivos SCORM **não foram modificados nesta versão**.
- [ ] Reabrir o relatório v3 e certificar que não houve regressão em CSV e XLSX.

## Testes realizados neste ambiente

- **Passou:** `node --check` de `serve.mjs`, `learning-discovery-v4.mjs`, `web-discovery-v4.js` e `verify-discovery-v4.mjs`.
- **Passou:** `node verify-discovery-v4.mjs` usando SQLite temporário com casos de autenticação, permissões, escopo empresarial, recusa de curso em rascunho/sem matrícula, idempotência, throttling, favoritos, avaliações, período, ausência de PII de busca e reabertura de banco.
- **Reconciliado:** o conteúdo original dos quatro arquivos substituídos antes da patch tem SHA Git idêntico aos arquivos da branch referenciada. Isso evita substituições baseadas em versões antigas.
- **Não executado:** suíte completa `npm test` no repositório, pois o ambiente local só disponibiliza Node 22 e não possui cópia integral atual do repositório; esse teste deve rodar no build de homologação com Node 24.
- **Não validado:** QA visual completo no navegador; a navegação a arquivos locais/localhost foi bloqueada pela política do navegador de testes. Não se declara E2E aprovado.
- **Não efetuado:** commit no GitHub ou deploy no Railway. O GitHub conectado mantém a recusa HTTP 403 para escritas.

## Limitações e próximos incrementos

1. **Fontes de verdade:** os novos eventos medem interações e tentativas de abertura, não tempo real de estudo, início efetivo, conclusão ou resultado. Esses fatos precisam ser conciliados com LMS/SCORM em uma etapa posterior usando outbox transacional.
2. **Histórico:** não há geração retroativa de eventos anteriores à instalação. Não há coleta retroativa de dados inexistentes.
3. **Empresas:** os cursos públicos continuam usando as regras de catálogo já existentes; esta versão não cria segmentação definitiva de conteúdo por empresa. A relação histórica de pessoas considera estrutura atual nas métricas.
4. **Privacidade:** o Pulse legado tem armazenamento identificado e exige redesenho de anonimização na origem; o presente release não o altera.
5. **Confiabilidade:** ainda faltam política de retenção dos eventos, monitoração avançada, índice de competência, limite de taxa por IP, testes de carga e E2E em ambiente publicado.
6. **Analytics corporativo:** os novos indicadores estão em `Descobertas LXP`; integração de seu catálogo ao relatório v3, drill-down por evento e exportação unificada estão previstos para a próxima etapa.
7. **LXP avançada:** recomendação semântica, onboarding, avaliação 360, Kirkpatrick N3/N4, cursos multi-SCO e permissões por atributo são etapas futuras e não são declarados prontos.

## Rollback

A reversão de código consiste em reimplantar o último commit estável da **homologação**, sem mexer no banco. As tabelas `lxp_discovery_*` são aditivas e não interferem nos módulos anteriores. Não exclua essas tabelas durante o rollback sem planejamento de retenção/backup. Antes de qualquer promoção para produção, é indispensável um teste de restauração do volume.
