# Auditoria comparativa de evolução — Open edX x Learning Sanepav

Data-base do levantamento: 23/11/2026.  
Origem: `https://github.com/openedx/openedx-platform` na árvore `b9e3b3b8662b539e200f8acf68d42431de032320` (`master`). Foram inventariados **11.481 caminhos** e **9.290 arquivos regulares** na árvore retornada. Isso é um **inventário amplo com leitura focal de módulos relevantes**, não uma revisão linha a linha de todos os arquivos.

## Licença e risco de migração

O arquivo [LICENSE](https://github.com/openedx/openedx-platform/blob/master/LICENSE) e o [README](https://github.com/openedx/openedx-platform/blob/master/README.rst) informam a licença **GNU AGPL-3.0**. O repositório usa Python/Django, Studio/CMS, LMS e microfrontends React, não o mesmo runtime Node/SQLite do Learning Sanepav. Copiar código dependente de Django/React não entrega funções operantes; reproduzir módulos também pode gerar obrigações de licença AGPL. Por isso, o pacote contém código original escrito para a arquitetura Sanepav, inspirado apenas em capacidades de produto e decisões gerais de design.

## Matriz de recursos e execução

| Área | Referência Open edX consultada | Gap identificado no Learning Sanepav | Neste pacote | Próximo incremento recomendado |
| --- | --- | --- | --- | --- |
| Autoria de cursos | [course_outline_service.py](https://github.com/openedx/openedx-platform/blob/master/cms/djangoapps/contentstore/rest_api/v2/course_outline_service.py), [XBlock authoring](https://github.com/openedx/openedx-platform/tree/master/cms/lib/xblock) | Curso simples e trilha de 1 nível; sem capítulos e seções relacionais | Melhora apresentação e navegação; reutiliza trilhas existentes | Modelos curso → módulo → aula → unidade e editor de ordem/visibilidade |
| Aprendizagem sequencial | [learning_sequences/models.py](https://github.com/openedx/openedx-platform/blob/master/openedx/core/djangoapps/content/learning_sequences/models.py) | Pré-requisitos implementados por missão, não em estrutura relacional ampla | Preserva trava e progresso existentes | Sequência de aprendizado normalizada, testes de desbloqueio e versões publicadas |
| Notas e gradebook | [course_grade.py](https://github.com/openedx/openedx-platform/blob/master/lms/djangoapps/grades/course_grade.py), [gradebook_views.py](https://github.com/openedx/openedx-platform/blob/master/lms/djangoapps/grades/rest_api/v1/gradebook_views.py) | Não havia visão de notas e progresso em tabela amigável | **Caderno de notas** com busca, agregações de notas existentes e CSV | Tentativas, critérios, pesos, rubricas, banco de questões e aprovação parametrizada |
| Certificação | [certificates/models.py](https://github.com/openedx/openedx-platform/blob/master/lms/djangoapps/certificates/models.py), [certificate API](https://github.com/openedx/openedx-platform/blob/master/cms/djangoapps/contentstore/rest_api/v1/views/certificates.py) | Não existia certificado emitido e validável por trilha | **Emissão idempotente, verificação pública limitada, template/fundo por trilha, impressão** | PDF nativo, revogação, assinatura criptográfica, QR e auditoria de versões |
| Branding e empresas | Módulos de configuração por site do ecossistema Open edX | Learning com logo fixa e tema global | **Logo, nome, cores por empresa autorizada** | Temas completos, domínio/URL por empresa e segregação empresarial de conteúdo |
| Acompanhamento | [courseware/models.py](https://github.com/openedx/openedx-platform/blob/master/lms/djangoapps/courseware/models.py) | Matrículas e progresso existem, mas interface de engajamento genérica | **Dashboard pessoal DNA** | Planos e métricas por período, abandono, risco e recomendações |
| Administração | [instructor_task](https://github.com/openedx/openedx-platform/tree/master/lms/djangoapps/instructor_task) | Gestão operacional sem operações administrativas completas | Exclusão segura apenas de curso sem vínculos | Importação em massa, filas, reprocessamento, logs e limpeza binária |
| Integração e padrões | `openedx/core` e APIs do CMS/LMS | API atual única, SCORM legado simplificado | Nenhum transplante de bibliotecas | LTI 1.3, SCORM 1.2/2004 testado, xAPI e trilhas interoperáveis |
| Acessibilidade e UX | Microfrontends e design system separados do monólito | Layout e ícones abstratos sem semântica | Novo design com SVGs rotulados, navegação mais consistente e responsividade | Auditoria WCAG 2.2 com leitor de tela, teclado e contraste |

## Inventário técnico resumido da árvore Open edX

Contagens de arquivos sob diretórios principais na árvore consultada:

- `cms/djangoapps/contentstore/`: 383 arquivos.
- `lms/djangoapps/grades/`: 123 arquivos.
- `lms/djangoapps/certificates/`: 112 arquivos.
- `lms/djangoapps/courseware/`: 118 arquivos.
- `lms/djangoapps/instructor_task/`: 60 arquivos.
- `openedx/core/djangoapps/content/`: 175 arquivos.
- `openedx/features/`: 230 arquivos.

O módulo [learning_sequences/models.py](https://github.com/openedx/openedx-platform/blob/master/openedx/core/djangoapps/content/learning_sequences/models.py) recomenda armazenamento relacional normalizado e camada de API separada. A base atual Sanepav usa parte do domínio em JSON; uma migração dessa estrutura exigirá planejamento, migração reversível, índices e preservação integral de matrículas.

## Decisão de arquitetura

**Preservar Node.js e SQLite** agora. Evitar uma substituição total pelo Open edX ou uma mistura de dependências Python/Django. Reproduzir primeiro as jornadas mais valiosas no fluxo corporativo Sanepav/Beta Clean, com segurança, testes e interfaces claras; preparar depois a evolução estrutural do domínio de cursos/avaliações com migração de dados e compatibilidade.

**Prioridades propostas para fase seguinte:** (1) gestão completa das unidades de conteúdo; (2) formulários de avaliação com banco de questões e tentativas; (3) geração de PDF nativo e revogação; (4) segregação de catálogo por empresa; (5) integração SCORM mais completa; (6) calendário, turmas e presença; (7) analytics Kirkpatrick N1–N4 e dashboards DHO.
