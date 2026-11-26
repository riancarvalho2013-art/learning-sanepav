# Esteira de evolução orientada a produto — Learning Academy

A central de ajuda Qulture Rocks é usada como referência funcional pública, sem copiar código, identidade visual ou interfaces proprietárias. A plataforma mantém sua própria linguagem visual e regras de negócio. Esta matriz separa entregas efetivas de funcionalidades ainda em desenvolvimento.

## V27.1 — relatório de OKRs entregue

A área de OKRs ganhou um painel de exportação Excel no recorte autorizado. Pode filtrar por escopo selecionado na interface, empresa (somente se permitido pela API), situação e período de sobreposição do objetivo. O histórico das atualizações dos objetivos selecionados permanece completo apenas quando autorizado.

| Aba | Dados reais exportados |
|---|---|
| Objetivos | ID, nome, nível, empresa, departamento, responsável, datas, situação, progresso, quantidade de KRs e datas de auditoria quando disponíveis |
| Resultados-chave | ID de objetivo e KR, nome, responsável do objetivo, unidade, base, meta, valor atual, peso, progresso, quantidade de atualizações e última atualização autorizada |
| Atualizações | IDs, data de referência, data de registro, valor, unidade, comentário e autor quando a API permite |
| Metadados | Data de geração, recortes, contagem, critérios, limites e privacidade |

Uma linha por objetivo, uma por KR e uma por check-in autorizado: não há duplicação artificial por contribuidor nem médias falsas. O XLSX usa células textuais, sem fórmula introduzida por texto de usuário, filtros automáticos e cabeçalho congelado. O histórico não autorizado não é reconstruído nem exportado. O download ocorre após consultar novamente a API autenticada. Isso não substitui a segurança do servidor; relatórios devem ser armazenados em local corporativo autorizado.

## Mapa de evolução após V27.1 (não entregue)

| Prioridade | Frente | Requisito e critério de aceite |
|---|---|---|
| P0 | RBAC | Revisar a exceção atual da Diretoria (OKRs corporativos e departamentos da própria empresa) em relação à regra do usuário de visão consolidada somente ADM. Testar API, relatórios, busca, exportação e acesso a arquivos com cinco perfis. Nenhuma alteração de perfil feita nesta versão. |
| P0 | Isolamento comercial | Administrador do SaaS separado de admin do cliente; autorização por tenant em todos os domínios; testes entre empresas e revogação de sessão. |
| P0 | Infraestrutura | Homologar bucket privado, backup independente e recuperação; separar mídia, ampliar upload de cursos em partes com retomada, cotas por tenant, verificação de arquivo e limites de SCORM. |
| P0 | Engenharia | Checkout integral, suíte Node 24, CI reproduzível com dependências travadas, testes adversariais, logs de erros e revisão de vulnerabilidades. |
| P1 | OKRs — gestão de ciclos | Ciclos nomeados com status, datas, configuração e encerramento controlado; objetivos vinculados a ciclo de forma não destrutiva; status e histórico de aprovação, sem inventar dados retroativos. |
| P1 | OKRs — colaboração | Responsáveis e contribuidores por KR, descrição, tipos de métrica, pesos, metas intermediárias, alinhamento estratégico, tarefas, entregáveis, anexos e permissões específicas. |
| P1 | OKRs — relatórios | Abas de projetos, tarefas, metas parciais e participantes ativos/inativos após modelagem; progresso e notas apenas quando definidos; auditoria de exportação e registro de referência retroativa. |
| P1 | Desempenho | Relatório individual com resumo, médias por relacionamento, tópicos, perguntas e comentários segundo regras de liberação; resultados por equipe e avaliação; download e PDI vinculado; separar informações identificáveis de avaliações protegidas. |
| P1 | Avaliações | Cronograma, indicação/validação de avaliadores, rascunho, acompanhamento, calibração auditada, publicação individual e configurações de privacidade. |
| P1 | LMS/LXP | Relatórios de matrícula, acessos, conclusão, prazos, certificações, horas, trilhas, aprendizagem e evidências SCORM; distinguir acesso, conclusão e aprovação. |
| P1 | People Analytics | Dicionário de métricas, filtros coerentes, drill-down autorizado, histórico temporal, exportação com mesma definição e reconciliação; suppressão de grupos pequenos em pesquisas. |
| P1 | Frontend | Centralizar tokens, componentes, modais, tabelas e estados vazios; substituir gradualmente CSS legado; QA visual autenticado de todas as páginas, perfis, zoom e dispositivos. |
| P1 | Banco | Avaliar concorrência real e elaborar migração PostgreSQL com mapeamento, contagens, hashes, teste de reversão e reconciliação; preservar SQLite até aprovação. |
| P1 | Marca | Remover endereços e textos Sanepav hardcoded; APP_ORIGIN por ambiente; personalização independente por tenant e e-mail real testado. |
| P2 | Operação comercial | Provisionamento de cliente, assinatura, cobrança, limites, suporte, contratos, LGPD, documentação e piloto pago condicionado ao go/no-go. |

## Referências públicas usadas

- Qulture Rocks, Exportar relatórios de OKRs: https://help.qulture.rocks/informa%C3%A7%C3%B5es-contidas-no-relat%C3%B3rio
- Qulture Rocks, Novo Relatório Individual de Performance: https://help.qulture.rocks/novo-relat%C3%B3rio-individual-de-performance
- Qulture Rocks, Relatórios de avaliações: https://help.qulture.rocks/relat%C3%B3rios-de-avalia%C3%A7%C3%B5es-central-de-conhecimento-qulture.rocks
- Qulture Rocks, Configurar e liberar relatórios individuais: https://help.qulture.rocks/p%C3%A1gina-1-do-relat%C3%B3rio-tabela-de-m%C3%A9dias
- Qulture Rocks, Exportando dados: https://help.qulture.rocks/exportando-dados-da-plataforma-central-de-conhecimento-qulture.rocks

A referência pública documenta múltiplas entidades, ciclos e colunas que não existem na mesma forma no modelo atual do Learning Academy. Não foram criadas abas vazias fingindo funcionalidades. A próxima evolução deve implementar o modelo de negócio e autorização correspondentes antes de adicionar campos aos relatórios.
