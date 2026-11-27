# Learning Academy — V42, consolidação arquitetural (início controlado)

**Estado:** ferramenta de consolidação entregue, não homologada. Não é um ZIP de código já materializado. Base fixada em `58c79a461699fb07fd119ceb7c8594a4d6b3afd7` (V41 unificada). Esta base foi conferida pelo GitHub. Se a base mudou, interromper e revisar em vez de forçar a ferramenta.

## Upload inicial sem terminal

1. No GitHub, selecione `homologacao-dna` e crie a branch `v42-consolidacao` a partir dela. Não conecte essa branch ao serviço Railway de produção.
2. Nessa branch, faça upload de `v42-consolidar.mjs`, `verify-v42-consolidar.mjs` e, opcionalmente, deste `V42-INSTRUCOES.md` na raiz. Commit apenas na branch nova.
3. Na mesma branch, use Add file → Create new file. Informe o nome completo `.github/workflows/learning-v42.yml` e cole **exatamente** o conteúdo do arquivo de mesmo nome no ZIP (pastas ocultas podem não aparecer no explorador). Commit na branch nova. O push iniciará a execução se Actions estiver habilitado; não é necessário CMD.
4. Em Actions, abra a execução **Learning Academy - V42 consolidation**. Confira os logs e baixe `Learning-Academy-V42-Evidencias` mesmo se falhar. O artefato `Learning-Academy-V42-Candidato` só é publicado quando todos os gates configurados passam.
5. Não faça merge automático. Se o candidato for gerado, compare o manifesto e os resultados, faça revisão de segurança e de regressão; aplique os arquivos do artefato em **outra branch derivada da V41**, mantendo os instaladores históricos que ainda são módulos importados. O pacote contém apenas arquivos alterados/adicionados; não apague outros arquivos. O arquivo V42-MANIFESTO.json identifica hashes e o estado não homologado. V42-GATES.txt identifica o que passou na execução.

## O que o código realiza

- Confere que a árvore de origem corresponde à V41 mais os arquivos autorizados para esta ferramenta. Trabalha com dois arquivos tar gerados por `git archive`, em pastas novas fora do checkout. Não usa o banco de produção.
- Executa exatamente a sequência ativa do Dockerfile V41 (11 instaladores internos ao pipeline e 9 seguintes), de modo independente nas duas cópias. Compara SHA-256 de todos os arquivos. Não confunde equivalência de fonte com teste funcional.
- Materializa o código resultante, remove a instrução que reaplica os instaladores no Dockerfile e mantém todos os comandos de teste anteriores. Declara a mesma dependência direta S3 (3.1174.0) e gera o lockfile real com npm; troca a instalação por `npm ci`.
- Bloqueia exclusões inesperadas, alterações fora do escopo, links simbólicos e diferenças não justificadas entre as duas materializações. Verifica sintaxe JS/MJS.
- Workflow executa builds baseline/candidato, auditoria npm e o teste real de navegador/restauração existente. Nenhum gate é desativado para liberar um candidato.

## Limites e próximos trabalhos dentro da própria V42

Não houve acesso a clone completo local: resolução DNS indisponível. Node local 22.16.0, projeto Node 24; não há Docker local. Foram executados oito testes dos utilitários, não os testes integrais da aplicação. O workflow também não foi executado neste ambiente. Se a auditoria npm ou o E2E antigo falhar, o bloqueio é intencional; não use o candidato para produção. A ferramenta não corrige por si só as regras de autorização, a duplicidade de autenticação, os contratos das APIs, a normalização do banco ou o design system. Essas atividades exigem a árvore materializada, revisão e testes integrais. O teste E2E existente cobre apenas os cenários nele descritos; ampliar a cobertura por módulo, perfil e resolução ainda é necessário. O lockfile é gerado pela resolução do npm no momento da execução; não prova equivalência byte a byte das dependências transitivas do deploy anterior. Actions e proteção obrigatória de branch dependem das configurações do GitHub. Não há mudança de produção, remoção de dados ou publicação automática.

A V42 não está concluída. Manter as quatro etapas acordadas, sem novas subversões. V43 segurança/dados, V44 qualidade funcional e V45 homologação continuam reservadas.
