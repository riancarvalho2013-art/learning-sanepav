# Auditoria de arquitetura — Learning Sanepav 3.0

**Base:** `riancarvalho2013-art/learning-sanepav`, `homologacao-dna`, commit `3a926f0929ff58b9c78b402601d844c649911f58` verificado em 23/11/2026. Esta auditoria é uma inspeção focada da estrutura, rotas e funções prioritárias; **não** é uma auditoria formal de cada linha dos arquivos do repositório nem certificação de segurança.

## Arquitetura encontrada

| Elemento | Implementação constatada | Observação |
|---|---|---|
| Backend | Node.js ES modules / `serve.mjs`, `platform.mjs` | Handler HTTP nativo; vários módulos de extensão por rota |
| Dados | SQLite via `storage.mjs`, `node:sqlite` | Tabela de objetos JSON + tabelas organizacionais; SQLite WAL |
| Pessoas/organização | `domain.mjs`, `migrations.mjs`, `web-foundation.js` | Empresas, unidades, departamentos, acesso e vínculos |
| LMS | `platform.mjs`, `learning.mjs`, `web-app.js` | Cursos, estados, trilhas, atribuições, progresso, questionários |
| LXP | `lxp-v2.mjs`, `web-lxp-v2.js`, `web-lxp-v2.css` | Pulse, ciclos, tarefas de avaliação, PDI 70-20-10, 1:1, solicitações de feedback |
| Identidade/certificado | `learning-evolution.mjs`, `web-evolution.js` | Marca por empresa, modelos e emissão por matrícula concluída |
| SCORM | `scorm-v3.mjs`, `web-scorm-v3.js`, `web-scorm-v3.css` | Runtime independente e player; usuário confirmou funcionamento em homologação |
| Design system | `web-style.css`, `web-evolution.css`, `web-lxp-v2.css` | Azul e branco, componentes móveis; faltava centralização de analíticos |
| Build | `asset-manifest.json`, `build.mjs`, `Dockerfile` | assets embutidos; `npm test` no Dockerfile com Node 24 |
| Segurança | Cookies HttpOnly para sessão, auth em middleware, permissões e escopos por empresa | Necessita teste contínuo de acesso cruzado e revisão de anonimato Pulse |

## Matriz de funcionalidade e situação — antes do release

| Módulo | Evidência de código | Situação de auditoria | Prioridade |
|---|---|---|---|
| Login, sessão, administração | `serve.mjs`, `platform.mjs` | Implementado; produção não auditada | Alta |
| Vínculos empresariais | `domain.mjs`, `migrations.mjs` | Implementado com modelo atual de um vínculo principal por pessoa | Alta |
| Cursos, matrículas, trilhas | `platform.mjs`, `learning.mjs` | Implementados, testes anteriores presentes; execução real parcial | Alta |
| SCORM 1.2/2004 | `scorm-v3.mjs`, `verify-scorm-v3.mjs` | Implementado; usuário confirmou um pacote funcionando | Crítica — preservar |
| Pulse | `lxp-v2.mjs` | Implementado com restrições; anonimato irreversível NÃO comprovado | Crítica — redesenhar privacidade |
| Ciclos de desempenho | `lxp-v2.mjs` | Implementado parcialmente; avaliação 360 completa não consta na extensão | Alta |
| PDI, feedback, 1:1 | `lxp-v2.mjs` | Implementados parcialmente | Média |
| Certificados | `learning-evolution.mjs` | Registro por conclusão; PDF nativo, revogação e indexação pendentes | Alta |
| Central de Relatórios | `web-app.js` e indicadores separados | Parcial e não padronizado | Alta — **objeto deste release** |
| People Analytics (RH/DP) | Sem integração confiável com folha/ponto identificada | Dependente de fonte externa | Alta, mas não inventar dados |
| Kirkpatrick N3/N4 | Sem coleta integrada de evidências operacional no inventário | Ausente/parcial | Média |
| Eventos de aprendizagem normalizados | Estado LMS + logs + alguns eventos LXP | Parcial | Alta |
| Construtor no-code, filas, agendamentos | Não identificado | Ausente | Média |

## Cobertura deste incremento

- **21 indicadores** em catálogo versionado: matrículas, conclusões, progresso, notas, certificados emitidos, trilhas, PDI, desempenho, feedback, 1:1 e Pulse.
- **Mapeamento completo da nova rota**: `reports-v3.mjs` → `BUCKET.get('system/state-v1')`, `BUCKET.get('lxp/v2/state')`, objetos `evolution/v1/issued/{enrollmentId}` → filtro de autorização/empresa/pessoa → cálculos → GET JSON ou CSV → frontend → XLSX/print.
- **Escopo efetivo**: servidor valida sessão e papel, empresas autorizadas e hierarquia; consultas por pessoa fora do escopo retornam 403.
- **Privacidade**: métrica Pulse indisponível para filtros individuais/departamentais; estatísticas somente para pesquisas com 7 ou mais respostas, sem identificar respondentes. Supressão de agrupamentos de departamento com menos de 5 pessoas.
- **Teste**: `verify-reports-v3.mjs` com fixtures isoladas e validação das rotas; QA Chromium com dados inventados, XLSX aberto com openpyxl.

## Riscos técnicos identificados

1. Persistência de estado JSON por módulos dificulta eventos normalizados, histórico e extração volumosa. Migrar incrementalmente com migrações versionadas.
2. Eventos de acesso, início de aula, tempo efetivo, tentativas detalhadas e certificações não possuem ainda um contrato analítico único. Não extrapolar dados.
3. Pulse existente grava `userId` junto à resposta em estado persistente. Um limiar estatístico na interface não equivale a anonimização irreversível.
4. Relatórios com datasets muito grandes são calculados no processo Node; adicionar paginação de consulta e materializações com índices em fase posterior.
5. A homologação usa a branch de testes: preservar isolamento e confirmar `main` em produção antes do upload.
6. O conector GitHub atual permite leitura do repositório, mas operações de criação de blob e escrita retornaram HTTP 403 neste turno. A alteração não foi publicada automaticamente.

## Próximas fases priorizadas do protocolo mestre

**P1 — qualidade de dados e analytics:** emitir eventos de aprendizagem idempotentes, reconciliar conclusão, tempo e certificados, agregar provas de Kirkpatrick N1/N2, ampliar filtros e criar índices relacionais para exportações.

**P2 — pesquisa e avaliação:** coleta de Pulse com anonimização desde o armazenamento; ciclos 180/270/360 com avaliadores pares, calibração, históricos, reabertura e governança de notas.

**P3 — relatórios avançados:** dicionário expandido, construtor no-code seguro, visualizações customizadas, drill-down por fonte, XLSX/CSV/PDF assíncronos, execução agendada e histórico de jobs.

**P4 — gestão, integração e hardening:** integração legítima de RH/DP, onboarding, dados de cargos, histórico organizacional, telemetria técnica, testes E2E com pacotes SCORM reais, desempenho e recuperação de backup.

Nada nesta auditoria declara o Learning 3.0 integralmente concluído. O escopo entregue é uma etapa funcional compatível com o protocolo de desenvolvimento por fases.
