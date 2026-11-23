# Inventário e mapeamento — Descobertas LXP V4

**Fonte:** repositório `riancarvalho2013-art/learning-sanepav`, branch `homologacao-dna`, commit base `5953cf8426b9116f95eda536de42f69be71df899` consultado em 23/11/2026. Diagnóstico incremental, não auditoria exaustiva de todas as funções do sistema.

| Funcionalidade | Interface | Backend/API | Persistência | Segurança | Fonte analítica | Evidência |
|---|---|---|---|---|---|---|
| Visualizar lista de cursos salvos | `web-discovery-v4.js` → Minha lista | `GET /api/discovery/v4/mine` | `lxp_discovery_bookmarks` | Sessão; apenas usuário autenticado | Estoque atual | Teste isolado passou |
| Salvar/remover favorito | Botão ♡ no catálogo e Minha lista | `POST /api/discovery/v4/bookmarks` | `lxp_discovery_bookmarks` | Verifica curso publicado e sessão | Contagem de favoritos | Teste isolado passou |
| Avaliar curso concluído | Estrelas 1–5 em Minha lista | `POST /api/discovery/v4/ratings` | `lxp_discovery_ratings` | Matrícula concluída obrigatória | Quantidade e média | Teste isolado passou |
| Acesso ao catálogo | Eventos por navegação | `POST /api/discovery/v4/events` | `lxp_discovery_events` | UUID, identidade de sessão, throttle | Evento `catalog_viewed` | Teste isolado passou |
| Pesquisa no catálogo | Enter no campo existente | `POST /api/discovery/v4/events` | `lxp_discovery_events` | Termo não persistido | Evento `search_performed` | Teste isolado passou |
| Solicitação de aula | Clique no player existente | `POST /api/discovery/v4/events` | `lxp_discovery_events` | Matrícula/autorização; **não** representa início real | Evento `lesson_launch_requested` | Teste isolado passou |
| Relatório de engajamento | Página Descobertas LXP | `GET /api/discovery/v4/metrics` | Agregado das 3 tabelas novas | Empresa, equipe, perfil, suprime recortes pequenos | Ativos, interações, favoritos e notas | Teste isolado passou |
| Migração | Sem interface | `schema()` no módulo novo | `lxp_discovery_migrations` V1 | Transação SQLite | Versão auditável | Teste isolado passou |

## Contratos de eventos

`catalog_viewed`: a navegação acionou a abertura do catálogo.  
`search_performed`: o usuário submeteu a pesquisa com Enter; nunca persistimos o termo.  
`lesson_launch_requested`: um usuário autenticado e autorizado clicou para abrir uma aula. **Não equivale a `started`, `completed` ou `passed`.**  

Campos persistidos: identificador idempotente, ID de usuário, empresa atual no momento do evento (se vinculada), ID de curso (se aplicável), tipo, horário UTC, data UTC. Sem texto livre, e-mail, senha, IP ou cookies.

## APIs novas

- `GET /api/discovery/v4/mine`: favoritos, notas próprias, catálogo publicado e sugestões por afinidade de trilha.
- `POST /api/discovery/v4/bookmarks`: `{ "courseId": "uuid", "bookmarked": true|false }`.
- `POST /api/discovery/v4/ratings`: `{ "courseId": "uuid", "score": 1..5 }`.
- `POST /api/discovery/v4/events`: `{ "eventId": "uuid", "type": "catalog_viewed|search_performed|lesson_launch_requested", "courseId"?: "uuid" }`.
- `GET /api/discovery/v4/metrics?company=uuid&department=uuid&from=YYYY-MM-DD&to=YYYY-MM-DD`: gestor autorizado, máximo de 366 dias, recortes menores que 5 ocultos.

## Status e próximos passos

**Implementado e testado isoladamente:** API, migração aditiva, autenticação, autorizações, favoritos, notas, contagens, filtros básicos, deduplicação, ausência de campos PII e schema versionado.  
**Implementado, ainda não validado E2E:** frontend e navegação das novas páginas, ações no catálogo, compatibilidade visual com o Learning publicado.  
**Não implementado:** catálogo de eventos completados confirmado pelo backend de LMS, pipeline com outbox, retenção automática, recomendações semânticas, trilhas por competência, snapshots históricos de empresa, integração completa com People Intelligence V3, monitoramento e cargas de grande escala.  
**Infraestrutura:** não foi realizado commit ou deploy nesta entrega.
