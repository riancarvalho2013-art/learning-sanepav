import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {DatabaseSync} from 'node:sqlite'
import {createScormRuntime} from './scorm-v3.mjs'
import {handleCompletionV11,reconcileCompletion,completionClassification} from './completion-v11.mjs'
import {handleAssessmentsV6} from './learning-assessments-v6.mjs'
import {handleEvolution} from './learning-evolution.mjs'
import {handleReportsV3} from './reports-v3.mjs'
import {createRouteRegistry} from './http-router-v11.mjs'
const db=new DatabaseSync(':memory:'),id=()=>randomUUID(),A=id(),B=id(),origin='https://qa.learning.test',identity='qa'
const people=['Administrador','Colaborador','Colaborador','Colaborador'].map((role,i)=>({id:id(),name:'QA '+i,active:true,role}))
const [admin,learner,other,foreign]=people, tokens=new Map(people.map(p=>[p.id,id()])),assignments=new Map(people.map((p,i)=>[p.id,{company_id:i===3?B:A,department_id:'qa-dept'}]))
const courses=['Leitura','Questionário','SCORM','Vídeo','Leitura','Leitura'].map((type,i)=>({id:id(),title:'Curso QA '+i,type,status:'published',revision:1,minutes:10,track:'QA',...(type==='Questionário'?{options:['A','B'],answer:1}:{}),...(type==='SCORM'?{upload:id(),entry:'index.html'}:{})}))
const [reading,quiz,scorm,video,blocked,legacy]=courses
const enroll=courses.map((c,i)=>({id:id(),course:c.id,person:learner.id,progress:i===5?100:0,...(i===4?{prerequisites:[video.id]}:{})}))
const [er,eq,es,ev,eb,el]=enroll,foreignEnroll={id:id(),person:foreign.id,course:reading.id,progress:0}
let state={users:people,sessions:people.map(p=>({digest:createHash('sha256').update(tokens.get(p.id)).digest('hex'),identity,person:p.id,until:Date.now()+3600000})),courses,enroll:[...enroll,foreignEnroll],records:[],pulses:[],missions:[],missionEnrollments:[],logs:[]}
let etag=id(), writes=0,forcedConflict=false
const objects=new Map(),org={companies:[{id:A,name:'Empresa A',active:1},{id:B,name:'Empresa B',active:1}],assignments,grants:[]}
objects.set('files/'+scorm.upload+'/index.html',{body:Buffer.from('<!doctype html><title>SCORM</title>'),etag:id()})
const BUCKET={async get(key){if(key==='system/state-v1'){const snapshot=JSON.stringify(state),revision=etag;return {etag:revision,body:Buffer.from(snapshot),json:async()=>Object.assign(JSON.parse(snapshot),{organization:org})}}const item=objects.get(key);return item?{...item,json:async()=>JSON.parse(item.body.toString()),text:async()=>item.body.toString()}:null},async put(key,value,opts){if(key==='system/state-v1'){if(forcedConflict){forcedConflict=false;etag=id();return null}if(opts.onlyIf.etagMatches!==etag)return null;state=JSON.parse(value);etag=id();writes++;return {etag}}const old=objects.get(key);if(opts?.onlyIf?.etagDoesNotMatch==='*'&&old)return null;const t=id();objects.set(key,{etag:t,body:Buffer.from(value)});return {etag:t}}}
const DOMAIN={allowedCompanies(s,u){return u.role==='Administrador'?[A,B]:[assignments.get(u.id)?.company_id].filter(Boolean)},canSeePerson(s,u,p){return u.role==='Administrador'||p===u.id}}
const ctx={BUCKET,DOMAIN,assessmentDb:db},runtime=createScormRuntime(),handlers=[{exact:'/api/progress',handler:r=>handleCompletionV11(r,ctx)},{prefix:'/api/completion/v11/',handler:r=>handleCompletionV11(r,ctx)},{prefix:'/api/scorm/v3/',handler:r=>runtime(r,ctx)},{prefix:'/api/assessment/v6/',handler:r=>handleAssessmentsV6(r,{...ctx,onAssessmentSubmitted:(req,c)=>reconcileCompletion(req,ctx,c)})},{prefix:'/api/evo/',handler:r=>handleEvolution(r,ctx)},{prefix:'/api/reports/v3/',handler:r=>handleReportsV3(r,ctx)}]
const router=createRouteRegistry(handlers,()=>new Response('fallback',{status:404}));let calls=0,checks=0
const same=(a,b,m)=>{assert.deepEqual(a,b,m);checks++}
async function call(path,user,body,expected=200,customOrigin=origin){const r=new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{'oai-authenticated-user-id':identity,origin:customOrigin,'content-type':'application/json',...(user?{cookie:'learning='+tokens.get(user.id)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const res=await router(r);const data=await res.json();calls++;same(res.status,expected,path+': '+JSON.stringify(data));return data}
const progress=(u,en,input,expected)=>call('/api/progress',u,{id:en.id,...input},expected)
const row=e=>state.enroll.find(x=>x.id===e.id)
async function createForm(course,kind='final',company=A){const payload={companyId:company,courseId:course.id,title:kind+' QA',kind,minScore:70,maxAttempts:2,durationMinutes:20,startsOn:'2020-01-01',endsOn:'2099-12-31',questions:[{prompt:'Qual a resposta correta?',options:['Opção A','Opção B'],correctIndex:1,weight:1}]};const f=await call('/api/assessment/v6/create',admin,payload);await call('/api/assessment/v6/publish',admin,{id:f.id,revision:f.revision});return f.id}
async function answer(form,user,correct){const s=await call('/api/assessment/v6/start',user,{id:form});return call('/api/assessment/v6/submit',user,{id:form,attemptId:s.attemptId,answers:[correct?1:0]})}
try{
 const final=await createForm(reading),pre=await createForm(reading,'pre'),outside=await createForm(reading,'final',B)
 await progress(null,er,{progress:100},401);await progress(other,er,{progress:100},403);await progress(foreign,er,{progress:100},403)
 await call('/api/progress',learner,{id:er.id,progress:100},403,'https://evil.test')
 await progress(learner,eb,{progress:100},403);await progress(learner,er,{progress:101},400);await progress(learner,er,{progress:'100'},400)
 const pending=await progress(learner,er,{progress:100,score:100,passed:true});same(pending.progress,99);same(pending.pendingAssessment,true);same(pending.requiredAssessments.map(x=>x.id),[final]);same(row(er).score,undefined)
 await call('/api/evo/certificates/issue',learner,{enrollmentId:er.id},409)
 await call('/api/assessment/v6/archive',admin,{id:final,revision:2},409)
 same((await answer(pre,learner,true)).passed,true);same(row(er).progress,99)
 same((await answer(final,learner,false)).passed,false);same(row(er).progress,99)
 const passed=await answer(final,learner,true);same(passed.passed,true);same(passed.completion.items[0].progress,100)
 const record=structuredClone(row(er).completionV11.event);same(record.organization.companyId,A);same(row(er).completionV11.requirements[0].passed,true)
 await progress(learner,er,{progress:100});same(row(er).completionV11.event,record)
 await call('/api/completion/v11/reconcile',learner,{});same(row(er).completionV11.event,record)
 const cert=await call('/api/evo/certificates/issue',learner,{enrollmentId:er.id});same((await call('/api/evo/certificates/issue',learner,{enrollmentId:er.id})).code,cert.code)
 same(completionClassification(row(el)),'legacy');same(row(el).completed,undefined)
 await progress(learner,eq,{progress:100,answer:null},400);await progress(learner,eq,{progress:100,answer:''},400);await progress(learner,eq,{progress:100,answer:0,score:100});same(row(eq).progress,1);same(row(eq).score,0)
 forcedConflict=true;await progress(learner,eq,{progress:100,answer:'1'});same(row(eq).progress,100);same(completionClassification(row(eq)),'quiz')
 await progress(learner,es,{progress:100,cmi:{'cmi.core.lesson_status':'passed'}},403)
 const launch=await call('/api/scorm/v3/launch?enrollment='+es.id,learner),ticket={id:es.id,token:launch.url.split('/')[3],key:launch.key}
 await call('/api/scorm/v3/commit',learner,{...ticket,key:'wrong',cmi:{}},403)
 await call('/api/scorm/v3/commit',other,{...ticket,cmi:{'cmi.core.lesson_status':'passed'}},403)
 await call('/api/scorm/v3/commit',learner,{...ticket,cmi:{'cmi.completion_status':'passed'}},400)
 same((await call('/api/scorm/v3/commit',learner,{...ticket,cmi:{'cmi.completion_status':'completed','cmi.success_status':'failed'}})).progress,1)
 same((await call('/api/scorm/v3/commit',learner,{...ticket,cmi:{'cmi.completion_status':'completed','cmi.success_status':'passed','cmi.suspend_data':'S'.repeat(60000)}})).progress,100)
 same(completionClassification(row(es)),'scorm');same(row(es).cmi['cmi.suspend_data'].length,60000)
 await progress(learner,ev,{progress:40});same(row(ev).progress,40);await progress(learner,ev,{progress:100});same(completionClassification(row(ev)),'manual');await progress(learner,eb,{progress:100});same(row(eb).progress,100)
 const report=await call('/api/reports/v3/summary?company='+A,admin);const metric=k=>report.metrics.find(x=>x.code==='learning.'+k).value
 same(metric('completed'),metric('completion_legacy')+metric('completion_manual')+metric('completion_quiz')+metric('completion_scorm'));same(metric('completion_assessed'),1)
 const detail=await call('/api/reports/v3/enrollments?company='+A,admin);same(detail.rows.find(x=>x.id===er.id).evidenceType,'manual');same(detail.rows.find(x=>x.id===er.id).assessmentPassed,1)
 same((await call('/api/completion/v11/mine',learner)).items.length,6);same((await call('/api/completion/v11/mine',foreign)).items.length,1)
 state.sessions=state.sessions.filter(s=>s.person!==learner.id);await progress(learner,er,{progress:100},401);await call('/api/scorm/v3/commit',learner,{...ticket,cmi:{'cmi.core.lesson_status':'passed'}},401)
 assert.throws(()=>createRouteRegistry([{prefix:'/api/',handler:()=>{}},{exact:'/api/x',handler:()=>{}}],()=>{}));checks++
 console.log(`PASSOU V11: ${calls} chamadas de handlers reais, ${checks} verificações, ${writes} escritas CAS, avaliações SQLite reais, emissão, relatórios, isolamento e sessão SCORM. BUCKET/DOMÍNIO de teste.`)
}finally{db.close()}
