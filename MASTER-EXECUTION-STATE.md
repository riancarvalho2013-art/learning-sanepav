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
