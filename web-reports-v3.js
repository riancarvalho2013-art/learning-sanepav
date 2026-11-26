/* Learning Sanepav 3.0 — Reports center. Existing application extension. */
(() => {
'use strict'
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const n=x=>x==null||!Number.isFinite(Number(x))?'Não disponível':Number(x).toLocaleString('pt-BR',{maximumFractionDigits:2})
const tabs=[['Geral','Carteira atual'],['Semântico','Indicadores unificados'],['Histórico','Histórico reconciliado'],['LMS','Aprendizagem'],['DHO','DHO e LXP'],['DNA','Inteligência integrada'],['Pessoas','Pessoas e áreas'],['Matrículas','Detalhamento'],['Dicionário','Dicionário']]
const groups={Geral:['people.active','learning.enrollments','learning.completed','learning.completion_rate','learning.courses','learning.certificates','dho.reviews_submitted','dho.pdi_actions','dho.pulse_mean'],LMS:['learning.enrollments','learning.completed','learning.completion_legacy','learning.completion_manual','learning.completion_quiz','learning.completion_scorm','learning.completion_assessed','learning.completion_rate','learning.courses','learning.avg_progress','learning.score_avg','learning.expired','learning.certificates','learning.tracks'],DHO:['dho.pdi_actions','dho.pdi_completion','dho.cycles','dho.reviews_assigned','dho.reviews_submitted','dho.review_adherence','dho.meetings','dho.feedback_requests','dho.pulse_surveys','dho.pulse_mean','dho.pulse_response_rate']}
let savedViews=null,reportContextInitialized=false,lastHeaderCompany=''
let semanticResult=null;let historyResult=null;let integrated=null,integratedError='';let section='Geral', reportState={company:'',department:'',person:'',course:'',from:'',to:''},catalog=null,last=null,offset=0,token=0
const $r=()=>document.getElementById('inside')
const query=()=>new URLSearchParams(Object.entries(reportState).filter(([k,v])=>v)).toString()
const filters=()=>query()?'?'+query():''
const org=()=>typeof organizationData==='object'&&organizationData?organizationData:{companies:[],departments:[],people:[]}
const firstCompany=()=>typeof organizationCompany==='string'?organizationCompany:''
const departmentChoices=()=>org().departments.filter(x=>!reportState.company||x.company_id===reportState.company)
const metricCard=m=>'<article class="r3-card"><div class="r3-card-label">'+esc(m.label)+'</div><strong class="r3-number">'+(m.available?n(m.value):'—')+(m.unit==='%'&&m.available?'<small>%</small>':'')+'</strong><p>'+esc(m.available?'Fonte: '+m.source:m.note||m.reason||'Sem dados suficientes para o cálculo')+'</p></article>'
const opt=(v,label,selected)=>'<option value="'+esc(v)+'"'+(selected===v?' selected':'')+'>'+esc(label)+'</option>'
const form=()=>'<form id="r3-filters" class="r3-filters"><label>Empresa<select name="company">'+opt('','Todas autorizadas',reportState.company)+org().companies.map(x=>opt(x.id,x.name,reportState.company)).join('')+'</select></label>'+ 
 '<label>Departamento<select name="department">'+opt('','Todos',reportState.department)+departmentChoices().map(x=>opt(x.id,x.name,reportState.department)).join('')+'</select></label>'+ 
 '<label>De<input type="date" name="from" value="'+esc(reportState.from)+'"></label><label>Até<input type="date" name="to" value="'+esc(reportState.to)+'"></label>'+ 
 '<div class="r3-filter-actions"><button type="submit" class="r3-btn r3-primary">Aplicar filtros</button><button type="button" data-r3="reset" class="r3-btn">Limpar</button></div></form>'
const savedToolbar=()=>'<div class="r3-saved"><label>Minhas visões salvas<select id="r3-view-picker">'+opt('','Escolher filtros salvos','')+(savedViews||[]).map(v=>opt(v.id,v.name,'')).join('')+'</select></label><button type="button" data-r3="apply-view" class="r3-btn">Aplicar visão</button><button type="button" data-r3="save-view" class="r3-btn">Salvar visão</button><button type="button" data-r3="delete-view" class="r3-btn">Excluir visão</button></div><dialog id="r3-save-dialog" class="r3-dialog"><form id="r3-saveform"><h2>Salvar visão personalizada</h2><p>Guarde sua seleção de empresa, período e departamento.</p><label>Nome da visão<input name="viewname" required minlength="2" maxlength="80" placeholder="Ex.: Resultado trimestral de T&D"></label><div><button type="button" class="r3-btn" data-r3="close-dialog">Cancelar</button><button class="r3-btn r3-primary" type="submit">Salvar</button></div></form></dialog>'
const top=(subtitle='Indicadores gerados com dados reais da plataforma.')=>'<section class="r3-hero"><div><span class="r3-overline">DNA DO DESENVOLVIMENTO / PEOPLE INTELLIGENCE</span><h1>Central de relatórios</h1><p>'+esc(subtitle)+'</p></div></section>'+
 '<nav class="r3-tabs" role="tablist" aria-label="Módulos analíticos">'+tabs.map(([id,label])=>'<button type="button" role="tab" aria-selected="'+(section===id?'true':'false')+'" class="r3-tab'+(section===id?' is-active':'')+'" data-r3="tab" data-id="'+esc(id)+'">'+esc(label)+'</button>').join('')+'</nav>'+savedToolbar()+form()
const info=message=>'<div class="r3-empty" role="status">'+esc(message)+'</div>'
function value(code){return last?.metrics?.find(m=>m.code===code)}
function chart(){const d=(last?.byCourse||[]).slice(0,8)
 if(!d.length)return info('Ainda não existem matrículas no recorte selecionado.')
 return '<div class="r3-chart">'+d.map(x=>'<div class="r3-chart-row"><div class="r3-chart-label"><span>'+esc(x.title)+'</span><b>'+n(x.completionRate)+'%</b></div><div class="r3-track"><div style="width:'+Math.max(0,Math.min(100,x.completionRate||0))+'%"></div></div><small>'+n(x.completed)+' de '+n(x.enrollments)+' matrículas concluídas</small></div>').join('')+'</div>'}
function card(title,html,caption=''){return '<section class="r3-panel"><header><h2>'+esc(title)+'</h2>'+(caption?'<small>'+esc(caption)+'</small>':'')+'</header>'+html+'</section>'}
function metrics(codes){return '<div class="r3-metrics">'+codes.map(code=>value(code)).filter(Boolean).map(metricCard).join('')+'</div>'}
function table(headers,rows){return '<div class="r3-table-scroll"><table><thead><tr>'+headers.map(t=>'<th scope="col">'+esc(t)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'}
function courseTable(){const a=last?.byCourse||[];return a.length?table(['Curso','Trilha','Tipo','Matrículas','Concluídas','Conclusão'],a.map(x=>'<tr><td><b>'+esc(x.title)+'</b></td><td>'+esc(x.track)+'</td><td>'+esc(x.type)+'</td><td>'+n(x.enrollments)+'</td><td>'+n(x.completed)+'</td><td>'+n(x.completionRate)+'%</td></tr>')):info('Nenhum curso com matrícula no escopo.')}
function deptTable(){const depts=last?.departments||[],names=new Map(org().departments.map(x=>[x.id,x.name]));return depts.length?table(['Departamento','Pessoas','Matrículas','Conclusões','Taxa de conclusão'],depts.map(x=>'<tr><td><b>'+esc(names.get(x.id)||x.label)+'</b></td>'+(x.suppressed?'<td colspan="4">Dados suprimidos: menos de cinco pessoas</td>':'<td>'+n(x.people)+'</td><td>'+n(x.enrollments)+'</td><td>'+n(x.completed)+'</td><td>'+n(x.completionRate)+'%</td>')+'</tr>')):info('Nenhuma pessoa encontrada no escopo autorizado.')}
const actions=()=>'<div class="r3-actions"><a class="r3-btn r3-primary" href="/api/reports/v3/export.csv'+esc(filters())+'" download>Exportar matrículas CSV</a><a class="r3-btn" href="/api/reports/v3/export.xlsx'+esc(filters())+'" download>Exportar Excel XLSX</a><button type="button" class="r3-btn" data-r3="print">Imprimir / salvar PDF</button></div>'
const annotations=()=>'<aside class="r3-disclaimer"><b>Como interpretar:</b> '+esc((last?.caveats||[]).join(' '))+'</aside>'

function dnaSource(source,title,rows){
 if(!source?.available)return card(title,info(source?.reason||'Fonte indisponível.'))
 return card(title,'<div class="r3-metrics">'+rows.map(([k,label,unit])=>'<article class="r3-card"><div class="r3-card-label">'+esc(label)+'</div><strong class="r3-number">'+(source.metrics?.[k]===null||source.metrics?.[k]===undefined?'—':n(source.metrics[k])+(unit||''))+'</strong><p>Fonte: '+esc(source.source||'Dados autorizados')+'</p></article>').join('')+'</div>')
}
function integratedView(){
 if(reportState.department||reportState.person||reportState.course)return info('Esta visão apresenta apenas agregados autorizados por empresa e período. Limpe os filtros de departamento, pessoa e curso para consultar Pulse com segurança.')
 if(integratedError)return info('Inteligência integrada temporariamente indisponível: '+integratedError+' . Os relatórios principais continuam disponíveis.')
 if(!integrated)return info('Consultando dados de interação, avaliações e pesquisas…')
 const src=integrated.sources||{}
 return '<aside class="r3-disclaimer"><strong>Critério de privacidade:</strong> fontes não disponíveis e amostras pequenas não são transformadas em zeros. Nenhuma resposta individual de pesquisa será exibida.</aside>'+ 
 dnaSource(src.lxp,'Descoberta e engajamento LXP',[["activePeople","Pessoas com interações"],["catalogViews","Visitas ao catálogo"],["searches","Pesquisas realizadas"],["launchRequests","Solicitações de abertura de aula"],["bookmarks","Favoritos atuais"],["ratings","Avaliações de conteúdo"],["averageRating","Nota média"," / 5"]])+ 
 dnaSource(src.assessments,'Avaliações educacionais',[["publishedOrArchivedForms","Avaliações publicadas ou arquivadas"],["participantAssessments","Avaliações respondidas por pessoa"],["attempts","Tentativas no período"],["passed","Aprovações por pessoa e formulário"],["passRate","Taxa de aprovação","%"],["averageBestScore","Maior nota média","%"]])+ 
 dnaSource(src.pulseSafe,'Pulse Seguro V5 · Dados agregados',[["qualifiedSurveys","Pesquisas elegíveis encerradas"],["suppressedSurveys","Pesquisas protegidas / em andamento"],["invited","Convites das pesquisas elegíveis"],["respondents","Participações elegíveis"],["responseRate","Taxa de participação","%"]])+ 
 dnaSource(src.kirkpatrick,'Kirkpatrick · Eficácia dos treinamentos',[["qualifiedReactionCohorts","Turmas N1 elegíveis"],["reactionResponses","Respostas N1 agregáveis"],["meanClarity","Clareza média"," / 5"],["meanRelevance","Relevância média"," / 5"],["nps","NPS"],["qualifiedLearningCohorts","Turmas N2 elegíveis"],["pairedLearningRecords","Pares N2"],["meanLearningChangePoints","Variação N2"," p.p."],["qualifiedTransferCohorts","Turmas N3 elegíveis"],["transferResponses","Avaliações N3 agregáveis"],["meanApplication","Aplicação média"," / 5"],["recordedBusinessObservations","Registros N4 de resultados"]])+ 
 card('Definições e limites',(integrated.caveats||[]).map(x=>'<p>'+esc(x)+'</p>').join(''),'Período e empresa são respeitados no backend')
}

function historyContent(){
 const h=historyResult;if(!h)return info('Histórico indisponível.')
 const companies=new Map(org().companies.map(x=>[x.id,x.name])),departments=new Map(org().departments.map(x=>[x.id,x.name]))
 const name=(map,id,empty)=>id?(map.get(id)||id):empty
 const reason={sem_historico:'Sem vínculo conhecido',divergencia:'Fontes divergentes',sem_data:'Data ausente'}
 const types={snapshot_conclusao:'Snapshot da conclusão',historico_vigente:'Histórico vigente',nao_reconciliado:'Não reconciliado'}
 const rows=h.rows||[]
 return '<div class="r3-metrics">'+h.metrics.map(metricCard).join('')+'</div>'+card('Conclusões por vínculo vigente',h.groups.length?table(['Empresa','Departamento','Pessoas','Conclusões'],h.groups.map(g=>'<tr><td>'+esc(name(companies,g.companyId,'Não informado'))+'</td><td>'+esc(name(departments,g.departmentId,'Sem departamento'))+'</td><td>'+n(g.people)+'</td><td>'+n(g.completions)+'</td></tr>')):info('Nenhuma conclusão reconciliada neste recorte.'))+
 card('Evidências de conclusão',rows.length?table(['Pessoa','Curso','Conclusão','Empresa','Departamento','Fonte'],rows.map(r=>'<tr><td>'+esc(r.person)+'</td><td>'+esc(r.course)+'</td><td>'+esc(r.completedAt?new Date(r.completedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem data')+'</td><td>'+esc(name(companies,r.companyId,'Não identificado'))+'</td><td>'+esc(name(departments,r.departmentId,r.companyId?'Sem departamento':'Não identificado'))+'</td><td>'+esc(types[r.reconciliation]||r.reconciliation)+(r.reason?'<br><small>'+esc(reason[r.reason]||r.reason)+'</small>':'')+'</td></tr>')):info('Nenhum registro autorizado.'),h.observedFrom?'Histórico observado desde '+new Date(h.observedFrom).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem data de instalação do histórico')+
 '<div class="r3-pager"><span>Exibindo '+(h.total?offset+1:0)+'–'+Math.min(offset+rows.length,h.total)+' de '+h.total+'</span><button type="button" data-r3="back" '+(offset===0?'disabled':'')+'>Anterior</button><button type="button" data-r3="next" '+(offset+25>=h.total?'disabled':'')+'>Próxima</button></div><div class="r3-actions"><a class="r3-btn r3-primary" href="/api/reports/v3/history.csv'+esc(filters())+'" download>Exportar CSV histórico</a><a class="r3-btn" href="/api/reports/v3/history.xlsx'+esc(filters())+'" download>Exportar Excel histórico</a><button type="button" class="r3-btn" data-r3="print">Imprimir / salvar PDF</button></div><aside class="r3-disclaimer">'+esc(h.caveats.join(' '))+'</aside>'
}
function content(){
 if(section==='Semântico'){const r=semanticResult;if(!r)return info('Indicadores indisponíveis.');return card('Catálogo e valores',table(['Indicador','Valor','Base temporal','Fonte / definição'],r.metrics.map(m=>'<tr><td><b>'+esc(m.label)+'</b><br><small>'+esc(m.code)+'</small></td><td>'+ (m.available?n(m.value)+' '+esc(m.unit):'—<br><small>'+esc(m.reason)+'</small>')+'</td><td>'+esc(m.temporalBasis)+'</td><td>'+esc(m.source)+'<br>'+esc(m.definition)+'</td></tr>')))+ '<div class="r3-actions"><a class="r3-btn" href="/api/reports/v3/semantic.xlsx'+esc(filters())+'" download>Exportar indicadores XLSX</a></div><aside class="r3-disclaimer">'+esc(r.caveats.join(' '))+' '+esc(r.periods.intelligence?('Inteligência: '+r.periods.intelligence.from+' a '+r.periods.intelligence.to):'Inteligência indisponível no recorte.')+'</aside>'}
 if(section==='Histórico')return historyContent()
 if(section==='DNA')return integratedView()
	 if(section==='Dicionário')return card('Definições oficiais',catalog?table(['Indicador','Código','Cálculo / critério','Unidade'],[...catalog.definitions,...(catalog.historicalDefinitions||[])].map(x=>'<tr><td><b>'+esc(x.label)+'</b></td><td><code>'+esc(x.code)+'</code></td><td>'+esc(x.definition)+'</td><td>'+esc(x.unit)+'</td></tr>')):info('Carregando dicionário.'))+card('Ainda sem fonte confiável',(catalog?.notTracked||[]).map(x=>'<p><b>'+esc(x.code)+':</b> '+esc(x.reason)+'</p>').join(''))
 if(section==='Pessoas')return metrics(['people.active','learning.enrollments','learning.completed','learning.completion_rate'])+card('Comparativo por departamento',deptTable(),'Resultados abaixo de cinco pessoas são suprimidos')+annotations()
 if(section==='LMS')return metrics(groups.LMS)+card('Conclusão por curso',chart())+card('Detalhamento dos cursos',courseTable())+actions()+annotations()
 if(section==='DHO')return metrics(groups.DHO)+card('Privacidade de pesquisas',info('No Pulse legado, respostas foram armazenadas com identificação; apenas a saída da Central de Relatórios é agregada. Use Pulse Seguro V5 para novas pesquisas protegidas.'))+annotations()
 if(section==='Matrículas')return card('Matrículas autorizadas','<div id="r3-enrollmentRows">'+info('Carregando registros…')+'</div>')+actions()+annotations()
 return metrics(groups.Geral)+card('Aprendizagem por curso',chart(),'Taxa de conclusão')+card('Resumo por departamento',deptTable(),'Mínimo de cinco pessoas')+actions()+annotations()
}
function skeleton(){return '<section class="r3-wrapper">'+top()+'<div class="r3-loading" role="status">Atualizando os indicadores…</div></section>'}
async function render(){const el=$r();if(!el)return
 const currentHeader=firstCompany();if(!reportContextInitialized||currentHeader!==lastHeaderCompany){reportState.company=currentHeader;reportState.department='';lastHeaderCompany=currentHeader;reportContextInitialized=true}
 const job=++token;el.innerHTML=skeleton()
 try{
  const historical=section==='Histórico';const historyQuery=new URLSearchParams({...reportState,limit:'25',offset:String(offset)});const out=await Promise.all([historical?api('reports/v3/history?'+historyQuery.toString()):section==='Semântico'?api('reports/v3/semantic'+filters()):api('reports/v3/summary'+filters()),catalog?Promise.resolve(catalog):api('reports/v3/catalog'),savedViews?Promise.resolve({items:savedViews}):api('reports/v3/views'),section==='DNA'&&!reportState.department&&!reportState.person&&!reportState.course?api('intelligence/v6/summary'+filters()).then(value=>({value})).catch(error=>({error:error.message})):Promise.resolve(null)]);if(job!==token||page!=='Relatórios')return
  if(historical)historyResult=out[0];else if(section==='Semântico')semanticResult=out[0];else last=out[0];catalog=out[1];savedViews=out[2].items||[];integrated=out[3]?.value||null;integratedError=out[3]?.error||''
  el.innerHTML='<section class="r3-wrapper">'+top('Indicadores rastreáveis, permissões por empresa e recortes consistentes.')+content()+'</section>'
  if(section==='Matrículas')void loadRows()
 }catch(ex){if(job===token&&page==='Relatórios')el.innerHTML='<section class="r3-wrapper">'+top()+'<div class="r3-error" role="alert">'+esc(ex.message||'Não foi possível carregar a central de relatórios.')+'</div></section>'}
}
async function loadRows(){const anchor=document.getElementById('r3-enrollmentRows');if(!anchor)return;const job=token,requestedOffset=offset
 try{const q=new URLSearchParams(query());q.set('limit','25');q.set('offset',String(offset))
  const result=await api('reports/v3/enrollments?'+q.toString())
  if(section!=='Matrículas'||page!=='Relatórios'||job!==token||offset!==requestedOffset)return
  const current=document.getElementById('r3-enrollmentRows');if(!current)return
  const entries=result.rows||[]
  current.innerHTML=(entries.length?table(['Pessoa','Curso','Progresso','Status','Conclusão','Evidência'],entries.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.course)+'</td><td>'+n(x.progress)+'%</td><td>'+esc(x.status)+'</td><td>'+esc(x.completed?new Date(x.completed).toLocaleDateString('pt-BR'):'—')+'</td><td>'+esc(({legacy:'Legada',manual:'Autodeclarada',quiz:'Questionário',scorm:'Runtime SCORM',pending:'Pendente'})[x.evidenceType]||'—')+'</td></tr>')):info('Não há matrículas para este filtro.'))+
  '<div class="r3-pager"><span>Exibindo '+(result.total?offset+1:0)+'–'+Math.min(offset+entries.length,result.total)+' de '+result.total+'</span><button type="button" data-r3="back" '+(offset===0?'disabled':'')+'>Anterior</button><button type="button" data-r3="next" '+(offset+25>=result.total?'disabled':'')+'>Próxima</button></div>'
 }catch(ex){const box=document.getElementById('r3-enrollmentRows');if(box&&job===token&&offset===requestedOffset&&section==='Matrículas'&&page==='Relatórios')box.innerHTML='<div class="r3-error">'+esc(ex.message)+'</div>'}
}
// Preserve legacy navigation and all functional LXP modules.
const previousBody=body
body=function(...args){if(page==='Relatórios'){void render();return}return previousBody(...args)}
const previousDraw=draw
draw=function(...args){const out=previousDraw(...args);if(d?.me?.role==='Diretoria'){const nav=document.querySelector('aside nav');if(nav&&!nav.querySelector('[data-id="Relatórios"]')){const button=document.createElement('button');button.dataset.act='nav';button.dataset.id='Relatórios';button.innerHTML='<span class="ico">◫</span>Relatórios';nav.append(button)}}return out}
window.addEventListener('click',ev=>{const b=ev.target.closest('[data-r3]');if(!b)return
 ev.preventDefault();if(page!=='Relatórios')return
 const act=b.dataset.r3
 if(act==='tab'){section=b.dataset.id;offset=0;void render()}
 if(act==='reset'){reportState={company:firstCompany(),department:'',person:'',course:'',from:'',to:''};offset=0;void render()}
 if(act==='back'){offset=Math.max(0,offset-25);if(section==='Histórico')void render();else void loadRows()}
 if(act==='next'){offset+=25;if(section==='Histórico')void render();else void loadRows()}
 if(act==='apply-view'){const id=document.getElementById('r3-view-picker')?.value;const selected=savedViews?.find(v=>v.id===id);if(!selected)return toast('Selecione uma visão salva.');reportState={company:'',department:'',person:'',course:'',from:'',to:'',...selected.filters};offset=0;void render()}
 if(act==='save-view'){document.getElementById('r3-save-dialog')?.showModal()}
 if(act==='close-dialog'){document.getElementById('r3-save-dialog')?.close()}
 if(act==='delete-view'){const id=document.getElementById('r3-view-picker')?.value;const selected=savedViews?.find(v=>v.id===id);if(!selected)return toast('Selecione a visão para excluir.');if(!confirm('Excluir a visão '+selected.name+'?'))return;void api('reports/v3/views/delete',{id:selected.id,revision:selected.revision}).then(()=>{savedViews=null;void render()}).catch(ex=>toast(ex.message))}
 if(act==='print')window.print()
})
window.addEventListener('submit',ev=>{if(ev.target.id==='r3-saveform'){ev.preventDefault();const name=String(new FormData(ev.target).get('viewname')||'');void api('reports/v3/views',{name,filters:reportState}).then(()=>{document.getElementById('r3-save-dialog')?.close();savedViews=null;toast('Visão salva no seu perfil.');void render()}).catch(ex=>toast(ex.message));return}
 if(ev.target.id!=='r3-filters')return;ev.preventDefault()
 const data=new FormData(ev.target);reportState={...reportState,company:String(data.get('company')||''),department:String(data.get('department')||''),from:String(data.get('from')||''),to:String(data.get('to')||'')};offset=0;void render()
})
window.addEventListener('change',ev=>{if(ev.target.name==='company'&&ev.target.closest('#r3-filters')){
 const target=ev.target.value;const dept=ev.target.form?.elements.department;reportState.company=target;reportState.department=''
 if(dept)dept.innerHTML=opt('','Todos','')+org().departments.filter(x=>!target||x.company_id===target).map(x=>opt(x.id,x.name,'')).join('')
}})
})()
