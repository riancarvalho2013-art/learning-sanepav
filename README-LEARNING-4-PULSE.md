# Learning Sanepav 4.0 — Incremento 01: Pulse Seguro V5

**Branch alvo:** `homologacao-dna` · **Base verificada:** `1c66c721ad6094d0d2d876c540f6cce18476af09` · **NÃO enviar à `main`**

## Missão e conteúdo

Corrigir a classificação enganosa de anonimato nas pesquisas legadas e oferecer uma nova modalidade de Pulse com armazenamento exclusivamente **agregado** de respostas numéricas. Esta fase é uma correção crítica e uma evolução incremental; não é a conclusão do Learning 4.0.

## Arquivos para envio (12 arquivos na raiz do repositório)

**Substituir (5):** `serve.mjs`, `web-index.html`, `asset-manifest.json`, `package.json`, `reports-v3.mjs`.

**Adicionar (7):** `pulse-secure-v5.mjs`, `web-pulse-v5.js`, `web-pulse-v5.css`, `verify-pulse-v5.mjs`, `verify-pulse-integration.mjs`, `README-LEARNING-4-PULSE.md`, `BASELINE-LEARNING-4.md`.

Não apagar nenhum arquivo existente. A migração é *aditiva* e cria somente tabelas `pulse_v5_*` (versão 1) ao primeiro acesso. Nenhuma pesquisa antiga é apagada ou convertida. O texto da Central de Relatórios V3 foi corrigido para não chamar de anônimas as respostas legadas identificadas.

## Protocolo GitHub / Railway

1. No Railway, confirme `production → learning-sanepav → Settings → Source → main` e verifique alterações pendentes. Não publique na produção.
2. Faça backup íntegro e **teste a restauração** de uma cópia da base SQLite de homologação antes da atualização.
3. No GitHub, abra `https://github.com/riancarvalho2013-art/learning-sanepav/tree/homologacao-dna`.
4. Se o HEAD não for o commit acima, pare e reconcilie os cinco arquivos substituídos antes do upload.
5. Extraia o ZIP e envie os 12 arquivos na raiz com `Add file → Upload files`.
6. Confirme `Commit directly to the homologacao-dna branch`. Mensagem: `Learning 4.0 - Pulse Seguro V5`.
7. Em `Railway → homologacao → angelic-serenity → Deployments`, valide `ACTIVE` e consulte os logs.
8. Faça login como administrador, abra **Pulse Seguro**; crie uma pesquisa na empresa autorizada, com no mínimo 7 convidados e perguntas 1–5 / 0–10.
9. Em uma conta de colaborador convidado, responda. Confirme o impedimento de resposta duplicada.
10. Verifique que a página de resultado está bloqueada até o encerramento e com menos de 7 participações; com 7 ou mais, confira apenas contagens agregadas.
11. Teste com usuário de outra empresa: a pesquisa deve ficar invisível e não responder nem exibir relatórios.
12. Confira que a sala de aula e os conteúdos SCORM V3 continuam carregando e salvando progresso.

## Endpoints criados

| Rota | Operação | Permissões |
|---|---|---|
| `/api/pulse/v5/options` | GET | Administrador, RH/DHO, Líder com escopo |
| `/api/pulse/v5/list` | GET | Pesquisas do respondente ou gestão autorizada |
| `/api/pulse/v5/create` | POST | Gestor com empresa/audiência autorizada |
| `/api/pulse/v5/answer` | POST | Respondente convidado e pesquisa aberta |
| `/api/pulse/v5/close` | POST | Gestão autorizada |
| `/api/pulse/v5/summary?id=<id>` | GET | Gestão autorizada, com supressão |

## Modelo de privacidade aplicado

- Existe uma tabela de convidados (`pulse_v5_invites`) para controlar elegibilidade/duplicidade.
- As escolhas são imediatamente somadas em `pulse_v5_answer_counts` por pesquisa, pergunta e valor. **Não se guardam respostas individuais**, IDs de participante, timestamp da escolha, texto livre ou grupo de respostas nessa tabela.
- Convidados e contadores são alterados na mesma transação SQLite. O resultado só é acessível quando a pesquisa estiver encerrada e com >=7 respondentes.
- Não há endpoints para exportar respostas individuais ou segmentar resultados por departamento/pessoa.
- Pesquisas existentes em `lxp-v2.mjs` e no Pulse legado permanecem identificadas. A navegação é rotulada para deixar essa diferença clara.

### Limitações e riscos NÃO resolvidos

- O isolamento é de **aplicação e modelo de dados**. Administradores de infraestrutura que monitorem operações do banco em tempo real, ou que correlacionem metadados externos, podem fazer inferências. Não declarar anonimato absoluto nem conformidade LGPD automaticamente.
- A versão suporta somente perguntas numéricas **Likert 1–5** e **recomendação 0–10**; não inclui texto, matrizes ou perguntas condicionais.
- Não há edição pós-publicação, gestão de convites por e-mail, agendamento de notificações, exportação PDF/XLSX ou ligação à Central BI V3 nesta entrega.
- O limite 7 não resolve todos os cenários de inferência por pesquisas semelhantes em públicos fortemente sobrepostos; a política organizacional deve revisar públicos e divulgação.
- A instalação não altera nem revoga a interface Pulse legada; esta permanece acessível com seus registros identificados.

## Testes e prontidão

- Executado com Node.js **24.11.1**: `node verify-pulse-v5.mjs` — PASSOU (38 chamadas ao módulo).
- Executado com Node.js **24.11.1**: `node verify-pulse-integration.mjs` — PASSOU.
- Sintaxe de `serve.mjs`, `pulse-secure-v5.mjs`, `web-pulse-v5.js`, `verify-pulse-v5.mjs` — PASSOU.
- `npm test` completo do repositório original: **NÃO EXECUTADO nesta geração local** (o checkout completo não está montado).
- E2E no ambiente Railway com contas reais: **NÃO EXECUTADO**.
- Inspeção de interface via Chromium: **INCONCLUSIVA** por limitação no navegador de QA local; exige validação manual da homologação.
- Homologação corporativa e prontidão de produção: **NÃO APROVADAS**.

## Rollback

O retorno ao commit anterior na homologação restaura as rotas e interface antigas. As tabelas `pulse_v5_*` são aditivas e permanecem no banco após esse rollback de código. **Não apague essas tabelas automaticamente.** Para desfazer migração, é necessária política de retenção, backup testado e autorização específica.

## Futuras entregas prioritárias

1. Consolidar Pulse novo + legado sem ambiguidades de privacidade, integrar resultados agregados ao catálogo BI e proteger diferenças de grupos sobrepostos.
2. Registrar eventos de LMS em uma trilha idempotente, com reconciliação matrículas → conclusões → certificados.
3. Avaliações educacionais e banco de questões da branch experimental, após revisão de contratos e testes.
4. Integração People Intelligence V4 (métricas históricas, drill-down, permissões granulares).
5. UX e testes E2E reais; inspeção de segurança do ambiente de homologação.
