/**
 * Learning Sanepav — LXP Discovery V4
 * Eventos de interação, favoritos e avaliações; nunca aceita "conclusão" ou "nota"
 * como eventos enviados pelo navegador. Esses dados continuam sob responsabilidade do LMS.
 */
import {DatabaseSync} from 'node:sqlite'
import {createHash,randomUUID} from 'node:crypto'
import {dirname} from 'node:path'
import {mkdirSync} from 'node:fs'

const PREFIX='/api/discovery/v4/'
const TYPES=new Set(['catalog_viewed','search_performed','lesson_launch_requested'])
const MANAGERS=new Set(['Administrador','RH/DHO','Diretoria','Líder'])
const safeId=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const toArray=x=>Array.isArray(x)?x:[]
const check=(ok,msg,status=400)=>{if(!ok)throw Object.assign(new Error(msg),{status})}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'}})
const dateOk=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x
const normalizeDate=(x,days)=>x||new Date(Date.now()-days*86400000).toISOString().slice(0,10)
let sharedDatabase
const prepared=new WeakSet()
function getDb(ctx){
 if(ctx.eventDb)return ctx.eventDb
 if(sharedDatabase)return sharedDatabase
 const path=process.env.LEARNING_DB||'data/learning.sqlite'
 check(path!==':memory:','Um banco SQLite persistente é necessário para telemetria.',503)
 mkdirSync(dirname(path),{recursive:true})
 sharedDatabase=new DatabaseSync(path)
 return sharedDatabase
}
function schema(db){
 if(prepared.has(db))return
 db.exec('PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS lxp_discovery_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')
 const done=db.prepare('SELECT 1 FROM lxp_discovery_migrations WHERE version=1').get()
 if(!done){
  db.exec('BEGIN IMMEDIATE')
  try{
   db.exec(`

  CREATE TABLE IF NOT EXISTS lxp_discovery_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    company_id TEXT,
    course_id TEXT,
    event_type TEXT NOT NULL CHECK(event_type IN ('catalog_viewed','search_performed','lesson_launch_requested')),
    created_at TEXT NOT NULL,
    event_date TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS lxp_discovery_event_date ON lxp_discovery_events(event_date,event_type);
  CREATE INDEX IF NOT EXISTS lxp_discovery_event_user ON lxp_discovery_events(user_id,event_date);
  CREATE TABLE IF NOT EXISTS lxp_discovery_bookmarks (
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(user_id,course_id)
  );
  CREATE TABLE IF NOT EXISTS lxp_discovery_ratings (
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(user_id,course_id)
  );
 `)
   db.prepare('INSERT OR IGNORE INTO lxp_discovery_migrations (version,applied_at) VALUES (?,?)').run(1,new Date().toISOString())
   db.exec('COMMIT')
  }catch(err){db.exec('ROLLBACK');throw err}
 }
 prepared.add(db)
}
function identityFrom(req,state){
 const cookie=req.headers.get('cookie')||''
 const token=cookie.match(/(?:^|;\s*)learning=([^;]+)/)?.[1]||''
 const digest=createHash('sha256').update(token).digest('hex')
 const identity=req.headers.get('oai-authenticated-user-id')||''
 const session=toArray(state.sessions).find(s=>s.digest===digest&&s.identity===identity&&s.until>Date.now())
 const user=toArray(state.users).find(p=>p.id===session?.person&&p.active)
 check(user,'Entre no Learning para continuar.',401)
 return user
}
function companyFor(state,userId){return state.organization?.assignments?.get(userId)?.company_id||null}
function subordinate(state,leaderId,targetId){
 const seen=new Set();let person=toArray(state.users).find(u=>u.id===targetId)
 while(person?.manager&&!seen.has(person.id)){
  if(person.manager===leaderId)return true
  seen.add(person.id);person=state.users.find(u=>u.id===person.manager)
 }
 return false
}
function authorizedUsers(state,actor,domain,query){
 check(MANAGERS.has(actor.role),'Relatórios LXP reservados a gestores autorizados.',403)
 const companies=toArray(domain.allowedCompanies(state,actor))
 const company=query.get('company')||''
 check(!company||(safeId.test(company)&&companies.includes(company)),'Empresa fora do escopo.',403)
 const department=query.get('department')||''
 check(!department||safeId.test(department),'Departamento inválido.',400)
 const allowed=new Set(company?[company]:companies)
 const users=toArray(state.users).filter(person=>{
  if(!person.active)return false
  const cid=companyFor(state,person.id)
  if(cid&&!allowed.has(cid))return false
  if(!cid&&(actor.role!=='Administrador'||Boolean(company)))return false
  if(actor.role==='Líder'&&person.id!==actor.id&&!subordinate(state,actor.id,person.id))return false
  if(department&&state.organization?.assignments?.get(person.id)?.department_id!==department)return false
  return true
 })
 return {users,company,department}
}
function courseFrom(state,id){return toArray(state.courses).find(c=>c.id===id)}
function published(course){return Boolean(course&&(course.status||'published')==='published')}
function canLaunch(state,actor,course){
 return published(course)&&(MANAGERS.has(actor.role)&&['Administrador','RH/DHO'].includes(actor.role)
  ||toArray(state.enroll).some(e=>e.person===actor.id&&e.course===course.id))
}
async function payload(req){
 check(req.headers.get('origin')===new URL(req.url).origin,'Origem não autorizada.',403)
 check(req.headers.get('content-type')?.toLowerCase().includes('application/json'),'Content-Type inválido.',415)
 const size=Number(req.headers.get('content-length')||0)
 check(size<=4096,'Solicitação acima do limite.',413)
 let raw=''
 for await(const piece of req.body||[]){raw+=Buffer.from(piece).toString('utf8');check(Buffer.byteLength(raw)<=4096,'Solicitação acima do limite.',413)}
 let data;try{data=JSON.parse(raw)}catch{check(false,'JSON inválido.')}
 check(data&&typeof data==='object'&&!Array.isArray(data),'Corpo inválido.')
 return data
}
function addEvent(db,state,actor,data){
 check(TYPES.has(data.type),'Evento não registrado neste catálogo.',400)
 check(safeId.test(data.eventId),'Identificador do evento inválido.',400)
 let course=null
 if(data.type==='lesson_launch_requested'){
  check(safeId.test(data.courseId),'Curso inválido.',400)
  course=courseFrom(state,data.courseId)
  check(canLaunch(state,actor,course),'Curso indisponível para este usuário.',403)
 }else check(!data.courseId,'Este evento não admite ID de curso.',400)
 // Limita eventos repetidos, inclusive com IDs diferentes, para reduzir inflação de métricas.
 const windowMs=data.type==='catalog_viewed'?30000:data.type==='search_performed'?8000:10000
 const recent=db.prepare('SELECT id FROM lxp_discovery_events WHERE user_id=? AND event_type=? AND course_id IS ? AND created_at>=? LIMIT 1')
  .get(actor.id,data.type,course?.id||null,new Date(Date.now()-windowMs).toISOString())
 if(recent)return {ok:true,recorded:false,reason:'interaction_throttled'}
 const now=new Date().toISOString()
 const result=db.prepare('INSERT OR IGNORE INTO lxp_discovery_events (id,user_id,company_id,course_id,event_type,created_at,event_date) VALUES(?,?,?,?,?,?,?)')
  .run(data.eventId,actor.id,companyFor(state,actor.id),course?.id||null,data.type,now,now.slice(0,10))
 return {ok:true,recorded:result.changes===1}
}
function saveBookmark(db,state,actor,data){
 check(safeId.test(data.courseId)&&typeof data.bookmarked==='boolean','Favorito inválido.')
 const course=courseFrom(state,data.courseId)
 check(published(course),'Curso não publicado.',403)
 if(data.bookmarked)db.prepare('INSERT OR IGNORE INTO lxp_discovery_bookmarks(user_id,course_id,created_at) VALUES (?,?,?)').run(actor.id,course.id,new Date().toISOString())
 else db.prepare('DELETE FROM lxp_discovery_bookmarks WHERE user_id=? AND course_id=?').run(actor.id,course.id)
 return {ok:true,bookmarked:data.bookmarked}
}
function saveRating(db,state,actor,data){
 check(safeId.test(data.courseId)&&Number.isInteger(data.score)&&data.score>=1&&data.score<=5,'A avaliação deve estar entre 1 e 5.')
 const course=courseFrom(state,data.courseId)
 check(course,'Curso não encontrado.',404)
 check(toArray(state.enroll).some(e=>e.person===actor.id&&e.course===course.id&&e.progress===100),
  'Conclua o curso antes de avaliá-lo.',403)
 const now=new Date().toISOString()
 db.prepare(`INSERT INTO lxp_discovery_ratings(user_id,course_id,score,created_at,updated_at) VALUES (?,?,?,?,?)
  ON CONFLICT(user_id,course_id) DO UPDATE SET score=excluded.score,updated_at=excluded.updated_at`)
  .run(actor.id,course.id,data.score,now,now)
 return {ok:true,score:data.score}
}
function myDiscovery(db,state,actor){
 const eligible=toArray(state.courses).filter(published)
 const byId=new Map(eligible.map(x=>[x.id,x]))
 const favorites=db.prepare('SELECT course_id,created_at FROM lxp_discovery_bookmarks WHERE user_id=? ORDER BY created_at DESC').all(actor.id)
  .filter(x=>byId.has(x.course_id)).map(x=>({courseId:x.course_id,createdAt:x.created_at}))
 const ratings=db.prepare('SELECT course_id,score,updated_at FROM lxp_discovery_ratings WHERE user_id=? ORDER BY updated_at DESC').all(actor.id)
  .filter(x=>byId.has(x.course_id)).map(x=>({courseId:x.course_id,score:x.score,updatedAt:x.updated_at}))
 const rated=new Map(ratings.map(r=>[r.courseId,r.score]));const saved=new Set(favorites.map(x=>x.courseId))
 const completedTracks=new Set(toArray(state.enroll).filter(e=>e.person===actor.id&&e.progress===100).map(e=>courseFrom(state,e.course)?.track).filter(Boolean))
 const recommendations=eligible.filter(c=>!saved.has(c.id)&&!toArray(state.enroll).some(e=>e.person===actor.id&&e.course===c.id))
  .sort((a,b)=>Number(completedTracks.has(b.track))-Number(completedTracks.has(a.track))||String(a.title).localeCompare(String(b.title),'pt-BR'))
  .slice(0,12).map(c=>({courseId:c.id,title:c.title,track:c.track||'',type:c.type,minutes:c.minutes||null}))
 return {bookmarks:favorites,ratings,catalog:eligible.map(c=>({id:c.id,title:c.title,track:c.track||'',type:c.type,minutes:c.minutes||null,bookmarked:saved.has(c.id),myRating:rated.get(c.id)||null,completed:toArray(state.enroll).some(e=>e.person===actor.id&&e.course===c.id&&e.progress===100)})),recommendations}
}
function metrics(db,state,actor,domain,query){
 const {users,company,department}=authorizedUsers(state,actor,domain,query)
 const from=normalizeDate(query.get('from'),29),to=query.get('to')||new Date().toISOString().slice(0,10)
 check(dateOk(from)&&dateOk(to)&&from<=to,'Período inválido.',400)
 const days=(new Date(to+'T00:00:00Z')-new Date(from+'T00:00:00Z'))/86400000
 check(days<=366,'Selecione um período de no máximo 366 dias.',400)
 const scopedIds=users.map(p=>p.id)
 const base={from,to,company,department,peopleInScope:scopedIds.length,mode:'estrutura_organizacional_atual',source:'lxp_discovery_events',generatedAt:new Date().toISOString()}
 if(scopedIds.length<5)return {...base,suppressed:true,reason:'Menos de cinco pessoas no recorte; métricas de engajamento ocultas.',metrics:null,trend:[]}
 const people=JSON.stringify(scopedIds)
 const eventCompanies=company?[company]:domain.allowedCompanies(state,actor)
 const parameters=[people,JSON.stringify(eventCompanies),from,to]
 const where=`user_id IN (SELECT value FROM json_each(?)) AND company_id IN (SELECT value FROM json_each(?)) AND event_date BETWEEN ? AND ?`
 const rows=db.prepare(`SELECT event_type AS type, COUNT(*) AS events, COUNT(DISTINCT user_id) AS people FROM lxp_discovery_events WHERE ${where} GROUP BY event_type`).all(...parameters)
 const unique=db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM lxp_discovery_events WHERE ${where}`).get(...parameters).n
 const saves=db.prepare(`SELECT COUNT(*) AS n FROM lxp_discovery_bookmarks WHERE user_id IN (SELECT value FROM json_each(?))`).get(people).n
 const reviews=db.prepare(`SELECT COUNT(*) AS n,AVG(score) AS average FROM lxp_discovery_ratings WHERE user_id IN (SELECT value FROM json_each(?))`).get(people)
 const trend=db.prepare(`SELECT event_date AS day,COUNT(*) AS events,COUNT(DISTINCT user_id) AS people FROM lxp_discovery_events WHERE ${where} GROUP BY event_date ORDER BY event_date`).all(...parameters)
 const byType=Object.fromEntries(rows.map(r=>[r.type,{events:r.events,people:r.people}]))
 return {...base,suppressed:false,metrics:{activePeople:unique,eventsByType:byType,bookmarksCurrent:saves,ratingsCurrent:reviews.n,
  averageRating:reviews.n?Math.round(reviews.average*100)/100:null},trend}
}
async function main(req,ctx,db){
 const raw=await ctx.BUCKET.get('system/state-v1')
 check(raw,'Ambiente não inicializado.',503)
 const state=await raw.json()
 const actor=identityFrom(req,state)
 const url=new URL(req.url),route=url.pathname.slice(PREFIX.length)
 schema(db)
 if(route==='mine'&&req.method==='GET')return json(myDiscovery(db,state,actor))
 if(route==='metrics'&&req.method==='GET')return json(metrics(db,state,actor,ctx.DOMAIN,url.searchParams))
 if(req.method==='POST'){
  const body=await payload(req)
  if(route==='events')return json(addEvent(db,state,actor,body))
  if(route==='bookmarks')return json(saveBookmark(db,state,actor,body))
  if(route==='ratings')return json(saveRating(db,state,actor,body))
 }
 return json({error:'Recurso de descoberta não encontrado.'},404)
}
export async function handleDiscoveryV4(req,ctx){
 if(!new URL(req.url).pathname.startsWith(PREFIX))return null
 try{return await main(req,ctx,getDb(ctx))}
 catch(err){return json({error:err.status?err.message:'Falha interna no módulo de descobertas LXP.'},err.status||500)}
}
