/** Registry of existing authoritative projections. No independent recalculation. */
const source=(label,definition,unit='quantidade',period='estoque')=>({label,definition,unit,period})
// Versioned, centralized definitions: display names and calculations must not drift.
export const REPORT_DEFINITIONS=Object.freeze({
 'people.active':source('Pessoas ativas no escopo','Pessoas ativas vinculadas às empresas e à hierarquia autorizadas, com vínculo organizacional atual.'),
 'learning.enrollments':source('Matrículas','Matrículas existentes no escopo; o filtro de período usa, nesta ordem, conclusão, atribuição, criação ou última atualização disponível.'),
 'learning.completed':source('Matrículas concluídas','Matrículas com conclusão registrada (100%), inclusive legadas. A evidência é discriminada nos indicadores e no detalhamento; conclusão não equivale a prova de conhecimento.'),
 'learning.completion_legacy':source('Conclusões legadas','Matrículas concluídas antes do registro estruturado de evidências, sem inferir aprovação.'),
 'learning.completion_manual':source('Conclusões autodeclaradas','Conclusões cujo conteúdo foi confirmado pelo participante; podem incluir avaliação final exigida.'),
 'learning.completion_quiz':source('Conclusões por questionário','Conclusões com questionário corrigido no servidor, mais avaliações finais exigidas, quando houver.'),
 'learning.completion_scorm':source('Conclusões SCORM','Conclusões informadas pelo runtime em sessão autorizada, sem inferir aprendizagem independente.'),
 'learning.completion_assessed':source('Conclusões com avaliação final','Conclusões V11 que possuem ao menos uma avaliação final exigida e aprovada no servidor.'),
 'learning.completion_rate':source('Taxa de conclusão','Matrículas concluídas / matrículas elegíveis no recorte × 100.','%'),
 'learning.courses':source('Cursos alcançados','Cursos distintos com matrícula no escopo filtrado, não o catálogo global.'),
 'learning.avg_progress':source('Progresso médio','Média aritmética do progresso das matrículas válidas, sem inferir tempo estudado.','%'),
 'learning.score_avg':source('Nota média registrada','Média das notas numericamente registradas nas matrículas, sem imputar notas ausentes.','pontos'),
 'learning.expired':source('Matrículas vencidas','Matrículas não concluídas cujo prazo válido é anterior à data de referência.'),
 'learning.certificates':source('Conclusões certificadas','Certificados efetivamente emitidos para matrículas do escopo, não conclusões presumidas.'),
 'learning.tracks':source('Trilhas atribuídas','Atribuições de trilha explicitamente registradas para colaboradores no escopo.'),
 'dho.pdi_actions':source('Ações de PDI','Ações PDI 70–20–10 registradas, por responsáveis autorizados.'),
 'dho.pdi_completion':source('Taxa de execução de PDI','Ações de PDI concluídas / ações elegíveis registradas × 100.','%'),
 'dho.reviews_assigned':source('Avaliações atribuídas','Tarefas de avaliação associadas a ciclos do escopo autorizado.'),
 'dho.reviews_submitted':source('Avaliações respondidas','Tarefas de avaliação efetivamente enviadas.'),
 'dho.review_adherence':source('Aderência ao ciclo','Tarefas enviadas / tarefas atribuídas × 100.','%'),
 'dho.cycles':source('Ciclos de desempenho','Ciclos de avaliação registrados nas empresas autorizadas.'),
 'dho.meetings':source('Reuniões 1:1 registradas','Reuniões contendo ao menos um participante do escopo; notas confidenciais não são acessadas.'),
 'dho.feedback_requests':source('Solicitações de feedback','Solicitações registradas originadas ou recebidas por pessoas do escopo; não inclui texto privado.'),
 'dho.pulse_surveys':source('Pesquisas Pulse','Pesquisas publicadas com público autorizado; não representa taxa de respostas.'),
 'dho.pulse_mean':source('Percepção média Pulse','Média de pesquisas com pelo menos 7 respostas na audiência original, sem filtros capazes de identificar pessoas.','1 a 5'),
 'okr.objectives':source('Objetivos OKR','Objetivos registrados com vigência sobreposta ao recorte.'),
 'okr.active':source('OKRs ativos','Objetivos publicados atualmente ativos.'),
 'okr.closed':source('OKRs encerrados','Objetivos atualmente encerrados.'),
 'okr.checkins':source('Check-ins de OKR','Atualizações registradas durante o recorte.'),
 'okr.average':source('Progresso médio dos OKRs ativos','Média do progresso ponderado por objetivo ativo, com base no último check-in.','%'),
 'dho.pulse_response_rate':source('Taxa de participação Pulse','Somente pesquisas com pelo menos 7 respostas, calculada por convites da audiência original.','%')
})
export const HISTORICAL_DEFINITIONS=Object.freeze({
 'history.completions':{label:'Conclusões com vínculo reconciliado',definition:'Matrículas distintas concluídas no período e atribuíveis ao vínculo vigente na conclusão, com acesso atual autorizado.',unit:'quantidade',source:'system/state-v1 + org_assignment_history_v11',version:1},
 'history.unresolved':{label:'Conclusões sem vínculo reconciliado',definition:'Conclusões não atribuíveis, sem data suficiente ou com divergência entre fontes; somente administração global, sem filtros organizacionais.',unit:'quantidade',source:'system/state-v1 + org_assignment_history_v11',version:1},
 'history.coverage':{label:'Cobertura de reconciliação',definition:'Conclusões reconciliadas / conclusões elegíveis, incluindo não reconciliadas, × 100; apenas visão global sem filtros organizacionais.',unit:'%',source:'system/state-v1 + org_assignment_history_v11',version:1}
})
// The provider owns the arithmetic and access policy; this registry owns identifiers and interpretation.
const integrated={
 lxp:{activePeople:['Pessoas com interações','Pessoas distintas com eventos no período'],catalogViews:['Visitas ao catálogo','Eventos de visualização do catálogo'],searches:['Pesquisas','Eventos de pesquisa'],launchRequests:['Solicitações de abertura','Eventos de solicitação; não são inícios comprovados'],bookmarks:['Favoritos atuais','Favoritos no estoque atual'],ratings:['Avaliações de conteúdo','Avaliações no estoque atual'],averageRating:['Nota média de conteúdo','Média de avaliações atuais','1 a 5']},
 assessments:{publishedOrArchivedForms:['Avaliações publicadas ou arquivadas','Formulários atualmente publicados ou arquivados'],attempts:['Tentativas','Tentativas submetidas no período'],participantAssessments:['Pessoas por formulário','Pares distintos de pessoa e formulário com tentativa'],passed:['Aprovações','Pares pessoa/formulário com pelo menos uma aprovação'],passRate:['Taxa de aprovação','Pares aprovados / pares avaliados × 100','%'],averageBestScore:['Média das maiores notas','Média da melhor nota por pessoa e formulário','%']},
 pulseSafe:{eligibleSurveys:['Pesquisas no recorte','Pesquisas com vigência sobreposta'],qualifiedSurveys:['Pesquisas elegíveis','Pesquisas encerradas com ao menos sete respostas'],suppressedSurveys:['Pesquisas protegidas','Pesquisas abertas ou abaixo do limiar'],invited:['Convites elegíveis','Convites nas pesquisas elegíveis'],respondents:['Participações elegíveis','Participações nas pesquisas elegíveis'],responseRate:['Participação Pulse Seguro','Participações / convites elegíveis × 100','%']},
 kirkpatrick:{qualifiedLearningCohorts:['Coortes N2 elegíveis','Coortes empresa/curso com sete ou mais pares de pré/pós-teste'],pairedLearningRecords:['Pares pessoa/curso N2','Pares de notas nas coortes elegíveis'],meanLearningChangePoints:['Variação média N2','Diferença média entre melhores notas pós e pré por pessoa/curso; equivalência pedagógica não comprovada automaticamente','pontos percentuais'],qualifiedReactionCohorts:['Coortes N1 elegíveis','Coortes empresa/curso com pelo menos sete respostas'],reactionResponses:['Respostas N1','Respostas nas coortes elegíveis'],meanClarity:['Clareza N1','Média ponderada de clareza nas coortes elegíveis','1 a 5'],meanRelevance:['Relevância N1','Média ponderada de relevância nas coortes elegíveis','1 a 5'],meanApplicability:['Aplicabilidade N1','Média ponderada de aplicabilidade nas coortes elegíveis','1 a 5'],nps:['NPS N1','100 × (promotores − detratores) / respondentes elegíveis','pontos'],qualifiedTransferCohorts:['Coortes N3 elegíveis','Coortes com pelo menos sete respostas'],transferResponses:['Respostas N3','Respostas submetidas nas coortes elegíveis'],meanApplication:['Aplicação N3','Média de aplicação nas coortes elegíveis','1 a 5'],recordedBusinessObservations:['Observações N4','Registros de resultados observados; não comprovam causalidade']}}
