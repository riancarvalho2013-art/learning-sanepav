# Scorecard V13

Baseline V12: `a2017a37f60b40926a69a54199bb0ffb8b7ee478` — status success confirmado no GitHub. V13 não publicada.

{'PASS': 10, 'NOT_TESTED': 14, 'BLOCKED': 1}; nota global não calculada; produção bloqueada.

| ID | Estado | Evidência |
|---|---|---|
| FE-01 | PASS | 20 verificações em fixture de build; não equivale a build completo |
| FE-02 | NOT_TESTED | Chromium 1440/390: OKR criação, publicação, check-in, catálogo, Pulse e Kirkpatrick com scripts reais e shell/API sintéticos. E2E integral bloqueado na cópia local. |
| BE-01 | PASS | Falha de importação reproduzida no original; teste corrigido passa com adapters do núcleo |
| BE-02 | NOT_TESTED | V13 reutiliza rotas LXP/relatórios e persistência CAS existentes. Refatoração integral do núcleo ainda pendente. |
| BE-03 | NOT_TESTED | Histórico V11 preservado; projeção de conclusões V12 com vigência, snapshots, detecção de divergências e ausência de dados. 50 verificações, SQLite real e adaptadores. Migração relacional ampla e reconciliação do banco real pendentes. |
| LMS-01 | NOT_TESTED | Motor V11 testado com pré-requisitos, escopo e confirmação de conteúdo; teste integral legado depende do checkout completo. |
| LMS-02 | NOT_TESTED | Motor V11: 81 verificações. V12 multi-SCO 1.2: conclusão após todas as etapas e prova final quando exigida; evidência runtime declarada. E2E integral pendente. |
| SC-01 | PASS | Regressão SCORM V3 passou com revogação do login e isolamento; bridge anterior preservada. |
| SC-02 | NOT_TESTED | 58 verificações SCORM 2004 flow-only explícito e 55 SCORM 1.2. Suporte restrito: organização plana, flow=true/choice=false, forwardOnly opcional, navegação ADL parcial. Regras complexas, rollup, objetivos compartilhados, pacotes reais e conformidade formal pendentes. |
| AE-01 | PASS | 59 chamadas isoladas |
| AE-02 | NOT_TESTED | Integração V11 preservada, teste multi-SCO + avaliação final aprovado. Banco de questões e E2E integral pendentes. |
| KP-01 | PASS | 33 chamadas isoladas |
| KP-02 | NOT_TESTED | N1–N4 preservados; suite isolada 33 chamadas passa; jornada integral real não executada. |
| DHO-01 | PASS | Adapters simulados; sem homologação |
| DHO-02 | NOT_TESTED | V13: 33 verificações de OKR em API e SQLite; metas crescentes/decrescentes, pesos, publicação, check-ins, encerramento, idempotência e escopo. 360/PDI preservados. Catálogo corporativo de competências e integração completa ainda pendentes. |
| PA-01 | PASS | 9 chamadas Intelligence V6, filtro por empresa de origem dos eventos Discovery incluído. Regressão passou. |
| PA-02 | NOT_TESTED | 66 definições únicas no registro semântico; projeção reutiliza carteira, histórico, inteligência e OKR. N2 usa cálculo compartilhado. Reconciliação de todos os fatos históricos e migração relacional pendentes. |
| RE-01 | PASS | Teste isolado passou |
| RE-02 | NOT_TESTED | Nova visão semântica e XLSX com as mesmas métricas; exportação validada por leitura. Fila persistente, construtor e processamento de grandes volumes ainda pendentes. |
| SP-01 | PASS | 38 chamadas Pulse e 58 verificações de organograma; adapters |
| SP-02 | NOT_TESTED | Testes adicionais de escopo OKR, transferências, revogação SCORM, bloqueio de navegação e integridade de backup. Matriz adversarial completa e LGPD pendentes. |
| QA-01 | PASS | 26 grupos locais EXIT=0 com Node 24.11.1; 49 verificações HTTP em fixture; navegador 1440/390 com shell/API sintéticos. |
| QA-02 | BLOCKED | npm test e verify-browser-v13.py interrompidos no build por ausência de web-marca.png e outros arquivos centrais na cópia de trabalho. Workflow criado para checkout integral; não executado remotamente. |
| QA-03 | NOT_TESTED | V12 a2017a37f60b40926a69a54199bb0ffb8b7ee478: GitHub status success confirmado. V13 não publicada: GitHub escrita 403. Smoke/E2E real pendentes. |
| QA-04 | NOT_TESTED | Backup WAL + SHA-256 de arquivo, esquema e conteúdo por tabela, verificação e restauração em cópia isolada aprovados com SQLite sintético; restauração com núcleo real, dispositivo externo e carga Railway ainda pendentes. |
