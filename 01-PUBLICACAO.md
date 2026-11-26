# Learning Academy V27.1 — publicação manual e segura

**Base exata:** [9aea20d3de4ad8da570730ca6fda7536c298998b](https://github.com/riancarvalho2013-art/learning-sanepav/commit/9aea20d3de4ad8da570730ca6fda7536c298998b), branch `homologacao-dna`. A `main` não é alvo desta entrega.

## 1. Arquivos que você deve enviar

Todos os arquivos abaixo já estão completos, não são trechos de código nem instaladores. Todos devem ficar na **raiz** do repositório. Não envie `GUIA`, `LEIA-PRIMEIRO.txt` ou o ZIP ao GitHub.

| Arquivo | Operação | Finalidade |
|---|---|---|
| `Dockerfile` | Substituir | Instala SDK S3, executa testes legados e V27 no build |
| `storage.mjs` | Substituir | Mantém adaptador original, integra mídia opcional e agenda backup opt-in |
| `media-storage-v27.mjs` | Novo | Mídia externa criptografada, integridade, referências e reidratação |
| `backup-scheduler-v27.mjs` | Novo | Agenda recuperação existente em dispositivo independente |
| `web-index.html` | Substituir | Carrega o CSS e JS V27, mantendo os assets antigos |
| `asset-manifest.json` | Substituir | Registra os dois assets novos no build |
| `web-design-v27.css` | Novo | Correções incrementais de responsividade e acessibilidade |
| `web-okr-report-v27.js` | Novo | Exporta XLSX a partir da visão de OKRs autorizada |
| `verify-enterprise-v27.mjs` | Novo | Verificações automatizadas específicas do incremento |

## 2. Publicação sem terminal

1. Verifique o HEAD em [homologacao-dna](https://github.com/riancarvalho2013-art/learning-sanepav/tree/homologacao-dna). Se não for o SHA informado, **não sobrescreva** os arquivos: atualizações posteriores podem ser perdidas.
2. Confira que o serviço Railway de homologação está conectado a essa branch; faça backup consistente da base e confirme que pode ser restaurado. Não exclua banco, volume ou serviço. Se não houver backup recuperável, suspenda a publicação com dados reais.
3. Extraia o ZIP localmente. Na raiz da branch no GitHub, selecione **Add file > Upload files**.
4. Selecione os nove arquivos de `GIT` juntos. Confira que não estão em uma pasta adicional. Confirme o commit **na homologação**. Sugestão de mensagem: `V27.1 - hardening de mídia, backup, UX e relatórios OKR`.
5. Na Railway, mantenha `LEARNING_MEDIA_MODE=sqlite` (ou ausente) e `LEARNING_BACKUP_DIRECTORY` ausente. Não altere `LEARNING_DB`, `SETUP_KEY`, `APP_ORIGIN` ou os dados existentes. O Dockerfile instala a dependência S3 e executa a suíte integral, depois o teste V27. Se falhar, leia o log; não desative testes para forçar o deploy.
6. Em Deployments, confirme o SHA do novo commit, o build bem-sucedido e o deploy ativo. Confira `/healthz` e `/readyz` da homologação e execute os testes do guia 02. A build depende de o Railway conseguir acessar o registro npm. A dependência principal foi fixada em 3.1174.0, mas não foi gerado lockfile de dependências transitivas nesta sessão.
7. Somente após homologar, avalie separadamente o modo externo de mídia.

## 3. Railway Storage Buckets — somente depois da primeira homologação

O modo SQLite é o padrão e não cria referências externas. O modo `external` mantém todos os arquivos anteriores onde estão e direciona **novas gravações elegíveis** (`files/`, `social/`, `social-video/`) ao S3, com referências SQLite. Os demais dados continuam na mesma base. Não realiza migração histórica em massa.

Crie um Bucket **privado exclusivo de homologação** no Railway, em região compatível. Consulte as credenciais no painel e use referências de variáveis. Não envie nenhuma credencial ao GitHub, não use chaves reais em documentação e não reutilize o bucket de produção.

| Variável da aplicação | Valor |
|---|---|
| `LEARNING_MEDIA_MODE` | `external` apenas depois de configurar e aprovar todos os itens abaixo |
| `LEARNING_MEDIA_ENDPOINT` | Endpoint HTTPS da aba Credentials do bucket, sem caminho |
| `LEARNING_MEDIA_BUCKET` | Nome real do bucket |
| `LEARNING_MEDIA_REGION` | Região informada pelo provedor |
| `LEARNING_MEDIA_ACCESS_KEY` | Access key do bucket via referência de variável |
| `LEARNING_MEDIA_SECRET_KEY` | Secret key do bucket via referência de variável |
| `LEARNING_MEDIA_PREFIX` | Prefixo exclusivo, ex.: `learning-homologacao-v27` |
| `LEARNING_MEDIA_KEY_HEX` | 32 bytes aleatórios criptograficamente seguros, em 64 caracteres hexadecimais, gerados por administrador autorizado em gerenciador de segredos |
| `LEARNING_MEDIA_PATH_STYLE` | `false` para virtual-hosted-style (padrão documentado Railway); use `true` só se o provedor exigir |

A chave de criptografia deve ser guardada em cofre de segredos com cópia segura fora do Railway. Não a altere nem exclua enquanto existirem objetos cifrados. O adaptador não aceita trocar de chave/endpoint/prefixo quando há referências existentes. O serviço realiza uma pequena prova de escrita, leitura e exclusão antes de iniciar. Não se conecta a S3 na configuração padrão.

**Gate:** teste com dados fictícios: curso PDF/MP4, capa, SCORM, vídeo social em partes, reprodução, autorização, reinício, indisponibilidade do bucket e reidratação. O SDK, endpoint e integração S3 real não foram executados nesta sessão. O adaptador utiliza buffers por objeto (até 64 MiB) e partes sociais de 4 MiB; não é um upload direto do navegador ao S3, não é streaming adaptativo e não aumenta os limites de curso. Medir CPU, memória, latência e custo de transferência. Manter uma réplica enquanto SQLite estiver sendo utilizado.

O armazenamento é cifrado com AES-256-GCM e vinculação ao identificador do objeto; a leitura verifica SHA-256 do conteúdo. Referências são persistidas somente após leitura de confirmação. Objetos remotos antigos/órfãos não são excluídos automaticamente porque podem ser necessários por snapshots anteriores. Implementar política de retenção auditada antes de escalar. Um backup SQLite isolado não recupera os objetos externos: proteja também os objetos e a chave.

Referência oficial: https://docs.railway.com/storage-buckets

## 4. Agendamento de backup opcional

O agendamento usa o mecanismo `scheduledBackup` V13 (snapshot consistente, fingerprint de tabelas e ensaio de restauração). Ele só funciona se houver **dispositivo de armazenamento separado, persistente, cifrado e autorizado**, montado fora da pasta do banco, com espaço para a cópia e ensaio. Não presuma que o Railway permite um segundo volume no mesmo serviço; se não houver destino independente adequado, mantenha desabilitado e contrate/configure um mecanismo de backup separado.

- `LEARNING_BACKUP_DIRECTORY`: caminho absoluto de destino independente (não preencher na primeira publicação).
- `LEARNING_BACKUP_INTERVAL_HOURS`: padrão 24; permitido 6 a 168.
- `LEARNING_BACKUP_MAX_SNAPSHOTS`: padrão 14; permitido 2 a 90.

Executa após 60 segundos do início e depois no intervalo. Recusa mesmo dispositivo. Não apaga backups automaticamente; ao alcançar o limite, registra `retention_limit` e exige gestão operacional. Uma única réplica. Logs `backup_v27` com `verified`, `failed`, `retention_limit` ou `invalid_configuration`; configurar acompanhamento, retenção e alertas operacionais. Um log de sucesso não substitui restauração em ambiente independente. Não colocar material com dados pessoais em compartilhamento público. O backup precisa ter criptografia no destino (o script não cifra o arquivo SQLite). O agendamento não foi executado em um segundo dispositivo real nesta sessão.

## 5. Rollback

**Enquanto o modo padrão SQLite esteve sempre ativo:** use o histórico do GitHub e o redeploy anterior da Railway se necessário, sem substituir volume. A atualização adiciona arquivos, não apaga tabelas existentes. Faça verificação de dados antes e depois.

**Após habilitar mídia externa:** jamais reverta diretamente a versão para V26 nem mude o modo para `sqlite` sem reidratar. O código V26 não sabe ler referências externas e poderia apresentar arquivos vazios. Mantenha a V27 e todas as variáveis/chaves/bucket, interrompa uso por usuários, confirme espaço em disco, faça backup completo e altere `LEARNING_MEDIA_MODE` para `rehydrate` durante manutenção. O startup recupera cada objeto para SQLite e valida o conteúdo antes de remover sua referência; se falhar, mantenha a versão e corrija a conexão. Confira nos logs `media_v27_rehydrated`, `remaining:0` e testes dos arquivos antes de retornar a `sqlite`. Para volumes muito grandes, não utilize esse fluxo por startup sem planejamento: pode exceder a janela de deploy. Restauração de snapshot anterior exige as mídias remotas correspondentes e a chave original. Não delete o bucket.

## 6. Não incluído nesta release

Não troca o banco para PostgreSQL, não altera a política de papéis existentes, não cria administração por tenant independente, não cria cobrança, não altera os limites de upload do LMS, não migra dados antigos, não modifica origem/branding de notificações legadas, não declara o produto pronto para produção. Essas alterações exigem checkout integral, revisão de impacto e testes integrados.
