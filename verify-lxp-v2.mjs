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
let r=await call('me');assert.equal(r.user.role,'Administrador');assert.equal(r.canCreatePulse,true)
r=await call('me',{as:workers[0]});assert.equal(r.canConfigurePerformance,false)
r=await call('pulse',{method:'POST',as:workers[0],body:{}});deny(r,403)
r=await call('pulse',{method:'POST',origin:'https://evil.test',body:{}});deny(r,403)
r=await call('pulse',{as:leader,method:'POST',body:{title:'Escuta da equipe',companyId:A,startDate:date,endDate:date,departmentIds:[],includeCreator:false}});assert.equal(r.httpStatus,201);assert.equal(r.participants,9)
r=await call('pulse',{method:'POST',body:{title:'Pulso da equipe',companyId:A,departmentIds:[],startDate:date,endDate:date,includeCreator:false}});assert.equal(r.httpStatus,201)
const pulseId=r.id;assert.equal(r.participants,11)
r=await call('pulse',{as:outsider});assert.equal(r.items.length,0)
r=await call('pulse/answer',{method:'POST',as:outsider,body:{id:pulseId,rating:5}});deny(r,403)
r=await call('pulse/answer',{method:'POST',as:workers[0],body:{id:pulseId,rating:9}});deny(r,400)
for(let i=0;i<6;i++){r=await call('pulse/answer',{method:'POST',as:workers[i],body:{id:pulseId,rating:4,comment:'Teste'}});assert.equal(r.httpStatus,200)}
r=await call('pulse');let x=r.items.find(x=>x.id===pulseId);assert.equal(x.summary.canShowAggregate,false);assert.equal(x.summary.distribution,null)
r=await call('pulse/answer',{method:'POST',as:workers[0],body:{id:pulseId,rating:5}});deny(r,409)
r=await call('pulse/answer',{method:'POST',as:workers[6],body:{id:pulseId,rating:5}});assert.equal(r.httpStatus,200)
r=await call('pulse');x=r.items.find(x=>x.id===pulseId);assert.equal(x.summary.canShowAggregate,true);assert.equal(x.summary.responses,7);assert.equal(x.summary.distribution.length,5)
const ratingQuestion={type:'rating',title:'Entrega de resultados',required:true,weight:2,competency:'Resultados'}
const textQuestion={type:'text',title:'Descreva um aprendizado',required:false,weight:0}
const cycle={companyId:A,title:'Ciclo 2026',description:'Avaliação customizável',startDate:date,endDate:date,includeSelf:true,includeLeader:true,selfQuestions:[ratingQuestion,textQuestion],leaderQuestions:[ratingQuestion],departmentIds:[deptA]}
r=await call('performance',{as:workers[0],method:'POST',body:cycle});deny(r,403)
r=await call('performance',{method:'POST',body:cycle});assert.equal(r.httpStatus,201);const cycleId=r.id
r=await call('performance/cycle?id='+cycleId);assert.equal(r.status,'draft');assert(r.selfQuestions.length)
r=await call('performance/publish',{method:'POST',body:{id:cycleId,revision:1}});assert.equal(r.tasks,15)
r=await call('performance/cycle?id='+cycleId,{as:workers[7]});deny(r,404)
r=await call('performance/cycle?id='+cycleId,{as:workers[0]});assert.equal(r.isManager,false);assert.equal(r.mine.length,1)
let review=r.mine[0].id;r=await call('performance/task?id='+review,{as:workers[1]});deny(r,403)
r=await call('performance/task?id='+review,{as:workers[0]});assert.equal(r.task.perspective,'self')
const questionId=r.form[0].id
r=await call('performance/task',{as:workers[0],method:'POST',body:{id:review,answers:{},submit:true}});deny(r,400)
r=await call('performance/task',{as:workers[0],method:'POST',body:{id:review,answers:{[questionId]:5},submit:false}});assert.equal(r.status,'draft')
r=await call('performance/task',{as:workers[0],method:'POST',body:{id:review,answers:{[questionId]:5},submit:true}});assert.equal(r.status,'submitted')
r=await call('performance/task',{as:workers[0],method:'POST',body:{id:review,answers:{[questionId]:3},submit:true}});deny(r,409)
r=await call('performance/cycle?id='+cycleId,{as:workers[0]});assert.equal(r.results,undefined)
r=await call('performance/close',{method:'POST',body:{id:cycleId}});assert.equal(r.ok,true)
r=await call('performance/release',{method:'POST',body:{id:cycleId}});assert.equal(r.ok,true)
r=await call('performance/cycle?id='+cycleId,{as:workers[0]});assert.equal(r.results[0].score,5)
r=await call('growth',{as:workers[0],method:'POST',body:{personId:workers[0],title:'Conduzir reunião',description:'Com apoio do líder',mix:'70',status:'doing',dueDate:date}});assert.equal(r.httpStatus,201)
r=await call('growth',{as:outsider});assert.equal(r.items.length,0)
r=await call('growth',{as:outsider,method:'POST',body:{personId:workers[0],title:'Fraude',mix:'70',status:'todo'}});deny(r,403)
r=await call('meetings',{as:workers[0],method:'POST',body:{otherId:workers[1],date,agenda:'Alinhamento',privateNote:'Somente meu'}});assert.equal(r.httpStatus,201);let meetingId=r.id
r=await call('meetings',{as:workers[1]});assert.equal(r.items[0].privateNote,'')
r=await call('meetings',{as:workers[0]});assert.equal(r.items[0].privateNote,'Somente meu')
r=await call('meetings',{as:admin});assert.equal(r.items.length,0)
r=await call('feedback',{as:workers[0],method:'POST',body:{toId:workers[1],topic:'Como fui na apresentação?'}});assert.equal(r.httpStatus,201);const feedbackId=r.id
r=await call('feedback/answer',{as:outsider,method:'POST',body:{id:feedbackId,answer:'Evil'}});deny(r,403)
r=await call('feedback/answer',{as:workers[1],method:'POST',body:{id:feedbackId,answer:'Boa evolução'}});assert.equal(r.ok,true)
r=await call('feedback',{as:workers[0]});assert.equal(r.items[0].answer,'Boa evolução')
r=await call('feedback',{as:admin});assert.equal(r.items.length,0)
console.log('LXP V2: fluxos críticos de autorização, avaliação, Pulse, PDI, 1:1 e feedback passaram.')
