# V28.1 | Publicação sem terminal

## Base e escopo
- Repositório `riancarvalho2013-art/learning-sanepav`, branch `homologacao-dna`.
- SHA consultado: `53cf2dcec332cbeda818de48b57158b4d6d0ee0a`; status de deploy GitHub: success (não equivale a homologação).
- Alterações propostas: `serve.mjs`, `Dockerfile`, `verify-security-v28.mjs`, `.github/workflows/learning-security-v28.yml`.
- Nenhuma alteração de schema, dados, frontend, políticas de autorização de negócio, arquivos V27 ou secrets.
- O pacote não foi publicado. Não aplicar sobre uma base diferente sem revisar os conflitos.

## 1. Pré-requisitos
1. No Railway, confira qual serviço/ambiente está ligado a `homologacao-dna` e qual está ligado a `main`. Confirme que os volumes e variáveis são segregados. Não assuma que o nome do ambiente comprova isolamento.
2. Verifique backup consistente e independente, incluindo mídia externa, se habilitada. Sem restauração verificada, não avance para uso com dados reais.
3. No GitHub, abra a branch `homologacao-dna` e confira o SHA acima. Se mudou, interrompa o upload para evitar sobrescrever o trabalho de outro commit.

## 2. GitHub pela interface gráfica
1. Na página da branch `homologacao-dna`, clique no seletor de branches. Digite `security/learning-v28-hardening` e escolha criar a branch a partir de `homologacao-dna`. Não criar a partir de main.
2. Extraia o ZIP no Windows. Na nova branch, clique **Add file > Upload files**.
3. Envie SOMENTE os três arquivos que estão na raiz da pasta `GIT`: `serve.mjs`, `Dockerfile`, `verify-security-v28.mjs`. Não envie pasta GUIA, ZIP ou pasta GIT como subdiretório.
4. Commit sugerido: `security: harden HTTP ingress and bootstrap activation`.
5. Ainda na branch de segurança, clique **Add file > Create new file**. Digite `.github/workflows/learning-security-v28.yml` como nome (a barra cria o caminho). Abra o arquivo do mesmo nome fornecido no ZIP em um editor de texto, copie integralmente e cole. Commit: `ci: add isolated build and security check`. Não inclua nenhum segredo.
6. Abra Pull Request com base `homologacao-dna` e compare `security/learning-v28-hardening`. Revise Files changed; confira que há somente quatro arquivos.
7. O workflow executa o build Docker e, dentro dele, a suíte anterior e a V28.1. Confira **Checks** do PR; se não aparecer, verifique Actions e permissões. Se o workflow estiver disponível em Actions, pode ser disparado por Run workflow quando as condições do GitHub permitirem. Não contorne falhas.
8. Não mesclar enquanto houver falha ou ausência de evidência. Antes de mesclar, confirme backup e autorização. Não mesclar em main. O merge em homologação pode disparar deploy automático no Railway, conforme configuração existente.

## 3. Configuração do Railway (opcional, após build aprovado)
- A lista de hosts vem desativada por padrão. No serviço da homologação: **Variables > New Variable** (ou equivalente). Nome `LEARNING_ALLOWED_HOSTS`. Valor: nomes exatos dos domínios aceitos, separados por vírgulas, sem esquema, caminho ou barra final. Exemplo `learningacademy.up.railway.app` apenas se for o domínio realmente utilizado pelo serviço. Inclua outros domínios legítimos que atendam a aplicação; nunca inclua domínio de terceiros. Health/readiness GET aceitam host interno válido para o probe. Se não tiver certeza, não habilite até conferir o roteamento.
- `SETUP_KEY`: mantenha segredo existente em variável protegida. Não publique valor. Cookies de ativação antigos deixarão de ser aceitos, reative pelo formulário caso ainda não exista administrador. Logins já estabelecidos não são modificados pela nova regra de ativação.
- `LEARNING_LOG_REQUESTS=true`: registra todos os status HTTP com categoria de rota, sem query/body/token/ID de usuário. Desativado: registra 401/403/421/429 e 5xx. Não é auditoria de negócio; a retenção depende do plano Railway. Avalie impacto de custo/volume.
- Healthcheck: mantenha configuração existente até validar `/readyz` em homologação (não comprova S3). No serviço, **Settings > Deploy > Healthcheck Path** se a UI oferecer; use `/readyz` somente após confirmar retorno 200 com o volume correto. Não desligue volume nem altere o plano.
- Não modifique `LEARNING_MEDIA_MODE`, chaves de criptografia V27, `LEARNING_DB`, backup ou variáveis de e-mail sem plano específico. A V28 não migra conteúdo.

## 4. Homologação e rollback
- Confirme no Railway o SHA do deploy e os logs de build. O Dockerfile executa `npm test`, `verify-enterprise-v27.mjs` e `verify-security-v28.mjs`; logs precisam mostrar sucesso.
- Use uma base isolada, com contas e cursos sintéticos. Teste login, recuperação, primeiro acesso, cinco perfis, OKR, upload, SCORM 1.2/2004, vídeo, certificados, PDF, exportações e mobile. Teste negação por perfil e tentativa de origem externa; não use dados reais.
- Se 421 após configurar hosts: revise a lista ou remova a variável na homologação e redeploy. Se SCORM legítimo exigir microfone/câmera/geolocalização, avaliar autorização explícita; não afrouxar segurança global sem análise.
- Se falhar build, não merge. Se houver regressão após deploy, no Railway **Deployments** escolha o deploy anterior validado e a opção rollback/redeploy quando disponível. No GitHub reverta o PR, sem alterar main. Confirme a compatibilidade de variáveis e volume; a V28 não tem migração de schema. O rollback do código não reverte dados ou configurações por si só.
- Não considerar apto para produção apenas por build verde.
