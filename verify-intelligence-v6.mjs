import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
import {handleIntelligenceV6} from './people-intelligence-v6.mjs'
const db=new DatabaseSync(':memory:')
const companyA=randomUUID(),companyB=randomUUID()
const users=Array.from({length:9},(_,i)=>({id:randomUUID(),name:'Pessoa '+i,active:true,role:i===0?'Administrador':i===1?'Líder':i===2?'RH/DHO':'Colaborador',manager:i>2&&i<7?null:''}))
for(let i=3;i<7;i++)users[i].manager=users[1].id
const tokens=new Map(users.map(x=>[x.id,randomUUID()]))
const assignments=new Map(users.map((u,i)=>[u.id,{company_id:i===8?companyB:companyA}]))
const state={users,organization:{assignments},sessions:users.map(u=>({person:u.id,identity:'i-test',digest:createHash('sha256').update(tokens.get(u.id)).digest('hex'),until:Date.now()+500000}))}
const BUCKET={async get(key){return key==='system/state-v1'?{async json(){return state}}:null}}
const DOMAIN={allowedCompanies(_,u){return u.role==='Administrador'?[companyA,companyB]:[companyA]}}
const origin='https://learning.test'
let calls=0
async function call(user,params=''){
 calls++;const h={'oai-authenticated-user-id':'i-test'};if(user)h.cookie='learning='+tokens.get(user.id)
 const r=await handleIntelligenceV6(new Request(origin+'/api/intelligence/v6/summary'+params,{headers:h}),{BUCKET,DOMAIN,intelligenceDb:db})
 return {status:r.status,body:await r.json()}
}
const today=new Date().toISOString().slice(0,10)
try{
 assert.equal((await call(null)).status,401)
 assert.equal((await call(users[3])).status,403)
 assert.equal((await call(users[2],'?company='+companyB)).status,403,'RH não acessa outra empresa')
 assert.equal((await call(users[0],'?company=invalid')).status,403)
 assert.equal((await call(users[0],'?from=2025-09-01&to=2025-02-01')).status,400)
 const zero=await call(users[0],'?company='+companyA)
 assert.equal(zero.status,200);assert.equal(zero.body.sources.lxp.available,false)
 assert.equal(zero.body.sources.assessments.available,false)
 assert.equal(zero.body.sources.pulseSafe.available,false)
 assert.equal(zero.body.sources.kirkpatrick.available,false)
 db.exec(`CREATE TABLE lxp_discovery_events (id TEXT, user_id TEXT, company_id TEXT, course_id TEXT,event_type TEXT,event_date TEXT);
 CREATE TABLE lxp_discovery_bookmarks(user_id TEXT,course_id TEXT);
 CREATE TABLE lxp_discovery_ratings(user_id TEXT,course_id TEXT,score INTEGER);
 CREATE TABLE assessment_v6_forms(id TEXT,company_id TEXT,status TEXT);
 CREATE TABLE assessment_v6_attempts(form_id TEXT,user_id TEXT,score INTEGER,passed INTEGER,submitted_at TEXT);
 CREATE TABLE pulse_v5_surveys(id TEXT,company_id TEXT,starts_on TEXT,ends_on TEXT,status TEXT);
 CREATE TABLE pulse_v5_invites(survey_id TEXT,user_id TEXT,responded INTEGER);`)
 const course=randomUUID(),form=randomUUID(),survey=randomUUID()
 db.prepare('INSERT INTO lxp_discovery_events VALUES(?,?,?,?,?,?)').run(randomUUID(),users[3].id,companyA,course,'catalog_viewed',today)
 db.prepare('INSERT INTO lxp_discovery_events VALUES(?,?,?,?,?,?)').run(randomUUID(),users[3].id,companyA,course,'lesson_launch_requested',today)
 db.prepare('INSERT INTO lxp_discovery_bookmarks VALUES(?,?)').run(users[3].id,course)
 db.prepare('INSERT INTO lxp_discovery_ratings VALUES(?,?,?)').run(users[3].id,course,5)
 db.prepare('INSERT INTO assessment_v6_forms VALUES(?,?,?)').run(form,companyA,'published')
 db.prepare('INSERT INTO assessment_v6_attempts VALUES(?,?,?,?,?)').run(form,users[3].id,60,0,new Date().toISOString())
 db.prepare('INSERT INTO assessment_v6_attempts VALUES(?,?,?,?,?)').run(form,users[3].id,90,1,new Date().toISOString())
 db.prepare('INSERT INTO pulse_v5_surveys VALUES(?,?,?,?,?)').run(survey,companyA,'2020-01-01',today,'closed')
 for(let i=0;i<7;i++)db.prepare('INSERT INTO pulse_v5_invites VALUES(?,?,?)').run(survey,users[i].id,1)
 db.exec(`CREATE TABLE kirkpatrick_reactions_v7(company_id TEXT,course_id TEXT,clarity INTEGER,relevance INTEGER,applicability INTEGER,recommendation INTEGER,submitted_at TEXT);
 CREATE TABLE kirkpatrick_transfer_v7(company_id TEXT,course_id TEXT,application INTEGER,status TEXT,submitted_at TEXT);
 CREATE TABLE kirkpatrick_outcomes_v7(company_id TEXT,course_id TEXT,created_at TEXT);`)
 const shortCourse=randomUUID()
 // Six responses MUST remain invisible even if a different course has seven.
 for(let i=0;i<6;i++)db.prepare('INSERT INTO kirkpatrick_reactions_v7 VALUES(?,?,?,?,?,?,?)').run(companyA,shortCourse,1,1,1,0,new Date().toISOString())
 for(let i=0;i<7;i++){
  db.prepare('INSERT INTO kirkpatrick_reactions_v7 VALUES(?,?,?,?,?,?,?)').run(companyA,course,5,4,3,i<5?10:8,new Date().toISOString())
  db.prepare('INSERT INTO kirkpatrick_transfer_v7 VALUES(?,?,?,?,?)').run(companyA,course,4,'submitted',new Date().toISOString())
 }
 db.prepare('INSERT INTO kirkpatrick_outcomes_v7 VALUES(?,?,?)').run(companyA,course,new Date().toISOString())
 // Simulates a previous-tenant event from a transferred employee. Must not leak into A.
 db.prepare('INSERT INTO lxp_discovery_events VALUES(?,?,?,?,?,?)').run(randomUUID(),users[3].id,companyB,course,'catalog_viewed',today)
 const report=await call(users[0],'?company='+companyA)
 assert.equal(report.status,200,JSON.stringify(report.body))
 assert.equal(report.body.sources.lxp.metrics.catalogViews,1)
 assert.equal(report.body.sources.lxp.metrics.launchRequests,1)
 assert.equal(report.body.sources.lxp.metrics.bookmarks,1)
 assert.equal(report.body.sources.lxp.metrics.averageRating,5)
 assert.equal(report.body.sources.assessments.metrics.attempts,2)
 assert.equal(report.body.sources.assessments.metrics.participantAssessments,1)
 assert.equal(report.body.sources.assessments.metrics.passed,1)
 assert.equal(report.body.sources.assessments.metrics.averageBestScore,90)
 assert.equal(report.body.sources.pulseSafe.metrics.respondents,7)
 assert.equal(report.body.sources.pulseSafe.metrics.qualifiedSurveys,1)
 assert.equal(report.body.sources.kirkpatrick.metrics.qualifiedReactionCohorts,1)
 assert.equal(report.body.sources.kirkpatrick.metrics.reactionResponses,7)
 assert.equal(report.body.sources.kirkpatrick.metrics.meanClarity,5)
 assert.equal(report.body.sources.kirkpatrick.metrics.qualifiedTransferCohorts,1)
 assert.equal(report.body.sources.kirkpatrick.metrics.transferResponses,7)
 assert.equal(report.body.sources.kirkpatrick.metrics.recordedBusinessObservations,1)
 assert.ok(!JSON.stringify(report.body.sources.pulseSafe).includes(users[3].id),'Pulse não pode retornar IDs de pessoas')
 const leader=await call(users[1])
 assert.equal(leader.status,200)
 assert.equal(leader.body.sources.pulseSafe.available,false)
 assert.equal(leader.body.sources.kirkpatrick.available,false)
 assert.equal(leader.body.sources.lxp.available,true,'Líder com cinco pessoas no escopo pode consultar agregados');assert.equal(leader.body.sources.lxp.metrics.catalogViews,1)
 const empty=await call(users[0],'?company='+companyB)
 assert.equal(empty.status,200)
 assert.equal(empty.body.sources.lxp.available,false,'Empresa com menos de 5 pessoas deve ser suprimida')
 assert.equal(empty.body.sources.kirkpatrick.metrics.reactionResponses,null)
 db.close()
 console.log('PASSOU: Intelligence V6 — '+calls+' chamadas; fontes reais, multiempresa, limiares de confidencialidade, valores e períodos.')
}catch(e){try{db.close()}catch{};throw e}
