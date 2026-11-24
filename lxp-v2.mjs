/**
 * Learning Sanepav / DNA do Desenvolvimento — LXP 02.
 * Independent, original implementation. No Open edX source copied.
 * Extends existing BUCKET/DOMAIN API without mutating legacy courses or HR records.
 * All persistent mutations are optimistic / revision-safe through the existing SQLite BUCKET.
 */
import {randomUUID,createHash} from 'node:crypto'
const STORE='lxp/v2/state'
const LEGACY='system/state-v1'
const MAX_ITEMS={pulses:500,pulseResponses:30000,cycles:250,reviews:40000,pdiActions:20000,meetings:10000,feedbackRequests:10000}
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v)
const now=()=>new Date().toISOString()
const isDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
const err=(condition,message,status=400)=>{if(!condition)throw Object.assign(new Error(message),{status})}
const text=(v,max=200,{optional=false}={})=>{if(optional&&(v==null||v===''))return '';err(typeof v==='string'&&v.trim().length>0&&v.trim().length<=max,'Confira o preenchimento dos campos.');return v.trim()}
const bool=v=>v===true
const id=()=>randomUUID()
const initial=()=>({schema:2,pulses:[],pulseResponses:[],cycles:[],reviews:[],pdiActions:[],meetings:[],feedbackRequests:[],events:[]})
const own=(s,p)=>s.users.find(u=>u.id===p&&u.active)
const assignment=(s,p)=>s.organization?.assignments?.get(p)
const company=(s,p)=>assignment(s,p)?.company_id||''
const leader=(s,subject,reviewer)=>Boolean(own(s,subject)?.manager===reviewer&&company(s,subject)===company(s,reviewer))
const isManage=u=>['Administrador','RH/DHO'].includes(u.role)
const canCreate=u=>isManage(u)||u.role==='Líder'
const hash=v=>createHash('sha256').update(v).digest('hex')
function getUser(req,state){
 const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1]||''
 const session=state.sessions?.find(s=>s.digest===hash(token)&&s.identity===(req.headers.get('oai-authenticated-user-id')||'')&&s.until>Date.now())
 const user=own(state,session?.person)
 err(user,'Entre na plataforma para continuar.',401)
 return user
}
function allowed(state,domain,user){return domain.allowedCompanies(state,user)}
function ensureCompany(state,domain,user,companyId){err(uuid(companyId)&&allowed(state,domain,user).includes(companyId),'Empresa fora do seu escopo.',403);err(state.organization.companies.some(x=>x.id===companyId),'Empresa inativa ou inexistente.',404);return companyId}
function canViewPerson(state,domain,user,personId){
 if(user.id===personId)return true
 if(user.role==='Administrador')return true
 const personCompany=company(state,personId)
 if(user.role==='RH/DHO')return Boolean(personCompany&&allowed(state,domain,user).includes(personCompany))
 if(user.role==='Líder'){
  const seen=new Set();let next=own(state,personId)
  while(next&&!seen.has(next.id)){if(next.manager===user.id)return company(state,next.id)===company(state,user.id);seen.add(next.id);next=own(state,next.manager)}
 }
 return false
}
function canEditPerson(state,domain,user,personId){return canViewPerson(state,domain,user,personId)&&(['Administrador','RH/DHO','Líder'].includes(user.role)||user.id===personId)}
function isInTeam(state,leaderId,personId){
 let person=own(state,personId);const seen=new Set()
 while(person&&!seen.has(person.id)){if(person.manager===leaderId)return true;seen.add(person.id);person=own(state,person.manager)}
 return false
}
function employees(state,companyId,departmentIds=[],includeCreator=''){
 const departments=new Set(departmentIds)
 const users=state.users.filter(u=>u.active&&company(state,u.id)===companyId&&(!departments.size||departments.has(assignment(state,u.id)?.department_id))).map(u=>u.id)
 if(includeCreator&&!users.includes(includeCreator))users.push(includeCreator)
 return users
}
function audienceIds(state,domain,user,input){
 const companyId=ensureCompany(state,domain,user,input.companyId)
 const departmentIds=Array.isArray(input.departmentIds)?input.departmentIds:[]
 err(departmentIds.length<=100&&departmentIds.every(uuid)&&departmentIds.length===new Set(departmentIds).size,'Departamentos inválidos.')
 // Do not accept arbitrary employee IDs from clients as an authorization bypass.
 const isAllowedEmployee=p=>user.role!=='Líder'||user.id===p||isInTeam(state,user.id,p)
 const eligible=new Set(employees(state,companyId).filter(isAllowedEmployee))
 const requested=Array.isArray(input.personIds)?input.personIds:[]
 err(requested.length<=2000&&requested.every(x=>eligible.has(x)),'Pessoas fora do escopo.',403)
 const participants=requested.length?requested:employees(state,companyId,departmentIds).filter(isAllowedEmployee)
 const includeCreator=bool(input.includeCreator)&&['Administrador','RH/DHO','Líder'].includes(user.role)&&(!company(state,user.id)||company(state,user.id)===companyId)
 if(includeCreator&&!participants.includes(user.id))participants.push(user.id)
 err(participants.length>0&&participants.length<=5000,'O público selecionado está vazio ou acima do limite.')
 return {companyId,departmentIds,participants,includeCreator}
}
async function source(bucket){const v=await bucket.get(LEGACY);err(v,'Ambiente não inicializado.',503);return await v.json()}
async function data(bucket){const v=await bucket.get(STORE);return {etag:v?.etag||null,state:v?await v.json():initial()}}
async function change(bucket,transform){
 for(let attempt=0;attempt<4;attempt++){
  const {etag,state}=await data(bucket)
  const result=transform(state)
  const stored=await bucket.put(STORE,JSON.stringify(state),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'}})
  if(stored)return result
 }
 err(false,'Outro usuário atualizou o conteúdo. Recarregue a página.',409)
}
function audit(s,user,action,entity){s.events.unshift({at:now(),userId:user.id,action,entity});s.events=s.events.slice(0,1500)}
function checkCapacity(s,key){err(s[key].length<MAX_ITEMS[key],'Limite do módulo atingido. Contate a administração.',409)}
function publicUser(state,p){const person=own(state,p);return person?{id:person.id,name:person.name,role:person.role,companyId:company(state,p),managerId:person.manager||''}:{id:p,name:'Usuário inativo',role:'',companyId:'',managerId:''}}
function pulseStatus(survey){const day=today();return survey.status==='closed'||day>survey.endDate?'closed':day<survey.startDate?'scheduled':'open'}
function statsForPulse(state,survey){
 const answers=state.pulseResponses.filter(x=>x.surveyId===survey.id)
 const n=answers.length,visible=n>=7
 const distribution=visible?Array.from({length:5},(_,i)=>answers.filter(a=>a.rating===i+1).length):null
 return {responses:n,invited:survey.participants.length,minimumAggregate:7,canShowAggregate:visible,mean:visible?Math.round(answers.reduce((a,b)=>a+b.rating,0)/n*100)/100:null,distribution}
}
function listPulses(state,user,db,domain){
 return db.pulses.filter(p=>p.participants.includes(user.id)||p.createdBy===user.id||isManage(user)&&allowed(state,domain,user).includes(p.companyId)).map(p=>({
  id:p.id,title:p.title,description:p.description,companyId:p.companyId,startDate:p.startDate,endDate:p.endDate,createdAt:p.createdAt,status:pulseStatus(p),
  isOrganizer:p.createdBy===user.id||isManage(user)&&allowed(state,domain,user).includes(p.companyId),isParticipant:p.participants.includes(user.id),
  answered:db.pulseResponses.some(a=>a.surveyId===p.id&&a.userId===user.id),
  ...(p.createdBy===user.id||isManage(user)&&allowed(state,domain,user).includes(p.companyId)?{summary:statsForPulse(db,p)}:{})
 })).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
}
function cycleStatus(c){return c.status}
function normalizedQuestion(q,index){
 err(q&&typeof q==='object'&&!Array.isArray(q),'Pergunta inválida.')
 const type=text(q.type,12)
 err(['rating','text','single','yesno'].includes(type),'Tipo de pergunta não suportado.')
 const choices=type==='single'?(Array.isArray(q.choices)?q.choices.map(x=>text(x,120)):[]):[]
 err(type!=='single'||choices.length>=2&&choices.length<=12&&new Set(choices).size===choices.length,'Informe de 2 a 12 alternativas diferentes.')
 const weight=q.weight==null?1:Number(q.weight)
 err(Number.isFinite(weight)&&weight>=0&&weight<=10,'Peso da pergunta entre 0 e 10.')
 return {id:uuid(q.id)?q.id:id(),type,title:text(q.title,250),description:text(q.description,500,{optional:true}),required:q.required!==false,weight,choices,competency:text(q.competency,100,{optional:true}),order:index}
}
function normalizeForm(x){err(Array.isArray(x)&&x.length>0&&x.length<=60,'Crie de 1 a 60 perguntas.');const form=x.map(normalizedQuestion);err(new Set(form.map(q=>q.id)).size===form.length,'Perguntas duplicadas.');return form}
function summarizeTask(t){return {id:t.id,cycleId:t.cycleId,subjectId:t.subjectId,reviewerId:t.reviewerId,perspective:t.perspective,status:t.status,submittedAt:t.submittedAt||null,updatedAt:t.updatedAt||null}}
function canAnswer(t,u){return t.reviewerId===u.id}
function ownTask(state,db,u,taskId){const task=db.reviews.find(x=>x.id===taskId);err(task,'Avaliação não encontrada.',404);err(canAnswer(task,u),'Essa avaliação não foi atribuída ao seu perfil.',403);return task}
function validateAnswers(form,answers,{draft=false}={}){
 err(answers&&typeof answers==='object'&&!Array.isArray(answers),'Respostas inválidas.')
 const validated={}
 for(const key of Object.keys(answers))err(form.some(q=>q.id===key),'Pergunta inexistente.')
 for(const q of form){
  const value=answers[q.id]
  if(value==null||value===''){err(draft||!q.required,'Responda: '+q.title);continue}
  if(q.type==='rating'){err(Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=5,'A nota deve estar entre 1 e 5.');validated[q.id]=Number(value)}
  else if(q.type==='text')validated[q.id]=text(value,3500)
  else if(q.type==='single'){err(typeof value==='string'&&q.choices.includes(value),'Escolha uma alternativa válida.');validated[q.id]=value}
  else if(q.type==='yesno'){err(value===true||value===false||value==='yes'||value==='no','Escolha sim ou não.');validated[q.id]=value===true||value==='yes'}
 }
 return validated
}
const perspectives=['self','leader','peer','report']
const formFor=(cycle,perspective)=>({self:cycle.selfQuestions,leader:cycle.leaderQuestions,peer:cycle.peerQuestions,report:cycle.reportQuestions})[perspective]||[]
const cyclePerson=(state,c,p)=>eligibleReviewer(state,c,p)?publicUser(state,p):{id:p,name:"Vínculo fora da empresa",role:"",companyId:"",managerId:""}
const taskSummary=(t,state,c)=>({...summarizeTask(t),subjectName:cyclePerson(state,c,t.subjectId).name})
function reviewScore(task,cycle){const form=formFor(cycle,task.perspective);let numerator=0,denominator=0;for(const q of form){if(q.type!=='rating')continue;const v=task.answers?.[q.id];if(Number.isFinite(v)){numerator+=v*q.weight;denominator+=q.weight}}return denominator?Math.round(numerator/denominator*100)/100:null}
// Peer/direct-report results are confidential but not anonymous at storage level.
// Only aggregate scores from >=3 distinct reviewers are released, never comments or identities.
function subjectResults(c,tasks,subjectId){
 const results=[]
 for(const perspective of perspectives){
  const rows=tasks.filter(t=>t.subjectId===subjectId&&t.perspective===perspective&&t.status==='submitted')
  if(!rows.length)continue
  if(['peer','report'].includes(perspective)){
   const scores=rows.map(t=>reviewScore(t,c)).filter(Number.isFinite)
   const qualified=new Set(rows.filter(t=>Number.isFinite(reviewScore(t,c))).map(t=>t.reviewerId)).size>=3
   results.push({perspective,score:qualified?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*100)/100:null,suppressed:!qualified,aggregate:true})
  }else for(const t of rows)results.push({perspective,score:reviewScore(t,c),answers:t.answers})
 }
 return results
}
const originalScore=(c,tasks,person)=>{const scores=subjectResults(c,tasks,person).map(r=>r.score).filter(Number.isFinite);return scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*100)/100:null}
const calibrationFor=(c,person)=>(c.calibrations||[]).filter(x=>x.personId===person).at(-1)||null
function assertCycleManagement(state,domain,user,c){err(isManage(user),'Somente RH/DHO e administração gerenciam ciclos.',403);ensureCompany(state,domain,user,c.companyId)}
function eligibleReviewer(state,cycle,person){return Boolean(own(state,person)&&(company(state,person)===cycle.companyId||(!company(state,person)&&cycle.participants.includes(person)&&own(state,person)?.role==='Administrador')))}
function summaryCycle(c,db,state,user,domain){
 const mayManage=isManage(user)&&allowed(state,domain,user).includes(c.companyId)
 const scoped=db.reviews.filter(t=>t.cycleId===c.id&&(mayManage||t.reviewerId===user.id||t.subjectId===user.id||canViewPerson(state,domain,user,t.subjectId)&&user.role==='Líder'))
 const assigned=db.reviews.filter(t=>t.cycleId===c.id).length
 const submitted=db.reviews.filter(t=>t.cycleId===c.id&&t.status==='submitted').length
 const mine=db.reviews.filter(t=>t.cycleId===c.id&&t.reviewerId===user.id&&eligibleReviewer(state,c,user.id)&&eligibleReviewer(state,c,t.subjectId)).map(t=>taskSummary(t,state,c))
 return {id:c.id,title:c.title,description:c.description,companyId:c.companyId,startDate:c.startDate,endDate:c.endDate,status:c.status,
  releaseResults:c.releaseResults,includeSelf:c.includeSelf,includeLeader:c.includeLeader,includePeer:!!c.includePeer,includeReports:!!c.includeReports,requireCalibration:!!c.requireCalibration,
  isManager:mayManage,assigned:mayManage?assigned:undefined,submitted:mayManage?submitted:undefined,
  assignedSubjects:mayManage?c.participants.length:undefined,mine,
  createdAt:c.createdAt,revision:c.revision,questionsCount:perspectives.reduce((n,p)=>n+formFor(c,p).length,0),
  canTake:mine.some(t=>t.status!=='submitted')}
}
function cycleVisible(c,state,user,domain,db){return isManage(user)&&allowed(state,domain,user).includes(c.companyId)||c.status!=='draft'&&eligibleReviewer(state,c,user.id)&&(c.participants.includes(user.id)||db.reviews.some(t=>t.cycleId===c.id&&t.reviewerId===user.id))}
function cycleList(s,state,user,domain){return s.cycles.filter(c=>cycleVisible(c,state,user,domain,s)).map(c=>summaryCycle(c,s,state,user,domain)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
const cycleView=(c,db,state,user,domain)=>{
 const summary=summaryCycle(c,db,state,user,domain),tasks=db.reviews.filter(t=>t.cycleId===c.id)
 const myTasks=tasks.filter(t=>t.reviewerId===user.id&&eligibleReviewer(state,c,user.id)&&eligibleReviewer(state,c,t.subjectId)).map(t=>taskSummary(t,state,c))
 const managing=summary.isManager
 return {...summary,selfQuestions:myTasks.length||managing?c.selfQuestions:[],leaderQuestions:myTasks.length||managing?c.leaderQuestions:[],peerQuestions:managing?c.peerQuestions||[]:[],reportQuestions:managing?c.reportQuestions||[]:[],
  departmentIds:managing?c.departmentIds:undefined,participants:managing?c.participants.map(p=>cyclePerson(state,c,p)):undefined,
  tasks:managing?tasks.map(t=>({...summarizeTask(t),subject:cyclePerson(state,c,t.subjectId),reviewer:cyclePerson(state,c,t.reviewerId)})):myTasks,
  calibration:managing&&c.status!=='draft'?c.participants.map(personId=>({personId,name:cyclePerson(state,c,personId).name,original:originalScore(c,tasks,personId),proposal:calibrationFor(c,personId)})):undefined,
  results:c.releaseResults?subjectResults(c,tasks,user.id):undefined,
  finalScore:c.releaseResults?(calibrationFor(c,user.id)?.approvedAt?calibrationFor(c,user.id).proposed:originalScore(c,tasks,user.id)):undefined}
}
function pdiVisible(state,domain,user,entry){return canViewPerson(state,domain,user,entry.personId)}
function meetingVisible(user,x){return x.participants.includes(user.id)}
function feedbackVisible(user,x){return x.fromId===user.id||x.toId===user.id}
function findCompanyForAction(state,domain,user,personId){err(own(state,personId),'Pessoa não encontrada.',404);err(canEditPerson(state,domain,user,personId),'Pessoa fora do seu escopo de desenvolvimento.',403);const companyId=company(state,personId);err(companyId,'A pessoa precisa estar vinculada a uma empresa.',409);ensureCompany(state,domain,user,companyId);return companyId}
function performanceDates(b){err(isDate(b.startDate)&&isDate(b.endDate)&&b.startDate<=b.endDate,'Informe um período válido.')}
async function endpoint(req,ctx){
 const {BUCKET,DOMAIN}=ctx, url=new URL(req.url),path=url.pathname.slice('/api/lxp/v2/'.length),method=req.method
 const state=await source(BUCKET),user=getUser(req,state)
 if(method==='POST')err(req.headers.get('origin')===url.origin,'Origem inválida.',403)
 const current=await data(BUCKET),db=current.state
 const request=async()=>{try{return await req.json()}catch{err(false,'Dados JSON inválidos.')}}
 if(path==='me'&&method==='GET'){
  const ownCompany=company(state,user.id)
  return reply({user:{id:user.id,name:user.name,role:user.role,companyId:ownCompany,managerId:user.manager||''},canManage:isManage(user),
   canCreatePulse:canCreate(user),canConfigurePerformance:isManage(user),
   allowedCompanies:allowed(state,DOMAIN,user),requiresCompanyLink:!ownCompany,
   counts:{assignedCourses:state.enroll.filter(e=>e.person===user.id).length,completedCourses:state.enroll.filter(e=>e.person===user.id&&e.progress===100).length,
    activePDIs:db.pdiActions.filter(x=>x.personId===user.id&&x.status!=='done').length,pendingReviews:db.reviews.filter(x=>x.reviewerId===user.id&&x.status!=='submitted').length,
    pendingFeedback:db.feedbackRequests.filter(x=>x.toId===user.id&&x.status==='requested').length}})
 }
 if(path==='pulse'&&method==='GET')return reply({items:listPulses(state,user,db,DOMAIN),today:today()})
 if(path==='pulse'&&method==='POST'){
  err(canCreate(user),'Apenas administração, RH/DHO ou liderança podem criar pesquisas de pulso.',403)
  const b=await request();performanceDates(b)
  const audience=audienceIds(state,DOMAIN,user,b)
  const survey={id:id(),title:text(b.title,160),description:text(b.description,600,{optional:true}),startDate:b.startDate,endDate:b.endDate,
   companyId:audience.companyId,departmentIds:audience.departmentIds,participants:audience.participants,createdBy:user.id,createdAt:now(),status:'published'}
  const result=await change(BUCKET,s=>{checkCapacity(s,'pulses');s.pulses.push(survey);audit(s,user,'pulse.create',survey.id);return survey})
  return reply({id:result.id,participants:result.participants.length},201)
 }
 if(path==='pulse/answer'&&method==='POST'){
  const b=await request();const survey=db.pulses.find(x=>x.id===b.id)
  err(survey&&survey.participants.includes(user.id),'Pesquisa não atribuída ao seu perfil.',403)
  err(pulseStatus(survey)==='open','A pesquisa está fora do período de respostas.',409)
  const rating=Number(b.rating)
  err(Number.isInteger(rating)&&rating>=1&&rating<=5,'Escolha uma nota de 1 a 5.')
  const comment=text(b.comment,1300,{optional:true})
  await change(BUCKET,s=>{
   const present=s.pulses.find(x=>x.id===survey.id)
   err(present&&pulseStatus(present)==='open'&&present.participants.includes(user.id),'Pesquisa indisponível.',409)
   err(!s.pulseResponses.some(x=>x.surveyId===survey.id&&x.userId===user.id),'Você já respondeu a esta pesquisa.',409)
   checkCapacity(s,'pulseResponses');s.pulseResponses.push({id:id(),surveyId:survey.id,userId:user.id,rating,comment,at:now()});audit(s,user,'pulse.answer',survey.id)
  })
  return reply({ok:true})
 }
 if(path==='pulse/close'&&method==='POST'){
  err(canCreate(user),'Permissão insuficiente.',403);const b=await request()
  await change(BUCKET,s=>{const p=s.pulses.find(x=>x.id===b.id);err(p,'Pesquisa inexistente.',404);ensureCompany(state,DOMAIN,user,p.companyId);err(p.createdBy===user.id||isManage(user),'Somente o autor ou gestão de RH pode encerrar a pesquisa.',403);p.status='closed';audit(s,user,'pulse.close',p.id)})
  return reply({ok:true})
 }
 if(path==='performance'&&method==='GET')return reply({items:cycleList(db,state,user,DOMAIN)})
 if(path==='performance'&&method==='POST'){
  err(isManage(user),'Somente administração e RH/DHO configuram ciclos.',403)
  const b=await request();performanceDates(b)
  const target=audienceIds(state,DOMAIN,user,b)
  const self=bool(b.includeSelf),manager=bool(b.includeLeader),peer=bool(b.includePeer),reports=bool(b.includeReports)
  err(self||manager||peer||reports,'Habilite pelo menos um tipo de avaliação.')
  const payload={title:text(b.title,160),description:text(b.description,1200,{optional:true}),startDate:b.startDate,endDate:b.endDate,
   companyId:target.companyId,departmentIds:target.departmentIds,participants:target.participants,includeSelf:self,includeLeader:manager,
   selfQuestions:self?normalizeForm(b.selfQuestions):[],leaderQuestions:manager?normalizeForm(b.leaderQuestions):[],includePeer:peer,includeReports:reports,requireCalibration:bool(b.requireCalibration),peerQuestions:peer?normalizeForm(b.peerQuestions):[],reportQuestions:reports?normalizeForm(b.reportQuestions):[],
   releaseResults:false}
  const result=await change(BUCKET,s=>{
   if(b.id){const prev=s.cycles.find(x=>x.id===b.id);err(prev,'Ciclo inexistente.',404);ensureCompany(state,DOMAIN,user,prev.companyId);err(prev.companyId===payload.companyId,'A empresa do ciclo não pode ser trocada.',409);
    err(prev.status==='draft','Para preservar as avaliações, só edite ciclos em rascunho.',409);err(Number(b.revision)===prev.revision,'O ciclo mudou. Atualize a página.',409)
    Object.assign(prev,payload,{revision:prev.revision+1,updatedAt:now()});audit(s,user,'performance.update',prev.id);return prev}
   checkCapacity(s,'cycles');const cycle={...payload,id:id(),status:'draft',createdAt:now(),createdBy:user.id,revision:1};s.cycles.push(cycle);audit(s,user,'performance.create',cycle.id);return cycle
  })
  return reply({id:result.id,status:result.status,participants:result.participants.length},b.id?200:201)
 }
 if(path==='performance/publish'&&method==='POST'){
  err(isManage(user),'Permissão insuficiente.',403);const b=await request()
  const result=await change(BUCKET,s=>{
   const cycle=s.cycles.find(c=>c.id===b.id);err(cycle,'Ciclo não encontrado.',404);ensureCompany(state,DOMAIN,user,cycle.companyId)
   err(cycle.status==='draft','O ciclo já foi publicado ou encerrado.',409)
   err(Number(b.revision)===cycle.revision,'O ciclo foi alterado. Recarregue.',409)
   const tasks=[]
   const members=state.users.filter(u=>u.active&&company(state,u.id)===cycle.companyId)
   for(const subjectId of cycle.participants){
    if(!eligibleReviewer(state,cycle,subjectId))continue
    if(cycle.includeSelf&&own(state,subjectId))tasks.push({id:id(),cycleId:cycle.id,subjectId,reviewerId:subjectId,perspective:'self',status:'pending',answers:{},updatedAt:now()})
    const directManager=own(state,subjectId)?.manager
    if(cycle.includeLeader&&directManager&&own(state,directManager)&&company(state,directManager)===cycle.companyId)
     tasks.push({id:id(),cycleId:cycle.id,subjectId,reviewerId:directManager,perspective:'leader',status:'pending',answers:{},updatedAt:now()})
    const addReview=(reviewerId,perspective)=>tasks.push({id:id(),cycleId:cycle.id,subjectId,reviewerId,perspective,status:'pending',answers:{},updatedAt:now()})
    if(cycle.includePeer&&directManager){const peers=members.filter(u=>u.id!==subjectId&&u.manager===directManager);err(peers.length<=30,'Mais de 30 pares por avaliado: reduza o escopo organizacional antes de publicar.',409);for(const u of peers)addReview(u.id,'peer')}
    if(cycle.includeReports){const reports=members.filter(u=>u.id!==subjectId&&u.manager===subjectId);err(reports.length<=100,'Mais de 100 liderados diretos por avaliado.',409);for(const u of reports)addReview(u.id,'report')}

   }
   err(tasks.length>0,'Não existem avaliações para o público selecionado.',409)
   err(s.reviews.length+tasks.length<=MAX_ITEMS.reviews,'Quantidade de avaliações acima do limite.',409)
   s.reviews.push(...tasks);cycle.status='published';cycle.revision++;cycle.publishedAt=now();audit(s,user,'performance.publish',cycle.id)
   return {id:cycle.id,tasks:tasks.length,missingLeaders:cycle.includeLeader?cycle.participants.length-tasks.filter(t=>t.perspective==='leader').length:0}
  })
  return reply(result)
 }
 if(path==='performance/close'&&method==='POST'){
  err(isManage(user),'Permissão insuficiente.',403);const b=await request()
  const result=await change(BUCKET,s=>{const c=s.cycles.find(x=>x.id===b.id);err(c,'Ciclo inexistente.',404);ensureCompany(state,DOMAIN,user,c.companyId);err(c.status==='published','O ciclo não está aberto.',409);c.status=c.requireCalibration?'calibration':'closed';c.revision++;c.collectionClosedAt=now();if(c.status==='closed')c.closedAt=now();audit(s,user,'performance.close',c.id);return {ok:true,status:c.status}})
  return reply(result)
 }
 if(path==='performance/release'&&method==='POST'){
  err(isManage(user),'Permissão insuficiente.',403);const b=await request()
  await change(BUCKET,s=>{const c=s.cycles.find(x=>x.id===b.id);err(c,'Ciclo não encontrado.',404);ensureCompany(state,DOMAIN,user,c.companyId);err(c.status==='closed'&&!c.releaseResults,'Encerre o ciclo antes de liberar os resultados ou verifique se já foram publicados.',409);c.releaseResults=true;c.revision++;audit(s,user,'performance.release',c.id)})
  return reply({ok:true})
 }
 if(['performance/calibrate','performance/calibration/approve','performance/calibration/finish'].includes(path)&&method==='POST'){
  const b=await request();const result=await change(BUCKET,s=>{
   const c=s.cycles.find(x=>x.id===b.id);err(c,'Ciclo inexistente.',404);assertCycleManagement(state,DOMAIN,user,c);err(c.status==='calibration','O ciclo não está em calibração.',409);err(b.revision===c.revision,'Ciclo atualizado. Recarregue.',409)
   c.calibrations??=[];const tasks=s.reviews.filter(t=>t.cycleId===c.id)
   if(path==='performance/calibrate'){
    err(c.participants.includes(b.personId),'Pessoa não faz parte do ciclo.',403)
    const original=originalScore(c,tasks,b.personId);err(original!==null,'Sem nota original válida para calibrar.',409)
    err(typeof b.proposed==='number'&&Number.isFinite(b.proposed)&&b.proposed>=1&&b.proposed<=5,'Nota proposta de 1 a 5.')
    const prev=calibrationFor(c,b.personId);err(!prev||prev.approvedAt,'Aprovar a proposta anterior antes de outra calibração.',409)
    err(c.calibrations.length<5000,'Limite de registros de calibração.',409)
    c.calibrations.push({id:id(),personId:b.personId,original,proposed:Math.round(b.proposed*100)/100,justification:text(b.justification,1000),proposedBy:user.id,proposedAt:now(),approvedBy:null,approvedAt:null})
   }else if(path==='performance/calibration/approve'){
    const proposal=c.calibrations.find(x=>x.id===b.proposalId);err(proposal&&!proposal.approvedAt,'Proposta indisponível.',409);proposal.approvedAt=now();proposal.approvedBy=user.id
   }else{err(c.calibrations.every(x=>x.approvedAt),'Há propostas sem aprovação.',409);c.status='closed';c.closedAt=now()}
   c.revision++;audit(s,user,path,c.id);return {ok:true,status:c.status,revision:c.revision}
  });return reply(result)
 }
 if(path==='performance/pdi'&&method==='POST'){
  const b=await request();const result=await change(BUCKET,s=>{
   const c=s.cycles.find(x=>x.id===b.id);err(c,'Ciclo inexistente.',404);assertCycleManagement(state,DOMAIN,user,c);err(c.status==='closed'&&c.releaseResults,'Libere o resultado antes de criar uma ação de PDI.',409)
   err(c.participants.includes(b.personId)&&company(state,b.personId)===c.companyId&&own(state,b.personId),'Pessoa fora do escopo.',403)
   err(['70','20','10'].includes(b.mix)&&isDate(b.dueDate)&&uuid(b.requestId),'Modalidade, prazo ou identificador inválidos.')
   const prior=s.pdiActions.find(x=>x.source?.requestId===b.requestId);if(prior){err(prior.personId===b.personId&&prior.source.cycleId===c.id,'Identificador incompatível.',409);return {id:prior.id,idempotent:true}}
   checkCapacity(s,'pdiActions');const action={id:id(),personId:b.personId,companyId:c.companyId,title:text(b.title,150),description:text(b.description,1500,{optional:true}),mix:b.mix,status:'todo',dueDate:b.dueDate,evidence:'',createdAt:now(),updatedAt:now(),createdBy:user.id,revision:1,source:{cycleId:c.id,requestId:b.requestId,calibrationId:calibrationFor(c,b.personId)?.id||null}};s.pdiActions.push(action);audit(s,user,'performance.pdi',action.id);return {id:action.id,idempotent:false}
  });return reply(result,201)
 }
 if(path==='performance/cycle'&&method==='GET'){
  const c=db.cycles.find(x=>x.id===url.searchParams.get('id'));err(c&&cycleVisible(c,state,user,DOMAIN,db),'Ciclo indisponível.',404)
  return reply(cycleView(c,db,state,user,DOMAIN))
 }
 if(path==='performance/task'&&method==='GET'){
  const task=ownTask(state,db,user,url.searchParams.get('id')),c=db.cycles.find(x=>x.id===task.cycleId)
  err(c,'Ciclo inexistente.',404);err(eligibleReviewer(state,c,user.id)&&eligibleReviewer(state,c,task.subjectId),'Empresa da avaliação não autorizada.',403)
  return reply({task:summarizeTask(task),cycle:{id:c.id,title:c.title,startDate:c.startDate,endDate:c.endDate,status:c.status},
   form:formFor(c,task.perspective),subject:publicUser(state,task.subjectId),answers:task.answers||{}})
 }
 if(path==='performance/task'&&method==='POST'){
  const b=await request();const task=ownTask(state,db,user,b.id),c=db.cycles.find(x=>x.id===task.cycleId)
  err(c&&c.status==='published'&&today()>=c.startDate&&today()<=c.endDate,'Fora do período de avaliação.',409)
  err(task.status!=='submitted','Avaliação já finalizada.',409)
  err(eligibleReviewer(state,c,user.id)&&eligibleReviewer(state,c,task.subjectId),'Empresa da avaliação não autorizada.',403)
  const form=formFor(c,task.perspective),draft=b.submit!==true
  const answers=validateAnswers(form,b.answers,{draft})
  await change(BUCKET,s=>{
   const t=s.reviews.find(x=>x.id===task.id),cycle=s.cycles.find(x=>x.id===task.cycleId)
   err(t?.reviewerId===user.id&&t.status!=='submitted'&&cycle?.status==='published'&&today()>=cycle.startDate&&today()<=cycle.endDate,'Avaliação indisponível.',409)
   t.answers=answers;t.status=draft?'draft':'submitted';t.updatedAt=now();if(!draft)t.submittedAt=t.updatedAt;audit(s,user,draft?'performance.draft':'performance.submit',t.id)
  })
  return reply({ok:true,status:draft?'draft':'submitted'})
 }
 if(path==='growth'&&method==='GET'){
  return reply({items:db.pdiActions.filter(a=>pdiVisible(state,DOMAIN,user,a)).map(a=>({...a,person:publicUser(state,a.personId)})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))})
 }
 if(path==='growth'&&method==='POST'){
  const b=await request();const personId=b.personId||user.id;findCompanyForAction(state,DOMAIN,user,personId)
  err(['70','20','10'].includes(b.mix),'Informe a modalidade 70, 20 ou 10.')
  err(['todo','doing','done'].includes(b.status),'Situação inválida.')
  err(!b.dueDate||isDate(b.dueDate),'Prazo inválido.')
  const payload={title:text(b.title,150),description:text(b.description,1500,{optional:true}),mix:b.mix,status:b.status,dueDate:b.dueDate||'',evidence:text(b.evidence,1500,{optional:true})}
  const result=await change(BUCKET,s=>{
   if(b.id){const a=s.pdiActions.find(x=>x.id===b.id);err(a&&a.personId===personId,'Ação não encontrada.',404);err(Number(b.revision)===a.revision,'A ação foi alterada.',409);Object.assign(a,payload,{revision:a.revision+1,updatedAt:now()});audit(s,user,'pdi.update',a.id);return a}
   checkCapacity(s,'pdiActions');const a={id:id(),personId,companyId:company(state,personId),...payload,createdAt:now(),updatedAt:now(),createdBy:user.id,revision:1};s.pdiActions.push(a);audit(s,user,'pdi.create',a.id);return a
  });return reply({id:result.id},b.id?200:201)
 }
 if(path==='meetings'&&method==='GET')return reply({items:db.meetings.filter(x=>meetingVisible(user,x)).map(m=>({...m,privateNote:m.privateNotes?.[user.id]||'',privateNotes:undefined})).sort((a,b)=>b.date.localeCompare(a.date))})
 if(path==='meetings'&&method==='POST'){
  const b=await request(),other=own(state,b.otherId)
  err(other&&other.id!==user.id&&company(state,other.id)===company(state,user.id)&&company(state,user.id),'Escolha alguém da sua empresa.',403)
  err(isDate(b.date),'Informe a data da conversa.')
  const payload={date:b.date,agenda:text(b.agenda,1500),action:text(b.action,1500,{optional:true})}
  const result=await change(BUCKET,s=>{
   if(b.id){const m=s.meetings.find(x=>x.id===b.id);err(m&&m.participants.includes(user.id),'Conversa não encontrada.',404);Object.assign(m,payload,{updatedAt:now()});m.privateNotes??={};m.privateNotes[user.id]=text(b.privateNote,2000,{optional:true});audit(s,user,'oneonone.update',m.id);return m}
   checkCapacity(s,'meetings');const m={id:id(),participants:[user.id,other.id],...payload,privateNotes:{[user.id]:text(b.privateNote,2000,{optional:true})},createdAt:now(),updatedAt:now(),createdBy:user.id};s.meetings.push(m);audit(s,user,'oneonone.create',m.id);return m
  });return reply({id:result.id},b.id?200:201)
 }
 if(path==='feedback'&&method==='GET')return reply({items:db.feedbackRequests.filter(x=>feedbackVisible(user,x)).map(x=>({...x,from:publicUser(state,x.fromId),to:publicUser(state,x.toId)})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))})
 if(path==='feedback'&&method==='POST'){
  const b=await request();const recipient=own(state,b.toId)
  err(recipient&&recipient.id!==user.id&&company(state,user.id)&&company(state,user.id)===company(state,recipient.id),'Selecione um colega da sua empresa.',403)
  const result=await change(BUCKET,s=>{checkCapacity(s,'feedbackRequests');const item={id:id(),fromId:user.id,toId:recipient.id,topic:text(b.topic,300),status:'requested',answer:'',createdAt:now(),updatedAt:now()};s.feedbackRequests.push(item);audit(s,user,'feedback.request',item.id);return item})
  return reply({id:result.id},201)
 }
 if(path==='feedback/answer'&&method==='POST'){
  const b=await request();await change(BUCKET,s=>{const item=s.feedbackRequests.find(x=>x.id===b.id);err(item&&item.toId===user.id,'Solicitação de feedback não atribuída a você.',403);err(item.status==='requested','Feedback já respondido.',409);item.answer=text(b.answer,3500);item.status='answered';item.updatedAt=now();audit(s,user,'feedback.answer',item.id)})
  return reply({ok:true})
 }
 if(path==='overview'&&method==='GET'){
  const companyId=url.searchParams.get('company')||company(state,user.id)
  if(companyId)ensureCompany(state,DOMAIN,user,companyId)
  const applicable=db.cycles.filter(x=>!companyId||x.companyId===companyId)
  const responses=db.pulseResponses.filter(x=>db.pulses.some(p=>p.id===x.surveyId&&(!companyId||p.companyId===companyId)))
  return reply({role:user.role,companyId,canManage:isManage(user),
    personal:{pendingReviews:db.reviews.filter(t=>t.reviewerId===user.id&&t.status!=='submitted').length,openPdis:db.pdiActions.filter(x=>x.personId===user.id&&x.status!=='done').length,meetings:db.meetings.filter(x=>x.participants.includes(user.id)).length,pendingFeedback:db.feedbackRequests.filter(x=>x.toId===user.id&&x.status==='requested').length},
    management:isManage(user)?{activeCycles:applicable.filter(c=>c.status==='published').length,totalReviews:db.reviews.filter(t=>applicable.some(c=>c.id===t.cycleId)).length,completedReviews:db.reviews.filter(t=>t.status==='submitted'&&applicable.some(c=>c.id===t.cycleId)).length,pulseSurveys:db.pulses.filter(p=>!companyId||p.companyId===companyId).length,answersCount:responses.length}:undefined})
 }
 return reply({error:'Recurso inexistente.'},404)
}
export async function handleLxpV2(req,ctx){
 if(!new URL(req.url).pathname.startsWith('/api/lxp/v2/'))return null
 try{return await endpoint(req,ctx)}catch(e){return reply({error:e.status?e.message:'Não foi possível processar a solicitação.'},e.status||500)}
}
