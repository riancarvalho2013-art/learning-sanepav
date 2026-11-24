# Learning Sanepav 4.0 — Release consolidada V5 + V6

**Branch-alvo:** `homologacao-dna`  
**HEAD verificado antes da implementação:** `1c66c721ad6094d0d2d876c540f6cce18476af09`  
**Branch de produção:** `main` — NÃO ALTERAR  
**Stack:** Node.js >=24, JavaScript, SQLite e frontend web próprio  
**Tipo:** Atualização incremental, sem dependências externas e sem substituição do SCORM V3

## O que esta release entrega de verdade

### Pulse Seguro V5, incluído nesta entrega única

- Pesquisa para público autorizado, perguntas Likert 1–5 e recomendação 0–10.
- Controle de elegibilidade separado dos resultados; respostas registradas em contadores agregados, sem linhas individuais de escolha.
- Impede respostas duplicadas; relatório só após encerramento e >=7 respostas; inclui taxa de participação, distribuição e eNPS compatível.
- NÃO muda pesquisas legadas identificadas e não é garantia de anonimato absoluto diante de correlação externa.

### Avaliações Educacionais V6, novo

- Nova aba **Avaliações educacionais** na navegação de cada usuário autorizado.
- Formulários vinculados a curso publicado e empresa, com versão, pré/pós/final, 1–40 questões de múltipla escolha, gabarito protegido, pesos, nota mínima, quantidade máxima de tentativas e janela de disponibilidade.
- Rascunho → edição → publicação → arquivamento; duplicação para novo rascunho sem alterar histórico da versão publicada.
- Colaborador responde apenas avaliação vinculada a curso em que está matriculado, na sua empresa, respeitando os pré-requisitos da trilha.
- Correção, aprovação, limite de tentativas e persistência realizados exclusivamente pelo servidor; envios idempotentes.
- Visão gerencial com respondentes, notas, tentativas, taxa de aprovação, paginação e CSV restrito a RH/Admin autorizado.
- **IMPORTANTE:** nota da avaliação não conclui automaticamente o curso nem emite certificados. A fonte de conclusão continua sendo o LMS/SCORM.

### People Intelligence V6, novo

- Nova aba **Inteligência integrada** dentro de **Relatórios**, respeitando empresa e período.
- LXP Discovery V4: pessoas com interações, catálogo, buscas, solicitações de abertura de aula, favoritos, avaliações e nota média.
- Avaliações V6: formulários publicados/arquivados, tentativas no período, avaliações respondidas, aprovados, taxas e maior nota média.
- Pulse Seguro V5: somente pesquisas encerradas com >=7 respondentes; total agregado de convites, respostas e taxa de participação.
- Informa explicitamente fonte, estado de disponibilidade e caveats. Não inventa eventos anteriores à instalação.
- Bloqueia recortes pequenos da LXP (<5 pessoas) e não abre agregados corporativos Pulse para líder sem permissão de RH.
- Não aplica filtros individuais/departamentais aos números Pulse V5; a tela exige limpar esses filtros na visão integrada.

### Preservado

- `platform.mjs`, `storage.mjs`, `domain.mjs`, `migrations.mjs`, `learning.mjs`, `scorm-v3.mjs`, `lxp-v2.mjs`, `learning-discovery-v4.mjs`, `learning-evolution.mjs` e certificados existentes **NÃO SÃO SUBSTITUÍDOS** por este ZIP.
- Manifesto e HTML continuam carregando o mesmo player SCORM V3 e módulos anteriores.

## Arquivos que vão ao GitHub

**Substituir (6):**
- `serve.mjs`
- `web-index.html`
- `asset-manifest.json`
- `package.json`
- `reports-v3.mjs`
- `web-reports-v3.js`

**Novos (12 de código/testes):**
- `pulse-secure-v5.mjs`
- `web-pulse-v5.js`
- `web-pulse-v5.css`
- `verify-pulse-v5.mjs`
- `verify-pulse-integration.mjs`
- `learning-assessments-v6.mjs`
- `people-intelligence-v6.mjs`
- `web-assessments-v6.js`
- `web-assessments-v6.css`
- `verify-assessments-v6.mjs`
- `verify-intelligence-v6.mjs`
- `verify-release-v6.mjs`

**Documentação:** este arquivo, `CHECKLIST-HOMOLOGACAO-V6.md`, `STATUS-QUALIDADE-V6.md`, `BASELINE-LEARNING-4.md`, `README-LEARNING-4-PULSE.md`.

O `release-sha256.txt` acompanha o pacote como inventário de integridade. Não precisa ser executado.

