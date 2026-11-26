# Learning Academy V23 — Cabeçalho, painel e catálogo compactos

Base consultada: branch `homologacao-dna`, arquivos `web-app.js` (d52df8cfa4c4eaebc7272094fa342629648abcff), `web-evolution.js` (8d29c493732dd45e3c45453ba7d5d6982cd75725), `web-foundation.js` (e1599e7eeca0254aaea77400f314a000af8fa3d0), `web-index.html` (03e4154821c534cf0ac39f64a80b2c29b5e63da3), `asset-manifest.json` (a00d9201ba73ea34229eb8480054fcc3a4b33a5e). V22 é pré-requisito.

## Instalação
1. Faça backup da revisão atual de homologação. Não aplique à main.
2. Extraia este ZIP. Se a base ainda corresponde à V22 consultada, envie os arquivos e pastas da raiz para `homologacao-dna` em Add file > Upload files, preservando `design-v23/`. O manifesto e HTML são versões de integração. Se houve alteração nesses arquivos desde a base consultada, prefira o instalador de merge: `node install-v23.mjs /caminho/do/clone` para manter as novas entradas da branch.
3. Commit, build e deploy de homologação conforme o processo atual do repositório. Faça recarregamento forçado do navegador.
4. Valide os cinco perfis, navegação, filtros de empresa, busca, cursos em grade/lista, trilhas e ações. Verifique o console. O instalador não faz push.

## Componentes
- Header: mantém busca global original, seletor de empresa, lista de notificações e avatar existente. Ícone SVG outline, ponto azul somente quando houver notificações não lidas. Menu do perfil com acesso a Meu perfil, alteração de foto e saída.
- Painel: quatro indicadores horizontais, bloco de continuidade, gráfico de anel em SVG e barra de progresso, sugestões compactas, atalhos do painel original. Curso em andamento = matrícula com progresso >0 e <100. Carga horária = soma da duração cadastrada dos cursos concluídos (não mede tempo real de estudo). Certificados = registros emitidos do usuário no endpoint existente. Sem matrículas, a taxa não é calculada. Variações históricas e metas dos concepts não são inventadas.
- Catálogo: 3 colunas em desktop, 2 em telas médias, 1 em celular; lista nativa preservada; capa ilustrada, tipo sobreposto, título, metadados, descrição, status e ações. Ações de gerenciamento do curso em seção expansível; mantém botões e atributos data-act. Cursos arquivados não recebem nova ação de matrícula. Trilhas mantêm lista horizontal e ações originais.
- Capas WEBP: seis recortes do concept de catálogo gerado, sem texto fixo, empregados somente quando não existe capa cadastrada. Capas cadastradas permanecem como fonte autorizada. As ilustrações são decorativas, não logos oficiais. O texto é DOM, nunca imagem estática.
- O cabeçalho e as métricas compactas compartilhadas afetam todas as áreas autenticadas. Não é uma reconstrução integral dos gráficos específicos de cada módulo, nem dos painéis por perfil.

## Validação
`node --check web-design-v23.js`; `python tests-v23/smoke.py` (requer Playwright e Chromium; fixture sintética, sem dados reais); valide o manifesto e execute build/testes do repositório. O teste sintético utiliza DOM representativo, não o CSS completo ou o backend da plataforma. O ambiente bloqueou navegação HTTP em browser, portanto não houve teste autenticado nem comparação visual integral. Os valores da fixture são fictícios. Não houve push.

## Reversão
Reverta o commit V23 em homologação ou remova as duas referências V23 no `web-index.html`. O backend e os endpoints não foram alterados. Não remova V22.
