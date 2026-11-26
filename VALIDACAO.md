# Refinamento funcional V29.1

## Escopo
- O CSS publicado foi conferido pelo hash Git de blob 6ca1956346336ffac3f383c1eb0b071a414d3eb1. A referência HTML original tem hash 4699d29fddc2362ab2d0963d424f741cd7c6e778.
- O CSS anterior é mantido byte a byte, seguido apenas das regras novas. O HTML difere somente na versão de cache do stylesheet. Não foram incorporadas as regras da proposta V29.0 rejeitada.
- Sem substituição de ativos gráficos, imagens, paleta, gradientes, logotipos, identidade visual ou regras de negócio. Hotfixes dos modais 01/02 mantidos.
- Menu: gerenciamento de rolagem e dimensionamento em telas curtas. Cabeçalho: quebra controlada de elementos e expansão do seletor de empresas. Perfil: grade 4/2/1 colunas por espaço real, quebra de valores longos e alinhamento de linhas. Ações: quebra de botões, foco e transições leves respeitando reduced motion. Tabelas: rolagem horizontal limitada ao componente. Legendas de campos profissionais: acabamento sem afetar avaliações ou players.

## Evidências locais
Chromium via Playwright, fixtures representativas das classes e declarações existentes. Não são telas autenticadas nem testes end-to-end da aplicação.
- 348 verificações de layout e preservação de estilos em 7 resoluções (320 a 1756 px).
- 185 verificações dos rodapés de modais e exclusão de modo imersivo.
- 720 verificações do editor OKR em 6 resoluções, 3 escopos, antes/depois do decorador, 1 ou 3 KRs.
- Total: 1253 verificações (asserções, não 1253 cenários independentes).
- Os testes comparam propriedades computadas de fundo, cor e raio de borda em fixtures; as imagens reais não foram renderizadas nesta sessão. Os arquivos de imagem permanecem intocados.
- A suíte completa Node 24, comportamento de todos os módulos reais, acessibilidade integral e desempenho em produção não foram executados. O build Railway deverá executar os testes existentes.

## Aceite após deploy
Verificar em desktop e mobile: campos de perfil, e-mail longo, menu com rolagem e Sair, busca, seletor empresa, relatórios, OKR, criação de trilha, formulário de pessoa, player e SCORM. Verificar teclado e foco. Não avançar com publicação comercial sem os P0 de isolamento e administração.

## Rollback
Reverter exclusivamente o commit da V29.1 ou restaurar os dois arquivos do commit-base. Não restaurar nem excluir banco ou volumes. Nenhuma migração necessária.
