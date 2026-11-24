/**
 * Learning Sanepav — Pulse Seguro V5
 * New-survey engine. Does NOT convert legacy identified surveys to anonymous.
 * App-level unlinkability: respondent eligibility and numeric answer rows are stored
 * separately. Numeric answers are immediately aggregated into counters.
 * Results are only revealed after closure and 7+ responses, without segmentation.
 * Database administrators and operational side channels are outside this limited model.
 */
import {DatabaseSync} from 'node:sqlite'
import {createHash,randomUUID} from 'node:crypto'
import {mkdirSync} from 'node:fs'
import {dirname} from 'node:path'

const ROOT='/api/pulse/v5/'
const MANAGERS=new Set(['Administrador','RH/DHO','Líder'])
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY=/^\d{4}-\d{2}-\d{2}$/
const arr=value=>Array.isArray(value)?value:[]
const error=(condition,message,status=400)=>{if(!condition)throw Object.assign(new Error(message),{status})}
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}})
const dateOk=value=>typeof value==='string'&&DAY.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value
const today=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const g=k=>p.find(x=>x.type===k)?.value;return `${g('year')}-${g('month')}-${g('day')}`}
let shared
const prepared=new WeakSet()
function connection(ctx){
 if(ctx.pulseDb)return ctx.pulseDb
 if(shared)return shared
 const path=process.env.LEARNING_DB||'data/learning.sqlite'
 error(path!==':memory:','Configure um banco persistente para pesquisas Pulse.',503)
 mkdirSync(dirname(path),{recursive:true})
 shared=new DatabaseSync(path)
 return shared
}
function schema(db){
 if(prepared.has(db))return
 db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS pulse_v5_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);`)
 if(!db.prepare('SELECT 1 FROM pulse_v5_migrations WHERE version=1').get()){
  db.exec('BEGIN IMMEDIATE')
  try{
   db.exec(`
   CREATE TABLE IF NOT EXISTS pulse_v5_surveys(
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    title TEXT NOT NULL CHECK(length(title) BETWEEN 3 AND 150),
    description TEXT NOT NULL DEFAULT '',
    starts_on TEXT NOT NULL,
    ends_on TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('published','closed')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    closed_at TEXT
   );
   CREATE TABLE IF NOT EXISTS pulse_v5_questions(
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL REFERENCES pulse_v5_surveys(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('likert5','recommend10')),
    UNIQUE(survey_id,position)
   );
   CREATE TABLE IF NOT EXISTS pulse_v5_invites(
    survey_id TEXT NOT NULL REFERENCES pulse_v5_surveys(id) ON DELETE RESTRICT,
    user_id TEXT NOT NULL,
    responded INTEGER NOT NULL DEFAULT 0 CHECK(responded IN (0,1)),
    PRIMARY KEY(survey_id,user_id)
   );
   CREATE TABLE IF NOT EXISTS pulse_v5_answer_counts(
    survey_id TEXT NOT NULL REFERENCES pulse_v5_surveys(id) ON DELETE RESTRICT,
    question_id TEXT NOT NULL REFERENCES pulse_v5_questions(id) ON DELETE RESTRICT,
    value INTEGER NOT NULL CHECK(value BETWEEN 0 AND 10),
    answer_count INTEGER NOT NULL DEFAULT 0 CHECK(answer_count >= 0),
    PRIMARY KEY(survey_id,question_id,value)
    -- Deliberately NO user ID, session ID, token, timestamp or answer batch key.
   );
   CREATE INDEX IF NOT EXISTS pulse_v5_invites_user ON pulse_v5_invites(user_id,survey_id);
   CREATE INDEX IF NOT EXISTS pulse_v5_company ON pulse_v5_surveys(company_id,ends_on);
   `)
   db.prepare('INSERT INTO pulse_v5_migrations(version,applied_at) VALUES(1,?)').run(new Date().toISOString())
   db.exec('COMMIT')
  }catch(e){db.exec('ROLLBACK');throw e}
 }
 prepared.add(db)
}
function authenticated(req,state){
 const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1]||''
 const digest=createHash('sha256').update(token).digest('hex')
 const identity=req.headers.get('oai-authenticated-user-id')||''
 const session=arr(state.sessions).find(s=>s.digest===digest&&s.identity===identity&&s.until>Date.now())
 const user=arr(state.users).find(u=>u.id===session?.person&&u.active)
 error(user,'Entre na plataforma para continuar.',401)
 return user
}
function companyOf(state,id){return state.organization?.assignments?.get(id)?.company_id||null}
function isSubordinate(state,leader,id){
 if(leader===id)return true
 let u=arr(state.users).find(x=>x.id===id)
 const visited=new Set()
 while(u?.manager&&!visited.has(u.id)){
  if(u.manager===leader)return true
  visited.add(u.id)
  u=state.users.find(x=>x.id===u.manager)
 }
 return false
}
function canManageSurvey(state,user,domain,company,owner){
 if(!MANAGERS.has(user.role))return false
 if(!arr(domain.allowedCompanies(state,user)).includes(company))return false
 return user.role!=='Líder'||owner===user.id
}
function publicStatus(s){return s.status==='closed'||s.ends_on<today()?'closed':s.starts_on>today()?'scheduled':'open'}
const surveyQuestions=(db,id)=>db.prepare('SELECT id,title,type,position FROM pulse_v5_questions WHERE survey_id=? ORDER BY position').all(id)
function overview(db,s,state,user,domain){
 const manage=canManageSurvey(state,user,domain,s.company_id,s.created_by)
 const invite=db.prepare('SELECT responded FROM pulse_v5_invites WHERE survey_id=? AND user_id=?').get(s.id,user.id)
 if(!manage&&!invite)return null
 return {id:s.id,title:s.title,description:s.description,companyId:s.company_id,startDate:s.starts_on,endDate:s.ends_on,status:publicStatus(s),mine:Boolean(invite),answered:Boolean(invite?.responded),canManage:manage,
  // Only expose audience size to managers; learner sees just assignment.
  ...(manage?{invited:db.prepare('SELECT COUNT(*) AS count FROM pulse_v5_invites WHERE survey_id=?').get(s.id).count}:{}),
  questions:surveyQuestions(db,s.id)}
}
function inTransaction(db,fn){
 db.exec('BEGIN IMMEDIATE')
 try{const result=fn();db.exec('COMMIT');return result}
 catch(e){db.exec('ROLLBACK');throw e}
}
function options(state,user,domain){
 error(MANAGERS.has(user.role),'Somente RH e lideranças autorizadas podem criar pesquisas.',403)
 const allowed=arr(domain.allowedCompanies(state,user))
 const companies=arr(state.organization?.companies).filter(x=>allowed.includes(x.id)&&x.active!==false).map(x=>({id:x.id,name:x.name}))
 const people=arr(state.users).filter(p=>p.active&&allowed.includes(companyOf(state,p.id))&&(user.role!=='Líder'||isSubordinate(state,user.id,p.id)))
  .map(p=>({id:p.id,name:p.name,companyId:companyOf(state,p.id)}))
 return {companies,people,minimumParticipants:7,notice:'Pesquisas legadas com userId não são anonimizadas retroativamente.'}
}
function detail(db,id,user,state,domain){
 error(ID.test(id||''),'Pesquisa inválida.',400)
 const s=db.prepare('SELECT * FROM pulse_v5_surveys WHERE id=?').get(id)
 error(s,'Pesquisa não encontrada.',404)
 const visible=overview(db,s,state,user,domain)
 error(visible,'Pesquisa não encontrada.',404)
 return {s,visible}
}
async function handleOperation(req,context){
 const {BUCKET,DOMAIN}=context
 const db=connection(context);schema(db)
 const raw=await BUCKET.get('system/state-v1')
 error(raw,'Plataforma ainda não foi ativada.',503)
 const state=await raw.json()
 const user=authenticated(req,state)
 const url=new URL(req.url),route=url.pathname.slice(ROOT.length)
 const method=req.method
 if(method==='POST')error(req.headers.get('origin')===url.origin,'Origem não autorizada.',403)
 const body=async()=>{
  const contentLength=Number(req.headers.get('content-length')||0)
  error(contentLength<=32768,'Formulário excede o limite.',413)
  let b;try{b=await req.json()}catch{error(false,'Dados JSON inválidos.')}
  error(b&&typeof b==='object'&&!Array.isArray(b),'Dados inválidos.')
  return b
 }
 if(route==='options'&&method==='GET')return reply(options(state,user,DOMAIN))
 if(route==='list'&&method==='GET'){
  const rows=db.prepare('SELECT * FROM pulse_v5_surveys ORDER BY created_at DESC LIMIT 200').all()
  return reply({items:rows.map(s=>overview(db,s,state,user,DOMAIN)).filter(Boolean)})
 }
 if(route==='create'&&method==='POST'){
  const b=await body(),available=options(state,user,DOMAIN)
  error(typeof b.title==='string'&&b.title.trim().length>=3&&b.title.trim().length<=150,'Informe o nome da pesquisa.')
  error(typeof b.companyId==='string'&&available.companies.some(c=>c.id===b.companyId),'Empresa não autorizada.',403)
  error(dateOk(b.startDate)&&dateOk(b.endDate)&&b.startDate>=today()&&b.endDate>=b.startDate&&b.endDate<=`${Number(today().slice(0,4))+2}-12-31`,'Período inválido.')
  const peopleIds=arr(b.participantIds)
  const uniq=[...new Set(peopleIds)]
  error(peopleIds.length===uniq.length&&uniq.length>=7&&uniq.length<=3000,'Selecione ao menos 7 pessoas, sem duplicidade, e no máximo 3000.')
  const valid=new Set(available.people.filter(p=>p.companyId===b.companyId).map(p=>p.id))
  error(uniq.every(id=>valid.has(id)),'Participante fora do seu escopo.',403)
  const questions=arr(b.questions)
  error(questions.length>=1&&questions.length<=8,'Configure entre 1 e 8 perguntas.')
  for(const q of questions)error(typeof q.title==='string'&&q.title.trim().length>=5&&q.title.trim().length<=200&&['likert5','recommend10'].includes(q.type),'Pergunta ou escala inválida.')
  const surveyId=randomUUID(),now=new Date().toISOString()
  inTransaction(db,()=>{
   db.prepare('INSERT INTO pulse_v5_surveys(id,company_id,title,description,starts_on,ends_on,status,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(surveyId,b.companyId,b.title.trim(),String(b.description||'').trim().slice(0,500),b.startDate,b.endDate,'published',user.id,now)
   const pq=db.prepare('INSERT INTO pulse_v5_questions(id,survey_id,position,title,type) VALUES(?,?,?,?,?)')
   questions.forEach((q,i)=>pq.run(randomUUID(),surveyId,i+1,q.title.trim(),q.type))
   const pi=db.prepare('INSERT INTO pulse_v5_invites(survey_id,user_id) VALUES(?,?)')
   for(const person of uniq)pi.run(surveyId,person)
  })
  return reply({ok:true,id:surveyId})
 }
 if(route==='answer'&&method==='POST'){
  const b=await body();const {s,visible}=detail(db,b.id,user,state,DOMAIN)
  error(visible.mine,'Você não foi convidado para esta pesquisa.',403)
  error(publicStatus(s)==='open','A pesquisa está fora do período de resposta.',409)
  const questions=surveyQuestions(db,s.id)
  const values=arr(b.values)
  error(values.length===questions.length,'Responda todas as perguntas.',400)
  for(let i=0;i<questions.length;i++){
   const n=values[i],q=questions[i]
   error(Number.isInteger(n)&&(q.type==='likert5'?n>=1&&n<=5:n>=0&&n<=10),'Resposta fora da escala.',400)
  }
  inTransaction(db,()=>{
   const changed=db.prepare('UPDATE pulse_v5_invites SET responded=1 WHERE survey_id=? AND user_id=? AND responded=0').run(s.id,user.id)
   error(changed.changes===1,'Esta pesquisa já foi respondida.',409)
   const insert=db.prepare('INSERT INTO pulse_v5_answer_counts(survey_id,question_id,value,answer_count) VALUES(?,?,?,1) ON CONFLICT(survey_id,question_id,value) DO UPDATE SET answer_count=answer_count+1')
   // Only counts remain. No individual answer rows are retained.
   for(let i=0;i<questions.length;i++)insert.run(s.id,questions[i].id,values[i])
  })
  return reply({ok:true,message:'Respostas recebidas e agregadas, sem registro individual das escolhas.'})
 }
 if(route==='close'&&method==='POST'){
  const b=await body(),{s,visible}=detail(db,b.id,user,state,DOMAIN)
  error(visible.canManage,'Sem permissão para encerrar esta pesquisa.',403)
  inTransaction(db,()=>db.prepare("UPDATE pulse_v5_surveys SET status='closed',closed_at=? WHERE id=? AND status<>'closed'").run(new Date().toISOString(),s.id))
  return reply({ok:true})
 }
 if(route==='summary'&&method==='GET'){
  const {s,visible}=detail(db,url.searchParams.get('id'),user,state,DOMAIN)
  error(visible.canManage,'Relatório restrito à gestão da pesquisa.',403)
  const invited=db.prepare('SELECT COUNT(*) AS count FROM pulse_v5_invites WHERE survey_id=?').get(s.id).count
  const answered=db.prepare('SELECT COUNT(*) AS count FROM pulse_v5_invites WHERE survey_id=? AND responded=1').get(s.id).count
  const closed=publicStatus(s)==='closed'
  if(!closed||answered<7)return reply({surveyId:s.id,status:closed?'suppressed':'not-closed',minimumAggregate:7,reason:!closed?'Resultados disponíveis somente após encerramento.':'Menos de 7 participações: divulgação bloqueada.',summary:null})
  const summary=surveyQuestions(db,s.id).map(q=>{
   const distribution=Array.from({length:q.type==='likert5'?5:11},(_,i)=>({value:q.type==='likert5'?i+1:i,count:0}))
   const counts=db.prepare('SELECT value,answer_count AS n FROM pulse_v5_answer_counts WHERE survey_id=? AND question_id=?').all(s.id,q.id)
   for(const c of counts){const target=distribution.find(d=>d.value===c.value);if(target)target.count=c.n}
   const total=counts.reduce((n,c)=>n+c.n,0),sum=counts.reduce((n,c)=>n+c.value*c.n,0)
   const nps=q.type==='recommend10'&&total>0?Math.round(100*((distribution.filter(v=>v.value>=9).reduce((n,v)=>n+v.count,0)-distribution.filter(v=>v.value<=6).reduce((n,v)=>n+v.count,0))/total)):null
   return {questionId:q.id,title:q.title,type:q.type,count:total,mean:total?Math.round(sum/total*100)/100:null,nps,distribution}
  })
  return reply({surveyId:s.id,status:'available',minimumAggregate:7,summary:{title:s.title,invited,responded:answered,responseRate:Math.round(answered/invited*10000)/100,questions:summary},caveats:['Resultados agregados de uma única pesquisa encerrada.','Sem filtros por pessoa, equipe ou departamentos.','Não há exportação de respostas individualizadas.']})
 }
 return reply({error:'Rota Pulse não encontrada.'},404)
}
export async function handlePulseV5(req,context){
 if(!new URL(req.url).pathname.startsWith(ROOT))return null
 try{return await handleOperation(req,context)}catch(e){const status=Number.isInteger(e.status)?e.status:500;return reply({error:status===500?'Falha interna ao processar pesquisa.':e.message},status)}
}
