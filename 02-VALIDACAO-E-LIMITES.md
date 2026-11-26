# Validação V27.1 — critérios de aceite

## Evidências desta sessão

- Leitura da branch homologacao-dna via GitHub conectado; HEAD 9aea20d3de4ad8da570730ca6fda7536c298998b.
- Node 22.16.0 local: `verify-enterprise-v27.mjs` — **58 verificações aprovadas** (SQLite sintético, storage simulado, criptografia, recusa de integridade inválida, duplicatas, falhas de gravação, reidratação, recusa de backup no mesmo dispositivo, filtros, histórico protegido, XML Excel, manifesto).
- Sintaxe de todos os arquivos JS/MJS modificados: aprovada no Node 22.
- Chromium com DOM sintético e resposta API fictícia: cinco larguras de viewport (320, 390, 768, 1024, 1440 px), sem overflow horizontal nos quatro componentes testados (banner, header do objetivo, filtro, painel de exportação).
- Chromium com JSZip local: download XLSX real, aberto com openpyxl; quatro abas, valor `=1+1` preservado como texto, caracteres especiais preservados, histórico restrito ausente e cabeçalhos congelados.
- O navegador não permitiu navegar para o host de fixture externo; o teste foi repetido com conteúdo local e resposta API simulada. Não foi a renderização completa do produto.
- O ambiente não conseguiu clonar o GitHub (DNS bloqueado); não houve checkout integral, npm test completo, Node 24, instalação/execução real do AWS SDK ou conexão Railway S3. O Dockerfile executa a suíte original e a nova no build remoto. Nenhum commit, deploy, alteração de base real ou acesso autenticado foi realizado nesta sessão.

## Teste após upload (homologação, dados fictícios)

| ID | Cenário | Aceite |
|---|---|---|
| QA-01 | Build e deploy | Todos os testes originais e V27 passam; SHA correto; `/readyz` retorna sucesso |
| QA-02 | Login e navegação | ADM, Diretoria, RH/DHO, Líder, Colaborador; nenhuma regressão de autenticação |
| QA-03 | OKRs | Criação, publicação, atualização, encerramento e escopo original; nenhuma visibilidade indevida |
| QA-04 | Excel | Selecionar recorte, situação e período; abrir XLSX; verificar 4 abas, valores e totais |
| QA-05 | Privacidade | Usar duas empresas e dois departamentos fictícios; comparar projeção API, tela e planilha; testar alteração do filtro/URL e sessão expirada; nenhum dado fora do escopo |
| QA-06 | Frontend | Cada aba do produto, 320/390/768/1024/1440 px, zoom 100% e 125%; conferir banners, cards, menu, modais, tabelas, player, foco, teclado e textos longos |
| QA-07 | LMS | PDF, MP4, áudio, SCORM 1.2, pacote real, avaliação final, certificados e progresso; arquivos legados continuam acessíveis |
| QA-08 | Rede social | Foto, vídeo com partes, reprodução e busca por posição, cancelamento e acesso autorizado |
| QA-09 | S3 opcional | Conexão, gravação e leitura, privacidade, erro de conexão, reinício e integridade; somente em bucket sintético |
| QA-10 | Backup | Destino independente comprovado, log verificado, restauração isolada e mídia correspondente; não usar banco principal como alvo |
| QA-11 | Reidratação opcional | Recuperar mídia externa em cópia de homologação, confirmar remaining:0 e leitura dos arquivos |
| QA-12 | Carga | Medir latência, concorrência, RAM, CPU, disco/WAL e transferências com usuários e arquivos sintéticos |

**No-go:** qualquer vazamento, perda de dados, falha de autenticação, backup não recuperável, erro de build, regressão nos módulos centrais ou incapacidade de demonstrar rollback. Não confundir deploy bem-sucedido com aprovação de segurança. Na operação multiempresa comercial, a revisão independente deve validar isolamento de todos os endpoints, exports e arquivos.

## Estado do incremento

| Pilar | Status |
|---|---|
| Exportação de OKRs em Excel | Código completo entregue; validado em fixture |
| Correção de overflow de componentes | Código entregue; validado em fixture; QA de todas as telas pendente |
| Mídia externa | Implementação opt-in entregue; adaptador testado com armazenamento simulado; integração real pendente |
| Agendamento de backup independente | Implementação opt-in entregue; recusa do mesmo dispositivo testada; restauração operacional pendente |
| Segurança | A exportação não amplia a autorização recebida da API; auditoria adversarial geral ainda pendente |
| PostgreSQL e multi-tenancy comercial | Backlog; não alterado |
| Comercialização | Não homologada |
