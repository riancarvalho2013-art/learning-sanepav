# V19 — Avaliação, desenvolvimento e Academia de práticas

Incremento sobre V18 `f99dca5d8589e6a183dabeadce02bc59c571f092`, destinado exclusivamente à branch `homologacao-dna`. URL: https://learningacademy.up.railway.app/. Não representa conclusão de todos os recursos das referências.

## Implementado

- RH/DHO e administração podem habilitar a conexão com o próprio PDI na configuração de um novo ciclo ou rascunho de avaliação. Desabilitada por padrão em ciclos existentes. Configuração congelada ao publicar.
- Após encerrar e liberar resultados, o participante usa **Desempenho → ciclo → Do resultado à prática**, ou seu perfil integrado, para preparar uma ação de uma competência com nota disponível. O salvamento é uma decisão explícita da pessoa.
- A ação registra ciclo, competência, proficiência observada, esperada e gap calculados no servidor. Não aceita criar para outra pessoa. O fluxo administrativo anterior é preservado separadamente.
- Treinamento recomendado opcional: um curso ou trilha já atribuído, apenas modalidade 10. Não concede matrícula. Progresso/conclusão continuam derivados do LMS. Mudanças de empresa e concorrência são verificadas na gravação; reenvios iguais não duplicam ações.
- **Academia de práticas** na navegação: 11 guias originais com busca, filtro por tema, orientações e acesso aos módulos. “Preparar ação no meu PDI” preenche o editor existente para revisão e gravação real. Leitura do guia não produz horas ou certificados. Conteúdo editorial nesta entrega é versionado; edição dos guias pelo RH ainda não disponível.

## Arquivos e dados

`lxp-v2.mjs`, `web-lxp-v2.js`, `verify-self-development-v19.mjs`, `package.json`, `openapi.json`, este documento, `INTEGRACOES-QULTURE-V19.md` e `MASTER-EXECUTION-STATE.md`.

Extensão aditiva no agregado existente `lxp/v2/state`: `cycles[].selfPdiEnabled`; `pdiActions[].source.kind/fingerprint` e referência à competência, além de `learningLink` já existente. Nenhuma tabela, migração destrutiva ou troca de volume. Reverter código preserva os registros criados e o vínculo de aprendizagem reconhecido na V18; apenas os novos atalhos/configuração deixam de aparecer.

## Validação e limites

`npm test` completo aprovado em Node 24.22.3; nova suíte com 48 verificações em SQLite isolado: origem/CSRF, papéis, empresa, resultado não liberado, configuração desabilitada, competência inexistente, conteúdo indisponível, idempotência e progresso do LMS, inclusive transferência durante gravação. Sem dados de teste publicados. Suíte integral repetida após ajustes de interface, com aprovação; a suíte V19 foi ampliada e executada com 48 verificações.

Prévia visual local bloqueada pela política do navegador desta sessão. Validação responsiva e fluxo autenticado no navegador continuam pendentes; não são declarados homologados. Publicação deve ser conferida pelo SHA remoto e status Railway.

Pendências: ciclo próprio de PDI e conexão de questões discursivas; favorito automático transacional; paginação acima de 2.000 treinamentos; campanhas de feedback; edição editorial pelo RH; integrações externas de identidade/sincronização; exportações granulares e sucessão completa. Convites dependem de APP_ORIGIN, EMAIL_FROM e RESEND_API_KEY. Não há credencial de integração com Qulture.Rocks; não há envio de dados de RH ao fornecedor.
