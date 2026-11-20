# Incremento de privacidade

Base db45361, branch main. Alteração incremental sobre o código atual do Railway em 19/11/2026.

Registros de 1:1 são exibidos somente aos participantes, dentro do escopo hierárquico existente. Vínculos de registros exigem acesso ao conteúdo privado. Média de Pulse exige sete respostas. Feedback e Pulse mantêm as regras existentes. Pulse permanece identificada no armazenamento. A proteção completa contra reidentificação em pesquisas anônimas continua pendente.

Na primeira inicialização desta versão sobre um SQLite existente, storage.mjs cria um snapshot consistente com a API de backup do SQLite, incluindo WAL, em backups/pre-privacy-20261119.sqlite, junto ao arquivo de dados. O snapshot tem permissão 0600 e permanece no volume atual. Reinícios preservam esse snapshot. Uma falha ao criar a cópia impede o início da versão. A cópia no mesmo volume exige proteção externa adicional para recuperação em caso de perda do volume.

Testes executados com Node 24

- node --check platform.mjs
- node --check serve.mjs
- node --check storage.mjs
- node verify-privacy.mjs
- node verify-backup.mjs

Os testes de integração cobrem autenticação, hierarquia, cursos, questionário, ponte SCORM, privacidade de 1:1, feedback e Pulse, edição por autor, vínculos autorizados e limiar de sete respostas. O teste de backup verifica WAL, arquivos binários, integridade, permissões e preservação após reinício. Todos passaram localmente com dados isolados. Não houve migração de schema.

O commit anterior permite reversão do código. Este incremento não conclui os quinze módulos do Sanepav Learning 2.0.

