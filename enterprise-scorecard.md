# Scorecard corporativo — V10 P0

Baseline: `0750dddf6e6972a428cf1793c953d642f1be7f40`. Data: 2026-11-24.

Pesos somam 100 por dimensão. Score final somente quando todos os critérios aplicáveis forem avaliados; PASS isolado é evidência parcial do critério restrito, não homologação. Não converter NOT_TESTED/BLOCKED em PASS. 10/10 somente com todos os critérios obrigatórios PASS e nenhum bloqueador crítico. Não há nota final nesta fase.

| Dimensão | Evidência local | Nota final |
|---|---|---|
| Frontend e navegação | 1/2 critérios restritos com evidência | Não calculada |
| Backend e arquitetura | 1/3 critérios restritos com evidência | Não calculada |
| LMS e trilhas | 0/2 critérios restritos com evidência | Não calculada |
| SCORM | 1/2 critérios restritos com evidência | Não calculada |
| Avaliações educacionais | 1/2 critérios restritos com evidência | Não calculada |
| Kirkpatrick | 1/2 critérios restritos com evidência | Não calculada |
| DHO | 1/2 critérios restritos com evidência | Não calculada |
| People Analytics | 1/2 critérios restritos com evidência | Não calculada |
| Relatórios | 1/2 critérios restritos com evidência | Não calculada |
| Segurança e privacidade | 1/2 critérios restritos com evidência | Não calculada |
| Infraestrutura e QA | 1/4 critérios restritos com evidência | Não calculada |

## Critérios e evidências

### Frontend e navegação

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| FE-01 | 30% | Assets, MIME e referências HTML verificáveis | PASS | 20 verificações em fixture de build; não equivale a build completo |
| FE-02 | 70% | Navegação integrada, acessibilidade e jornadas completas | NOT_TESTED | Sem navegador autenticado nesta sessão |

### Backend e arquitetura

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| BE-01 | 25% | Importação dos módulos reais no teste de inicialização | PASS | Falha de importação reproduzida no original; teste corrigido passa com adapters do núcleo |
| BE-02 | 35% | Roteamento e autenticação centralizados | NOT_TESTED | Fase 1 condicionada à estabilização |
| BE-03 | 40% | Migração e histórico organizacional reconciliados | NOT_TESTED | Checkout e banco reais indisponíveis |

### LMS e trilhas

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| LMS-01 | 35% | Regressão de publicação, progresso e pré-requisitos | NOT_TESTED | Núcleo indisponível nesta cópia |
| LMS-02 | 65% | Jornada completa, conclusão autoritativa e certificado | NOT_TESTED | Ainda não homologado |

### SCORM

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| SC-01 | 45% | Runtime V3: teste isolado, recursos e autorização | PASS | Teste isolado passou Node 24 |
| SC-02 | 55% | Múltiplos SCOs, edição 2004 e pacotes reais | NOT_TESTED | Não alterado nesta fase |

### Avaliações educacionais

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| AE-01 | 40% | Regressão de sessões, tentativas e correção | PASS | 59 chamadas isoladas |
| AE-02 | 60% | Banco de questões, integração LMS e E2E | NOT_TESTED | Não alterado nesta fase |

### Kirkpatrick

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| KP-01 | 40% | Regressão de N1–N4, acesso e persistência | PASS | 33 chamadas isoladas |
| KP-02 | 60% | Fluxo real LMS → N1/N2/N3/N4 → analytics | NOT_TESTED | E2E não executado |

### DHO

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| DHO-01 | 25% | Regressão isolada LXP V2 e organograma | PASS | Adapters simulados; sem homologação |
| DHO-02 | 75% | Desempenho 360°, calibração, competências, PDI e OKR integrados | NOT_TESTED | Não alterado nesta fase |

### People Analytics

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| PA-01 | 30% | Regressão de fontes, escopo e disponibilidade | PASS | 9 chamadas isoladas |
| PA-02 | 70% | Fonte semântica única e histórico reconciliado | NOT_TESTED | Fase futura |

### Relatórios

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| RE-01 | 35% | Regressão isolada de filtros, escopo e CSV | PASS | Teste isolado passou |
| RE-02 | 65% | Construtor, jobs, PDF/XLSX e reconciliação | NOT_TESTED | Fase futura |

### Segurança e privacidade

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| SP-01 | 30% | Regressão de autorização nos módulos disponíveis | PASS | 38 chamadas Pulse e 58 verificações de organograma; adapters |
| SP-02 | 70% | Testes adversariais do núcleo, sessões e LGPD | NOT_TESTED | Sem execução integral |

### Infraestrutura e QA

| ID | Peso | Critério | Estado | Evidência |
|---|---:|---|---|---|
| QA-01 | 25% | Regressões locais no Node 24 | PASS | 17 suítes disponíveis aprovadas; 41 arquivos com sintaxe válida |
| QA-02 | 25% | Build e suíte integral no checkout real | BLOCKED | Checkout incompleto no contêiner; log registra ausência de web-marca.png |
| QA-03 | 30% | Deploy saudável e smoke tests no Railway | FAIL | V9 failure no SHA auditado; patch não publicado |
| QA-04 | 20% | Carga, restauração e recuperação no ambiente real | NOT_TESTED | Somente backup/restore isolado aprovado |

**Produção bloqueada.** Consulte o JSON para os campos individuais.
