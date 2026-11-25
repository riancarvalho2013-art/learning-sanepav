# Learning Academy — V18: PDI com busca de aprendizagem

Data: 25/11/2026. Base: `homologacao-dna`, `8f889a49eca2cee0d8ca3fedc4624a9eb02be543` (V17).

Homologação: https://learningacademy.up.railway.app. Domínio alterado no serviço existente; mesmo volume. Produção permanece na branch `main`.

## Incremento funcional

- PDI > Nova ação > Aprendizagem formal: busca pelo título, sem diferenciar maiúsculas e acentos, e filtro por cursos ou trilhas.
- Seleção informa duração e progresso oficial; o nome preenche o título quando ele está vazio ou ainda contém o nome preenchido automaticamente.
- Pesquisa preserva o treinamento selecionado e textos editados manualmente.
- O card do próprio PDI permite acessar o treinamento atribuído usando os players existentes, inclusive SCORM V3. Consultar o PDI de outra pessoa não permite consumir o treinamento em nome dela.
- API de opções aceita `q` e `kind`, mantendo autorização por pessoa e escopo. O limite existente de 2.000 opções é sinalizado; a busca do editor filtra esse conjunto localmente.
- O vínculo permanece limitado a uma ação formal; conclusão e status continuam projetados a partir das matrículas oficiais. Nenhuma matrícula é criada automaticamente.

Referências funcionais, consultadas em 25/11/2026:

- https://help.qulture.rocks/learning-rocks
- https://help.qulture.rocks/learning.rocks-integra%C3%A7%C3%A3o-entre-pdi-espa%C3%A7os-e-pdi-miss%C3%B5es-central-de-conhecimento-qulture.rocks
- https://help.qulture.rocks/como-cadastrar-seus-conte%C3%BAdos-de-learning.rocks-em-seu-pdi-central-de-conhecimento-qulture.rocks

Implementação original, reaproveitando a V17. Favoritar automaticamente e percorrer catálogos acima de 2.000 opções no editor continuam pendentes.

## Arquivos e banco

Alterados: `lxp-v2.mjs`, `web-lxp-v2.js`, `web-lxp-v2.css`, `verify-profile-v16.mjs`. Documentação: este arquivo e `MASTER-EXECUTION-STATE.md`.

Sem migração, tabela nova ou alteração de registros existentes. Preserva `lxp/v2/state`, matrículas, arquivos e certificados. Rollback: retornar o código à V17; não apagar dados.

## Validação

`npm test` integral aprovado com Node 24.22.3 no checkout completo: build e todos os grupos existentes, incluindo HTTP/SQLite reais, SCORM, desempenho, convites e recomendações. A suíte do perfil passou de 68 para 78 verificações, cobrindo filtros, consulta vazia e entradas inválidas. Testes de convites simulam envio; não comprovam entrega de e-mail.

O backup gerenciado do volume foi consultado: o plano atual bloqueia a criação e não há snapshots listados. Não foi feita contratação de plano nem alteração do volume. A rotina de recuperação existente exige armazenamento independente configurado.

## Próximos incrementos

1. Favoritos integrados ao PDI com consistência transacional e permissões.
2. Busca paginada para catálogos maiores, com inspeção de acessibilidade e responsividade.
3. Continuidade Avaliação → PDI → aprendizagem, com rastreabilidade e testes de jornada.
4. Configurar envio real quando houver remetente e chave aprovados. Para o novo endereço, `APP_ORIGIN` deve ser `https://learningacademy.up.railway.app`.
