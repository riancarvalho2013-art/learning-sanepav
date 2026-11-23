import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {handleDiscoveryV4} from './learning-discovery-v4.mjs'

const dirname=await mkdtemp(join(tmpdir(),'dna-discovery-'))
const databasePath=join(dirname,'test.sqlite')
const eventDb=new DatabaseSync(databasePath)
const origin='https://learning.example.test'
const companyA=randomUUID(),companyB=randomUUID(),department=randomUUID(),courseId=randomUUID(),draftCourseId=randomUUID()
const users=Array.from({length:7},(_,i)=>({id:randomUUID(),name:'Pessoa '+i,active:true,
 role:i===0?'Administrador':i===1?'Líder':'Colaborador',manager:i===2?'':i===3?'':i===4?'':i===5?'':i===6?'':null,
 email:'p'+i+'@example.test'}))
users[3].manager=users[1].id
const assignment=new Map(users.map((u,i)=>[u.id,{company_id:i===6?companyB:companyA,department_id:department}]))
const tokens=new Map(users.map(u=>[u.id,randomUUID()]))
const sessions=users.map(u=>({digest:createHash('sha256').update(tokens.get(u.id)).digest('hex'),identity:'learning-test',person:u.id,until:Date.now()+3600000}))
const legacy={users,sessions,courses:[{id:courseId,title:'Conduta',status:'published',track:'DNA do Desenvolvimento',type:'Leitura',minutes:30},{id:draftCourseId,title:'Rascunho',status:'draft'}],
 enroll:[{id:randomUUID(),person:users[2].id,course:courseId,progress:100},{id:randomUUID(),person:users[3].id,course:courseId,progress:50}],
 organization:{assignments:assignment,companies:[{id:companyA,name:'Empresa A'},{id:companyB,name:'Empresa B'}]}}
