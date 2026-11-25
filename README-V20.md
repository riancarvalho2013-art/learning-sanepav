# V20 — Identidade e autenticação Learning Academy

Evolução aditiva sobre V19. Nome oficial padrão: Learning Academy. Referências visuais recebidas durante a execução: background e composição de login. Camadas oficiais enviadas em learning-academy-camadas(2).zip integradas: símbolo e ícones SVG fornecidos, nome em duas linhas e background limpo convertido de PNG para WebP (sem formulário). preview.js e autenticação demonstrativa não foram importados. Textos, campos e botões são componentes reais, sem imagem contendo formulário.

## Alterações

- Componente reutilizável `web-auth-v20.js`: login, primeiro acesso administrativo, definição de senha/convite e recuperação. Ícones vetoriais, campo de senha com controle acessível de visibilidade, validação nativa, status de envio e bloqueio de reenvio durante processamento.
- `web-auth-v20.css`: composição desktop 60/40; identidade centralizada nos dois eixos; background limpo fornecido, gradientes e luminosidade em CSS, marca e ícones vetoriais; card com capelo/notebook. Disposição vertical em telas pequenas, alturas flexíveis e suporte a movimento reduzido. Em tablets intermediários, 50/50 para legibilidade. Fonte Inter/Plus Jakarta Sans quando instalada, com fallback local Segoe UI; sem dependência de fonte externa.
- `web-academy-mark.svg`, favicon, título inicial, metadados e marca padrão atualizados. Login não utiliza nome, cor ou logo de empresa cliente. Marcas e dados de empresas autenticadas preservados. Novos ambientes passam a ter nome/cores padrão Learning Academy; nenhum tema persistido foi regravado.
- Convites mantêm empresa e personalização, com identidade institucional padrão Learning Academy. E-mail de recuperação e página de ativação recebem o novo nome. Nenhuma alteração nos prazos de tokens, cookies, hashes, sessão, ACL, banco ou variáveis do Railway.
- Integração nos arquivos existentes: `web-app.js`, `web-foundation.js`, `web-evolution.js`, `web-index.html`, `asset-manifest.json`, `platform.mjs`, `recovery.mjs`, `serve.mjs` e `package.json`.

## Validação

Build pelo manifesto existente. Background limpo otimizado: 1.410.874 bytes em PNG para 40.136 bytes em WebP, nas mesmas dimensões de 1790 × 879. Textos e controles permanecem HTML independente. Nova suíte `verify-auth-v20.mjs`: 32 verificações de contratos de formulário, primeiro acesso, recuperação indisponível, exibir/ocultar senha, carregamento, restauração após erro, identidade de e-mail, marca de cliente, ordem dos assets e contraste de textos/cores. Regressão integral inclui autenticação real por HTTP/SQLite, sessões, recuperação de token de uso único, convites e todos os módulos existentes.

A verificação de contraste de cores e regras responsivas não equivale a certificação WCAG 2.2 AA. As imagens foram inspecionadas para ajustar composição, símbolo, cores e alinhamento. A comparação da renderização final com elas depende da validação visual publicada. Prévia local bloqueada pela política do navegador; conferir o resultado publicado na homologação em desktop/celular e registrar qualquer limite de acesso. Não declarar navegação autenticada integral homologada sem executá-la.

## Publicação e reversão

Destino exclusivo: `homologacao-dna` / https://learningacademy.up.railway.app/. Confirmar árvore remota idêntica e deploy Railway bem-sucedido. `main`, serviço de produção, banco e volume existentes preservados. Reversão por Git dos componentes e chamadas; não há migração de dados a desfazer. V19 (avaliação/PDI/Academia de práticas) integra a mesma entrega sem substituição de funcionalidades.
