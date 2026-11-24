/**
 * Learning Sanepav — Avaliações Educacionais V6
 * Incremental, authoritative server-side grading for single-choice assessments.
 * Legacy learning state remains the source of truth for courses/enrollments.
 * Assessments and attempts are persisted in separate normalized SQLite tables.
 * No automatic LMS completion or certificates are inferred from the exam result.
 * V7: server-enforced timed sessions, resumable drafts and consumption of attempts.
 * Existing assessment_v6 tables and API paths remain unchanged.
 */
import {DatabaseSync} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
import {mkdirSync} from 'node:fs'
import {dirname} from 'node:path'

const ROOT='/api/assessment/v6/'
const ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
const DATE=/^\d{4}-\d{2}-\d{2}$/
const MANAGERS=new Set(['Administrador','RH/DHO'])
const KINDS=new Set(['pre','post','final'])
const arr=v=>Array.isArray(v)?v:[]
const guard=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})}
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
const day=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const g=k=>parts.find(x=>x.type===k)?.value;return `${g('year')}-${g('month')}-${g('day')}`}
const dateOk=d=>typeof d==='string'&&DATE.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d
const trimmed=(v,min,max,field)=>{guard(typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max,field+' inválido.');return v.trim()}
let shared
const prepared=new WeakSet()
function database(ctx){
 if(ctx.assessmentDb)return ctx.assessmentDb
 if(shared)return shared
 const path=process.env.LEARNING_DB||'data/learning.sqlite'
 guard(path!==':memory:','É necessário um arquivo SQLite persistente.',503)
 mkdirSync(dirname(path),{recursive:true})
 shared=new DatabaseSync(path)
 return shared
}
function schema(db){
 if(prepared.has(db))return
 db.exec(`PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS assessment_v6_schema(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);`)
 if(!db.prepare('SELECT 1 FROM assessment_v6_schema WHERE version=1').get()){
  db.exec('BEGIN IMMEDIATE')
  try{
   db.exec(`
   CREATE TABLE IF NOT EXISTS assessment_v6_forms(
     id TEXT PRIMARY KEY,company_id TEXT NOT NULL,course_id TEXT NOT NULL,
     title TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('pre','post','final')),
     min_score INTEGER NOT NULL CHECK(min_score BETWEEN 0 AND 100),
     max_attempts INTEGER NOT NULL CHECK(max_attempts BETWEEN 1 AND 10),
     duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 1 AND 240),
     starts_on TEXT NOT NULL,ends_on TEXT NOT NULL,
     status TEXT NOT NULL CHECK(status IN ('draft','published','archived')),
     revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
     created_by TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
     published_at TEXT,archived_at TEXT
   );
   CREATE TABLE IF NOT EXISTS assessment_v6_questions(
     id TEXT PRIMARY KEY,form_id TEXT NOT NULL REFERENCES assessment_v6_forms(id) ON DELETE RESTRICT,
     position INTEGER NOT NULL,prompt TEXT NOT NULL,options_json TEXT NOT NULL,
     correct_index INTEGER NOT NULL,weight INTEGER NOT NULL CHECK(weight BETWEEN 1 AND 5),
     UNIQUE(form_id,position)
   );
   CREATE TABLE IF NOT EXISTS assessment_v6_attempts(
     id TEXT PRIMARY KEY,form_id TEXT NOT NULL REFERENCES assessment_v6_forms(id) ON DELETE RESTRICT,
     user_id TEXT NOT NULL,score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
     passed INTEGER NOT NULL CHECK(passed IN (0,1)),answers_json TEXT NOT NULL,
     submitted_at TEXT NOT NULL,UNIQUE(form_id,user_id,id)
   );
   CREATE TABLE IF NOT EXISTS assessment_v6_audit(
     id TEXT PRIMARY KEY,form_id TEXT NOT NULL,actor_id TEXT NOT NULL,action TEXT NOT NULL,
     happened_at TEXT NOT NULL,metadata_json TEXT NOT NULL DEFAULT '{}'
   );
   CREATE INDEX IF NOT EXISTS assessment_v6_company_status ON assessment_v6_forms(company_id,status,course_id);
   CREATE INDEX IF NOT EXISTS assessment_v6_attempt_form ON assessment_v6_attempts(form_id,user_id,submitted_at);
   CREATE INDEX IF NOT EXISTS assessment_v6_audit_form ON assessment_v6_audit(form_id,happened_at);
   `)
   db.prepare('INSERT INTO assessment_v6_schema VALUES(1,?)').run(new Date().toISOString())
   db.exec('COMMIT')
  }catch(e){db.exec('ROLLBACK');throw e}
 }
 // Additive V7 schema: preserves every V6 form, answer and existing submitted attempt.
 if(!db.prepare('SELECT 1 FROM assessment_v6_schema WHERE version=2').get()){
  db.exec('BEGIN IMMEDIATE')
  try{
   db.exec(`CREATE TABLE IF NOT EXISTS assessment_v7_sessions(
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES assessment_v6_forms(id) ON DELETE RESTRICT,
    user_id TEXT NOT NULL,
    started_at_ms INTEGER NOT NULL,
    expires_at_ms INTEGER NOT NULL,
    draft_json TEXT NOT NULL DEFAULT '[]',
    revision INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','submitted')),
    submitted_at_ms INTEGER,
    CHECK(expires_at_ms>started_at_ms)
   );
   CREATE INDEX IF NOT EXISTS assessment_v7_session_user ON assessment_v7_sessions(form_id,user_id,status,expires_at_ms);
   CREATE INDEX IF NOT EXISTS assessment_v7_session_expiry ON assessment_v7_sessions(status,expires_at_ms);
   `)
   db.prepare('INSERT INTO assessment_v6_schema(version,applied_at) VALUES(2,?)').run(new Date().toISOString())
   db.exec('COMMIT')
  }catch(error){db.exec('ROLLBACK');throw error}
 }
 prepared.add(db)
}
function tx(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}
function actor(req,state){
 const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1]||''
 const digest=createHash('sha256').update(token).digest('hex')
 const identity=req.headers.get('oai-authenticated-user-id')||''
 const session=arr(state.sessions).find(s=>s.digest===digest&&s.identity===identity&&s.until>Date.now())
 const user=arr(state.users).find(u=>u.id===session?.person&&u.active)
 guard(user,'Faça login para continuar.',401)
 return user
}
const companyFor=(state,userId)=>state.organization?.assignments?.get(userId)?.company_id||null
const manager=u=>MANAGERS.has(u.role)
const hasCompany=(state,domain,user,cid)=>arr(domain.allowedCompanies(state,user)).includes(cid)
const published=c=>(c?.status||'published')==='published'
const currentCourse=(state,cid)=>arr(state.courses).find(c=>c.id===cid&&published(c))
const hasEnroll=(state,userId,cid)=>arr(state.enroll).some(e=>e.person===userId&&e.course===cid)
const learningUnlocked=(state,userId,cid)=>{
 const enrollment=arr(state.enroll).find(e=>e.person===userId&&e.course===cid)
 return Boolean(enrollment&&arr(enrollment.prerequisites).every(required=>arr(state.enroll).some(e=>e.person===userId&&e.course===required&&e.progress===100)))
}
const datesOpen=f=>f.starts_on<=day()&&f.ends_on>=day()
function audit(db,formId,user,action,metadata={}){db.prepare('INSERT INTO assessment_v6_audit VALUES(?,?,?,?,?,?)').run(randomUUID(),formId,user.id,action,new Date().toISOString(),JSON.stringify(metadata))}
function verifyForm(b){
 const title=trimmed(b.title,3,160,'Título'),kind=b.kind||'final'
 guard(KINDS.has(kind),'Tipo de avaliação inválido.')
 guard(ID.test(b.courseId||'')&&ID.test(b.companyId||''),'Curso ou empresa inválidos.')
 guard(Number.isInteger(b.minScore)&&b.minScore>=0&&b.minScore<=100,'Nota de aprovação inválida.')
 guard(Number.isInteger(b.maxAttempts)&&b.maxAttempts>=1&&b.maxAttempts<=10,'Limite de tentativas inválido.')
 guard(Number.isInteger(b.durationMinutes)&&b.durationMinutes>=1&&b.durationMinutes<=240,'Duração estimada inválida.')
 guard(dateOk(b.startsOn)&&dateOk(b.endsOn)&&b.endsOn>=b.startsOn,'Período inválido.')
 const questions=arr(b.questions)
 guard(questions.length>=1&&questions.length<=40,'Informe de 1 a 40 perguntas.')
 const cleaned=questions.map((q,i)=>{
  const prompt=trimmed(q.prompt,5,500,'Pergunta '+(i+1))
  const opts=arr(q.options)
  guard(opts.length>=2&&opts.length<=8,'Use de 2 a 8 alternativas por pergunta.')
  const options=opts.map((x,j)=>trimmed(x,1,240,'Alternativa '+(j+1)))
  guard(new Set(options.map(x=>x.toLowerCase())).size===options.length,'Alternativas duplicadas na pergunta '+(i+1)+'.')
  guard(Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<options.length,'Marque a alternativa correta da pergunta '+(i+1)+'.')
  const weight=q.weight??1
  guard(Number.isInteger(weight)&&weight>=1&&weight<=5,'Peso inválido na pergunta '+(i+1)+'.')
  return {prompt,options,correctIndex:q.correctIndex,weight}
 })
 return {title,kind,courseId:b.courseId,companyId:b.companyId,minScore:b.minScore,maxAttempts:b.maxAttempts,durationMinutes:b.durationMinutes,startsOn:b.startsOn,endsOn:b.endsOn,questions:cleaned}
}
function questions(db,formId,withAnswers=false){return db.prepare('SELECT id,position,prompt,options_json,correct_index,weight FROM assessment_v6_questions WHERE form_id=? ORDER BY position').all(formId).map(q=>({id:q.id,position:q.position,prompt:q.prompt,options:JSON.parse(q.options_json),weight:q.weight,...(withAnswers?{correctIndex:q.correct_index}:{})}))}
function replaceQuestions(db,id,qs){
 db.prepare('DELETE FROM assessment_v6_questions WHERE form_id=?').run(id)
 const insert=db.prepare('INSERT INTO assessment_v6_questions VALUES(?,?,?,?,?,?,?)')
 qs.forEach((q,i)=>insert.run(randomUUID(),id,i+1,q.prompt,JSON.stringify(q.options),q.correctIndex,q.weight))
}
function getForm(db,id){guard(ID.test(id||''),'Identificador inválido.');const item=db.prepare('SELECT * FROM assessment_v6_forms WHERE id=?').get(id);guard(item,'Avaliação não encontrada.',404);return item}
function canAccess(state,domain,user,form){
 if(!hasCompany(state,domain,user,form.company_id))return false
 if(manager(user))return true
 return form.status==='published'&&companyFor(state,user.id)===form.company_id&&hasEnroll(state,user.id,form.course_id)
}
function canEdit(state,domain,user,form){return manager(user)&&hasCompany(state,domain,user,form.company_id)}
function myAttempts(db,formId,uid){return db.prepare('SELECT id,score,passed,submitted_at FROM assessment_v6_attempts WHERE form_id=? AND user_id=? ORDER BY submitted_at DESC').all(formId,uid).map(x=>({id:x.id,score:x.score,passed:!!x.passed,submittedAt:x.submitted_at}))}
function activeSession(db,fid,uid,now=Date.now()){
 return db.prepare("SELECT * FROM assessment_v7_sessions WHERE form_id=? AND user_id=? AND status='active' AND expires_at_ms>? ORDER BY started_at_ms DESC LIMIT 1").get(fid,uid,now)
}
function consumedSlots(db,fid,uid){
 // Submitted V7 sessions must not be counted twice; pre-V7 attempts still count.
 const sessions=db.prepare('SELECT COUNT(*) AS n FROM assessment_v7_sessions WHERE form_id=? AND user_id=?').get(fid,uid).n
 const legacy=db.prepare('SELECT COUNT(*) AS n FROM assessment_v6_attempts a WHERE a.form_id=? AND a.user_id=? AND NOT EXISTS (SELECT 1 FROM assessment_v7_sessions s WHERE s.id=a.id)').get(fid,uid).n
 return sessions+legacy
}
function validateDraft(input,qs,complete=false){
 guard(Array.isArray(input)&&input.length===qs.length,'A quantidade de respostas é inválida.',400)
 input.forEach((a,i)=>guard((!complete&&a===null)||(Number.isInteger(a)&&a>=0&&a<qs[i].options.length),'Resposta inválida na pergunta '+(i+1)+'.',400))
 return input
}
function formCard(db,f,user,manage,student=false){
 const attempts=myAttempts(db,f.id,user.id)
 const active=activeSession(db,f.id,user.id)
 const consumed=consumedSlots(db,f.id,user.id)
 return {id:f.id,companyId:f.company_id,courseId:f.course_id,title:f.title,kind:f.kind,minScore:f.min_score,maxAttempts:f.max_attempts,durationMinutes:f.duration_minutes,startsOn:f.starts_on,endsOn:f.ends_on,status:f.status,revision:f.revision,createdAt:f.created_at,publishedAt:f.published_at,questionsCount:db.prepare('SELECT COUNT(*) AS n FROM assessment_v6_questions WHERE form_id=?').get(f.id).n,canManage:manage,canAnswer:student&&f.status==='published'&&datesOpen(f)&&(Boolean(active)||consumed<f.max_attempts),activeAttempt:active?{id:active.id,expiresAt:new Date(active.expires_at_ms).toISOString()}:null,remainingAttempts:Math.max(0,f.max_attempts-consumed),attempts}
}
const csvEscape=x=>{let v=String(x??'');if(/^[\s\uFEFF]*[=+@\-\t\r]/u.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'}
function csvResults(rows){const columns=['personId','name','attempts','bestScore','passed','lastAttemptAt'];return '\ufeff'+[columns.join(';'),...rows.map(row=>columns.map(k=>csvEscape(row[k])).join(';'))].join('\r\n')}
// Completion reads the authoritative final forms and graded attempts, not client data.
export function readFinalAssessmentRequirements(ctx,companyId,courseId){
 if(!companyId)return []
 const db=database(ctx);schema(db)
 return db.prepare("SELECT id,title,revision FROM assessment_v6_forms WHERE company_id=? AND course_id=? AND kind='final' AND status='published' ORDER BY id").all(companyId,courseId).map(r=>({...r,passed:false}))
}
export function readFinalAssessmentPasses(ctx,ids,userId){
 if(!ids.length)return Object.create(null)
 const db=database(ctx);schema(db);const result=Object.create(null)
 const q=db.prepare('SELECT id,score,submitted_at FROM assessment_v6_attempts WHERE form_id=? AND user_id=? AND passed=1 ORDER BY score DESC,submitted_at,id LIMIT 1')
 for(const id of ids){const row=q.get(id,userId);if(row)result[id]=row}
 return result
}
async function operation(req,{BUCKET,DOMAIN,...ctx}){
 const db=database(ctx);schema(db)
 const raw=await BUCKET.get('system/state-v1');guard(raw,'Ambiente não inicializado.',503)
 const state=await raw.json(),user=actor(req,state)
 const url=new URL(req.url),path=url.pathname.slice(ROOT.length)
 if(req.method==='POST')guard(req.headers.get('origin')===url.origin,'Origem inválida.',403)
 const body=async()=>{guard(Number(req.headers.get('content-length')||0)<=90000,'Formulário acima do limite.',413);let b;try{b=await req.json()}catch{guard(false,'JSON inválido.')}guard(b&&typeof b==='object'&&!Array.isArray(b),'Dados inválidos.');return b}
 if(path==='options'&&req.method==='GET'){
  guard(manager(user),'Permissão de configuração restrita ao RH.',403)
  const ids=arr(DOMAIN.allowedCompanies(state,user))
  return json({companies:arr(state.organization?.companies).filter(c=>ids.includes(c.id)&&c.active!==false).map(c=>({id:c.id,name:c.name})),courses:arr(state.courses).filter(published).map(c=>({id:c.id,title:c.title,track:c.track||''}))})
 }
 if(path==='list'&&req.method==='GET'){
  const companies=arr(DOMAIN.allowedCompanies(state,user))
  const forms=db.prepare('SELECT * FROM assessment_v6_forms ORDER BY updated_at DESC LIMIT 500').all().filter(f=>companies.includes(f.company_id)&&canAccess(state,DOMAIN,user,f))
  return json({items:forms.map(f=>formCard(db,f,user,canEdit(state,DOMAIN,user,f),companyFor(state,user.id)===f.company_id&&hasEnroll(state,user.id,f.course_id)))})
 }
 if(path==='detail'&&req.method==='GET'){
  const f=getForm(db,url.searchParams.get('id'))
  guard(canAccess(state,DOMAIN,user,f),'Avaliação fora do seu escopo.',403)
  const manage=canEdit(state,DOMAIN,user,f)
  return json({...formCard(db,f,user,manage,companyFor(state,user.id)===f.company_id&&learningUnlocked(state,user.id,f.course_id)),questions:questions(db,f.id,manage),canEdit:manage&&f.status==='draft'})
 }
 if(path==='create'&&req.method==='POST'){
  guard(manager(user),'Criação restrita ao RH e administração.',403)
  const b=verifyForm(await body())
  guard(hasCompany(state,DOMAIN,user,b.companyId),'Empresa fora do seu escopo.',403)
  guard(currentCourse(state,b.courseId),'Curso inexistente ou não publicado.',409)
  const id=randomUUID(),now=new Date().toISOString()
  tx(db,()=>{
   db.prepare('INSERT INTO assessment_v6_forms(id,company_id,course_id,title,kind,min_score,max_attempts,duration_minutes,starts_on,ends_on,status,revision,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)')
    .run(id,b.companyId,b.courseId,b.title,b.kind,b.minScore,b.maxAttempts,b.durationMinutes,b.startsOn,b.endsOn,'draft',user.id,now,now)
   replaceQuestions(db,id,b.questions);audit(db,id,user,'created',{revision:1})
  })
  return json({id,revision:1,status:'draft'})
 }
 if(path==='update'&&req.method==='POST'){
  const rawBody=await body(),f=getForm(db,rawBody.id)
  guard(canEdit(state,DOMAIN,user,f),'Sem permissão para editar.',403)
  guard(f.status==='draft','Somente rascunhos podem ser editados.',409)
  guard(rawBody.revision===f.revision,'A avaliação mudou. Atualize antes de editar.',409)
  const b=verifyForm(rawBody)
  guard(b.companyId===f.company_id,'A empresa não pode ser trocada nesta versão.',409)
  guard(currentCourse(state,b.courseId),'Curso não publicado.',409)
  tx(db,()=>{const res=db.prepare(`UPDATE assessment_v6_forms SET title=?,course_id=?,kind=?,min_score=?,max_attempts=?,duration_minutes=?,starts_on=?,ends_on=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status='draft'`)
   .run(b.title,b.courseId,b.kind,b.minScore,b.maxAttempts,b.durationMinutes,b.startsOn,b.endsOn,new Date().toISOString(),f.id,f.revision)
   guard(res.changes===1,'A avaliação foi alterada por outra sessão.',409)
   replaceQuestions(db,f.id,b.questions);audit(db,f.id,user,'updated',{revision:f.revision+1})
  })
  return json({id:f.id,revision:f.revision+1})
 }
 if(['publish','archive'].includes(path)&&req.method==='POST'){
  const b=await body(),f=getForm(db,b.id)
  guard(canEdit(state,DOMAIN,user,f),'Sem permissão para alterar status.',403)
  guard(b.revision===f.revision,'Revisão desatualizada.',409)
  guard(path==='publish'?f.status==='draft':f.status==='published','Transição de status inválida.',409)
  if(path==='publish')guard(currentCourse(state,f.course_id),'O curso não está publicado.',409)
  if(path==='archive'&&f.kind==='final'){const pending=arr(state.enroll).filter(e=>e.progress!==100&&e.completionV11?.requirements?.some(r=>r.id===f.id));guard(pending.every(e=>Boolean(readFinalAssessmentPasses(ctx,[f.id],e.person)[f.id])),'Há matrículas aguardando aprovação nesta avaliação final. Não arquive antes de resolver as pendências.',409)}
  const status=path==='publish'?'published':'archived',now=new Date().toISOString()
  tx(db,()=>{const updated=db.prepare(`UPDATE assessment_v6_forms SET status=?,revision=revision+1,updated_at=?,${path==='publish'?'published_at':'archived_at'}=? WHERE id=? AND revision=?`).run(status,now,now,f.id,f.revision)
   guard(updated.changes===1,'Avaliação alterada por outra sessão.',409);audit(db,f.id,user,path,{revision:f.revision+1})})
  return json({ok:true,status,revision:f.revision+1})
 }
 if(path==='duplicate'&&req.method==='POST'){
  const b=await body(),f=getForm(db,b.id)
  guard(canEdit(state,DOMAIN,user,f),'Sem permissão para duplicar.',403)
  const id=randomUUID(),now=new Date().toISOString()
  tx(db,()=>{
   db.prepare('INSERT INTO assessment_v6_forms(id,company_id,course_id,title,kind,min_score,max_attempts,duration_minutes,starts_on,ends_on,status,revision,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)')
   .run(id,f.company_id,f.course_id,(f.title+' · cópia').slice(0,160),f.kind,f.min_score,f.max_attempts,f.duration_minutes,f.starts_on,f.ends_on,'draft',user.id,now,now)
   const rows=db.prepare('SELECT prompt,options_json,correct_index,weight FROM assessment_v6_questions WHERE form_id=? ORDER BY position').all(f.id)
   replaceQuestions(db,id,rows.map(r=>({prompt:r.prompt,options:JSON.parse(r.options_json),correctIndex:r.correct_index,weight:r.weight})))
   audit(db,id,user,'duplicated',{source:f.id})
  })
  return json({id,status:'draft',revision:1})
 }
 if(path==='start'&&req.method==='POST'){
  const b=await body(),f=getForm(db,b.id)
  guard(f.status==='published'&&datesOpen(f),'A avaliação não está aberta.',409)
  guard(companyFor(state,user.id)===f.company_id&&hasCompany(state,DOMAIN,user,f.company_id),'Empresa não autorizada.',403)
  guard(currentCourse(state,f.course_id)&&hasEnroll(state,user.id,f.course_id),'Matrícula inexistente ou curso indisponível.',403)
  guard(learningUnlocked(state,user.id,f.course_id),'Pré-requisitos pendentes.',403)
  const info=tx(db,()=>{
   const now=Date.now()
   db.prepare("UPDATE assessment_v7_sessions SET status='expired' WHERE form_id=? AND user_id=? AND status='active' AND expires_at_ms<=?").run(f.id,user.id,now)
   let session=activeSession(db,f.id,user.id,now)
   const resumed=Boolean(session)
   if(!session){
    guard(consumedSlots(db,f.id,user.id)<f.max_attempts,'Você atingiu o limite de tentativas (inclusive expiradas).',409)
    const token=randomUUID(),end=now+f.duration_minutes*60000
    db.prepare('INSERT INTO assessment_v7_sessions(id,form_id,user_id,started_at_ms,expires_at_ms,draft_json) VALUES(?,?,?,?,?,?)').run(token,f.id,user.id,now,end,JSON.stringify(questions(db,f.id).map(()=>null)))
    audit(db,f.id,user,'session_started',{sessionId:token})
    session=activeSession(db,f.id,user.id,now)
   }
   return {attemptId:session.id,expiresAt:new Date(session.expires_at_ms).toISOString(),serverNow:new Date(now).toISOString(),answers:JSON.parse(session.draft_json),revision:session.revision,resumed,remainingAttempts:Math.max(0,f.max_attempts-consumedSlots(db,f.id,user.id))}
  })
  return json(info)
 }
 if(path==='save'&&req.method==='POST'){
  const b=await body(),f=getForm(db,b.id)
  guard(f.status==='published'&&datesOpen(f),'Avaliação encerrada.',409)
  guard(companyFor(state,user.id)===f.company_id&&hasCompany(state,DOMAIN,user,f.company_id),'Empresa não autorizada.',403)
  guard(learningUnlocked(state,user.id,f.course_id),'Pré-requisitos pendentes.',403)
  guard(ID.test(b.attemptId||''),'Sessão inválida.',400)
  const qs=questions(db,f.id,true),answers=validateDraft(b.answers,qs)
  const saved=tx(db,()=>{
   const session=db.prepare('SELECT * FROM assessment_v7_sessions WHERE id=?').get(b.attemptId)
   guard(session&&session.form_id===f.id&&session.user_id===user.id,'Sessão não autorizada.',403)
   guard(session.status==='active'&&session.expires_at_ms>Date.now(),'Tempo da avaliação esgotado.',409)
   guard(session.revision===b.revision,'A avaliação mudou em outra aba. Reabra para recuperar as respostas.',409)
   const updated=db.prepare("UPDATE assessment_v7_sessions SET draft_json=?,revision=revision+1 WHERE id=? AND revision=? AND status='active' AND expires_at_ms>?").run(JSON.stringify(answers),session.id,session.revision,Date.now())
   guard(updated.changes===1,'Não foi possível salvar este rascunho.',409)
   return {ok:true,revision:session.revision+1,expiresAt:new Date(session.expires_at_ms).toISOString()}
  })
  return json(saved)
 }
 if(path==='submit'&&req.method==='POST'){
  const b=await body(),f=getForm(db,b.id)
  guard(f.status==='published'&&datesOpen(f),'A avaliação não está aberta.',409)
  guard(companyFor(state,user.id)===f.company_id&&hasCompany(state,DOMAIN,user,f.company_id),'Empresa não autorizada.',403)
  guard(currentCourse(state,f.course_id)&&hasEnroll(state,user.id,f.course_id),'Você precisa estar matriculado no curso publicado.',403)
  guard(learningUnlocked(state,user.id,f.course_id),'Conclua os pré-requisitos da trilha antes da avaliação.',403)
  guard(ID.test(b.attemptId||''),'Identificador de envio inválido.',400)
  const qs=questions(db,f.id,true),values=arr(b.answers)
  guard(values.length===qs.length,'Responda todas as perguntas.',400)
  values.forEach((a,i)=>guard(Number.isInteger(a)&&a>=0&&a<qs[i].options.length,'Resposta inválida na pergunta '+(i+1)+'.'))
  const total=qs.reduce((n,q)=>n+q.weight,0)
  const right=qs.reduce((n,q,i)=>n+(q.correctIndex===values[i]?q.weight:0),0)
  const score=Math.round(100*right/total),passed=score>=f.min_score
  const outcome=tx(db,()=>{
   const session=db.prepare('SELECT * FROM assessment_v7_sessions WHERE id=?').get(b.attemptId)
   guard(session&&session.form_id===f.id&&session.user_id===user.id,'Inicie uma sessão de avaliação autorizada.',403)
   const prior=db.prepare('SELECT form_id,user_id,score,passed,submitted_at FROM assessment_v6_attempts WHERE id=?').get(b.attemptId)
   if(prior){guard(prior.form_id===f.id&&prior.user_id===user.id,'Identificador de tentativa não pertence a esta avaliação.',409);return {ok:true,score:prior.score,passed:!!prior.passed,id: b.attemptId,submittedAt:prior.submitted_at,idempotent:true}}
   const now=Date.now()
   guard(session.status==='active'&&session.expires_at_ms>now,'Tempo da avaliação esgotado.',409)
   const when=new Date(now).toISOString()
   db.prepare('INSERT INTO assessment_v6_attempts VALUES(?,?,?,?,?,?,?)').run(b.attemptId,f.id,user.id,score,passed?1:0,JSON.stringify(values),when)
   db.prepare("UPDATE assessment_v7_sessions SET status='submitted',submitted_at_ms=?,draft_json='[]' WHERE id=?").run(now,session.id)
   audit(db,f.id,user,'submitted',{attemptId:b.attemptId,score,passed})
   return {ok:true,score,passed,id:b.attemptId,submittedAt:when,idempotent:false,attemptNumber:consumedSlots(db,f.id,user.id)}
  })
  // The grade is committed first. If the legacy state write is temporarily unavailable,
  // retain the grade and allow idempotent reconciliation without resubmitting answers.
  let completion=null,reconciliationPending=false
  if(outcome.passed&&f.kind==='final'&&ctx.onAssessmentSubmitted){
   try{completion=await ctx.onAssessmentSubmitted(req,f.course_id)}catch{reconciliationPending=true}
  }
  return json({...outcome,completion,reconciliationPending,note:'A aprovação só conclui a matrícula quando todas as evidências exigidas estiverem registradas.'})
 }
 if(path==='question-analysis'&&req.method==='GET'){
  const f=getForm(db,url.searchParams.get('id'))
  guard(canEdit(state,DOMAIN,user,f),'Análises por questão restritas ao RH autorizado.',403)
  const qs=questions(db,f.id,true),attempts=db.prepare('SELECT answers_json FROM assessment_v6_attempts WHERE form_id=?').all(f.id)
  const stats=qs.map((q,index)=>({position:q.position,prompt:q.prompt,weight:q.weight,respondents:0,correct:0,incorrect:0,accuracy:null}))
  for(const attempt of attempts){
   let answers=[];try{answers=JSON.parse(attempt.answers_json)}catch{continue}
   if(!Array.isArray(answers))continue
   stats.forEach((x,i)=>{if(Number.isInteger(answers[i])){x.respondents++;if(answers[i]===qs[i].correctIndex)x.correct++;else x.incorrect++}})
  }
  stats.forEach(x=>{x.accuracy=x.respondents?Math.round(x.correct*10000/x.respondents)/100:null})
  return json({formId:f.id,formTitle:f.title,totalAttempts:attempts.length,questions:stats,source:'assessment_v6_attempts',generatedAt:new Date().toISOString()})
 }
 if(['results','export.csv'].includes(path)&&req.method==='GET'){
  const f=getForm(db,url.searchParams.get('id'))
  guard(canEdit(state,DOMAIN,user,f),'Resultados restritos à gestão autorizada.',403)
  const attempts=db.prepare('SELECT user_id,score,passed,submitted_at FROM assessment_v6_attempts WHERE form_id=? ORDER BY submitted_at').all(f.id)
  const people=new Map(arr(state.users).filter(p=>companyFor(state,p.id)===f.company_id).map(p=>[p.id,p]))
  const by=new Map()
  for(const a of attempts){if(!people.has(a.user_id))continue;const p=people.get(a.user_id);let x=by.get(a.user_id)||{personId:a.user_id,name:p.name,attempts:0,bestScore:null,passed:false,lastAttemptAt:null};x.attempts++;x.bestScore=Math.max(x.bestScore??0,a.score);x.passed ||= Boolean(a.passed);x.lastAttemptAt=a.submitted_at;by.set(a.user_id,x)}
  const rows=[...by.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
  if(path==='export.csv'){
   guard(rows.length<=20000,'Exporte um conjunto menor de dados.',413)
   return new Response(csvResults(rows),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="avaliacoes-learning-v6.csv"','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
  }
  const attemptCount=rows.reduce((n,x)=>n+x.attempts,0),passed=rows.filter(x=>x.passed).length
  const page=Math.max(1,Math.min(1000,Number(url.searchParams.get('page'))||1))
  return json({id:f.id,formTitle:f.title,participants:rows.length,attempts:attemptCount,passed,passRate:rows.length?Math.round(10000*passed/rows.length)/100:null,averageBestScore:rows.length?Math.round(rows.reduce((n,x)=>n+x.bestScore,0)*100/rows.length)/100:null,page,pageSize:25,total:rows.length,rows:rows.slice((page-1)*25,page*25)})
 }
 return json({error:'Rota de avaliações não encontrada.'},404)
}
export async function handleAssessmentsV6(req,context){
 if(!new URL(req.url).pathname.startsWith(ROOT))return null
 try{return await operation(req,context)}catch(e){const status=Number.isInteger(e.status)?e.status:500;return json({error:status===500?'Falha interna no módulo de avaliações.':e.message},status)}
}
