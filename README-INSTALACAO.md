# Learning Sanepav — DNA Evolution 01

**Data:** 23/11/2026  
**Base analisada:** [`riancarvalho2013-art/learning-sanepav`](https://github.com/riancarvalho2013-art/learning-sanepav), branch `main`, árvore `e88542a2d22d16b02063d84165699fd5b4ae91c3`.  
**Referência de arquitetura e produto:** [`openedx/openedx-platform`](https://github.com/openedx/openedx-platform), branch `master`, árvore `b9e3b3b8662b539e200f8acf68d42431de032320`.

## O que este pacote entrega efetivamente

1. **Novo frontend azul e branco** com identidade editorial do DNA do Desenvolvimento, navegação com ícones SVG sem biblioteca externa, dashboard de aprendizagem personalizado, cartões de progresso e responsividade.
2. **Marca por empresa**, com nome, subtítulo, cores e upload de logo (PNG/JPG/WebP, validação de assinatura, limite de 4 MB). As marcas são persistidas em SQLite, com administração restrita e isolamento de acesso por empresa.
3. **Certificados por trilha**, incluindo configuração de texto, assinatura institucional e upload de fundo (até 8 MB) por empresa/trilha. A emissão é permitida somente para uma matrícula concluída. São guardados os dados da conclusão e uma cópia da configuração visual na emissão. Documento HTML de impressão no formato A4 paisagem, com opção **Salvar como PDF no navegador**.
4. **Validação de certificados por código** em rota pública que informa status, curso, empresa e data, mas não expõe o nome do colaborador.
5. **Caderno de notas**, com tabela autorizada de matrículas, notas que já existirem no LMS, progresso, estados, médias, busca e exportação CSV segura contra fórmulas.
6. **Exclusão controlada** de curso sem matrículas, sem participação em trilhas e sem registros de desenvolvimento vinculados. Preserva os cursos em uso; para eles, use Arquivar.
7. **Verificações automatizadas** do incremento, adicionadas à cadeia `npm test` já existente. Mantém a arquitetura Node.js 24 e SQLite e não exige bibliotecas adicionais.

## O que **não** está concluído nesta etapa

- **Não é uma cópia nem a instalação do Open edX**. Open edX depende de Python/Django, microfrontends e infraestrutura própria; importar seus arquivos diretamente quebraria a base atual.
- Não há migração integral dos cursos para tabelas relacionais, novas tentativas por questão, bancos de questões completos, LTI, cohorts, vídeo adaptativo, importação OLX, proctoring ou SCORM 2004 plenamente certificado.
- **Certificado não é um PDF nativo gerado no servidor**: é um documento HTML para imprimir/salvar em PDF. Não implementa QR Code, revogação de certificados nem assinatura criptográfica de documentos; a verificação funciona pelo registro persistido.
- A exclusão controlada remove o **cadastro** do curso, mas ainda não faz coleta segura de todos os binários órfãos do armazenamento. Faça backup antes de qualquer exclusão.
- Trocar a marca **não** equivale a isolar todo o catálogo de conteúdos por empresa. As regras existentes de escopo e matrícula continuam em vigor.
- A homologação contra o **repositório completo** e em navegador real ainda precisa ser executada após a aplicação. Não foi feito deploy nem alteração no GitHub do usuário.

## Instalação manual no GitHub (sem Railway)

> Recomenda-se primeiro criar uma branch `homologacao-dna` e fazer backup do banco `learning.sqlite` em local seguro **fora do repositório**. Não publique bancos SQLite, variáveis `.env`, tokens ou dados de colaboradores no GitHub.

1. No repositório `learning-sanepav`, crie ou selecione a branch `homologacao-dna`.
2. Extraia este ZIP. **Os oito arquivos de código abaixo vão para a raiz do repositório**, sem pasta intermediária:
   - `serve.mjs` — **substituir** o arquivo anterior;
   - `web-index.html` — **substituir**;
   - `asset-manifest.json` — **substituir**;
   - `package.json` — **substituir**;
   - `learning-evolution.mjs` — **adicionar**;
   - `web-evolution.js` — **adicionar**;
   - `web-evolution.css` — **adicionar**;
   - `verify-evolution.mjs` — **adicionar**.
3. Mantenha todos os arquivos anteriores, incluindo `platform.mjs`, `web-app.js`, `web-foundation.js`, `web-style.css`, `domain.mjs`, `migrations.mjs`, `storage.mjs`, `web-zip.js`, imagens e scripts `verify-*`. Não apague nada que não esteja explicitamente indicado.
4. Em GitHub, utilize **Add file → Upload files**. Se a interface não aceitar a substituição de algum nome existente, atualize o conteúdo desse arquivo com **Edit this file**, mantendo o caminho correto. Confira os oito nomes antes do commit.
5. Antes de publicar, em um ambiente de homologação usando **Node 24**, rode `npm test`. O Dockerfile atual também executa isso durante o build. Para validação isolada deste incremento, `node verify-evolution.mjs`.
6. Execute `npm start` em um ambiente de teste com volume separado. Acesse `http://localhost:8080/healthz`, faça login e teste: alternância de empresa, logo, certificados, tela do aluno, caderno de notas, uploads e uma exclusão controlada sem vínculos.
7. Só então integre os commits na branch de produção. O GitHub **armazena código, não hospeda este backend Node/SQLite por conta própria**.

**Importante:** uma empresa precisa estar cadastrada e os usuários precisam ter vínculo profissional válido para receber marca específica e emitir certificados. Um usuário sem empresa vinculada não emite certificado nessa versão.

## Operação das novas telas

- **Administrador → Marca por empresa:** selecione a empresa, defina nome, subtítulo, cores e envie uma logo. A configuração não altera o cadastro legal da empresa.
- Na mesma página, escolha uma **trilha** de cursos, configure os dizeres e envie seu fundo de certificado. Trilha é o campo `track` dos cursos já existentes.
- **Colaborador → Certificados:** conclua um curso, clique em **Emitir certificado**, depois **Visualizar e imprimir**.
- **Líder/RH/Administrador → Caderno de notas:** leia apenas matrículas já autorizadas na API do Learning e exporte um CSV.
- **Administrador → Catálogo LMS:** cursos sem vínculos exibem ação **Excluir curso sem vínculos**. A validação final é sempre feita no servidor; a tela não consegue forçar exclusão em cursos com histórico.

## Segurança e compatibilidade

- Cada endpoint novo verifica sessão, papel, empresa autorizada e origem HTTP de POST.
- A identidade de sessão continua a mesma do Learning: cookie HttpOnly `learning`, hash SHA-256 associado a `oai-authenticated-user-id` fornecido pelo `serve.mjs`.
- Logo e imagens não aceitam SVG/HTML, restringindo superfície de execução. Os formatos PNG/JPEG/WebP são validados por bytes iniciais. O exame do arquivo **não** equivale a antivírus ou decodificação/reprocessamento completo.
- A emissão é idempotente por matrícula. O registro de emissão contém nome, curso e data; a rota pública de verificação não expõe o nome.
- O pacote não altera o esquema SQLite nem substitui dados existentes. Novos objetos ficam nas chaves `evolution/v1/*` da tabela `objects` já existente.
- Manutenção visual: a camada original em `web-style.css` permanece; `web-evolution.css` carrega depois. Os módulos antigos continuam sendo desenhados pelo `web-app.js` e `web-foundation.js` originais.
- A política CSP existente permite JS e CSS de mesma origem. A página imprimível usa CSP mais restrita e não carrega terceiros.

## Princípio de evolução

A referência Open edX é usada **como inspiração de arquitetura e recursos**, não como fonte de código transplantado. Seu repositório contém cerca de 9.290 arquivos regulares na árvore consultada, usa licença AGPL-3.0 e suporta um conjunto de serviços diferente. Consulte `MATRIZ-OPENEDX.md` para o inventário funcional e prioridades.

**Status da qualidade:** novo módulo e testes isolados validados em Node 22 compatível com sintaxe; pipeline integrado e UX real devem ser executados em Node 24 após aplicar ao repositório existente. Não foi utilizado banco de colaboradores neste desenvolvimento.
