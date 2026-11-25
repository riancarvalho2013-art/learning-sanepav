# Learning Academy — evolução visual V21 (em homologação)

Base preservada: `f4e4f9687bdc26198230383706cb85428d89d47b`, branch `homologacao-dna`. Desenvolvimento isolado em `work/learning-academy-design-v21`.

## Implementado

Camada autenticada de tokens e componentes a partir do pacote aprovado: sidebar navy, seleção azul, ícones SVG currentColor, banners com ondas/seta, canvas claro, cards, indicadores, filtros, tabelas, progresso, campos, uploads e modal principal. Assets SVG originais separados, locais e registrados no manifesto. Ícones adicionados sem substituir handlers, controles, textos reais ou regras de permissão. Layouts responsivos e foco visível; preferência por movimento reduzido. Player recebe acabamento no contêiner; iframe/conteúdo SCORM intacto. Login V20 intacto. Logos e variáveis de marca das empresas mantidos. Confirmações e seletor de arquivo nativos continuam nativos.

## Arquivos e dados

`web-design-v21.css/js`, `design-v21/*.svg`, `asset-manifest.json`, `web-index.html`; removido apenas o `!important` do background de botão primário em `web-lxp-v2.css` para permitir cascata consistente. `DESIGN-COVERAGE-V21.json` cruza o inventário aprovado com handlers reais; pendências explícitas. Nenhuma mudança de backend, endpoint, banco, migração, volume, sessão, permissão ou provedor externo.

## Testes e limites

Build: 38 assets verificados. Suíte completa do repositório passou (44 programas de verificação após build), incluindo autenticação/recuperação/convites, escopo de empresas, aprendizagem, SCORM 1.2/2004, certificados, PDI, OKR, Pulse, desempenho e organograma. Testes usam dados isolados; entrega de e-mail simulada conforme suíte existente. Após o ajuste final de CSS, a suíte deve ser repetida antes do commit.

**Não homologado visualmente.** A sessão disponível em https://learningacademy.up.railway.app/ está desautenticada. Não foram realizados screenshots internos, testes manuais por papel, leitor de tela ou validação nos quatro viewports solicitados. O navegador local e a emulação de DevTools foram bloqueados anteriormente pela política do ambiente; nenhuma tentativa de contornar essas restrições. Não classificar a cobertura como 100%. A matriz separa estilo implementado de validação visual pendente e registra os handlers que ainda precisam de revisão individual.

## Próxima validação e promoção

Entrar com conta de teste autorizada na homologação. Validar cada linha da matriz, navegação/fechamento/foco/erros/envio/duplo envio e persistência; gerar capturas sem dados pessoais em 1440×900, 1920×1080, 1024×768 e 390×844 em navegador que permita esses tamanhos. Conferir contraste e semântica dos gráficos e 9Box. Corrigir inconsistências, revisar alterações e somente então propor promoção. **Produção não autorizada nesta entrega.** Rollback visual: reverter o commit/PR V21 em homologação; nenhum rollback de banco necessário.
