# Learning Sanepav 3.0 — DNA Intelligence | Release 01

**Origem:** branch `homologacao-dna`, repositório `riancarvalho2013-art/learning-sanepav`.
**Base verificada:** commit `3a926f0929ff58b9c78b402601d844c649911f58` (consulta realizada em 23/11/2026).
**Classificação:** incremento de homologação; NÃO pronto para produção.
**Foco:** primeira fase funcional da Central de Relatórios e People Intelligence, preservando o SCORM Runtime V3 que já funciona na homologação.

## 1. Alterações incluídas

**Substituir na raiz do repositório (4):**

- `serve.mjs` — registra o módulo de relatórios antes dos demais handlers; mantém `handleScormV3`, `handleLxpV2`, `handleEvolution` e o aplicativo legado intactos.
- `web-index.html` — registra o CSS e JS da nova Central de Relatórios no final da lista de assets.
- `asset-manifest.json` — disponibiliza os dois novos assets no build existente.
- `package.json` — adiciona `verify-reports-v3.mjs` ao final de `npm test`, preservando todos os testes anteriores.

**Adicionar na raiz (4):**

- `reports-v3.mjs` — API real com autenticação, organização, cálculo de indicadores e exportação.
- `web-reports-v3.js` — frontend com abas, filtros, detalhamento, salvamento de visões e exportações.
- `web-reports-v3.css` — design system branco/azul, responsividade e impressão.
- `verify-reports-v3.mjs` — testes de segurança, organização, matrículas, Pulse, filtros e visões salvas.

**Documentação (opcional, recomendada):** `README-LEARNING-3-RELATORIOS.md`, `AUDITORIA-LEARNING-3.md`.

> Não apague `scorm-v3.mjs`, `web-scorm-v3.js`, `web-scorm-v3.css`, `lxp-v2.mjs`, `learning-evolution.mjs` ou o banco de dados. Nenhuma mudança no SCORM Runtime V3 é necessária para esta entrega.

## 2. Funcionalidades de fato incluídas

- Central de Relatórios acessível pela opção **Relatórios** no menu administrativo / gerencial, sem substituir os módulos de LXP.
- Telas: Visão Geral, Aprendizagem, DHO e LXP, Pessoas e áreas, Detalhamento, Dicionário de Indicadores.
- **21 definições de métricas versionadas**, com descrição, fórmula, unidade e fonte de dados.
- Filtros por empresa, departamento, período. Escopo server-side com regras de administrador, RH, diretoria e líderes.
- KPIs baseados nas fontes persistidas: pessoas ativas, matrículas, cursos com matrículas, conclusões, progresso, notas registradas, prazos, trilhas, certificados realmente emitidos, PDI, desempenho, 1:1, feedback e Pulse.
- Matrículas detalhadas e paginadas, com até 100 itens por página na API.
- Gráfico de barras de conclusão por curso e resumo por departamento, com supressão de grupos com menos de 5 pessoas.
- **Pulse sem exposição de respostas**: apenas consolidados de pesquisas com pelo menos 7 respostas da audiência original; recortes por pessoa ou departamento desabilitam métricas de Pulse.
- CSV protegido contra injeção de fórmulas, Excel XLSX verdadeiro com 5 abas, gerado no navegador com a biblioteca JSZip já presente no Learning, e documento imprimível/salvável como PDF pelo navegador.
- **Visões salvas por usuário**, com filtros armazenados em SQLite pelo mecanismo BUCKET, até 30 por usuário e revisão otimista.
- Estado `Não disponível` quando não há base suficiente; nenhum número sintético ou mock no backend.

## 3. Testes já realizados

- `node --check` nos arquivos JS/MJS novos e de integração — **passou no Node 22**, disponível nesta sessão.
- `node verify-reports-v3.mjs` — **passou com dados de teste isolados** para autenticação, RBAC, hierarquia, filtro empresarial, matrículas, certificado emitido, nota e progresso, Pulse com limite 7, bloqueio por recorte individual, paginação, CSV, dicionário, visões salvas, alteração concorrente e exclusão.
- Chromium com fixtures fictícias: **passou** navegação das abas, tabelas, visualização desktop/mobile e download Excel; planilha foi aberta e validada com openpyxl, contendo 5 abas.
- **Não executado aqui:** `npm test` completo em Node 24 sobre um clone integral do repositório, testes reais do banco do Railway ou testes end-to-end no ambiente de homologação. Esses passos são obrigatórios antes de produzir deploy.

