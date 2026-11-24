# Baseline técnico verificado — Learning Sanepav 4.0 / Fase 0

Data de referência: **23 de novembro de 2026**.

## GitHub

| Ref | SHA observado | Estado |
|---|---|---|
| main | `e88542a2d22d16b02063d84165699fd5b4ae91c3` | Base de produção; **não alterar** |
| homologacao-dna | `1c66c721ad6094d0d2d876c540f6cce18476af09` | Seis commits à frente da main |
| feature/lms-assessments-certificates-classes | `2c3ecc74da3027b48a432e8887015b1727df70f4` | Divergente; contém trabalho potencialmente reutilizável de avaliações e PDF |

## Módulos inspecionados na branch de homologação

- `serve.mjs`: encaminhamento dos módulos adicionados sem reescrita do core.
- `platform.mjs`: estado legado, autenticação, autorização, cursos, registros de aprendizagem.
- `storage.mjs`: SQLite `objects/system/state-v1`, esquema organizacional, persistência WAL.
- `domain.mjs`, `migrations.mjs`: vínculos organizacionais e permissões.
- `scorm-v3.mjs`: runtime do SCORM aprovado operacionalmente pelo usuário; **preservar**.
- `learning-discovery-v4.mjs`: favoritos, avaliações de cursos concluídos e eventos de descoberta.
- `lxp-v2.mjs`: registros identificados de Pulse (`pulseResponses` incluem `userId`) e desempenho.
- `reports-v3.mjs`: indicadores e regras de privacidade mínimas; respostas legadas ainda identificadas na origem.
- `web-app.js`, `web-discovery-v4.js`, `web-reports-v3.js`: navegação por extensão de funções.

## Diagnóstico confirmado

- **ALTO:** `lxp-v2.mjs` associa diretamente `pulseResponses.userId` à escolha e comentário; não deve ser rotulado como pesquisa de respostas anônimas.
- **ALTO:** relatórios legados e V3 usam estrutura organizacional atual, não vínculo histórico na data do evento.
- **MÉDIO:** wrappers sucessivos de funções globais (`draw`, `body`) tornam regressões de navegação mais prováveis; planejar roteador explícito sem retirar os módulos existentes.
- **MÉDIO:** vários requisitos de People Intelligence 4.0 ainda não têm eventos ou fonte confiável; não preencher com valores inventados.
- **BLOQUEIO:** acesso de escrita do GitHub via conexão atual responde 403; não há evidência de permissão para fazer commit diretamente.

## Ação implementada na Fase 1

Módulo Pulse Seguro V5 como coexistência controlada e correção de transparência do texto Pulse nos relatórios V3, sem migração destrutiva ou alterações no SCORM. Testes registrados na documentação de release.

## Estado não verificado

Não foi possível consultar logs privados do Railway ou dados reais da instância a partir desta interface. `ACTIVE` ou histórico de deployments não são afirmados nesta entrega.
