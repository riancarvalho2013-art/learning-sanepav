# Scorecard V12

Baseline V11: `cd87919c500b1b8a6e8f9cd4ad8ac40971379a7f` — status success confirmado no GitHub. V12 sem commit ou deploy.

Critérios: {'PASS': 10, 'NOT_TESTED': 14, 'BLOCKED': 1}. Nota final não calculada; produção bloqueada.

| ID | Status | Evidência |
|---|---|---|
| FE-01 | PASS | 20 verificações em fixture de build; não equivale a build completo |
| FE-02 | NOT_TESTED | Chromium 1440/390: histórico, filtros, paginação, links e alternância com Pulse/Kirkpatrick. Extensões reais com shell/API sintéticos; E2E e acessibilidade integral pendentes. |
| BE-01 | PASS | Falha de importação reproduzida no original; teste corrigido passa com adapters do núcleo |
| BE-02 | NOT_TESTED | Registro de rotas HTTP V11, autenticação compartilhada nos novos módulos; demais handlers ainda usam autenticação anterior. Teste HTTP fixture passou. |
| BE-03 | NOT_TESTED | Histórico V11 preservado; projeção de conclusões V12 com vigência, snapshots, detecção de divergências e ausência de dados. 50 verificações, SQLite real e adaptadores. Migração relacional ampla e reconciliação do banco real pendentes. |
| LMS-01 | NOT_TESTED | Motor V11 testado com pré-requisitos, escopo e confirmação de conteúdo; teste integral legado depende do checkout completo. |
| LMS-02 | NOT_TESTED | Motor V11: 81 verificações. V12 multi-SCO 1.2: conclusão após todas as etapas e prova final quando exigida; evidência runtime declarada. E2E integral pendente. |
| SC-01 | PASS | Regressão SCORM V3 passou com revogação do login e isolamento; bridge anterior preservada. |
| SC-02 | NOT_TESTED | 55 verificações de sequência linear SCORM 1.2 (2–50 SCOs), retomada e prova final. Manifestos multi-SCO 2004/complexos não suportados; pacotes reais e certificação formal pendentes. |
| AE-01 | PASS | 59 chamadas isoladas |
| AE-02 | NOT_TESTED | Integração V11 preservada, teste multi-SCO + avaliação final aprovado. Banco de questões e E2E integral pendentes. |
| KP-01 | PASS | 33 chamadas isoladas |
| KP-02 | NOT_TESTED | N1–N4 preservados; suite isolada 33 chamadas passa; jornada integral real não executada. |
| DHO-01 | PASS | Adapters simulados; sem homologação |
| DHO-02 | NOT_TESTED | Regressão 360°, calibração, supressão, metas opcionais de proficiência, gaps por competência e PDI vinculado aprovados localmente. Catálogo estruturado de competências por cargo e OKR avançado pendentes. |
| PA-01 | PASS | 9 chamadas Intelligence V6, filtro por empresa de origem dos eventos Discovery incluído. Regressão passou. |
| PA-02 | NOT_TESTED | 3 métricas históricas com fonte comum para tela/detalhe/exportação. 50 verificações; não atribui passado ao departamento atual. Catálogo global e histórico de outros fatos ainda pendentes. |
| RE-01 | PASS | Teste isolado passou |
| RE-02 | NOT_TESTED | CSV por fluxo e XLSX server-side (3 abas histórico / 5 carteira; limite 20 mil linhas por aba). Arquivos abertos no openpyxl; jobs persistentes, construtor e PDF corporativo pendentes. |
| SP-01 | PASS | 38 chamadas Pulse e 58 verificações de organograma; adapters |
| SP-02 | NOT_TESTED | Testes de transferências, acesso entre empresas, mudança de empresa, revogação do login e uso indevido de sessão SCORM passaram. Matriz adversarial integral e LGPD pendentes. |
| QA-01 | PASS | 22 grupos locais com EXIT=0 no Node 24.11.1, incluindo fixtures e 45 verificações HTTP; Chromium 2 tamanhos com shell/API sintéticos. |
| QA-02 | BLOCKED | npm test interrompido no build por web-marca.png ausente na cópia local; arquivo existe no GitHub. Checkout integral indisponível no contêiner. Não houve remoção de testes. |
| QA-03 | NOT_TESTED | V11 cd87919: sucesso confirmado no GitHub/Railway em 2026-11-24. V12 sem deploy; smoke tests autenticados ainda não executados. |
| QA-04 | NOT_TESTED | Restore isolado V7 aprovado (6 verificações), benchmark V11 permanece sintético (220 requisições/20 concorrentes). Nenhum teste novo de carga real ou restauração do volume Railway. |
