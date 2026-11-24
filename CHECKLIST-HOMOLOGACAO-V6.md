# Checklist de homologação — Learning 4.0 V5 + V6

## Proteção antes de iniciar

- [ ] Produção `main`, sem mudança pendente para `homologacao-dna`.
- [ ] Backup consistente da homologação criado e restauração testada.
- [ ] Commit HEAD da homologação conferido.
- [ ] Build e testes completos no Railway aprovados; sem erros no startup.

## Learning e SCORM: regressão obrigatória

- [ ] SCORM que já funcionava abre com CSS, imagens e scripts.
- [ ] Salva progresso parcial, fecha e retoma no ponto correto.
- [ ] Conclusão é persistida somente quando o SCO/LMS a comunica.
- [ ] Trilha sequencial continua bloqueando pré-requisitos.
- [ ] Certificados existentes não desaparecem ou duplicam.

## Pulse Seguro V5

- [ ] RH cria pesquisa para uma empresa autorizada, com 7+ pessoas.
- [ ] Um participante responde; a mesma conta não responde duas vezes.
- [ ] Outro CNPJ não consulta pesquisa ou resultados.
- [ ] Média fica oculta antes de encerramento e com menos de sete respostas.
- [ ] Encerramento com 7+ respostas fornece apenas dados agregados, sem identificadores.
- [ ] Pesquisas legadas permanecem explicitamente identificadas como dados de origem nominativa.

## Avaliações educacionais V6

- [ ] RH cria rascunho com perguntas e alternativas.
- [ ] Alteração de rascunho incrementa a revisão; revisão desatualizada retorna erro.
- [ ] Publicação bloqueia a edição retroativa do gabarito.
- [ ] Pessoa não matriculada, de outra empresa ou em etapa bloqueada não consegue responder.
- [ ] Colaborador não recebe `correctIndex` no GET do formulário.
- [ ] Correção, nota mínima e limite de tentativas funcionam após refresh.
- [ ] Duplo envio com mesmo `attemptId` não gera nova tentativa.
- [ ] Duplicar cria novo rascunho sem modificar resultados existentes.
- [ ] Arquivar preserva histórico de notas e relatórios.
- [ ] Exportação CSV contém apenas pessoas autorizadas.

## People Intelligence V6

- [ ] LXP conta eventos de abertura sem tratá-los como curso concluído.
- [ ] Métricas V6 usam empresa e período efetivos.
- [ ] Gestão de equipe pequena tem agregados suprimidos conforme limiar.
- [ ] Líder não acessa resultados Pulse corporativos fora de sua permissão.
- [ ] Períodos sem fonte aparecem indisponíveis, não com números falsos.
- [ ] Resultados batem com contagem das tabelas autoritativas em teste de reconciliação.

## Resultado final

- [ ] Mobile e desktop sem bloqueadores de navegação.
- [ ] Backup e rollback documentados e testados.
- [ ] Aprovação funcional do RH e responsável por segurança.
- [ ] Só depois: considerar PR para produção mediante autorização explícita.
