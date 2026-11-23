# Learning Sanepav — DNA SCORM Runtime V3

## Objetivo
Corrigir o problema em que pacotes SCORM abrem na sala de aula sem CSS, sem imagens e sem scripts funcionais. A extensão preserva o Learning, a área LXP, os certificados, as matrículas e os conteúdos já cadastrados.

**Repositório analisado:** `riancarvalho2013-art/learning-sanepav`  
**Branch de destino:** `homologacao-dna`  
**Base confirmada:** commit `b487dd79c2be94c562bb8b0338f3dec1a3c9002f` (23/11/2026).  
**Ambiente recomendado:** Railway `homologacao`, serviço `angelic-serenity`.

## O problema original

Na base anterior, o iframe SCORM utiliza isolamento por `sandbox`, mas os arquivos do pacote são carregados em URLs `/content/...` que exigem cookie de sessão do Learning. Em contextos isolados, o navegador pode deixar de enviar esses cookies para os recursos filhos. O resultado é semelhante ao print fornecido: HTML sem CSS, scripts que não iniciam e imagens quebradas.

## Correção aplicada

1. **Sala de aula SCORM V3** em tela cheia, com identidade branca/azul, painel de progresso, ações de recarga e fechamento, barra de status e diagnóstico.
2. **Sessão temporária de arquivos**: após login e validação da matrícula, o servidor entrega uma URL com token temporário de acesso exclusivo ao pacote daquele curso. CSS, JS, imagens, fontes, vídeos, JSON e HTML podem ser carregados por caminhos relativos sem depender do cookie dentro do iframe.
3. **Controle de acesso**: validações por usuário, matrícula, pré-requisitos e integridade da vinculação do conteúdo. O token expira após 30 minutos sem renovação, com duração máxima de oito horas e renovação a partir da página autenticada. Uma reinicialização da aplicação exige reabrir a aula.
4. **Isolamento do SCORM**: o iframe não usa `allow-same-origin`, e a política de conteúdo bloqueia acesso ao DOM do painel administrativo e restringe conteúdo externo. URLs do próprio pacote são autorizadas; o pacote deve ser autocontido.
5. **Ponte de progresso SCORM 1.2 e 2004**: APIs `window.API` e `window.API_1484_11`, com `Initialize`, `GetValue`, `SetValue`, `Commit` e `Terminate`, envio assíncrono de valores CMI e reaproveitamento do endpoint de progresso existente.
6. **Persistência de retomada**: suporte a `cmi.suspend_data` de até 64 KB (sujeito ao limite de 90 KB de estado total do armazenamento atual).
7. **Diagnóstico administrativo**: verifica arquivo inicial, manifesto, versão declarada no manifesto e arquivos vinculados diretamente no HTML de entrada. Isso não identifica todos os recursos criados dinamicamente.

## Instalação — sem terminal, pelo GitHub

**Importante:** antes de enviar os arquivos, confira que o serviço **production** no Railway está conectado à branch `main`, e não há deploy pendente de `homologacao-dna`. Não altere a produção. Faça backup externo dos dados SQLite antes da homologação.

1. Abra o repositório GitHub na branch `homologacao-dna`.
2. Extraia o ZIP e abra a pasta extraída.
3. Clique em **Add file → Upload files**.
4. Selecione os oito arquivos de código da raiz do ZIP, sem a documentação e sem pastas intermediárias.
5. Substitua estes quatro arquivos já existentes:
   - `serve.mjs`
   - `web-index.html`
   - `asset-manifest.json`
   - `package.json`
6. Adicione estes quatro arquivos novos:
   - `scorm-v3.mjs`
   - `web-scorm-v3.js`
   - `web-scorm-v3.css`
   - `verify-scorm-v3.mjs`
7. Confirme o commit com a mensagem `Learning Sanepav — DNA SCORM Runtime V3`, selecionando **Commit directly to the homologacao-dna branch**.
8. O Railway deve iniciar o deploy no ambiente `homologacao` se o deploy automático estiver ativado. Na aba **Deployments**, aguarde **ACTIVE / Deployment successful**. O Dockerfile existente roda `npm test` no build, agora incluindo `verify-scorm-v3.mjs`.
9. Abra `https://angelic-serenity-homologacao.up.railway.app/` e use `Ctrl + Shift + R` para forçar a atualização do navegador.

## Homologação funcional — mesma aula com problema

1. Entre com um usuário que tenha matrícula válida no curso SCORM.
2. Abra **Catálogo LMS → curso SCORM → Acessar**.
3. Verifique se a sala abre em tela cheia, com cabeçalho azul/branco e a aula visível.
4. Confira o carregamento de CSS, imagens, fontes, botões e scripts do pacote; ele deve apresentar o visual original exportado pela ferramenta de autoria.
5. Realize uma interação e conclua a atividade. Verifique no rodapé se aparece **Progresso sincronizado**.
6. Feche e reabra a aula para testar retomada do ponto anterior.
7. Para um usuário administrador ou RH/DHO, clique em **Diagnóstico** dentro da sala. Verifique se `Arquivo inicial` e `Manifesto` estão identificados e se há recursos ausentes.
8. Teste com um usuário sem matrícula e com uma trilha de pré-requisitos pendentes; ambos devem ser impedidos de acessar conteúdo não autorizado.

## Quando um SCORM ainda não funcionar

- `Arquivo inicial não está no armazenamento`: o pacote foi enviado incompleto ou o arquivo de lançamento do manifesto está ausente. Reenvie o ZIP original completo.
- `Recurso não encontrado dentro do pacote`: use Diagnóstico e confirme que o arquivo está no ZIP com exatamente a mesma capitalização, incluindo subpastas.
- `Sessão expirada`: clique em **Recarregar aula**, que emite uma nova sessão após validação do seu login.
- A atividade abre, mas não conclui: confirme se o ZIP foi exportado como **SCORM 1.2 ou 2004 com um SCO**, com registro de conclusão configurado na ferramenta de autoria. A ponte não fabrica notas nem conclusões que o pacote não reportou.
- Pacotes que usam scripts externos de CDN, API de terceiros, conteúdo com DRM, Flash, caminhos absolutos gerados dinamicamente ou múltiplos SCOs podem exigir adaptações próprias e **não estão garantidos por esta atualização**.

## Testes e limitações

- **Executado:** `node verify-scorm-v3.mjs` (passou com dados sintéticos e armazenamento simulado); sintaxe de `scorm-v3.mjs`, `serve.mjs` e `web-scorm-v3.js` verificada com `node --check`.
- **Coberto:** sessão/autorização, isolamento, arquivos CSS/JS/imagens sem cookie, CORS, respostas 206 de mídia, paths indevidos, diagnóstico, API SCORM 1.2/2004, `suspend_data`, revogação e pré-requisitos.
- **Ainda necessário:** executar toda a suíte `npm test` do repositório com Node 24 e a homologação em navegador real com o ZIP original que falhou. O navegador local da ferramenta bloqueou navegação HTTP por política da execução.
- O runtime usa tokens de sessão em memória e foi projetado para a configuração atual de **uma réplica**. Múltiplas réplicas exigem armazenamento compartilhado de sessão ou afinidade de requisições.
- Não é uma certificação formal de conformidade ADL/SCORM. A versão atual do editor continua limitada a **um SCO por pacote**.
- Esta versão não remove nem altera conteúdos/matrículas existentes, não cria contas, não modifica produção e não requer novas variáveis de ambiente.
