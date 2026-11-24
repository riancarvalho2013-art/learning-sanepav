/** Learning Sanepav V6 — cross-module analytical read model.
 * Uses authoritative events/attempts/survey counters already persisted in SQLite.
 * No invented historical events and no respondent-level Pulse output.
 */
import {DatabaseSync} from 'node:sqlite'
import {createHash} from 'node:crypto'
import {mkdirSync} from 'node:fs'
import {dirname} from 'node:path'
const ROOT='/api/intelligence/v6/'
const ID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i
const ROLES=new Set(['Administrador','RH/DHO','Diretoria','Líder'])
const arr=x=>Array.isArray(x)?x:[]
const check=(ok,message,status=400)=>{if(!ok)throw Object.assign(new Error(message),{status})}
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff'}})
const dateOk=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x
let shared
function getDb(ctx){if(ctx.intelligenceDb)return ctx.intelligenceDb;if(shared)return shared;const path=process.env.LEARNING_DB||'data/learning.sqlite';check(path!==':memory:','SQLite persistente necessário.',503);mkdirSync(dirname(path),{recursive:true});shared=new DatabaseSync(path);return shared}
const exists=(db,name)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
function userFrom(req,state){const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)learning=([^;]+)/)?.[1]||'',identity=req.headers.get('oai-authenticated-user-id')||'',digest=createHash('sha256').update(token).digest('hex');const s=arr(state.sessions).find(s=>s.digest===digest&&s.identity===identity&&s.until>Date.now()),u=arr(state.users).find(u=>u.id===s?.person&&u.active);check(u,'Faça login.',401);check(ROLES.has(u.role),'Relatórios restritos à gestão autorizada.',403);return u}
const companyFor=(state,id)=>state.organization?.assignments?.get(id)?.company_id||''
function subordinate(state,leader,id){if(leader===id)return true;const visited=new Set();let u=arr(state.users).find(p=>p.id===id);while(u?.manager&&!visited.has(u.id)){if(u.manager===leader)return true;visited.add(u.id);u=state.users.find(p=>p.id===u.manager)}return false}
function scope(state,DOMAIN,user,params){
 const companies=arr(DOMAIN.allowedCompanies(state,user)),company=params.get('company')||''
 check(!company||ID.test(company)&&companies.includes(company),'Empresa não autorizada.',403)
 const from=params.get('from')||new Date(Date.now()-29*86400000).toISOString().slice(0,10),to=params.get('to')||new Date().toISOString().slice(0,10)
 check(dateOk(from)&&dateOk(to)&&from<=to&&(Date.parse(to)-Date.parse(from))<=366*86400000,'Selecione um período de até 366 dias.',400)
 const companyScope=new Set(company?[company]:companies)
 const people=arr(state.users).filter(p=>p.active&&companyScope.has(companyFor(state,p.id))&&(user.role!=='Líder'||subordinate(state,user.id,p.id))).map(x=>x.id)
 return {company,companies:[...companyScope],people,from,to,role:user.role}
}
function events(db,scope){
 if(!exists(db,'lxp_discovery_events'))return {available:false,reason:'A migração Discovery V4 ainda não foi criada.',metrics:null}
 if(scope.people.length<5)return {available:false,reason:'Público com menos de cinco pessoas.',metrics:null}
 const ids=JSON.stringify(scope.people),sql='user_id IN (SELECT value FROM json_each(?)) AND event_date BETWEEN ? AND ?',args=[ids,scope.from,scope.to]
 const rows=db.prepare(`SELECT event_type,COUNT(*) AS events,COUNT(DISTINCT user_id) AS people FROM lxp_discovery_events WHERE ${sql} GROUP BY event_type`).all(...args)
 const unique=db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM lxp_discovery_events WHERE ${sql}`).get(...args).n
 const counts=Object.fromEntries(rows.map(row=>[row.event_type,{events:row.events,people:row.people}]))
 const bookmarks=exists(db,'lxp_discovery_bookmarks')?db.prepare('SELECT COUNT(*) AS n FROM lxp_discovery_bookmarks WHERE user_id IN (SELECT value FROM json_each(?))').get(ids).n:null
 const ratings=exists(db,'lxp_discovery_ratings')?db.prepare('SELECT COUNT(*) AS n,AVG(score) AS mean FROM lxp_discovery_ratings WHERE user_id IN (SELECT value FROM json_each(?))').get(ids):{n:null,mean:null}
 const timeline=db.prepare(`SELECT event_date AS day,COUNT(*) AS events FROM lxp_discovery_events WHERE ${sql} GROUP BY event_date ORDER BY event_date`).all(...args)
 return {available:true,source:'lxp_discovery_events, lxp_discovery_bookmarks, lxp_discovery_ratings',metrics:{activePeople:unique,catalogViews:counts.catalog_viewed?.events||0,searches:counts.search_performed?.events||0,launchRequests:counts.lesson_launch_requested?.events||0,bookmarks,ratings:ratings.n,averageRating:ratings.mean===null?null:Math.round(ratings.mean*100)/100},timeline}
}
function assessments(db,scope){
 if(!exists(db,'assessment_v6_forms')||!exists(db,'assessment_v6_attempts'))return {available:false,reason:'O módulo de avaliações V6 ainda não possui dados.',metrics:null}
 if(scope.people.length<5)return {available:false,reason:'Público com menos de cinco pessoas.',metrics:null}
 const companyJson=JSON.stringify(scope.companies),ids=JSON.stringify(scope.people)
 const forms=db.prepare("SELECT COUNT(*) AS n FROM assessment_v6_forms WHERE company_id IN (SELECT value FROM json_each(?)) AND status IN ('published','archived')").get(companyJson).n
 const rows=db.prepare(`SELECT a.form_id,a.user_id,a.score,a.passed FROM assessment_v6_attempts a JOIN assessment_v6_forms f ON f.id=a.form_id WHERE f.company_id IN (SELECT value FROM json_each(?)) AND a.user_id IN (SELECT value FROM json_each(?)) AND substr(a.submitted_at,1,10) BETWEEN ? AND ?`).all(companyJson,ids,scope.from,scope.to)
 const people=new Map()
 for(const a of rows){const key=a.form_id+'|'+a.user_id,prior=people.get(key);if(!prior)people.set(key,{best:a.score,passed:Boolean(a.passed)});else{prior.best=Math.max(prior.best,a.score);prior.passed ||= Boolean(a.passed)}}
 const unique=[...people.values()],passed=unique.filter(x=>x.passed).length
 return {available:true,source:'assessment_v6_forms e assessment_v6_attempts',metrics:{publishedOrArchivedForms:forms,attempts:rows.length,participantAssessments:unique.length,passed,passRate:unique.length?Math.round(passed*10000/unique.length)/100:null,averageBestScore:unique.length?Math.round(unique.reduce((n,x)=>n+x.best,0)*100/unique.length)/100:null}}
}
function pulse(db,scope){
 if(scope.role==='Líder')return {available:false,reason:'Pesquisas corporativas não são abertas automaticamente ao gestor de equipe.',metrics:null}
 if(!exists(db,'pulse_v5_surveys')||!exists(db,'pulse_v5_invites'))return {available:false,reason:'Nenhuma pesquisa Pulse Seguro V5 inicializada.',metrics:null}
 // No department/person drill-through, and published surveys can only enter the
 // aggregate after closure and >=7 actual respondents per ORIGINAL audience.
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const surveyRows=db.prepare("SELECT id,starts_on,ends_on,status FROM pulse_v5_surveys WHERE company_id IN (SELECT value FROM json_each(?)) AND starts_on<=? AND ends_on>=?").all(JSON.stringify(scope.companies),scope.to,scope.from)
 let respondents=0,invited=0,qualified=0,suppressed=0
 for(const s of surveyRows){const closed=s.status==='closed'||s.ends_on<today,n=db.prepare('SELECT COUNT(*) AS n FROM pulse_v5_invites WHERE survey_id=? AND responded=1').get(s.id).n
  if(!closed||n<7){suppressed++;continue}
  const audience=db.prepare('SELECT COUNT(*) AS n FROM pulse_v5_invites WHERE survey_id=?').get(s.id).n
  invited+=audience;respondents+=n;qualified++
 }
 return {available:true,source:'pulse_v5_surveys e pulse_v5_invites (somente agregação)',metrics:{eligibleSurveys:surveyRows.length,qualifiedSurveys:qualified,suppressedSurveys:suppressed,invited:qualified?invited:null,respondents:qualified?respondents:null,responseRate:qualified&&invited?Math.round(respondents*10000/invited)/100:null},privacy:'Apenas pesquisas encerradas e com pelo menos sete participações são agregadas; sem respostas ou filtros individuais.'}
}
async function main(req,ctx){
 const raw=await ctx.BUCKET.get('system/state-v1');check(raw,'Ambiente não inicializado.',503)
 const state=await raw.json(),user=userFrom(req,state),url=new URL(req.url)
 check(req.method==='GET','Método não permitido.',405)
 const s=scope(state,ctx.DOMAIN,user,url.searchParams),db=getDb(ctx)
 if(url.pathname===ROOT+'summary'){
  const result={version:'6.0',generatedAt:new Date().toISOString(),filters:{company:s.company,from:s.from,to:s.to},mode:'estrutura_atual',peopleInScope:s.people.length,
   sources:{lxp:events(db,s),assessments:assessments(db,s),pulseSafe:pulse(db,s)},
   caveats:['Eventos de descoberta não são progresso nem conclusão comprovada.','Resultados de avaliação são classificados por formulário e pessoa (maior nota no período).','Pulse só aparece agregado após encerramento e limiar mínimo; não há corte individual.','Os vínculos organizacionais refletem a estrutura atual.']}
  return reply(result)
 }
 return reply({error:'Rota de inteligência não encontrada.'},404)
}
export async function handleIntelligenceV6(req,ctx){if(!new URL(req.url).pathname.startsWith(ROOT))return null;try{return await main(req,ctx)}catch(e){return reply({error:e.status?e.message:'Falha interna ao consultar inteligência corporativa.'},e.status||500)}}
