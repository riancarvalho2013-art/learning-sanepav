# Learning Academy V22 — composição visual interna

## Instalação direta (GitHub)

Base inspecionada: `riancarvalho2013-art/learning-sanepav`, branch `homologacao-dna`, commit `f0b7922ca63128abde59f348c3aea208a761f85b` (merge PR #9).

1. Crie uma branch a partir de `homologacao-dna` (ex.: `feature/learning-academy-v22`).
2. Extraia o ZIP. Envie os arquivos **da raiz do ZIP** para a raiz do repositório, mantendo as pastas `design-v22/` e `tests-v22/`.
3. Substitua `web-index.html` e `asset-manifest.json` somente se a branch continuar na base indicada. Se houver commits posteriores, preserve as novas entradas e referências e faça a integração manual ou use `install-v22.mjs`.
4. Faça o commit. Execute `npm run build` e a suíte de testes definida no `package.json` existente. Faça deploy de homologação da branch e valide com contas de teste autorizadas antes de mesclar.
5. Rollback: reverta o commit V22. Nenhuma alteração de schema/banco.

## O que muda

- Reutiliza a arte limpa original da tela de login em `design-v22/background-original.webp`. O banner, o menu e o canvas são adaptações rasterizadas derivadas do material visual, não camadas originais dos screenshots; não contêm textos fixos. O banner é uma adaptação, não uma extração pixel a pixel do concept.
- V22 é uma camada incremental sobre V21; mantém autenticação, scripts e estilos existentes, controles e endpoints. O adaptador reconhece a rota e modifica a composição DOM/CSS sem alterar a persistência. A ação Continuar do painel utiliza a matrícula existente e o handler `learn` quando o conteúdo não tem pré-requisito pendente. Não adiciona permissões.
- Painel: título Learning Academy, saudação, indicadores, capa real quando cadastrada, botão de continuar, progresso circular calculado das matrículas próprias, sugestões.
- Catálogo: busca e filtros originais, cards e capas, alternância local grade/lista. Não cria filtros, categorias ou cursos fictícios.
- Trilhas: lista e painel de evolução V21, capa, detalhes e modais. PDI: resumo, indicadores, competências/ações e tabela V21. Feedback: conversas e ações rápidas V21.
- OKR: indicadores calculados a partir dos objetivos visíveis, KRs e média simples de progresso, sem confundir com progresso ponderado corporativo. Mantém check-in, filtros e histórico.
- Relatórios: filtros, abas e dados originais, composição dos gráficos, anel quando a taxa de conclusão está disponível. Indicadores estratégicos: métricas e distribuição por empresa existentes. Não inventa risco de turnover, comparativos ou resultados.
- Demais rotas: banners, ícones, cartões, tabelas, layouts e estados existentes, tratados segundo a função de cada módulo. Consulte `COBERTURA-V22.md`.
- Modais: trilha, player, avaliação e formulários; classificação pela estrutura real. O conteúdo dentro de iframe SCORM e documentos de certificado permanece intacto. Diálogos do navegador nativos não são estilizados.
- Logo e capa Beta Clean fornecidas estão incluídas como assets opcionais; a aplicação respeita a marca/capa cadastradas. Não muda automaticamente a identidade de nenhuma empresa nem vincula capa a curso por nome.

## Limites e validação

Os nove concepts são referências visuais, não protótipos funcionais. O código não promete uma réplica pixel a pixel: diferenças nos dados, nas permissões e nos controles reais podem exigir ajustes. Todas as rotas da lista foram mapeadas no adaptador, mas isso não prova que todos os estados/subtelas estão homologados. Não foi feito deploy, nem executada a suíte completa do repositório; acesso ao clone pelo container falhou por DNS. O navegador local recusou a navegação de teste com `ERR_BLOCKED_BY_ADMINISTRATOR`. `tests-v22/smoke.py` é um teste de DOM sintético para rodar em ambiente permitido, não um resultado aprovado. A sintaxe JS e a integridade dos assets/referências foram verificadas localmente. Valide cada papel (colaborador, líder, RH/DHO, administrador, diretoria), cada ação de criação/edição/fechamento e quatro viewports. Verifique contraste, teclado, campos, modal, player, pré-requisitos, exportação, filtros, privacidade e ausência de overflow. Não publique diretamente em produção antes da homologação.
