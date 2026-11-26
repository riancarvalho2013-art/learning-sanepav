# Operação, evidências e testes

## Backup e DR
Alvo de validação (não SLA): RPO 24h e RTO 4h. Antes de cada mudança crítica, snapshot consistente SQLite, cópia independente e backup de objetos externos e chaves necessárias à restauração. Verificar que a chave está guardada separadamente, com acesso restrito; não versionar segredos. Definir retenção proposta de 7 diários, 4 semanais e 12 mensais mediante política e orçamento. Não ativar exclusão automática antes de validar retenção jurídica e recuperação. Restaurar em serviço/volume isolados, conferir hash/integridade do banco, mídia, permissões e fluxos. Medir tempos. Logs de backup sem dados pessoais. A V27 dispõe de scheduler opcional; não afirmar que está ativo. Não usar somente backup no mesmo dispositivo.

## Incidentes
Identificar e classificar; conter (suspender acesso/integrar revogação, isolar serviço quando necessário), preservar logs e snapshots com acesso restrito, investigar escopo e causa, corrigir, rotacionar segredos comprometidos, restaurar ambiente verificado, documentar impacto e decisões, comunicar responsáveis de segurança/jurídico para avaliar obrigações LGPD e notificações. Ações em produção dependem de autorização; não apagar evidências. A regra de logs HTTP V28 não substitui trilhas auditáveis de atos de usuários.

## Testes realizados em 26/11/2026
- Ambiente local Node v22.16.0. A rede do container não resolveu github.com, portanto o checkout integral não foi possível. Os arquivos atuais foram lidos pela integração GitHub. Node 24 não estava disponível localmente.
- `node --check serve.mjs` aprovado.
- `node verify-security-v28.mjs`: PASS 64 verificações. Funções reais do servidor e servidor HTTP iniciado localmente com handlers de negócio simulados. Casos: origem ausente/cross-site, host/authority, métodos, SCORM preflight, health, cabeçalhos, logs sem identificadores, contenção de autenticação, expiração e adulteração do token de ativação, cookie não contém chave, 413.
- `node verify-enterprise-v27.mjs`: PASS 58 verificações no pacote local V27.1. Armazenamento simulado, SQLite local, integridade, recuperação, privacidade, filtros, Excel e manifesto. Não demonstra acesso ao S3 real nem ao banco real.
- Total 122 verificações isoladas nas duas suítes; não afirmar 122 testes E2E ou segurança integral.
- Não executado: `npm test` completo Node 24, build Docker, Actions remoto, Railway logs, navegador autenticado, varredura histórica de segredos, scanners externos, pen test, teste de carga e restauração real. A suíte completa e ambas as novas verificações estão no Dockerfile fornecido; workflow usa Dockerfile. O teste do servidor não substitui os testes de negócio.

## Segurança operacional
Variáveis: `SETUP_KEY` (segredo já existente; não compartilhar); `LEARNING_ALLOWED_HOSTS` (opcional, lista de host exato); `LEARNING_LOG_REQUESTS` (opcional booleano textual), `LEARNING_DB` (caminho persistente atual); `APP_ORIGIN`, `EMAIL_FROM`, `RESEND_API_KEY` (existentes; revisar origem e segredos); variáveis de mídia e backup V27 conforme guia anterior. Nenhum valor real foi consultado. Não reutilizar chaves entre ambientes. Healthcheck não comprova disponibilidade de buckets externos.

Referência de projeto: requisitos do documento enviado (OWASP Top 10, API Security, ASVS, CIS). Nenhuma certificação nem validação formal contra versão específica foi executada. Nenhuma cobrança ou contratação realizada.
