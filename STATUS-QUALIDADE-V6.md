# Status de qualidade — Learning 4.0, release V5+V6

**Base GitHub:** `homologacao-dna` SHA `1c66c721ad6094d0d2d876c540f6cce18476af09`  
**Mudanças locais da release:** sem commit no remoto  
**Estado:** incremento tecnicamente preparado para homologação, **não liberado para produção**.

| Dimensão | Evidência | Situação |
|---|---|---|
| Integridade de respostas Pulse V5 | 38 chamadas + inspeção do esquema SQLite | Aprovado no teste isolado |
| Avaliações V6 | 39 chamadas com matrícula, privacidade, revisão, idempotência e persistência | Aprovado no teste isolado |
| Intelligence V6 | 9 chamadas de fontes, filtros e autorizações | Aprovado no teste isolado |
| Integração estática | Manifest, HTML, arquivo server, presença de handlers e regressão lógica | Aprovado |
| UI Avaliações V6 | Chromium local, desktop e mobile, navegação/editor/resultados com mocks | Aprovado no smoke isolado |
| UI Relatórios integrado | Código checado; fluxo completo no navegador conectado | Não testado |
| Suíte Node 24 do repositório completo | `npm test` | Não executado localmente; source original não montado |
| SCORM V3 | Preservação no roteamento e HTML; execução real no Railway | Relato anterior de funcionamento; regressão desta release pendente |
| Homologação com dados reais | Railway, contas reais, banco e volume | Não executada |
| Privacidade e segurança | Negativas em testes do módulo; revisão externa | Parcial |
| Backup/restore | Precisa de snapshot do volume Railway e restore real | Não executado |
| Performance | Carga, p95, memória e sessões concorrentes | Não executado |

## Restrições e impedimentos

- GitHub no ChatGPT continua retornando HTTP 403 em operações de escrita. É preciso upload manual ou outro conector autorizado. Nenhuma alteração publicada pelo assistente.
- O ZIP é um **overlay de atualização**, não um clone completo do repositório. Requer as bases anteriores da branch.
- A release não declara suporte completo a todos os padrões SCORM nem 10/10 corporativo.
- Dados de diagnóstico sintéticos não são dados reais de pessoas, e não devem ser mesclados à produção.

## Testes locais utilizados

```bash
node --experimental-sqlite verify-pulse-v5.mjs
node --experimental-sqlite verify-pulse-integration.mjs
node --experimental-sqlite verify-assessments-v6.mjs
node --experimental-sqlite verify-intelligence-v6.mjs
node --experimental-sqlite verify-release-v6.mjs
```

O Node disponível nesta execução local foi **v22.16.0** com flag experimental SQLite. A instalação real exige Node >=24 e a suíte completa do repositório deve rodar no ambiente correto.
