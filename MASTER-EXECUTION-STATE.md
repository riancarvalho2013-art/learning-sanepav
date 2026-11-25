# Checkpoint — Learning Academy / V20

- 25/11/2026: pedido adicional de identidade e login integrado sobre a V19 local ac76fd2. Branch de publicação work/learning-academy-v19 → homologacao-dna; main preservada.
- Componentes de autenticação em web-auth-v20.js/css, SVG e favicon próprios, metadados e e-mails padrão Learning Academy; personalização e dados dos clientes preservados. APIs e regras de segurança mantidas.
- Duas imagens recebidas e inspecionadas; símbolo e composição ajustados em SVG/CSS. Comparação da renderização final ainda depende de QA visual. Prévia local bloqueada por política do navegador. Nova suíte V20 com 32 verificações; ver README-V20.md para limites.
- Publicação ainda deve ser confirmada pelo SHA remoto/árvore e status Railway. Não declarar entregue antes dessa verificação.

## Checkpoint V19 preservado

# Checkpoint — Learning Academy / V19

- 25/11/2026: continuidade sobre V18 f99dca5; destino homologacao-dna, main preservada.
- Domínio https://learningacademy.up.railway.app/; serviço, banco e volume existentes preservados.
- Entrega: conexão do próprio resultado liberado com PDI, habilitada no rascunho do ciclo; ação auditável, treinamento recomendado opcional e progresso do LMS. Academia com 11 guias originais e aplicação no PDI.
- Persistência aditiva no agregado existente, sem mudanças de tabelas. Nova suíte V19: 48 verificações SQLite aprovadas. npm test completo aprovado novamente após ajustes de interface e API documentada.
- Matriz de referências e lacunas em INTEGRACOES-QULTURE-V19.md; instruções e limites em README-V19.md.
- Prévia visual local bloqueada por política do navegador; QA responsivo e autenticado ainda pendente. Integração GitHub retorna 403 para escrita; usar interface autorizada, conferir árvore e deploy pelo SHA antes de declarar publicado.
- Nenhuma sincronização externa Qulture configurada. Convites sem provedor de e-mail. Backup independente operacional ainda pendente; nenhum banco/volume substituído.

## Checkpoint V18 preservado

# Checkpoint — Learning Academy / V18

- Atualizado em 25/11/2026 a partir do checkout completo. Branch de entrega: `homologacao-dna`; base V17 `8f889a49eca2cee0d8ca3fedc4624a9eb02be543`. Produção `main` preservada.
- Railway: serviço `c64a10c1-6898-4e91-aeab-42d69a3f57e1`, ambiente `homologacao`; volume `478eff6f-e337-4c4f-8bdf-f2b330ec3c4b` preservado.
- Endereço alterado e entrada verificada: https://learningacademy.up.railway.app. Requer novo login pela mudança de origem.
- Último deploy observado antes da V18: V17 `c864acc4-7630-4d90-8cb3-cd8c0eaad3aa`, Active / Deployment successful. Confirmar novo deploy pelo SHA publicado.
- V18: busca e filtros de cursos/trilhas no PDI, título automático editável, duração/progresso e acesso pelo próprio plano. Sem mudanças de esquema ou matrículas automáticas.
- `npm test` integral aprovado com Node 24.22.3. Perfil/PDI: 78 verificações. Testes HTTP, build, SCORM e regressões preservados.
- Backup gerenciado bloqueado pelo plano; lista vazia. Recuperação operacional exige armazenamento independente. Convites reais continuam sem Resend configurado.
- GitHub: integração retorna 403 para escrita; usar interface autorizada e verificar árvore publicada. Não sobrepor a V17 com arquivos da branch antiga desta conversa.
- Referências e pendências atuais: `README-V18.md` e https://help.qulture.rocks/learning-rocks.

## Histórico V13 — registro anterior, superado pelo checkpoint acima

- Branch autorizada: homologacao-dna. Baseline: a2017a37f60b40926a69a54199bb0ffb8b7ee478, deploy success confirmado. Main intocada.
- Novos módulos: metric-registry-v13.mjs, okr-v13.mjs, kirkpatrick-n2-v13.mjs, ops/recovery-v13.mjs.
- Integrações: relatórios e N2 compartilhado; OKRs na mesma coleção CAS de LXP; SCORM 2004 flow-only no runtime/motor existentes.
- Persistência: extensão aditiva okrsV13 dentro de lxp/v2/state. Sem alteração destrutiva de esquema; registros OKR legados mantidos. Históricos antigos sem fonte continuam não reconciliados.
- Testes: 26 grupos locais aprovados; Node 24.11.1; 49 HTTP com fixture; 58 SCORM 2004; 33 OKR; 66 métricas; navegador 1440/390 com shell/API simulados; restore sintético com hashes. Build completo e E2E integral não executáveis na cópia local (arquivos centrais ausentes).
- GitHub: escrita 403 confirmada; sem commit da V13. Railway V13 não validado.
- Próxima ação: backup da homologação; upload preservando caminhos; executar workflow na branch de homologação; conferir logs, testar pacotes SCORM reais, validar dados e restaurar backup em ambiente isolado. Não liberar produção.
- Pendências: SCORM 2004 regras complexas/objetivos/rollup, migração relacional e reconciliação global de fatos, fila de exportação, recuperação em volume independente real, E2E integral, carga e segurança integral.
