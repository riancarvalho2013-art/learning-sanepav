# Learning Sanepav V17 — convite de primeiro acesso e recomendações por competência

Baseline verificada: homologacao-dna 069264386c7dd0d037904ea596bacf85d90a03af (V16, deploy aprovado). Alteração incremental; não aplicar em main. Antes de instalar, faça backup conforme a rotina do ambiente e confira que o serviço de produção continua ligado à main.

## Instalação
Envie os 11 arquivos do ZIP diretamente à raiz de homologacao-dna e confirme o deploy. Nenhum arquivo requer subpasta. Nenhuma suíte anterior foi desativada. `npm test` inclui os novos testes. O servidor usa a rota existente de redefinição de senha para consumir o convite; a tabela aditiva first_access_invites_v17 é criada somente na primeira tentativa válida de convite. Não execute rollback destrutivo do esquema.

## Convite por e-mail
Administração > Pessoas > Enviar convite para primeiro acesso, também disponível no formulário de edição de cadastro. A conta deve estar ativa, não administrativa e com e-mail salvo. Salve mudanças de cadastro antes de convidar. A ação envia diretamente ao provedor Resend, sem exigir copiar um link ou enviar uma senha. O HTML usa nome, empresa, título do ambiente e identidade DNA do Desenvolvimento. A senha inicial dos cadastros existentes continua sendo tratada pelo fluxo anterior, mas não precisa ser compartilhada com o destinatário.

No serviço `angelic-serenity`, ambiente `homologacao`, configure as variáveis:
- `RESEND_API_KEY`: chave secreta de envio do Resend.
- `EMAIL_FROM`: remetente autorizado pelo Resend; ex.: `DNA do Desenvolvimento <learning@seudominio.com.br>` (substituir pelo domínio efetivamente verificado).
- `APP_ORIGIN`: `https://angelic-serenity-homologacao.up.railway.app` (ou origem HTTPS real do ambiente, sem caminho). Não use a URL de produção na homologação. O servidor recusa enviar quando a origem da solicitação não coincide com a configurada.

O convite tem validade de 48 horas e uso único. O servidor armazena somente o hash do token, não retorna o link ao navegador de administração, usa o mecanismo PBKDF2 existente para a nova senha e invalida sessões e tokens anteriores após a redefinição. O reenvio (intervalo mínimo de 60 s; máximo de 100 solicitações por administrador/hora) invalida o convite anterior. Falha do provedor invalida o token criado. Alteração de e-mail, perfil, senha ou empresa invalida o convite. O envio é bloqueado se houver sessão ativa ou convite já resgatado. Não há histórico inequívoco de todos os acessos anteriores à instalação; contas antigas sem sessão ativa podem ser convidadas. Para contas já utilizadas, prefira recuperação de senha. O sistema registra aceitação pelo provedor e resgate do convite, não confirmação de entrega à caixa de entrada. Nenhum disparo automático coletivo foi acrescentado.

Teste real recomendado: após deploy, use uma conta de teste controlada, clique no botão, confirme a recepção, abra o link em uma janela anônima, defina senha, entre e confirme que o mesmo link não funciona novamente. Não cole chaves, tokens ou senhas nos logs ou no GitHub.

## Recomendações de LMS na devolutiva
Desempenho > ciclo em rascunho > Recomendações por competência. Administrador associa até 10 cursos/trilhas publicados a cada tópico de competência (seleção múltipla). A configuração é persistida no próprio ciclo e versionada. Não é editável após publicação. Os conteúdos aparecem em Desempenho e Perfil Integrado > Avaliações somente após encerramento e liberação do resultado. O colaborador precisa ter atribuição válida do conteúdo; sem atribuição, somente quantidade indisponível aparece, sem título nem ID do conteúdo. A recomendação não matricula automaticamente e não altera o motor de conclusão, PDI ou certificados. Líder pode consultar o perfil autorizado de seu liderado, sem configuração global. A referência funcional é https://help.qulture.rocks/learning-rocks-integracao-entre-avaliacao-e-espacos.

## Verificações
Node 24.11.1: 31 grupos locais (inclui runtime com fixture); convite 53 verificações em SQLite/hash reais com entrega simulada; recomendações 41 verificações com organização simulada; interface Chromium 1440/390 com shell e API simulados. A suíte integral do repositório e a entrega por e-mail real não foram executadas localmente, pois o checkout central está incompleto e não há credenciais do provedor. O teste HTTP integral existente foi ampliado para verificar a rota de convite sem enviar e-mails. Validar no Railway.
