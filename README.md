# Learning Academy — V26 | pacote de evolução local

**Base consultada:** `riancarvalho2013-art/learning-sanepav`, branch `homologacao-dna`, PR #10 (`feat: complete social video and classroom v25`, merge `e1d0d25976687ef1d5d2d43c586794758a2ce27a`).

Este pacote não é um clone completo nem um commit publicado. Ele contém um aplicador que edita o código-fonte existente usando âncoras verificadas na branch publicada, e um verificador dos trechos novos. Não substitua o repositório por este ZIP. Não foi possível recuperar o working tree não publicado da sessão anterior ou clonar o repositório no ambiente desta conversa. O incremento foi reconstruído sobre os arquivos públicos consultados.

## Alterações propostas

| Área | Implementação |
|---|---|
| Banners | Altura mínima e espaçamentos uniformes, tipografia coerente, gradiente azul limpo em vez da arte raster com possíveis brilhos; altura pode crescer se houver conteúdo extenso. |
| Estrelas e brilhos | Remove os símbolos decorativos encontrados no código de dashboard, identidade e elogios; substitui o ícone de reconhecimento por um ícone de conquista. Não altera conteúdo publicado por colaboradores. |
| Relatórios | Substitui o `nav` sujeito ao CSS global por um grupo de botões semânticos, alinhados horizontalmente e com rolagem lateral em telas menores. Mantém data-r3, filtros, relatórios, exportações e visão selecionada. |
| OKR | Linhas de objetivo e resultados-chave com responsável, empresa, departamento, prazo, situação e progresso. Check-ins, reatribuição, publicação, encerramento, histórico autorizado e auditoria continuam usando os handlers existentes. |
| Intranet | Nome novo na navegação, breadcrumb, título e grupo de indicadores. Identificadores internos de rota e notificações continuam compatíveis com links antigos; aceita também `?view=Intranet`. |
| Matriz 9Box | Nove células, pessoas em linhas, contagem por quadrante, filtro e última avaliação legada válida de cada pessoa. Apenas registros já entregues pela API e pessoas no escopo. Não altera as regras de privacidade do backend nem integra automaticamente os ciclos mais recentes de avaliação. |
| Primeiro acesso | Cadastro de usuário não administrador sem senha manual, mediante opt-in explícito, com credencial aleatória gerada e hasheada no servidor; nenhum segredo retornado. Depois do cadastro confirmado, tenta convite no endpoint V17. Falha de envio não desfaz cadastro; conta bloqueada não recebe convite. Novo administrador continua exigindo senha inicial. |

## Aplicar no Git local (Windows, macOS ou Linux)

Pré-requisitos: Git, Node.js 24 ou superior, repositório clonado e acesso autorizado. Mantenha os arquivos deste pacote **fora** do repositório. Salve seu trabalho local antes de começar; o aplicador exige uma árvore de trabalho limpa e uma branch de revisão diferente de `main`, `master` e `homologacao-dna`.

No terminal aberto na raiz do repositório:

```sh
git fetch origin
git switch -c work/learning-academy-v26 origin/homologacao-dna
node --version
node "/caminho/learning-v26/aplicar-v26.mjs" --check .
node "/caminho/learning-v26/aplicar-v26.mjs" --apply .
git status --short
git diff --stat
git diff --check
node "/caminho/learning-v26/verificar-v26.mjs" .
npm run build
npm run test:okr
npm run test:invitations
npm test
```

No PowerShell, substitua `/caminho/learning-v26` pelo caminho real, por exemplo `C:\Users\SeuUsuario\Downloads\learning-v26`. O modo `--check` simula todas as substituições e executa `node --check` nos JS/MJS resultantes sem escrever. O modo `--apply` valida a branch, a árvore limpa, as âncoras e a sintaxe antes de gravar. Se falhar a verificação de diff, restaura o conteúdo original dos arquivos que editou. Se uma âncora não existir ou for ambígua, não force: compare a base, especialmente se você tiver mudanças locais mais recentes.

O comando `npm test` da V25 já contempla build, privacidade, SCORM, relatórios, avaliação, OKR, convites, vídeo, intranet, entre outros. A suíte de V26 é complementar.

## Homologação visual e funcional (antes de publicar)