**Observação:** as prévias de tela são ambientes de QA com dados FICTÍCIOS; não são evidência de dados reais do Sanepav Learning.

## 4. Publicar com o mesmo protocolo anterior (sem terminal)

1. No Railway, confirme que `production → learning-sanepav → Settings → Source` continua na branch `main` e que não existe alteração de branch pendente direcionando a produção para `homologacao-dna`.
2. Extraia o ZIP deste release.
3. No GitHub abra `riancarvalho2013-art/learning-sanepav` na branch **`homologacao-dna`**.
4. **Add file → Upload files**. Selecione os 8 arquivos de código acima e, opcionalmente, os dois documentos. Não envie pasta intermediária.
5. Faça commit direto na `homologacao-dna` com a mensagem `Learning Sanepav 3.0 - Relatórios e People Intelligence 01`.
6. Em `Railway → homologacao → angelic-serenity → Deployments`, confira o build. O `Dockerfile` existente executará `npm test` em Node 24. Se falhar, não republique sem ler os **Build Logs**.
7. Somente após `ACTIVE`, abra `https://angelic-serenity-homologacao.up.railway.app/`, entre no Learning e clique em **Relatórios**.
8. Compare as quantidades de cursos, matrículas, conclusões e certificados com os registros reais; aplique filtro por empresa e teste exportações CSV e XLSX. Certifique-se de que os dados de uma empresa não aparecem na outra.
9. Execute novamente o treinamento SCORM que estava funcionando; confira carregamento, salvamento e retomada, para confirmar que não houve regressão.
10. Somente com aprovação formal de QA considere criar PR. **Não realize merge para `main` automaticamente.**

## 5. API nova

Prefixo `/api/reports/v3/` — todas as rotas exigem sessão e autorização gerencial.

- `GET summary?[company][&department][&person][&course][&from][&to]` — métricas e quadros de curso/departamento.
- `GET catalog` — dicionário versionado + indisponibilidades declaradas.
- `GET enrollments?limit=25&offset=0` — linhas autorizadas paginadas.
- `GET export.csv` — dados autorizados em CSV, até 20.000 matrículas; protegido contra fórmulas.
- `GET health` — status resumido das fontes, sem segredos.
- `GET views` — visões salvas do usuário.
- `POST views` — cria/atualiza visão (nome, filtros, id/revision opcionais). Protegida por CSRF Origem.
- `POST views/delete` — exclui visão própria com conferência de revisão. Protegida por CSRF Origem.

A API não permite SQL arbitrário, nem expõe registros individuais de Pulse ou conteúdos privados de reuniões.

## 6. Limitações e próximos incrementos

1. O relatório de **horas efetivas**, tempo SCORM por SCO e tentativas completas exige eventos de aprendizagem padronizados. Não deve ser inferido da duração nominal dos cursos.
2. Certificados são consultados individualmente por matrícula no armazenamento `evolution/v1/issued/*`; acima de 2.000 matrículas o indicador é marcado indisponível até existir uma tabela de índice.
3. Exportação XLSX no navegador limitada a 2.000 matrículas. CSV do servidor limitado a 20.000. Fila de exportação persistente ainda ausente.
4. PDF disponível por impressão do navegador; **não** foi criado gerador nativo PDF do backend.
5. Vínculos organizacionais atuais — histórico de movimentações exige schema e migração próprios.
6. O Pulse atual contém respostas com identificadores no armazenamento LXP, embora o novo relatório use somente agregados com limite mínimo. **Isso não atende plenamente ao requisito de anonimização irreversível do protocolo mestre.** Exige redesenho de coleta para novas pesquisas.
7. Construtor livre de relatórios, filtros multiseleção avançados, agendamento, KPIs de People Analytics dependentes do DP, instrumentos Kirkpatrick N3/N4, avaliação 360° e outras seções extensas do protocolo mestre continuam pendentes.

## 7. Rollback

Em caso de regressão, reverta os 8 arquivos alterados/adicionados por um novo commit na `homologacao-dna` para o último commit estável. Este incremento **não aplica migração de schema nem apaga dados existentes**; as visões salvas em `reports/v3/saved-views` permanecem no banco e podem ser usadas após corrigir a versão. Verifique o volume do Railway antes de qualquer operação destrutiva. Para produção, mantenha `main` isolada.