## Como atualizar SEM afetar a produção

1. **Pare se `production` estiver conectada à `homologacao-dna`.** Em Railway → production → learning-sanepav → Settings → Source, confirme `main`. Não use Deploy em produção.
2. **Faça snapshot consistente do SQLite de homologação e teste a restauração em cópia isolada.** Essas migrações são aditivas, mas preservação exige backup.
3. Confirme que a branch `homologacao-dna` ainda é `1c66c721ad6094d0d2d876c540f6cce18476af09`. Se tiver mudado, reconcilie os 6 arquivos modificados antes de subir.
4. Extraia o ZIP. Abra `https://github.com/riancarvalho2013-art/learning-sanepav/tree/homologacao-dna` → **Add file → Upload files**. Envie todos os arquivos da raiz extraída, não o ZIP e não a pasta inteira.
5. Commit: `Learning 4.0 - Release Unificada Pulse V5 Assessments V6 Intelligence V6`. Selecione `Commit directly to homologacao-dna`.
6. No Railway → **homologacao → angelic-serenity → Deployments**, aguarde `ACTIVE / Deployment successful` após o commit. Se falhar, verifique `Build Logs` antes de alterar mais arquivos.
7. Entre no ambiente de homologação e valide `Pulse Seguro`, `Avaliações educacionais`, `Relatórios → Inteligência integrada`, SCORM V3 e certificados antigos.
8. **Não realize merge à main antes dos testes E2E, restauração e validação de privacidade.**

## Testes da release no checkout completo

```bash
node --version    # deve ser >=24
npm test
```

A suíte do `package.json` foi ampliada com:

- `verify-pulse-v5.mjs`
- `verify-pulse-integration.mjs`
- `verify-pulse-integration.mjs`
- `verify-assessments-v6.mjs`
- `verify-intelligence-v6.mjs`
- `verify-release-v6.mjs`

## Novas APIs

| URL | Método | Função |
|---|---|---|
| `/api/pulse/v5/*` | GET/POST | Público, criação, respostas, fechamento, resumo protegido |
| `/api/assessment/v6/options` | GET | Empresas/cursos para RH/Admin |
| `/api/assessment/v6/list` | GET | Listagem com escopo por perfil |
| `/api/assessment/v6/detail?id=...` | GET | Formulário; gabarito somente para gestores autorizados |
| `/api/assessment/v6/create` | POST | Criação de rascunho |
| `/api/assessment/v6/update` | POST | Revisão otimista de rascunho |
| `/api/assessment/v6/publish` | POST | Publicação imutável do formulário |
| `/api/assessment/v6/archive` | POST | Arquivamento sem perda de histórico |
| `/api/assessment/v6/duplicate` | POST | Cópia para novo rascunho |
| `/api/assessment/v6/submit` | POST | Correção e registro autoritativos |
| `/api/assessment/v6/results?id=...` | GET | Resultado gerencial paginado |
| `/api/assessment/v6/export.csv?id=...` | GET | CSV autorizado |
| `/api/intelligence/v6/summary?company=...&from=...&to=...` | GET | Métricas integradas, com escopo e supressão |

## Persistência e rollback

- `pulse_v5_*` e `assessment_v6_*` são tabelas **aditivas** no mesmo SQLite persistente; migração no primeiro acesso do módulo.
- Não apagar tabelas na reversão de código. O rollback da branch recupera o frontend/rotas anteriores; dados novos permanecem para recuperação e retenção apropriada.
- Um processo de restauração só é seguro após backup testado e validação dos dados atuais.

## Limitações conscientemente abertas

Esta release NÃO implementa tudo que consta no protocolo mestre 4.0. Ainda estão pendentes: múltiplos SCOs/sequenciamento completo SCORM 2004; banco de questões reutilizável; turma presencial; avaliação 360°/calibração; certificados PDF nativos com QR e verificação pública aprimorada; série histórica com estrutura organizacional na data do evento; job de exportação de alto volume; todas as jornadas E2E; desempenho p95; infraestrutura de backup e monitoramento; design system global WCAG 2.2 AA; integração confiável com folha/DP. O formulário V6 tem duração planejada, NÃO cronômetro servidor com expiração de tentativa.

### Estado de aceite

**APROVADO:** testes isolados do backend V5/V6 e smoke UI com dados sintéticos.  
**NÃO TESTADO:** `npm test` de todo o repositório com Node 24, E2E real no Railway, revisão externa de segurança, restore do SQLite e carga.  
**NÃO HOMOLOGADO PARA PRODUÇÃO:** a publicação e uso real ainda dependem desses gates.