1. Execute o ambiente de desenvolvimento em uma base de testes, sem usar dados ou credenciais de produção.
2. Confira todos os banners a 1366×768 e 1920×1080, e também em mobile. Verifique se controles e títulos longos não são cortados.
3. Relatórios: todas as abas clicáveis, disposição horizontal, filtros, exportação e impressão. Teste com zoom e teclado.
4. OKR: objetivo sem resultados, múltiplos resultados, status diferentes, progresso, permissão para check-in, histórico restrito, auditoria administrativa, empresa e nível.
5. Intranet: navegação, publicação, comentários, anexos e vídeo, links antigos `?view=Rede%20social` e novos `?view=Intranet`.
6. 9Box: um registro por pessoa, posições válidas 1 a 3, usuários fora do escopo ausentes, estados vazios e bloqueio para colaboradores. Verifique especialmente o acesso de RH/DHO, líderes e administradores. A API V25 restringe os registros pessoais de Administrador e Diretoria; esta V26 não amplia essa política de acesso. Uma 9Box corporativa consolidada exige política e endpoint específicos, além de definição dos ciclos de avaliação que servem de origem.
7. Usuários: criação sem senha para perfil comum; empresa válida obrigatória; conta bloqueada; e-mail duplicado; nova conta administrativa com senha obrigatória; provedor indisponível; convite aceito; link expirado; reenvio; redefinição de senha. Confira que nenhum segredo vai para os logs ou para o frontend e que a criação continua atômica junto ao vínculo organizacional.
8. E-mail: use as variáveis já previstas no serviço de recuperação (APP_ORIGIN, EMAIL_FROM, RESEND_API_KEY) e um destinatário de teste. A aceitação pelo provedor não é comprovação de entrega na caixa postal. O estado pendente é informado na interface, com reenvio manual; não foi adicionada uma fila durável de reenvio automático.

Após os testes e revisão, se desejar publicar manualmente:

```sh
git add web-app.js web-foundation.js web-lxp-v2.js web-reports-v3.js web-evolution.js web-design-v21.js web-design-v22.js web-design-v23.css platform.mjs
git commit -m "feat: refine Learning Academy UI, OKR, 9Box and first-access flow (v26)"
git push -u origin work/learning-academy-v26
```

Abra um pull request de `work/learning-academy-v26` para `homologacao-dna`, **não para `main`**. Não faça merge até os testes passarem e a homologação ser revisada. O aplicador não realiza nenhum dos comandos de publicação acima.

## Reversão local

Se ainda não fez commit, e somente se deseja descartar as mudanças V26:

```sh
git restore -- web-app.js web-foundation.js web-lxp-v2.js web-reports-v3.js web-evolution.js web-design-v21.js web-design-v22.js web-design-v23.css platform.mjs
```

Se já fez commit, prefira `git revert <SHA-do-commit-V26>` após revisar o histórico. Não use force push.

## Evidência e limites da verificação realizada nesta conversa

- A existência do PR #10 mesclado foi confirmada via GitHub. Os caminhos e os trechos de código foram consultados na branch `homologacao-dna`.
- As âncoras de substituição foram conferidas contra os arquivos remotos. Uma âncora de brilho aparecia duas vezes; o aplicador final substitui as três ocorrências do caractere de brilho no arquivo, em vez de exigir uma ocorrência única.
- `node --check` dos dois scripts deste pacote: aprovado em Node.js 22.16.0.
- Teste de falha para caminho que não é um repositório Learning Academy: aprovado; encerrou sem alterações.
- Cinco grupos de verificações isoladas foram executados nos fragmentos novos reconstruídos do próprio aplicador: OKR (renderização e escaping, permissões, histórico e filtros), 9Box (nove células, escopo, posição válida e registro mais recente), convite (cadastro confirmado antes do convite, destinatário identificado pelo ID retornado, erro de envio, bloqueio, ID ausente, administrador e erro no cadastro): aprovados.
- **Não executado:** aplicação integral no checkout verdadeiro, build Node 24, testes HTTP/segurança completos, deploy e inspeção visual real. O ambiente local desta conversa não conseguiu resolver o host `github.com`; o acesso de leitura ao código ocorreu pelo conector GitHub. Os comandos e a checklist acima são gates de homologação, não resultados já obtidos.
- Não há garantia de recuperação ou equivalência exata às mudanças não publicadas da sessão anterior. A aparência dos banners foi padronizada por uma escolha de design (gradiente limpo e altura mínima) para evitar corte de conteúdo, não por comparação visual de todas as telas.

## Arquivos do pacote

- `aplicar-v26.mjs`: código das alterações e aplicação local com verificações preventivas.
- `verificar-v26.mjs`: testes isolados dos renderizadores e do callback de cadastro, sem alterar dados.
- `README.md`: este guia.
