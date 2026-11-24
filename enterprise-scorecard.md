# Scorecard V11

Baseline: `3963d1e91ea06e575430297463c3a328a5950813` — status Railway success. V11 sem commit remoto, sem deploy.

Critérios: {'PASS': 10, 'FAIL': 0, 'BLOCKED': 1, 'NOT_TESTED': 14, 'NOT_APPLICABLE': 0}. Sem nota final; produção bloqueada.

| ID | Status | Evidência |
|---|---|---|
| FE-01 | PASS | 20 verificações em fixture de build; não equivale a build completo |
| FE-02 | NOT_TESTED | Atualizados consumidores de progresso, avaliações, DHO, relatórios e organograma; roteador de frontend e E2E visual ainda não validados. |
| BE-01 | PASS | Falha de importação reproduzida no original; teste corrigido passa com adapters do núcleo |
| BE-02 | NOT_TESTED | Registro de rotas HTTP V11, autenticação compartilhada nos novos módulos; demais handlers ainda usam autenticação anterior. Teste HTTP fixture passou. |
| BE-03 | NOT_TESTED | Histórico aditivo de vínculos e gestores: 20 verificações SQLite em fixture. Não migrado estado legado completo nem conciliado banco real. |
| LMS-01 | NOT_TESTED | Motor V11 testado com pré-requisitos, escopo e confirmação de conteúdo; teste integral legado depende do checkout completo. |
| LMS-02 | NOT_TESTED | 46 chamadas e 81 verificações em handlers, SQLite de avaliações e adapters; integração de certificado e relatório. HTTP integral bloqueado. Conteúdo manual permanece autodeclarado. |
| SC-01 | PASS | Regressão local do runtime V3 e teste de commit V11 com sessão, CMI e autorização; pacotes reais no Railway não testados nesta release. |
| SC-02 | NOT_TESTED | Ainda SCO único; compatibilidade formal e sequenciamento pendentes. |
| AE-01 | PASS | 59 chamadas isoladas |
| AE-02 | NOT_TESTED | Prova final publicada exigida para conclusão, reconciliação após aprovação; banco de questões e jornada HTTP integral pendentes. |
| KP-01 | PASS | 33 chamadas isoladas |
| KP-02 | NOT_TESTED | N1–N4 preservados; suite isolada 33 chamadas passa; jornada integral real não executada. |
| DHO-01 | PASS | Adapters simulados; sem homologação |
| DHO-02 | NOT_TESTED | Quatro perspectivas, calibração com histórico e PDI vinculado; testes isolados passam. Competências e OKR completos, pesos avançados e E2E pendentes. |
| PA-01 | PASS | 9 chamadas isoladas |
| PA-02 | NOT_TESTED | Classificação das conclusões no relatório, snapshot organizacional e histórico observado; catálogo semântico único e reconciliação histórica integral pendentes. |
| RE-01 | PASS | Teste isolado passou |
| RE-02 | NOT_TESTED | CSV, detalhe e XLSX incluem tipo de evidência; construtor, jobs, PDF e validação de XLSX no navegador pendentes. |
| SP-01 | PASS | 38 chamadas Pulse e 58 verificações de organograma; adapters |
| SP-02 | NOT_TESTED | Novos testes negativos de escopo, sessão revogada, CMI inválido, fraude de nota, calibração e mudança de empresa. Núcleo integral e revisão LGPD pendentes. |
| QA-01 | PASS | 20 suítes executáveis no Node 24.11.1 passaram, incluindo runtime com fixture; não equivalem à suíte completa. |
| QA-02 | BLOCKED | npm test interrompido por web-marca.png ausente na cópia local; runtime integral e jornada HTTP não iniciaram por platform.mjs ausente. Repositório remoto contém esses arquivos. |
| QA-03 | NOT_TESTED | Baseline V10 3963d1e: sucesso confirmado no status GitHub/Railway. V11 não publicada nem smoke testada. |
| QA-04 | NOT_TESTED | 220 requisições de leitura em fixture HTTP, 20 concorrentes, zero erros, p95 230–872 ms, RSS pico 324,6 MiB. Restore isolado passa. Carga e recuperação real pendentes. |
