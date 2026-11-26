# Esteira de hardening — antes de funcionalidades novas

Requisitos do documento de 18 fases. Status reportado com evidência e sem pontuação arbitrária.

| Fase | Estado | Evidência / próximo passo |
|---|---|---|
| 1 Auditoria | Parcial | Leitura de arquivos/rotas e SHA; histórico, configuração real e cobertura integral pendentes. |
| 2 Railway | Parcial | Gate HTTP, HSTS e guia healthcheck/hosts; rede privada, plano, variáveis, backups e privilégios reais não inspecionados. |
| 3 Multi-tenant | Bloqueador | Fundação organizacional existe; catálogo legado e administrador global precisam migração/isolamento. |
| 4 Acessos | Bloqueador | RBAC atual preservado; separar administrador corporativo e superadmin; ABAC por módulo. |
| 5 Segurança por módulo | Parcial | Evidência OKR, catálogo e SCORM; matriz-alvo e testes restantes. |
| 6 Autenticação | Parcial | Token assinado bootstrap, limites por processo; MFA, Argon2id e revogação integral pendentes. |
| 7 APIs/OWASP | Parcial | Origem, host, cabeçalhos, logs, limites; não equivale à validação completa OWASP/ASVS. |
| 8 SCORM | Parcial | Preserve CSP/sandbox/preflight, compatibilidade real e origem separada pendentes. |
| 9 Upload | Parcial | V27 opcional e testes isolados; sem aumento de limites nem antivírus. |
| 10 Banco | Pendente | SQLite preservado; proprietário/tenant e migração PostgreSQL/RLS ainda não implementados. |
| 11 Backup/DR | Parcial | V27 e scripts existentes; restore real independente não comprovado. |
| 12 Auditoria | Parcial | Logs HTTP com categoria/ID/status; falta ator/tenant/recurso e trilha imutável/consulta administrativa. |
| 13 Monitoramento | Parcial | Logs de recusas e 5xx; alertas, resposta operacional e medição de carga pendentes. |
| 14 Integrações/IA | Pendente | Sem configuração real ou verificação integral de dados enviados. |
| 15 Privacidade/LGPD | Pendente | Minimização de logs; inventário, retenção, direitos e jurídico pendentes. |
| 16 DevSecOps | Parcial | Workflow proposto, nenhuma execução remota; branch protection e scans pendentes. |
| 17 Testes | Parcial | 64 verificações V28 + 58 V27 isoladas; falta suíte completa, E2E, isolamento/carga real. |
| 18 Implementação | Parcial | Incremento completo de arquivos para branch específica, nenhum merge/deploy realizado. |

## Próximos incrementos obrigatórios (não entregues)
1. **Contenção multi-tenant**: inventariar cada entidade, registrar origem de curso/trilha/mídia, tratar registros sem origem como não classificáveis, preservar dados, preparar backfill revisável, política central e admin corporativo separado. Não atribuir organização automaticamente sem evidência.
2. Autenticação e sessão: MFA admin, atualização gradual de hashes, revogação e rate limit, proteção de convites/reset.
3. Upload e SCORM: tipos reais, quotas, isolamento, arquivos privados, varredura de conteúdo e regressão.
4. Resiliência e privacidade: backup externo criptografado e restauração, auditoria por ator/tenant/recurso, alertas, inventário e retenção.
5. DevSecOps: scans atuais e histórico, dependências, SBOM, branch protection e testes integrados; medir carga 10/25/50/100/150 simultâneos somente em homologação autorizada.

## Gate de aceite
- [ ] SHA e arquivos conferidos, PR revisado, build completo Node 24 verde, V27 e V28 verdes.
- [ ] Nenhum risco P0 conhecido sem contenção adequada; isolamento de tenants e departamentos comprovado por API e exportação.
- [ ] MFA administrativo, sessão e recuperação testados.
- [ ] Upload, SCORM real e fluxos críticos sem regressões; mobile e desktop.
- [ ] Backup independente configurado; restauração testada; medir RPO <= 24h, RTO <= 4h.
- [ ] Logs de auditoria completos, monitoramento e resposta a incidentes testados.
- [ ] Segredos/visibilidade GitHub, configuração Railway, privacidade e riscos residuais aprovados.
- [ ] Testes de carga realizados com critérios acordados, sem dados reais e sem produção.

**Resultado atual: NO-GO para operação comercial multi-cliente.** Este pacote não autoriza produção nem certifica LGPD/OWASP. Piloto interno somente após os gates pertinentes e autorização da empresa. Não contratar recursos automaticamente. Custo adicional do código não estimado; depende de consumo de CPU, logs, volume, bucket e plano vigente. Não foi feita nova consulta a valores Railway nem conferência de plano/limites reais, portanto não há estimativa precisa nesta entrega.
