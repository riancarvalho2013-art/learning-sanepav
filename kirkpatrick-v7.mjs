/**
 * Learning Sanepav — Kirkpatrick N1/N2/N3/N4 V7.
 * N1: identified reaction instrument after real LMS completion.
 * N2: paired pre/post evidence only when the forms are methodologically comparable.
 * N3: manager-rated transfer evidence 30/60/90 days.
 * N4: manually documented operational observations; NEVER asserts causality.
 */
import {pairedLearning} from './kirkpatrick-n2-v13.mjs'
import {DatabaseSync} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
import {dirname} from 'node:path'
import {mkdirSync} from 'node:fs'
const ROOT='/api/kirkpatrick/v7/'
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const ASSESS_DAYS=new Set([30,60,90])
const roles=new Set(['Administrador','RH/DHO'])
const array=v=>Array.isArray(v)?v:[]
const guard=(value,message,status=400)=>{if(!value)throw Object.assign(new Error(message),{status})}
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
const text=(v,max=350,{optional=false}={})=>{guard(typeof v==='string'&&(optional||v.trim().length>0)&&v.trim().length<=max,'Texto obrigatório ou acima do limite.');return v.trim()}
const scale=(v,min,max)=>{guard(Number.isInteger(v)&&v>=min&&v<=max,'Resposta fora da escala.');return v}
const dayOk=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v
const company=(s,id)=>s.organization?.assignments?.get(id)?.company_id||null
const now=()=>new Date().toISOString()
const businessToday=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=key=>parts.find(x=>x.type===key)?.value;return `${v('year')}-${v('month')}-${v('day')}`}
let singleton
const ready=new WeakSet()
function connect(ctx){
 if(ctx.kirkpatrickDb)return ctx.kirkpatrickDb
 if(singleton)return singleton
 const path=process.env.LEARNING_DB||'data/learning.sqlite'
 guard(path!==':memory:','Configure um banco SQLite persistente.',503)
 mkdirSync(dirname(path),{recursive:true})
 singleton=new DatabaseSync(path)
 return singleton
}
function setup(db){
 if(ready.has(db))return
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS kirkpatrick_schema_v7(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)')
 if(!db.prepare('SELECT 1 FROM kirkpatrick_schema_v7 WHERE version=1').get()){
  db.exec('BEGIN IMMEDIATE')
  try{
   db.exec(`
   CREATE TABLE IF NOT EXISTS kirkpatrick_reactions_v7(
    id TEXT PRIMARY KEY,company_id TEXT NOT NULL,course_id TEXT NOT NULL,
    user_id TEXT NOT NULL,enrollment_id TEXT NOT NULL UNIQUE,
    clarity INTEGER NOT NULL CHECK(clarity BETWEEN 1 AND 5),
    relevance INTEGER NOT NULL CHECK(relevance BETWEEN 1 AND 5),
    applicability INTEGER NOT NULL CHECK(applicability BETWEEN 1 AND 5),
    recommendation INTEGER NOT NULL CHECK(recommendation BETWEEN 0 AND 10),
    comment TEXT NOT NULL DEFAULT '',submitted_at TEXT NOT NULL,
    UNIQUE(course_id,user_id,enrollment_id)
   );
   CREATE TABLE IF NOT EXISTS kirkpatrick_transfer_v7(
    id TEXT PRIMARY KEY,company_id TEXT NOT NULL,course_id TEXT NOT NULL,
    enrollment_id TEXT NOT NULL,subject_id TEXT NOT NULL,reviewer_id TEXT NOT NULL,
    offset_days INTEGER NOT NULL CHECK(offset_days IN (30,60,90)),
    due_on TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','submitted')),
    application INTEGER CHECK(application BETWEEN 1 AND 5),
    barrier TEXT NOT NULL DEFAULT '',evidence TEXT NOT NULL DEFAULT '',action TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,submitted_at TEXT,
    UNIQUE(enrollment_id,offset_days)
   );
   CREATE TABLE IF NOT EXISTS kirkpatrick_outcomes_v7(
    id TEXT PRIMARY KEY,company_id TEXT NOT NULL,course_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,unit TEXT NOT NULL,baseline REAL NOT NULL,observed REAL NOT NULL,
    period_start TEXT NOT NULL,period_end TEXT NOT NULL,source TEXT NOT NULL,
    method TEXT NOT NULL,caveat TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS kp_reactions_course ON kirkpatrick_reactions_v7(company_id,course_id,submitted_at);
   CREATE INDEX IF NOT EXISTS kp_transfer_reviewer ON kirkpatrick_transfer_v7(reviewer_id,status,due_on);
   CREATE INDEX IF NOT EXISTS kp_transfer_course ON kirkpatrick_transfer_v7(company_id,course_id,status);
   CREATE INDEX IF NOT EXISTS kp_outcomes_course ON kirkpatrick_outcomes_v7(company_id,course_id,created_at);
   `)
   db.prepare('INSERT INTO kirkpatrick_schema_v7 VALUES(1,?)').run(now())
   db.exec('COMMIT')
  }catch(e){db.exec('ROLLBACK');throw e}
 }
 ready.add(db)
}
function transaction(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}
function actor(req,state){
 const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1]||''
 const digest=createHash('sha256').update(token).digest('hex')
 const identity=req.headers.get('oai-authenticated-user-id')||''
 const session=array(state.sessions).find(s=>s.digest===digest&&s.identity===identity&&s.until>Date.now())
 const u=array(state.users).find(u=>u.id===session?.person&&u.active)
 guard(u,'Entre no Learning para continuar.',401)
 return u
}
const availableCompany=(state,domain,user,companyId)=>ID.test(companyId||'')&&array(domain.allowedCompanies(state,user)).includes(companyId)
const isManager=user=>roles.has(user.role)
function completed(state,uid,courseId){
 return array(state.enroll).find(x=>x.person===uid&&x.course===courseId&&x.progress===100&&x.completed)
}
const courseFor=(state,courseId)=>array(state.courses).find(c=>c.id===courseId&&c.status!=='draft')
function sameCompany(state,uid,other){return company(state,uid)&&company(state,uid)===company(state,other)}
function transferTask(db,id){guard(ID.test(id||''),'Identificador inválido.');const row=db.prepare('SELECT * FROM kirkpatrick_transfer_v7 WHERE id=?').get(id);guard(row,'Acompanhamento não encontrado.',404);return row}
function summary(db,state,domain,user,companyId,courseId){
 guard(isManager(user)&&availableCompany(state,domain,user,companyId),'Relatório fora do escopo.',403)
 guard(ID.test(courseId||'')&&courseFor(state,courseId),'Curso inválido.',404)
 const reaction=db.prepare('SELECT COUNT(*) AS n,AVG(clarity) AS clarity,AVG(relevance) AS relevance,AVG(applicability) AS applicability, SUM(CASE WHEN recommendation>=9 THEN 1 ELSE 0 END) AS promoters,SUM(CASE WHEN recommendation<=6 THEN 1 ELSE 0 END) AS detractors FROM kirkpatrick_reactions_v7 WHERE company_id=? AND course_id=?').get(companyId,courseId)
 const transfers=db.prepare('SELECT COUNT(*) AS n, SUM(CASE WHEN status=\'submitted\' THEN 1 ELSE 0 END) AS submitted,AVG(CASE WHEN status=\'submitted\' THEN application ELSE NULL END) AS mean FROM kirkpatrick_transfer_v7 WHERE company_id=? AND course_id=?').get(companyId,courseId)
 const threshold=7,ratingsAvailable=reaction.n>=threshold,transferAvailable=(transfers.submitted||0)>=threshold
 const nps=ratingsAvailable?Math.round((reaction.promoters-reaction.detractors)*10000/reaction.n)/100:null
 const {changeSum,...educational}=pairedLearning(db,companyId,courseId)
 const outcomes=db.prepare('SELECT id,metric_name,unit,baseline,observed,period_start,period_end,source,method,caveat,created_at FROM kirkpatrick_outcomes_v7 WHERE company_id=? AND course_id=? ORDER BY created_at DESC LIMIT 50').all(companyId,courseId)
 return {companyId,courseId,generatedAt:now(),n1:{state:ratingsAvailable?'available':'insufficient_data',threshold,responseCount:ratingsAvailable?reaction.n:null,meanClarity:ratingsAvailable?Math.round(reaction.clarity*100)/100:null,meanRelevance:ratingsAvailable?Math.round(reaction.relevance*100)/100:null,meanApplicability:ratingsAvailable?Math.round(reaction.applicability*100)/100:null,nps},n2:educational,n3:{state:transferAvailable?'available':'insufficient_data',assigned:transfers.n,submitted:transfers.submitted||0,meanApplication:transferAvailable?Math.round(transfers.mean*100)/100:null},n4:{state:outcomes.length?'recorded_observations':'not_measured',observations:outcomes,warning:'Observações operacionais não estabelecem causalidade com o treinamento.'},privacy:'N1 é uma pesquisa identificada, mas o relatório apresenta apenas agregados com 7+ respostas. Notas individuais não são disponibilizadas por esta API.'}
}
async function handleOperation(req,{BUCKET,DOMAIN,...ctx}){
 const db=connect(ctx);setup(db)
 const raw=await BUCKET.get('system/state-v1');guard(raw,'Ambiente não inicializado.',503)
 const state=await raw.json(),user=actor(req,state),url=new URL(req.url),route=url.pathname.slice(ROOT.length)
 if(req.method==='POST')guard(req.headers.get('origin')===url.origin,'Origem inválida.',403)
 const body=async()=>{guard(Number(req.headers.get('content-length')||0)<=16000,'Corpo acima do limite.',413);let value;try{value=await req.json()}catch{guard(false,'JSON inválido.')}guard(value&&typeof value==='object'&&!Array.isArray(value),'Dados inválidos.');return value}
 if(route==='options'&&req.method==='GET'){
  const companies=array(state.organization?.companies).filter(c=>availableCompany(state,DOMAIN,user,c.id)&&c.active!==false).map(c=>({id:c.id,name:c.name}))
  const enrolled=array(state.enroll).filter(e=>e.person===user.id&&e.progress===100&&e.completed).map(e=>({id:e.id,courseId:e.course}))
  const visibleCourses=new Set(enrolled.map(e=>e.courseId));const courses=array(state.courses).filter(c=>c.status!=='draft'&&(isManager(user)||visibleCourses.has(c.id))).map(c=>({id:c.id,title:c.title,track:c.track||''}))
  return respond({companies,courses,enrollments:enrolled,canManage:isManager(user)})
 }
 if(route==='reaction'&&req.method==='POST'){
  const b=await body()
  guard(ID.test(b.courseId||'')&&courseFor(state,b.courseId),'Curso inválido.',404)
  const enrollment=completed(state,user.id,b.courseId)
  guard(enrollment&&company(state,user.id),'Reação disponível após conclusão válida e vínculo empresarial.',403)
  const values={clarity:scale(b.clarity,1,5),relevance:scale(b.relevance,1,5),applicability:scale(b.applicability,1,5),recommendation:scale(b.recommendation,0,10)}
  const comment=text(b.comment??'',600,{optional:true}),companyId=company(state,user.id)
  const result=transaction(db,()=>{
   guard(!db.prepare('SELECT 1 FROM kirkpatrick_reactions_v7 WHERE enrollment_id=?').get(enrollment.id),'Você já respondeu à avaliação de reação deste curso.',409)
   const id=randomUUID()
   db.prepare('INSERT INTO kirkpatrick_reactions_v7 VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,companyId,b.courseId,user.id,enrollment.id,values.clarity,values.relevance,values.applicability,values.recommendation,comment,now())
   return {ok:true,submitted:true,id}
  })
  return respond(result)
 }
 if(route==='transfer/assign'&&req.method==='POST'){
  guard(isManager(user),'Somente RH e administração atribuem acompanhamento.',403)
  const b=await body()
  guard(ID.test(b.courseId||'')&&courseFor(state,b.courseId),'Curso inválido.',404)
  guard(availableCompany(state,DOMAIN,user,b.companyId),'Empresa não autorizada.',403)
  guard(ASSESS_DAYS.has(b.offsetDays),'Escolha 30, 60 ou 90 dias.',400)
  const target=array(state.enroll).filter(e=>e.course===b.courseId&&e.progress===100&&e.completed&&company(state,e.person)===b.companyId)
  const assigned=transaction(db,()=>{
   let created=0,skipped=0
   for(const e of target){
    const person=state.users.find(x=>x.id===e.person&&x.active),manager=state.users.find(x=>x.id===person?.manager&&x.active)
    if(!person||!manager||!sameCompany(state,person.id,manager.id)){skipped++;continue}
    const date=new Date(Date.parse(e.completed)+b.offsetDays*86400000)
    if(Number.isNaN(date.getTime())){skipped++;continue}
    const due=date.toISOString().slice(0,10)
    const r=db.prepare('INSERT OR IGNORE INTO kirkpatrick_transfer_v7(id,company_id,course_id,enrollment_id,subject_id,reviewer_id,offset_days,due_on,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),b.companyId,b.courseId,e.id,person.id,manager.id,b.offsetDays,due,'pending',now())
    created+=r.changes
   }
   return {created,skipped}
  })
  return respond(assigned)
 }
 if(route==='transfer/tasks'&&req.method==='GET'){
  const list=db.prepare('SELECT * FROM kirkpatrick_transfer_v7 WHERE reviewer_id=? ORDER BY due_on LIMIT 200').all(user.id).filter(t=>company(state,user.id)===t.company_id)
  return respond({items:list.map(t=>({id:t.id,courseId:t.course_id,subjectId:t.subject_id,subject:state.users.find(x=>x.id===t.subject_id)?.name||'Colaborador',offsetDays:t.offset_days,dueOn:t.due_on,status:t.status,application:t.application,submittedAt:t.submitted_at,canAnswer:t.status==='pending'&&t.due_on<=businessToday()}))})
 }
 if(route==='transfer/submit'&&req.method==='POST'){
  const b=await body(),t=transferTask(db,b.id)
  guard(t.reviewer_id===user.id,'Acompanhamento não atribuído ao seu usuário.',403)
  guard(t.status==='pending','Acompanhamento já concluído.',409)
  guard(t.due_on<=businessToday(),'A avaliação de transferência ainda não está no período previsto.',409)
  guard(company(state,user.id)===t.company_id,'Empresa incompatível.',403)
  const application=scale(b.application,1,5),barrier=text(b.barrier??'',700,{optional:true}),evidence=text(b.evidence??'',1500,{optional:true}),action=text(b.action??'',700,{optional:true})
  transaction(db,()=>{
   const change=db.prepare("UPDATE kirkpatrick_transfer_v7 SET status='submitted',application=?,barrier=?,evidence=?,action=?,submitted_at=? WHERE id=? AND reviewer_id=? AND status='pending'").run(application,barrier,evidence,action,now(),t.id,user.id)
   guard(change.changes===1,'Outro envio atualizou a avaliação.',409)
  })
  return respond({ok:true,status:'submitted'})
 }
 if(route==='outcomes'&&req.method==='POST'){
  guard(isManager(user),'Somente RH e administração registram resultados.',403)
  const b=await body()
  guard(availableCompany(state,DOMAIN,user,b.companyId),'Empresa não autorizada.',403)
  guard(ID.test(b.courseId||'')&&courseFor(state,b.courseId),'Curso inválido.',404)
  guard(Number.isFinite(b.baseline)&&Number.isFinite(b.observed),'Informe números válidos.',400)
  guard(dayOk(b.periodStart)&&dayOk(b.periodEnd)&&b.periodStart<=b.periodEnd&&b.periodEnd<=businessToday(),'Informe um período de observação já encerrado.',400)
  const entry={id:randomUUID(),companyId:b.companyId,courseId:b.courseId,metricName:text(b.metricName,160),unit:text(b.unit,40),baseline:b.baseline,observed:b.observed,periodStart:b.periodStart,periodEnd:b.periodEnd,source:text(b.source,300),method:text(b.method,800),caveat:text(b.caveat??'Associação observada; não é prova de causalidade.',800),createdBy:user.id,createdAt:now()}
  transaction(db,()=>{db.prepare('INSERT INTO kirkpatrick_outcomes_v7 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(entry.id,entry.companyId,entry.courseId,entry.metricName,entry.unit,entry.baseline,entry.observed,entry.periodStart,entry.periodEnd,entry.source,entry.method,entry.caveat,entry.createdBy,entry.createdAt)})
  return respond(entry)
 }
 if(route==='summary'&&req.method==='GET')return respond(summary(db,state,DOMAIN,user,url.searchParams.get('company'),url.searchParams.get('course')))
 return respond({error:'Rota Kirkpatrick inexistente.'},404)
}
export async function handleKirkpatrickV7(req,ctx){
 if(!new URL(req.url).pathname.startsWith(ROOT))return null
 try{return await handleOperation(req,ctx)}catch(e){const status=Number.isInteger(e.status)?e.status:500;return respond({error:status===500?'Falha interna no módulo Kirkpatrick.':e.message},status)}
}
