# Checkpoint V12 — 2026-11-24

- Branch: `homologacao-dna`; HEAD consultada: `cd87919c500b1b8a6e8f9cd4ad8ac40971379a7f`.
- V11: GitHub commit status success, serviço angelic-serenity. V12: patch local; escrita GitHub 403.
- Produção: não alterada; liberação bloqueada.
- Incrementos: projeção de conclusões por vínculo histórico, filtro Discovery por empresa de origem, exportação CSV em blocos e XLSX no servidor, SCORM 1.2 multi-SCO linear, sessão vinculada ao login, metas de competência e PDI no ciclo existente.
- Banco: índice aditivo no histórico organizacional, atributos opcionais nos registros existentes. Sem reconstrução fictícia de passado. Não exclui ou revoga dados legados. Curso com evidência prévia de apenas um SCO não é reconciliado como multi-SCO sem evidências suficientes.
- Testes: 22 grupos locais Node 24.11.1 (adapters em parte das suítes); 50 verificações históricas, 55 multi-SCO, 81 conclusão V11 e 45 HTTP de fixture; navegador desktop/mobile com shell/API sintéticos, Excel lido pelo openpyxl.
- Bloqueador: `npm test` completo parou em web-marca.png ausente na cópia local, embora presente no repositório; nenhuma alteração do gate. Não testado o volume real, a carga real, a recuperação operacional e o E2E integral.
- Próxima ação: publicar exclusivamente em homologação, executar build integral, confirmar SHA e smoke tests das novas telas, validar backup e restauração isolados do banco da homologação. Usar pacote SCORM real 1.2 com 2 SCOs e outro de SCO único; validar prova final, certificado, histórico, exportação e DHO. Não fazer merge para main.
- Pendências: catálogo global de métricas, normalização e histórico de outros fatos, SCORM 2004 sequenciamento completo, catálogo competências por cargo/OKRs, jobs exportação, matriz adversarial completa, E2E integral e carga real.