const BUCKET={async get(key){return key==='system/state-v1'?{async json(){return legacy}}:null}}
const DOMAIN={allowedCompanies(_,user){return user.role==='Administrador'?[companyA,companyB]:[assignment.get(user.id)?.company_id].filter(Boolean)}}
function headers(actor){return {origin,'content-type':'application/json','oai-authenticated-user-id':'learning-test',...(actor?{cookie:'learning='+tokens.get(actor.id)}:{})}}
async function call(path,actor,body){
 const req=new Request(origin+'/api/discovery/v4/'+path,{method:body===undefined?'GET':'POST',headers:headers(actor),...(body===undefined?{}:{body:JSON.stringify(body)})})
 const res=await handleDiscoveryV4(req,{BUCKET,DOMAIN,eventDb})
 assert.ok(res,'A rota deve ser reconhecida.')
 return {status:res.status,data:await res.json()}
}
const admin=users[0],leader=users[1],learner=users[2],employee=users[3]
try{
 const noAuth=await call('mine',null)
 assert.equal(noAuth.status,401)
 assert.equal((await call('mine',learner)).data.bookmarks.length,0)
 const token=randomUUID()
 let event=await call('events',learner,{type:'catalog_viewed',eventId:token})
 assert.equal(event.status,200);assert.equal(event.data.recorded,true)
 event=await call('events',learner,{type:'catalog_viewed',eventId:token})
 assert.equal(event.status,200);assert.equal(event.data.recorded,false,'Eventos devem ser idempotentes')
 event=await call('events',learner,{type:'catalog_viewed',eventId:randomUUID()})
 assert.equal(event.data.recorded,false,'Evitar contagem inflada por refresh repetido')
 assert.equal((await call('events',learner,{type:'content_completed',courseId,eventId:randomUUID()})).status,400,'Não aceitar conclusão fabricada pelo navegador')
 assert.equal((await call('events',learner,{type:'lesson_launch_requested',courseId:draftCourseId,eventId:randomUUID()})).status,403)
 assert.equal((await call('events',learner,{type:'lesson_launch_requested',courseId,eventId:randomUUID()})).status,200)
 assert.equal((await call('events',users[4],{type:'lesson_launch_requested',courseId,eventId:randomUUID()})).status,403,'Exige matrícula para abrir aula')
 assert.equal((await call('bookmarks',learner,{courseId,bookmarked:true})).status,200)
 assert.equal((await call('bookmarks',learner,{courseId,bookmarked:true})).status,200)
 assert.equal((await call('mine',learner)).data.bookmarks.length,1,'Favoritos não podem duplicar')
 assert.equal((await call('bookmarks',learner,{courseId:draftCourseId,bookmarked:true})).status,403)
 assert.equal((await call('ratings',employee,{courseId,score:4})).status,403,'Avaliação exige conclusão')
 assert.equal((await call('ratings',learner,{courseId,score:5})).status,200)
 assert.equal((await call('ratings',learner,{courseId,score:6})).status,400)
 assert.equal((await call('ratings',learner,{courseId,score:4})).status,200)
 assert.equal((await call('mine',learner)).data.ratings[0].score,4,'A nota pode ser corrigida')
 assert.equal((await call('metrics',learner)).status,403,'Colaborador não pode acessar métricas gerenciais')
 assert.equal((await call('metrics?company='+companyB,leader)).status,403,'Líder não pode consultar outra empresa')
 const leadersView=await call('metrics',leader)
 assert.equal(leadersView.status,200)
 assert.equal(leadersView.data.suppressed,true,'Equipe menor que cinco deve ser suprimida')
 const analytics=await call('metrics?company='+companyA,admin)
 assert.equal(analytics.status,200)
 assert.equal(analytics.data.suppressed,false)
 assert.equal(analytics.data.metrics.activePeople,1)
 assert.equal(analytics.data.metrics.eventsByType.catalog_viewed.events,1)
 assert.equal(analytics.data.metrics.eventsByType.lesson_launch_requested.events,1)
 assert.equal(analytics.data.metrics.bookmarksCurrent,1)
 assert.equal(analytics.data.metrics.averageRating,4)
 assert.equal((await call('metrics?from=2090-01-01&to=2090-02-01',admin)).data.metrics.activePeople,0,'Datas sem dados são válidas')
 assert.equal((await call('metrics?from=2026-13-01&to=2026-12-01',admin)).status,400)
 assert.equal((await call('metrics?from=2023-01-01&to=2026-12-01',admin)).status,400)
 assert.equal((await call('events',learner,{type:'search_performed',eventId:randomUUID(),query:'nome do colaborador'})).status,200,'Campos extras são ignorados, não armazenados')
 assert.equal(eventDb.prepare('SELECT COUNT(*) AS n FROM lxp_discovery_migrations WHERE version=1').get().n,1,'Migração V1 registrada')
 const schema=eventDb.prepare('SELECT sql FROM sqlite_master WHERE name=?').get('lxp_discovery_events')
 assert.ok(schema.sql.includes('CHECK(event_type IN'))
 const privacy=eventDb.prepare('PRAGMA table_info(lxp_discovery_events)').all().map(x=>x.name)
 assert.ok(!privacy.includes('query')&&!privacy.includes('email'),'Não armazenar termo pesquisado nem e-mail')
 eventDb.close()
 const reopened=new DatabaseSync(databasePath)
 assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM lxp_discovery_bookmarks').get().n,1,'Favoritos sobrevivem à reabertura')
 assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM lxp_discovery_events WHERE event_type=?').get('catalog_viewed').n,1)
 reopened.close()
 console.log('OK: cenários isolados de sessão, escopo, eventos idempotentes, deduplicação, proibição de conclusão falsa, favoritos, avaliações, agregação, privacidade, datas e persistência SQLite.')
}catch(e){try{eventDb.close()}catch{};throw e}
finally{await rm(dirname,{force:true,recursive:true})}
