import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {handleLxpV2} from './lxp-v2.mjs'
const rid=()=>randomUUID()
const A=rid(),B=rid(),deptA=rid(),deptB=rid(),admin=rid(),hr=rid(),leader=rid(),outsider=rid()
const workers=Array.from({length:8},rid)
const all=[{id:admin,name:'Admin',role:'Administrador',active:true},{id:hr,name:'RH',role:'RH/DHO',active:true},{id:leader,name:'Líder A',role:'Líder',active:true},...workers.map((id,i)=>({id,name:'Colaborador '+i,role:'Colaborador',manager:leader,active:true})),{id:outsider,name:'Fora B',role:'Colaborador',active:true}]
const assigned=new Map([[admin,{company_id:A,department_id:deptA}],[hr,{company_id:A,department_id:deptA}],[leader,{company_id:A,department_id:deptA}],...workers.map((x,i)=>[x,{company_id:A,department_id:i<6?deptA:deptB}]),[outsider,{company_id:B,department_id:rid()}]])
const cookie='test-secret-lxp',digest=createHash('sha256').update(cookie).digest('hex')
const raw={users:all,sessions:[{digest,identity:'learning-railway',person:admin,until:Date.now()+3600_000}],enroll:[],records:[],courses:[],logs:[]}
const DOMAIN={
 allowedCompanies(state,u){return u.role==='Administrador'?[A,B]:u.role==='RH/DHO'?[A]:[assigned.get(u.id)?.company_id].filter(Boolean)},
 decorateState(s){Object.defineProperty(s,'organization',{value:{companies:[{id:A,name:'Sanepav',active:1},{id:B,name:'Beta Clean',active:1}],assignments:assigned,grants:[]},configurable:true});return s}
}
const store=new Map([['system/state-v1',{etag:'initial',body:Buffer.from(JSON.stringify(raw))}]])
const BUCKET={async get(k){const entry=store.get(k);if(!entry)return null;return {etag:entry.etag,body:entry.body,json:async()=>k==='system/state-v1'?DOMAIN.decorateState(JSON.parse(entry.body.toString())):JSON.parse(entry.body.toString())}},async put(k,v,options){const existing=store.get(k);if(options?.onlyIf?.etagMatches&&existing?.etag!==options.onlyIf.etagMatches)return null;if(options?.onlyIf?.etagDoesNotMatch==='*'&&existing)return null;const etag=rid();store.set(k,{etag,body:Buffer.from(v)});return {etag}}}
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
async function call(path,{as=admin,method='GET',body,origin='https://learning.test'}={}){
 const state=JSON.parse(store.get('system/state-v1').body.toString());state.sessions[0].person=as;store.set('system/state-v1',{etag:rid(),body:Buffer.from(JSON.stringify(state))})
 const headers={cookie:'learning='+cookie,'oai-authenticated-user-id':'learning-railway'}
 const options={method,headers};if(method==='POST'){headers.origin=origin;headers['content-type']='application/json';options.body=JSON.stringify(body||{})}
 const response=await handleLxpV2(new Request('https://learning.test/api/lxp/v2/'+path,options),{BUCKET,DOMAIN})
 assert(response);let result=await response.json();return {...result,httpStatus:response.status}
}
const deny=(r,code)=>assert.equal(r.httpStatus,code,JSON.stringify(r))
const question={type:'rating',title:'Colaboração',weight:1,required:true}
const cycle={companyId:A,title:'Ciclo 360',startDate:date,endDate:date,personIds:[workers[0],leader],includeSelf:true,includeLeader:true,includePeer:true,includeReports:true,requireCalibration:true,selfQuestions:[question],leaderQuestions:[question],peerQuestions:[question],reportQuestions:[question]}
const post=(path,body,as=admin)=>call(path,{method:'POST',body,as})
const view=(as=admin)=>call('performance/cycle?id='+cid,{as})
deny(await post('performance',cycle,leader),403)
let r=await post('performance',cycle);deny(r,201);const cid=r.id
r=await post('performance/publish',{id:cid,revision:1});deny(r,200);assert.equal(r.tasks,18)
deny(await view(outsider),404);deny(await post('performance/close',{id:cid},leader),403)
async function submit(as,subject,perspective,value){const c=await view(as);const t=c.mine.find(t=>t.subjectId===subject&&t.perspective===perspective);assert(t);const f=await call('performance/task?id='+t.id,{as});deny(f,200);deny(await post('performance/task',{id:t.id,answers:{[f.form[0].id]:value},submit:true},as),200);return t.id}
await submit(workers[0],workers[0],'self',5)
await submit(leader,workers[0],'leader',3)
for(const w of workers.slice(1,4))await submit(w,workers[0],'peer',4)
await submit(workers[0],leader,'report',3);await submit(workers[1],leader,'report',5)
const moved=workers[4],movedTask=(await view(moved)).mine.find(t=>t.subjectId===workers[0]);const originalAssignment=assigned.get(workers[0]);assigned.set(workers[0],{company_id:B,department_id:rid()});deny(await call('performance/task?id='+movedTask.id,{as:moved}),403);assigned.set(workers[0],originalAssignment)
assert.equal((await view(workers[0])).results,undefined)
deny(await post('performance/release',{id:cid}),409)
r=await post('performance/close',{id:cid});assert.equal(r.status,'calibration')
let c=await view();assert.equal(c.calibration.find(x=>x.personId===workers[0]).original,4);assert.equal(c.calibration.find(x=>x.personId===leader).original,null)
const proposal={id:cid,revision:c.revision,personId:workers[0],proposed:4.2,justification:'Evidências discutidas'}
deny(await post('performance/calibrate',proposal,leader),403);deny(await post('performance/calibrate',{...proposal,proposed:6}),400);deny(await post('performance/calibrate',{...proposal,revision:0}),409)
deny(await post('performance/calibrate',proposal),200);c=await view();const p=c.calibration.find(x=>x.personId===workers[0]).proposal;assert.equal(p.original,4)
deny(await post('performance/calibration/finish',{id:cid,revision:c.revision}),409)
deny(await post('performance/calibration/approve',{id:cid,revision:c.revision,proposalId:p.id}),200);c=await view();deny(await post('performance/calibration/finish',{id:cid,revision:c.revision}),200);deny(await post('performance/release',{id:cid}),200)
c=await view(workers[0]);assert.equal(c.finalScore,4.2);const peers=c.results.find(x=>x.perspective==='peer');assert.equal(peers.score,4);assert.equal(peers.answers,undefined);assert.equal(peers.reviewerId,undefined)
c=await view(leader);assert.equal(c.results.find(x=>x.perspective==='report').suppressed,true);assert.equal(c.finalScore,null)
const action={id:cid,personId:workers[0],title:'Praticar colaboração',mix:'70',dueDate:date,requestId:rid()};r=await post('performance/pdi',action);deny(r,201);const pid=r.id;r=await post('performance/pdi',action);assert.equal(r.id,pid);assert.equal(r.idempotent,true);assert.equal((await call('growth',{as:workers[0]})).items.find(x=>x.id===pid).source.cycleId,cid)
console.log('PASS: desempenho 360, segregação empresarial, calibração, supressão e PDI idempotente (fixture de organização e persistência).')
