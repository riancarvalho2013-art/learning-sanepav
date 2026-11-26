# Learning Academy V25 — Sala de aula e política de vídeo

Atualização incremental aplicada sobre `homologacao-dna`, preservando V22, V23 e V24.

## Implementado

- Sala de aula responsiva com player 16:9, contraste reforçado e ações consistentes.
- Política configurável para vídeos com avanço livre ou reprodução sequencial obrigatória.
- Duração lida no servidor a partir dos metadados MP4/WebM; o valor enviado pelo navegador não é confiado.
- Sessão de reprodução com validação de posição, tempo decorrido, retomada e bloqueio de salto.
- Vídeos já concluídos continuam livres para revisão.
- Próxima etapa considera conclusão, matrícula e pré-requisitos; o último item não oferece avanço inexistente.
- SCORM, PDF, áudio e conteúdos sociais permanecem em seus fluxos próprios.

## Segurança e limites

- A política reduz saltos comuns e chamadas diretas de conclusão, mas não é DRM nem prova de atenção humana.
- Novos cursos em vídeo usam reprodução obrigatória por padrão; cursos legados mantêm avanço livre até edição.
- Somente Administrador e RH/DHO podem configurar a política.
- Nenhuma migração destrutiva ou alteração de dados existentes foi executada.

## Validação

- `node test-video-v25.mjs`
- `npm run build`
- `npm test`

Antes de produção, ainda é obrigatório homologar com vídeos reais MP4/WebM, cinco perfis, dispositivos móveis, queda de conexão, certificados, avaliações finais e trilhas com pré-requisitos.