const sources={lxp:'lxp_discovery_events / bookmarks / ratings',assessments:'assessment_v6_forms / attempts',pulseSafe:'pulse_v5_surveys / invites',kirkpatrick:'kirkpatrick_reactions_v7 / transfer / outcomes / assessment_v6_attempts'}
const catalog=Object.freeze([
 ...Object.entries(REPORT_DEFINITIONS).map(([code,v])=>({code,...v,source:code.startsWith('okr.')?'lxp/v2/state.okrsV13':code==='learning.certificates'?'evolution/v1/issued':code.startsWith('dho.')?'lxp/v2/state':'system/state-v1',temporalBasis:'carteira_atual',version:1})),
 ...Object.entries(HISTORICAL_DEFINITIONS).map(([code,v])=>({code,...v,temporalBasis:'ocorrencia_historica'})),
 ...Object.entries(integrated).flatMap(([provider,values])=>Object.entries(values).map(([key,[label,definition,unit='quantidade']])=>({code:provider+'.'+key,label,definition,unit,source:sources[provider],temporalBasis:['bookmarks','ratings','averageRating','publishedOrArchivedForms'].includes(key)?'estoque_atual':provider==='pulseSafe'?'pesquisa_vigente':'periodo_com_escopo_atual',version:1})))
])
export const semanticDefinitions=()=>catalog.map(x=>({...x}))
export function semanticProjection(current,historical,intelligence,filters={}){
 const values=new Map([...current,...(historical?.metrics||[])].map(m=>[m.code,m]))
 const narrow=filters.department||filters.person||filters.course
 return catalog.map(def=>{
  let m=values.get(def.code);const [provider,key]=def.code.split('.');const source=intelligence?.sources?.[provider]
  if(Object.hasOwn(integrated,provider)){const v=source?.available?source.metrics?.[key]:null;m={value:v??null,reason:narrow?'Recorte detalhado não suportado por esta fonte.':source?.reason||(!intelligence?'Fonte ou período indisponível.':null)}}
  // Avoid implying a course filter affects unrelated DHO/person metrics.
  if(filters.course&&(def.code.startsWith('dho.')||def.code.startsWith('okr.')||def.code.startsWith('people.')))m={value:null,reason:'Filtro de curso não se aplica à métrica.'}
  const value=typeof m?.value==='number'&&Number.isFinite(m.value)?m.value:null
  return {...def,value,available:value!==null,numerator:m?.numerator??null,denominator:m?.denominator??null,reason:value===null?(m?.reason||m?.note||'Dados insuficientes ou fonte indisponível.'):null}
 })
}
