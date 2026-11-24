/**
 * Learning Sanepav 3.0 — Relatórios e Dicionário de Indicadores.
 * Release incremental, original, sem dependências externas.
 * Os dados refletem vínculos organizacionais ATUAIS; nunca inferir eventos ausentes.
 */
import {createHash,randomUUID} from 'node:crypto'
import {completionClassification} from './completion-v11.mjs'

const LEGACY='system/state-v1'
const LXP='lxp/v2/state'
const VIEWS='reports/v3/saved-views'
const MIN_PULSE=7
const uuid=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i
const validDate=d=>typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d
const guard=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})}
const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
const arr=x=>Array.isArray(x)?x:[]
const mean=xs=>xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length*100)/100:null
const percent=(n,d)=>d?Math.round(n*10000/d)/100:null
const date=v=>typeof v==='string'?v.slice(0,10):''
const saoPauloToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const inPeriod=(v,f)=>!f.from&&!f.to||Boolean(v&&(!f.from||date(v)>=f.from)&&(!f.to||date(v)<=f.to))
const norm=(v)=>String(v??'').normalize('NFKC').trim()
const clamp=(v,min,max,def)=>v!==null&&v!==''&&Number.isInteger(Number(v))?Math.max(min,Math.min(max,Number(v))):def
const source=(label,definition,unit='quantidade',period='estoque')=>({label,definition,unit,period})
// Versioned, centralized definitions: display names and calculations must not drift.
export const REPORT_DEFINITIONS=Object.freeze({
 'people.active':source('Pessoas ativas no escopo','Pessoas ativas vinculadas às empresas e à hierarquia autorizadas, com vínculo organizacional atual.'),
 'learning.enrollments':source('Matrículas','Matrículas existentes no escopo; filtro temporal usa a data de atribuição apenas quando registrada.'),
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
 'dho.pulse_response_rate':source('Taxa de participação Pulse','Somente pesquisas com pelo menos 7 respostas, calculada por convites da audiência original.','%')
})
const metric=(code,value,extra={})=>({code,...REPORT_DEFINITIONS[code],value,available:value!==null,source:code.startsWith('learning.certificates')?'evo/certificates':code.startsWith('dho.')?'lxp/v2/state':'system/state-v1',...extra})

