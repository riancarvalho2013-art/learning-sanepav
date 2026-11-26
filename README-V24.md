# Learning Academy V24 — correções Rede social e Elogios

Base: `homologacao-dna`, arquivos conferidos pelo GitHub (plataforma bdcb7a54, storage dfe274a9, serve 3d4a5efa, web-app d52df8cf). A atualização é incremental, preserva V22/V23 e não muda o design existente.

## Aplicação

1. Faça backup da base/volume Railway, incluindo SQLite e WAL por snapshot consistente.
2. Extraia o ZIP em uma pasta temporária. Na raiz de uma cópia atualizada do repositório (branch `homologacao-dna`), execute:
   ```sh
   node /caminho/para/learning-social-fix/install-social-v24.mjs .
   node test-social-video-v24.mjs
   npm run build
   node verify-social-v24.mjs
   npm test
   ```
   Requer Node >=24 para testes da aplicação, conforme package.json. O instalador verifica que todos os trechos esperados existem uma única vez antes de alterar os arquivos. É idempotente. Se a base mudou, interrompe com indicação do trecho incompatível: não force a substituição.
3. Revise `git diff` e envie os arquivos modificados e novos à homologação. Não envie `data/`, banco, chaves, tokens ou dados pessoais. Exemplo:
   ```sh
   git add platform.mjs storage.mjs serve.mjs web-app.js social-video-v24.mjs test-social-video-v24.mjs verify-social-v24.mjs
   git commit -m "fix: upload de videos sociais ate 1 GiB e elogios entre colegas"
   git push origin homologacao-dna
   ```
   Apenas anexar o ZIP ou seus arquivos na interface do GitHub não aplica as alterações: execute o instalador primeiro, localmente ou em ambiente de desenvolvimento. Não há alteração em `main`.
4. Deploy em homologação; confirme que a instância usa a base/volume persistente correta. Faça a homologação descrita abaixo.

## Alterações
- `platform.mjs`: exceção exclusivamente para `Elogio` na restrição de registros pessoais. Valida colega ativo e escopo organizacional; não permite autoelogio nem editar elogios de outros autores. Outros registros mantêm as mesmas regras.
- `web-app.js`: aceita MP4/WebM até 1 GiB (1.073.741.824 bytes), fotos até 8 MiB. Upload sequencial em partes com progresso, até três tentativas por parte em erros transitórios e cancelamento ao fechar a janela.
- `social-video-v24.mjs`: sessões autenticadas, partes de 4 MiB, limite por tamanho e formato, limite diário existente de 12 envios, um vídeo simultâneo por pessoa, até oito sessões ativas no conjunto, expiração de sessões inativas e remoção de partes expiradas quando se inicia um novo vídeo. Publicação mantém referência às partes; entrega por streaming, HEAD e Range HTTP. Arquivos sociais antigos mantêm o formato de armazenamento anterior. Upload legado sem parâmetro de ação mantém teto antigo (64 MiB para vídeos); a interface atualizada usa a rota em partes.
- `storage.mjs`: remoção limitada às partes de sessões expiradas ou canceladas. O armazenamento continua SQLite, com objetos de no máximo 4 MiB por parte.
- `serve.mjs`: pipeline de resposta com tratamento de erros de streaming.

## Testes
Executados no ambiente de elaboração (Node 22): sintaxe dos módulos; testes unitários com armazenamento simulado, incluindo 65 MiB enviados e lidos em partes, teto lógico de 1 GiB, ordem, duplicação, autorização, formato, expiração, cancelamento e Range. Todos os pontos de aplicação foram conferidos na branch. Não foi executada a suíte real em Node 24/SQLite ou homologação autenticada. `verify-social-v24.mjs` está incluído para teste de integração com SQLite em memória e cinco perfis.

Checklist no Railway: publicar o vídeo original que excedia 64 MiB; abrir e avançar o player; publicar foto; rejeitar arquivo inválido e vídeo acima de 1 GiB; testar envio de elogios dos cinco perfis e rejeição de autoelogios e destinatários fora do escopo; confirmar os dados após reiniciar e verificar backup. Só depois testar vídeo real de 1 GiB e avaliar espaço livre, tamanho do banco/WAL, latência e consumo do serviço.

Atenção: SQLite é persistente e inclui as partes no backup, mas vídeos grandes aumentam volume e custo de armazenamento. É preciso reservar espaço suficiente para vídeos, WAL e snapshots; o pacote não aumenta a capacidade do Railway. Limites de concorrência são conservadores; instâncias múltiplas devem ser validadas antes de escalonar. Uma interrupção abrupta no momento da gravação pode deixar objetos órfãos; a limpeza normal de sessões expiradas não é garantia de coletar todos esses objetos. Para utilização intensiva, adotar armazenamento de objetos dedicado com política de retenção e quota por empresa. Não reverter o backend após publicar vídeos V24 sem preservar a leitura de partes; backup e plano de migração são necessários.
