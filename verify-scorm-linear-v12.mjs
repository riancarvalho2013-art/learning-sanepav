import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {linearScormPlan,canReconcileScorm} from './scorm-linear-v12.mjs'
import {createScormRuntime} from './scorm-v3.mjs'
import {handleAssessmentsV6} from './learning-assessments-v6.mjs'
import {reconcileCompletion,completionClassification} from './completion-v11.mjs'
const id=()=>randomUUID(),A=id(),cid=id(),upload=id(),eid=id(),admin=id(),person=id(),other=id(),origin='https://qa.test',identity='qa'
const manifest=`<?xml version="1.0"?><manifest xmlns:adlcp="urn:adlcp"><metadata><schemaversion>1.2</schemaversion></metadata><organizations default="O"><organization identifier="O"><title>Trilha</title><item identifier="I1" identifierref="R1"><title>Introdução</title></item><item identifier="I2" identifierref="R2"><title>Prática</title></item></organization></organizations><resources><resource identifier="R1" adlcp:scormtype="sco" href="a/index.html"/><resource identifier="R2" adlcp:scormtype="sco" href="b/index.html"/></resources></manifest>`
const plan=linearScormPlan(manifest);assert.equal(plan.mode,'linear');assert.equal(plan.items.length,2);assert.equal(plan.items[1].entry,'b/index.html');assert.equal(linearScormPlan(manifest.replace('1.2','2004')).mode,'unsupported');assert.equal(linearScormPlan(manifest.replace('b/index.html','../index.html')).mode,'unsupported');assert.equal(linearScormPlan(manifest.replace('<title>Prática</title>','<imsss:sequencing/>')).mode,'unsupported');assert.equal(linearScormPlan(manifest.replace('I2','I1')).mode,'unsupported');assert.equal(linearScormPlan('<!DOCTYPE x>'+manifest).mode,'unsupported')
const tokens=new Map([[admin,id()],[person,id()],[other,id()]]),users=[{id:admin,role:'Administrador',active:true,name:'Admin'},{id:person,role:'Colaborador',active:true,name:'Aluno'},{id:other,role:'Colaborador',active:true,name:'Outro'}],assignments=new Map(users.map(x=>[x.id,{company_id:A}]))
const course={id:cid,title:'SCORM multi',type:'SCORM',status:'published',revision:1,minutes:10,upload,entry:'a/index.html'}
let state={users,courses:[course],enroll:[{id:eid,course:cid,person,progress:0}],sessions:users.map(u=>({person:u.id,identity,digest:createHash('sha256').update(tokens.get(u.id)).digest('hex'),until:Date.now()+600000})),records:[],missions:[],missionEnrollments:[]},etag=id()
const files=new Map([['imsmanifest.xml',manifest],['a/index.html','<!doctype html><title>A</title>'],['b/index.html','<!doctype html><title>B</title>']]);const db=new DatabaseSync(':memory:')
const BUCKET={async get(key){if(key==='system/state-v1'){const snapshot=JSON.stringify(state),revision=etag;return {etag:revision,json:async()=>Object.assign(JSON.parse(snapshot),{organization:{assignments,companies:[{id:A,name:'A',active:1}],grants:[]}})}}const value=files.get(key.replace('files/'+upload+'/',''));if(value!==undefined)return {body:Buffer.from(value),text:async()=>value};return null},async put(key,value,o){assert.equal(key,'system/state-v1');if(o.onlyIf.etagMatches!==etag)return null;state=JSON.parse(value);etag=id();return {etag}}}
const DOMAIN={allowedCompanies:()=>[A],canSeePerson:()=>true},ctx={BUCKET,DOMAIN,assessmentDb:db},runtime=createScormRuntime()
let checks=8;const eq=(a,b)=>{assert.deepEqual(a,b);checks++}
async function call(path,user=person,body,expected=200,tokenOverride){const r=new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{origin,'oai-authenticated-user-id':identity,'content-type':'application/json',cookie:'learning='+(tokenOverride||tokens.get(user))},...(body===undefined?{}:{body:JSON.stringify(body)})});const response=path.includes('/assessment/')?await handleAssessmentsV6(r,{...ctx,onAssessmentSubmitted:(req,c)=>reconcileCompletion(req,ctx,c)}):await runtime(r,ctx);const data=await response.json();assert.equal(response.status,expected,path+': '+JSON.stringify(data));checks++;return data}
const launch=(idx,expected=200)=>call('/api/scorm/v3/launch?enrollment='+eid+(idx==null?'':'&sco='+idx),person,undefined,expected)
const commit=(l,cmi,user=person,expected=200,tokenOverride)=>call('/api/scorm/v3/commit',user,{id:eid,token:l.url.split('/')[3],key:l.key,cmi},expected,tokenOverride)
try{
 const f=await call('/api/assessment/v6/create',admin,{companyId:A,courseId:cid,title:'Prova final',kind:'final',minScore:70,maxAttempts:2,durationMinutes:20,startsOn:'2020-01-01',endsOn:'2099-12-31',questions:[{prompt:'Escolha a alternativa correta',options:['A','B'],correctIndex:1,weight:1}]});await call('/api/assessment/v6/publish',admin,{id:f.id,revision:f.revision})
 eq(await canReconcileScorm(BUCKET,course,{completionV11:{content:{type:'scorm'}}}),false);await launch(1,403);let l=await launch();eq(l.multiSco.index,0);eq(l.multiSco.count,2);eq(l.url.endsWith('/a/index.html'),true)
 let r=await commit(l,{'cmi.suspend_data':'a-state','cmi.core.lesson_status':'incomplete'});eq(r.multiSco.currentComplete,false);eq(r.progress,0)
 l=await launch();const page=await runtime(new Request(origin+l.url),ctx);eq(page.status,200);assert.match(await page.text(),/a-state/);checks++
 await commit(l,{'cmi.core.lesson_status':'passed'},other,403)
 const fresh=id();state.sessions.push({person,identity,digest:createHash('sha256').update(fresh).digest('hex'),until:Date.now()+600000});await commit(l,{'cmi.core.lesson_status':'passed'},person,403,fresh)
 r=await commit(l,{'cmi.core.lesson_status':'passed'});eq(r.progress,50);eq(r.multiSco.completed,1);eq(state.enroll[0].completionV11,undefined)
 eq((await commit(l,{'cmi.core.lesson_status':'passed'})).multiSco.completed,1)
 let second=await launch();eq(second.multiSco.index,1);eq(second.url.endsWith('/b/index.html'),true);const page2=await runtime(new Request(origin+second.url),ctx);eq(page2.status,200);assert.doesNotMatch(await page2.text(),/a-state/);checks++
 r=await commit(second,{'cmi.suspend_data':'b-state','cmi.core.lesson_status':'failed'});eq(r.multiSco.completed,1);eq(r.progress,50)
 r=await commit(second,{'cmi.core.lesson_status':'passed'});eq(r.multiSco.completed,2);eq(r.progress,99);eq(r.pendingAssessment,true)
 eq(state.enroll[0].scormMultiV12.items[0].cmi['cmi.suspend_data'],'a-state');eq(state.enroll[0].scormMultiV12.items[1].cmi['cmi.suspend_data'],'b-state')
 eq(await canReconcileScorm(BUCKET,course,state.enroll[0]),true);const attempt=await call('/api/assessment/v6/start',person,{id:f.id});r=await call('/api/assessment/v6/submit',person,{id:f.id,attemptId:attempt.attemptId,answers:[1]});eq(r.passed,true);eq(state.enroll[0].progress,100);eq(completionClassification(state.enroll[0]),'scorm');eq(state.enroll[0].completionV11.content.scoCount,2)
 const original=state.enroll[0].completionV11.event.id;await commit(second,{'cmi.core.lesson_status':'passed'});eq(state.enroll[0].completionV11.event.id,original)
 state.sessions=state.sessions.filter(x=>x.person!==person);const denied=await runtime(new Request(origin+second.url),ctx);eq(denied.status,403)
 state.sessions.push({person,identity,digest:createHash('sha256').update(tokens.get(person)).digest('hex'),until:Date.now()+600000});files.set('imsmanifest.xml',manifest.replace('1.2','2004'));await launch(null,422)
 console.log('PASS multi-SCO linear 1.2: '+checks+' verificações, runtime e motor de conclusão reais, avaliação SQLite, adaptadores de estado/organização.')
}finally{db.close()}