function userFrom(req,state){
 const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1]||''
 const digest=createHash('sha256').update(token).digest('hex')
 const identity=req.headers.get('oai-authenticated-user-id')||''
 const s=arr(state.sessions).find(x=>x.digest===digest&&x.identity===identity&&x.until>Date.now())
 const user=arr(state.users).find(x=>x.id===s?.person&&x.active)
 guard(user,'Entre na plataforma para continuar.',401)
 guard(['Administrador','RH/DHO','Líder','Diretoria'].includes(user.role),'Acesso gerencial não autorizado.',403)
 return user
}
const companyFor=(state,userId)=>state.organization?.assignments?.get(userId)?.company_id||''
function subordinate(state,leaderId,personId){
 const visited=new Set();let p=arr(state.users).find(x=>x.id===personId)
 while(p?.manager&&!visited.has(p.id)){
  if(p.manager===leaderId)return true
  visited.add(p.id);p=state.users.find(x=>x.id===p.manager)
 }
 return false
}
function prepareScope(state,domain,user,params){
 const available=arr(domain.allowedCompanies(state,user))
 const company=params.get('company')||''
 guard(!company||uuid.test(company)&&available.includes(company),'Empresa fora do escopo.',403)
 const department=params.get('department')||'',person=params.get('person')||'',course=params.get('course')||''
 guard(!department||uuid.test(department),'Departamento inválido.')
 guard(!person||uuid.test(person),'Pessoa inválida.')
 guard(!course||uuid.test(course),'Curso inválido.')
 const from=params.get('from')||'',to=params.get('to')||''
 guard(!from||validDate(from),'Data inicial inválida.')
 guard(!to||validDate(to),'Data final inválida.')
 guard(!from||!to||from<=to,'O período inicial não pode exceder o final.')
 const allowedCompanies=new Set(company?[company]:available)
 const allPeople=arr(state.users).filter(p=>p.active&&(
  user.role==='Administrador'&&!companyFor(state,p.id) && !company && !department ? true : allowedCompanies.has(companyFor(state,p.id))
 )&&(user.role!=='Líder'||p.id===user.id||subordinate(state,user.id,p.id)))
 const org=state.organization
 if(department){guard([...arr(org?.companies)].some(c=>allowedCompanies.has(c.id)),'Selecione uma empresa autorizada.',403)}
 const people=allPeople.filter(p=>(!department||org?.assignments?.get(p.id)?.department_id===department)&&(!person||person===p.id))
 guard(!person||people.some(p=>p.id===person),'Pessoa fora de seu escopo.',403)
 // Filtered work can only reference catalog items linked to scoped enrollments.
 return {company,department,person,course,from,to,people,ids:new Set(people.map(p=>p.id)),allCompanies:allowedCompanies,applied:{company,department,person,course,from,to},role:user.role}
}
function legacyEnrollments(legacy,scope){
 return arr(legacy.enroll).filter(e=>scope.ids.has(e.person)&&(!scope.course||e.course===scope.course)&&
  (!scope.from&&!scope.to||inPeriod(e.completed||e.assigned||e.created||e.updated,scope)))
}
function lxpRows(legacy,lxp,scope){
 const ids=scope.ids
 const cycles=arr(lxp.cycles).filter(c=>scope.allCompanies.has(c.companyId)&&(!scope.person||c.participants?.includes(scope.person))&&
  (scope.role!=='Líder'||arr(c.participants).some(id=>scope.ids.has(id)))&&inPeriod(c.createdAt,scope))
 const cycleIds=new Set(cycles.map(c=>c.id))
 const reviews=arr(lxp.reviews).filter(r=>cycleIds.has(r.cycleId)&&ids.has(r.subjectId)&&(!scope.from&&!scope.to||inPeriod(r.submittedAt||r.updatedAt,scope)))
 const pdi=arr(lxp.pdiActions).filter(a=>ids.has(a.personId)&&inPeriod(a.createdAt,scope))
 const meetings=arr(lxp.meetings).filter(m=>arr(m.participants).some(id=>ids.has(id))&&inPeriod(m.createdAt||m.date,scope))
 const feedback=arr(lxp.feedbackRequests).filter(r=>(ids.has(r.fromId)||ids.has(r.toId))&&inPeriod(r.createdAt,scope))
 return {cycles,reviews,pdi,meetings,feedback}
}
function pulseSummary(lxp,scope){
 // Strict privacy: no small-group analytics, person or department slicing, nor respondent exports.
 if(scope.person||scope.department)return {surveys:null,mean:null,responseRate:null,suppressed:true,reason:'Recorte individual ou por departamento não permitido para registros Pulse identificados na origem.'}
 const eligible=arr(lxp.pulses).filter(p=>scope.allCompanies.has(p.companyId)&&inPeriod(p.createdAt,scope))
 const qualified=[]
 for(const p of eligible){
  const audience=new Set(arr(p.participants));const n=arr(lxp.pulseResponses).filter(r=>r.surveyId===p.id&&audience.has(r.userId))
  if(n.length>=MIN_PULSE)qualified.push({n:n.length,invited:audience.size,mean:mean(n.map(r=>r.rating).filter(x=>Number.isInteger(x)&&x>=1&&x<=5))})
 }
 const n=qualified.reduce((s,x)=>s+x.n,0),invited=qualified.reduce((s,x)=>s+x.invited,0)
 return {surveys:eligible.length,mean:qualified.length?Math.round(qualified.reduce((s,x)=>s+x.n*x.mean,0)/n*100)/100:null,
  responseRate:qualified.length?percent(n,invited):null,suppressed:qualified.length!==eligible.length,qualifiedSurveys:qualified.length,
  reason:qualified.length!==eligible.length?'Pesquisas com menos de 7 respostas não entram nos agregados.':undefined}
}
async function collect(bucket,scope,legacy){
 const o=await bucket.get(LXP)
 const lxp=o?await o.json():{pulses:[],pulseResponses:[],cycles:[],reviews:[],pdiActions:[],meetings:[],feedbackRequests:[]}
 const enroll=legacyEnrollments(legacy,scope)
 const all=legacy.enroll||[]
 const rows=lxpRows(legacy,lxp,scope)
 const pulse=pulseSummary(lxp,scope)
 const courses=new Map(arr(legacy.courses).map(c=>[c.id,c]))
 const completed=enroll.filter(x=>x.progress===100).length
 const scores=enroll.map(x=>Number(x.score)).filter((v,i)=>Number.isFinite(v)&&enroll[i].score!=null)
 let certCount=null
 // Existing certificate issuer persists one immutable object per enrollment.
 // No global list exists; only enumerate enrollments already authorized.
 if(enroll.length<=2000){const found=await Promise.all(enroll.map(e=>bucket.get('evolution/v1/issued/'+e.id)));certCount=found.filter(Boolean).length}
 const assignments=arr(legacy.missionEnrollments).filter(x=>scope.ids.has(x.person))
 const data=[
  metric('people.active',scope.people.length),
  metric('learning.enrollments',enroll.length),
  metric('learning.completed',completed),
  ...['legacy','manual','quiz','scorm'].map(kind=>metric('learning.completion_'+kind,enroll.filter(e=>completionClassification(e)===kind).length)),
  metric('learning.completion_assessed',enroll.filter(e=>e.progress===100&&e.completionV11?.event&&e.completionV11.requirements?.length&&e.completionV11.requirements.every(r=>r.passed)).length),
  metric('learning.completion_rate',percent(completed,enroll.length),{numerator:completed,denominator:enroll.length}),
  metric('learning.courses',new Set(enroll.map(e=>e.course)).size),
  metric('learning.avg_progress',mean(enroll.map(x=>Number(x.progress)).filter(Number.isFinite))),
  metric('learning.score_avg',mean(scores)),
  metric('learning.expired',enroll.filter(e=>e.progress!==100&&validDate(e.due)&&e.due<saoPauloToday()).length),
  metric('learning.certificates',certCount,{note:certCount===null?'Mais de 2.000 matrículas no recorte: limite seguro de consulta de certificados; aplique filtros.':'Certificados encontrados na fonte persistida.'}),
  metric('learning.tracks',assignments.length),
  metric('dho.pdi_actions',rows.pdi.length),
  metric('dho.pdi_completion',percent(rows.pdi.filter(x=>x.status==='done').length,rows.pdi.length),{numerator:rows.pdi.filter(x=>x.status==='done').length,denominator:rows.pdi.length}),
  metric('dho.reviews_assigned',rows.reviews.length),
  metric('dho.reviews_submitted',rows.reviews.filter(x=>x.status==='submitted').length),
  metric('dho.review_adherence',percent(rows.reviews.filter(x=>x.status==='submitted').length,rows.reviews.length),{numerator:rows.reviews.filter(x=>x.status==='submitted').length,denominator:rows.reviews.length}),
  metric('dho.cycles',rows.cycles.length),
  metric('dho.meetings',rows.meetings.length),
  metric('dho.feedback_requests',rows.feedback.length),
  metric('dho.pulse_surveys',pulse.surveys,{reason:pulse.reason}),
  metric('dho.pulse_mean',pulse.mean,{reason:pulse.reason,privacyThreshold:MIN_PULSE}),
  metric('dho.pulse_response_rate',pulse.responseRate,{reason:pulse.reason,privacyThreshold:MIN_PULSE})
 ]
 const grouped=new Map()
 for(const e of enroll){const c=courses.get(e.course);if(!c)continue
  const row=grouped.get(c.id)||{id:c.id,title:c.title,track:c.track||'Sem trilha',type:c.type,status:c.status||'published',enrollments:0,completed:0,progressTotal:0,withScore:0,scoreTotal:0}
  row.enrollments++;row.completed+=e.progress===100?1:0;row.progressTotal+=Number(e.progress)||0
  if(Number.isFinite(Number(e.score))&&e.score!=null){row.withScore++;row.scoreTotal+=Number(e.score)}
  grouped.set(c.id,row)
 }
 const byCourse=[...grouped.values()].map(({progressTotal,scoreTotal,withScore,...v})=>({...v,completionRate:percent(v.completed,v.enrollments),avgProgress:Math.round(progressTotal/v.enrollments*100)/100,scoreAvg:withScore?Math.round(scoreTotal/withScore*100)/100:null})).sort((a,b)=>b.enrollments-a.enrollments)
 const byDepartment=new Map()
 for(const p of scope.people){const id=legacy.organization?.assignments?.get(p.id)?.department_id||'';const group=byDepartment.get(id)||{id,label:id?'Departamento':'Sem departamento',people:0,enrollments:0,completed:0}
  group.people++;byDepartment.set(id,group)}
 for(const e of enroll){const dept=legacy.organization?.assignments?.get(e.person)?.department_id||'';const g=byDepartment.get(dept);if(g){g.enrollments++;if(e.progress===100)g.completed++}}
 const departments=[...byDepartment.values()].map(g=>g.people>=5?{...g,completionRate:percent(g.completed,g.enrollments)}:{id:g.id,label:g.label,suppressed:true,reason:'Recorte com menos de 5 pessoas.'})
 return {metrics:data,byCourse,departments,enroll,legacy,lxp,rows,pulse}
}
function dataRows(summary,scope){
 const people=new Map(arr(summary.legacy.users).map(p=>[p.id,p]))
 const courses=new Map(arr(summary.legacy.courses).map(c=>[c.id,c]))
 return summary.enroll.map(e=>{
 const u=people.get(e.person),c=courses.get(e.course),assign=summary.legacy.organization?.assignments?.get(e.person)
 return {id:e.id,personId:e.person,name:u?.name||'Colaborador não encontrado',companyId:assign?.company_id||'',departmentId:assign?.department_id||'',
  courseId:e.course,course:c?.title||'Curso removido',track:c?.track||'',type:c?.type||'',status:e.progress===100?'Concluído':e.progress?'Em andamento':'Não iniciado',
  progress:Number(e.progress)||0,score:e.score??null,due:e.due||'',updated:e.updated||'',completed:e.completed||'',evidenceType:completionClassification(e),assessmentRequired:e.completionV11?.requirements?.length??null,assessmentPassed:e.completionV11?.requirements?.filter(x=>x.passed).length??null}
 })
}
const escapeCsv=v=>{let s=norm(v);if(/^[\s\uFEFF]*[=+@\-\t\r]/u.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
const csv=rows=>{const cols=['id','personId','name','companyId','departmentId','courseId','course','track','type','status','progress','score','due','updated','completed','evidenceType','assessmentRequired','assessmentPassed']
 return '\ufeff'+[cols.join(';'),...rows.map(r=>cols.map(c=>escapeCsv(r[c]??'')).join(';'))].join('\r\n')}


async function saveView(req,bucket,legacy,user,domain,route){
 const method=req.method
 const options=await bucket.get(VIEWS)
 const data=options?await options.json():{version:1,items:[],events:[]}
 if(method==='GET'&&route==='views')return send({items:arr(data.items).filter(v=>v.ownerId===user.id).map(({ownerId,...v})=>v)})
 guard(method==='POST','Método não permitido.',405)
 guard(req.headers.get('origin')===new URL(req.url).origin,'Origem inválida.',403)
 let body;try{body=await req.json()}catch{guard(false,'JSON inválido.')}
 guard(body&&typeof body==='object'&&!Array.isArray(body),'Formato inválido.')
 if(route==='views'){
  guard(typeof body.name==='string','Nome inválido.')
  const name=norm(body.name)
  guard(name.length>=2&&name.length<=80,'Nome da visão deve ter entre 2 e 80 caracteres.')
  guard(body.filters&&typeof body.filters==='object'&&!Array.isArray(body.filters),'Filtros inválidos.')
  const allowedFields=['company','department','person','course','from','to']
  guard(Object.keys(body.filters).every(k=>allowedFields.includes(k)),'Filtro desconhecido.')
  const filters=Object.fromEntries(allowedFields.map(k=>[k,typeof body.filters[k]==='string'?body.filters[k]:'']))
  guard(Object.values(filters).every(v=>v.length<=100),'Filtro acima do limite.')
  prepareScope(legacy,domain,user,new URLSearchParams(filters))
  const id=body.id
  return await updateViews(bucket,mutable=>{
   const items=arr(mutable.items),mine=items.filter(v=>v.ownerId===user.id)
   let view
   if(id){view=items.find(v=>v.id===id&&v.ownerId===user.id);guard(view,'Visão inexistente.',404);guard(body.revision===view.revision,'Visão modificada por outra sessão.',409)
    Object.assign(view,{name,filters,revision:view.revision+1,updatedAt:new Date().toISOString()})
   }else{
    guard(mine.length<30,'Limite de 30 visões salvas por usuário.',409)
    view={id:randomUUID(),ownerId:user.id,name,filters,revision:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};items.push(view);mutable.items=items
   }
   mutable.events=arr(mutable.events);mutable.events.unshift({actor:user.id,action:id?'report.view.update':'report.view.create',id:view.id,at:new Date().toISOString()});mutable.events.length=Math.min(mutable.events.length,1000)
   return {id:view.id,revision:view.revision}
  })
 }
 if(route==='views/delete')return await updateViews(bucket,mutable=>{
  const index=arr(mutable.items).findIndex(v=>v.id===body.id&&v.ownerId===user.id)
  guard(index>=0,'Visão inexistente.',404)
  const view=mutable.items[index];guard(view.revision===body.revision,'A visão foi alterada; recarregue a página.',409)
  mutable.items.splice(index,1)
  mutable.events=arr(mutable.events);mutable.events.unshift({actor:user.id,action:'report.view.delete',id:view.id,at:new Date().toISOString()});mutable.events.length=Math.min(mutable.events.length,1000)
  return {ok:true}
 })
 return send({error:'Rota não encontrada.'},404)
}
async function updateViews(bucket,fn){
 for(let i=0;i<5;i++){
  const v=await bucket.get(VIEWS),data=v?await v.json():{version:1,items:[],events:[]}
  const result=fn(data)
  const saved=await bucket.put(VIEWS,JSON.stringify(data),{onlyIf:v?{etagMatches:v.etag}:{etagDoesNotMatch:'*'}})
  if(saved)return send(result)
 }
 guard(false,'A configuração foi alterada; tente novamente.',409)
}

async function main(req,ctx){
 const path=new URL(req.url).pathname,route=path.slice('/api/reports/v3/'.length)
 const bucket=ctx.BUCKET,raw=await bucket.get(LEGACY)
 guard(raw,'Ambiente não inicializado.',503)
 const legacy=await raw.json()
 const user=userFrom(req,legacy)
 if(route==='views'||route==='views/delete')return saveView(req,bucket,legacy,user,ctx.DOMAIN,route)
 guard(req.method==='GET','Método não permitido.',405)
 const query=new URL(req.url).searchParams
 const scope=prepareScope(legacy,ctx.DOMAIN,user,query)
 if(route==='catalog')return send({version:'3.0.0',definitions:Object.entries(REPORT_DEFINITIONS).map(([code,v])=>({code,...v,source:code.startsWith('dho.')?LXP:LEGACY,version:1})),notTracked:[
  {code:'learning.actual_hours',reason:'Não há telemetria padronizada de tempo efetivo para todos os formatos.'},
  {code:'people.turnover',reason:'Sem base de admissões/desligamentos confiável integrada ao RH/DP.'},
  {code:'people.absenteeism',reason:'Sem sistema de ponto ou presença vinculado.'},
  {code:'kirkpatrick.l3_l4',reason:'Disponíveis na visão Inteligência integrada quando há dados do módulo Kirkpatrick; não duplicados neste catálogo.'}
 ]})
 const result=await collect(bucket,scope,legacy)
 const common={version:'3.0.0',at:new Date().toISOString(),filters:scope.applied,scope:{companies:[...scope.allCompanies],people:scope.people.length},
  caveats:['Estrutura organizacional atual, não fotografia histórica.','Períodos em matrículas dependem das datas registradas; ausência de timestamp não é preenchida artificialmente.','Pulse legado mantém respostas identificadas na origem; o limiar de sete respostas protege apenas a divulgação agregada, sem anonimização retroativa.']}
 if(route==='summary')return send({...common,metrics:result.metrics,byCourse:result.byCourse.slice(0,100),departments:result.departments,privacy:result.pulse})
 if(route==='enrollments'||route==='export.csv'){
  const rows=dataRows(result,scope)
  if(route==='export.csv'){
   guard(rows.length<=20000,'O relatório excede 20 mil matrículas. Restrinja o período ou a empresa.',413)
   return new Response(csv(rows),{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="learning-matriculas.csv"','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
  }
  const size=clamp(query.get('limit'),1,100,25),offset=clamp(query.get('offset'),0,1000000,0)
  return send({...common,total:rows.length,limit:size,offset,rows:rows.slice(offset,offset+size)})
 }
 if(route==='health')return send({version:'3.0.0',storage:'available',modules:{legacy:true,lxp:!!await bucket.get(LXP)},at:new Date().toISOString()})
 return send({error:'Recurso de relatórios não encontrado.'},404)
}
export async function handleReportsV3(req,ctx){
 if(!new URL(req.url).pathname.startsWith('/api/reports/v3/'))return null
 try{return await main(req,ctx)}catch(e){return send({error:e.status?e.message:'Falha interna na central de relatórios.'},e.status||500)}
}
