import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {handleLxpV2,projectPdiLearning} from './lxp-v2.mjs'
import {handleReportsV3} from './reports-v3.mjs'
const id=()=>randomUUID(),A=id(),B=id(),D=id(),D2=id(),admin=id(),leader=id(),worker=id(),peer=id(),outside=id(),hr=id(),dir=id(),c1=id(),c2=id(),draft=id(),e1=id(),e2=id(),ePeer=id(),edraft=id(),mission=id(),otherMission=id(),origin='https://qa.test'
const users=[{id:admin,role:'Administrador',name:'Admin'},{id:leader,role:'Líder',name:'Líder'},{id:worker,role:'Colaborador',name:'Colaborador',manager:leader},{id:peer,role:'Colaborador',name:'Outro time'},{id:outside,role:'Colaborador',name:'Outra empresa'},{id:hr,role:'RH/DHO',name:'RH'},{id:dir,role:'Diretoria',name:'Diretoria'}].map(x=>({...x,active:true}))
const org={companies:[{id:A,name:'Empresa A'},{id:B,name:'Empresa B'}],departments:[{id:D,company_id:A,name:'RH'},{id:D2,company_id:A,name:'Financeiro'}],assignments:new Map(users.map(u=>[u.id,{company_id:u.id===outside?B:A,department_id:u.id===peer?D2:D,position:'Cargo'}])),revision:'1',grants:[]}
const legacy={users,sessions:users.map(u=>({person:u.id,digest:createHash('sha256').update(u.id).digest('hex'),identity:'qa',until:Date.now()+600000})),records:[],courses:[{id:c1,title:'Curso A',minutes:60},{id:c2,title:'Curso B',minutes:30},{id:draft,title:'Rascunho',status:'draft',minutes:30}],enroll:[{id:e1,person:worker,course:c1,progress:30},{id:e2,person:worker,course:c2,progress:0},{id:ePeer,person:peer,course:c1,progress:100},{id:edraft,person:worker,course:draft,progress:100}],missions:[{id:mission,title:'Trilha A',courses:[c1,c2]},{id:otherMission,title:'Trilha não atribuída',courses:[c1]}],missionEnrollments:[{id:id(),person:worker,mission}],logs:[]}
const q=id(),cycle=id(),hidden=id(),review={id:id(),cycleId:cycle,subjectId:worker,reviewerId:leader,perspective:'leader',status:'submitted',answers:{[q]:4}},form=[{id:q,type:'rating',title:'Competência',competency:'Comunicação',weight:1,expected:5}]
const lxp={schema:2,pulses:[],pulseResponses:[],cycles:[{id:cycle,title:'Liberado',companyId:A,participants:[worker],status:'closed',releaseResults:true,endDate:'2026-10-01',leaderQuestions:form},{id:hidden,title:'Sigiloso',companyId:A,participants:[worker],status:'closed',releaseResults:false,endDate:'2026-10-01',leaderQuestions:form}],reviews:[review],pdiActions:[],meetings:[{participants:[worker,leader],privateNotes:{[leader]:'SEGREDO_1_1'}}],feedbackRequests:[{toId:worker,fromId:leader,status:'requested',answer:'SEGREDO_FEEDBACK'}],events:[],okrsV13:[]}
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE objects(key TEXT PRIMARY KEY,etag TEXT,body TEXT)');const save=(k,x)=>db.prepare('INSERT INTO objects VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET etag=excluded.etag,body=excluded.body').run(k,id(),JSON.stringify(x));save('system/state-v1',legacy);save('lxp/v2/state',lxp)
const DOMAIN={allowedCompanies:(s,u)=>u.role==='Administrador'?[A,B]:[org.assignments.get(u.id)?.company_id].filter(Boolean)}
let simulateRace=false
const BUCKET={async get(k){const x=db.prepare('SELECT * FROM objects WHERE key=?').get(k);return x?{etag:x.etag,json:async()=>Object.assign(JSON.parse(x.body),k==='system/state-v1'?{organization:org}:{})}:null},async put(k,v,o){if(simulateRace){simulateRace=false;org.assignments.set(worker,{company_id:B,department_id:D2});org.revision='2';return null}if(o.requireStateEtag!==undefined&&db.prepare('SELECT etag FROM objects WHERE key=?').get('system/state-v1').etag!==o.requireStateEtag)return null;if(o.requireOrganizationRevision!==undefined&&o.requireOrganizationRevision!==org.revision)return null;const etag=id(),n=o.onlyIf.etagMatches?db.prepare('UPDATE objects SET body=?,etag=? WHERE key=? AND etag=?').run(v,etag,k,o.onlyIf.etagMatches).changes:db.prepare('INSERT OR IGNORE INTO objects VALUES(?,?,?)').run(k,etag,v).changes;return n?{etag}:null}}
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};async function call(path,actor=worker,body,status=200,base='/api/lxp/v2/',requestOrigin=origin){const req=new Request(origin+base+path,{method:body?'POST':'GET',headers:{origin:requestOrigin,cookie:'learning='+actor,'oai-authenticated-user-id':'qa','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const response=await (base.includes('reports')?handleReportsV3:handleLxpV2)(req,{BUCKET,DOMAIN});const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));checks++;return result}
try{
 const setup={title:'Configuração V19',companyId:A,personIds:[worker],startDate:'2026-01-01',endDate:'2099-12-31',includeSelf:true,selfQuestions:form,selfPdiEnabled:true}
 await call('performance',worker,setup,403)
 const configured=await call('performance',hr,setup,201)
 eq((await call('performance/cycle?id='+configured.id,hr)).selfPdiEnabled,true)
 await call('performance',hr,{...setup,id:configured.id,revision:1,selfPdiEnabled:false})
 eq((await call('performance/cycle?id='+configured.id,hr)).selfPdiEnabled,false)
 const configuredState=await (await BUCKET.get('lxp/v2/state')).json();configuredState.cycles.find(x=>x.id===configured.id).status='published';save('lxp/v2/state',configuredState)
 await call('performance',hr,{...setup,id:configured.id,revision:2},409)
 const current=await (await BUCKET.get('lxp/v2/state')).json(),c=current.cycles.find(x=>x.id===cycle)
 c.selfPdiEnabled=true;c.learningRecommendationsV17=[{key:'comunicação',items:[{kind:'course',id:c1},{kind:'mission',id:mission},{kind:'mission',id:otherMission}]}];save('lxp/v2/state',current)
 const route='performance/my-development',payload={id:cycle,requestId:id(),competencyKey:'comunicação',title:'Praticar comunicação',description:'Aplicar e revisar com a liderança.',mix:'70',dueDate:'2099-01-01'}
 eq((await call('performance/cycle?id='+cycle)).selfPdiEnabled,true)
 for(const actor of [leader,admin,hr,dir,outside,peer])await call(route,actor,payload,403)
 await call(route,worker,{...payload,personId:peer},403)
 await call(route,worker,payload,403,undefined,'https://evil.test')
 await call(route,worker,{...payload,competencyKey:'não existe'},409)
 await call(route,worker,{...payload,dueDate:'ontem'},400)
 await call(route,worker,{...payload,learningLink:{kind:'course',id:e1}},400)
 await call(route,worker,{...payload,mix:'10',learningLink:{kind:'mission',id:otherMission}},403)
 await call(route,worker,{...payload,mix:'10',learningLink:{kind:'course',id:ePeer}},403)
 c.selfPdiEnabled=false;save('lxp/v2/state',current);await call(route,worker,payload,409)
 c.selfPdiEnabled=true;c.releaseResults=false;save('lxp/v2/state',current);await call(route,worker,payload,409)
 c.releaseResults=true;c.status='published';save('lxp/v2/state',current);await call(route,worker,payload,409)
 c.status='closed';save('lxp/v2/state',current)
 const made=await call(route,worker,payload,201);eq((await call(route,worker,payload,201)),{id:made.id,idempotent:true})
 await call(route,worker,{...payload,title:'Alteração em reenvio'},409)
 let stored=await (await BUCKET.get('lxp/v2/state')).json();eq(stored.pdiActions.length,1);const action=stored.pdiActions[0];eq(action.personId,worker);eq(action.source.competency.observed,4);eq(action.source.competency.expected,5);eq(action.source.cycleId,cycle);assert(stored.events.some(x=>JSON.stringify(x).includes('performance.self-pdi')));checks++
 const linked=await call(route,worker,{...payload,requestId:id(),mix:'10',learningLink:{kind:'course',id:e1}},201)
 let g=(await call('growth')).items.find(x=>x.id===linked.id);eq(g.status,'doing');eq(g.learning.progress,30)
 legacy.enroll.find(x=>x.id===e1).progress=100;save('system/state-v1',legacy);g=(await call('growth')).items.find(x=>x.id===linked.id);eq(g.status,'done')
 // Replay after reopening storage still returns exactly one action per request.
 eq((await call(route,worker,payload,201)).id,made.id)
 simulateRace=true;await call(route,worker,{...payload,requestId:id()},403)
 stored=await (await BUCKET.get('lxp/v2/state')).json();eq(stored.pdiActions.length,2);eq((await call('growth')).items.length,0)
 console.log('PASS V19: '+checks+' verificações de origem, liberação, consentimento, escopo, idempotência, progresso real e transferência durante gravação. SQLite isolado.')
}finally{db.close()}
