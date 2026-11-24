// Real core + HTTP + persistent SQLite gate. Never uses a corporate database.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import net from 'node:net'
const dir=await mkdtemp(join(tmpdir(),'completion-v11-http-')),listener=net.createServer().listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r))
const endpoint='http://127.0.0.1:'+port,origin='https://127.0.0.1:'+port,key=randomUUID()+randomUUID(),password=randomUUID();let child,log='',checks=0
async function call(path,cookie='',body,expected=200){const r=await fetch(endpoint+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const str=await r.text();assert.equal(r.status,expected,path+': '+str.slice(0,300));checks++;return {data:JSON.parse(str),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
try{
 child=spawn(process.execPath,['serve.mjs'],{cwd:import.meta.dirname,env:{...process.env,PORT:String(port),NODE_ENV:'production',LEARNING_DB:join(dir,'learning.sqlite'),SETUP_KEY:key},stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x)
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(endpoint+'/readyz')).ok){ready=true;break}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,50))}assert.ok(ready,'Servidor não iniciou: '+log.slice(-1500))
 const activation=await fetch(endpoint+'/ativar',{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:key})});assert.equal(activation.status,303)
 const admin=(await call('login',activation.headers.get('set-cookie').split(';')[0],{name:'Admin QA',email:'admin@example.test',password})).cookie
 const company=(await call('v2/company',admin,{name:'Empresa QA V11'})).data.id
 await call('user',admin,{name:'Learner QA',email:'learner@example.test',role:'Colaborador',active:true,password,organization:{company_id:company,revision:0,position:'Analista'}})
 const person=(await call('v2/organization',admin)).data.people.find(p=>p.email==='learner@example.test');assert.ok(person)
 const learner=(await call('login','',{email:person.email,password})).cookie
 const data=async cookie=>(await call('data',cookie)).data
 await call('course',admin,{title:'V11 curso de teste',type:'Leitura',body:'Conteúdo QA',minutes:5})
 const course=(await data(admin)).courses.find(c=>c.title==='V11 curso de teste');assert.ok(course)
 await call('courseState',admin,{id:course.id,revision:course.revision,status:'published'})
 await call('assign',admin,{course:course.id,person:person.id})
 const enrollment=(await data(learner)).enroll.find(e=>e.course===course.id);assert.ok(enrollment)
 const linked=(await call('lxp/v2/growth',learner,{personId:person.id,title:'PDI QA vinculado',mix:'10',status:'done',learningLink:{kind:'course',id:enrollment.id}},201)).data
 assert.equal(linked.status,'todo');assert.equal((await call('lxp/v2/profile',learner)).data.counts.completedPdi,0)
 await call('lxp/v2/profile?person='+person.id,'',undefined,401)
 const f=(await call('assessment/v6/create',admin,{companyId:company,courseId:course.id,title:'Final QA V11',kind:'final',minScore:70,maxAttempts:2,durationMinutes:20,startsOn:'2020-01-01',endsOn:'2099-12-31',questions:[{prompt:'Selecione a alternativa correta',options:['A','B'],correctIndex:1,weight:1}]})).data
 await call('assessment/v6/publish',admin,{id:f.id,revision:f.revision})
 await call('progress',admin,{id:enrollment.id,progress:100},403)
 const pending=(await call('progress',learner,{id:enrollment.id,progress:100,score:100})).data;assert.equal(pending.progress,99);assert.equal(pending.pendingAssessment,true)
 await call('evo/certificates/issue',learner,{enrollmentId:enrollment.id},409)
 assert.equal((await call('lxp/v2/growth',learner)).data.items.find(x=>x.id===linked.id).status,'doing')
 const s=(await call('assessment/v6/start',learner,{id:f.id})).data
 const attempt=(await call('assessment/v6/submit',learner,{id:f.id,attemptId:s.attemptId,answers:[1]})).data;assert.equal(attempt.passed,true);assert.equal(attempt.completion.items[0].progress,100)
 assert.equal((await data(learner)).enroll.find(e=>e.id===enrollment.id).progress,100)
 const cert=(await call('evo/certificates/issue',learner,{enrollmentId:enrollment.id})).data;assert.ok(cert.code)
 const profile=(await call('lxp/v2/profile?person='+person.id,admin)).data;assert.equal(profile.counts.completedPdi,1);assert.equal(profile.counts.certificates,1);assert.equal(profile.counts.nominalMinutes,5);assert.equal(profile.pdi.find(x=>x.id===linked.id).learning.progress,100)
 const hist=(await call('organization/v11/history?person='+person.id,admin)).data;assert.equal(hist.assignments[0].company_id,company)
 await call('organization/v11/history',learner,undefined,403)
 const report=(await call('reports/v3/summary?company='+company,admin)).data;assert.equal(report.metrics.find(m=>m.code==='learning.completion_assessed').value,1);assert.equal(report.metrics.find(m=>m.code==='dho.pdi_completion').value,100)
 await call('logout',learner,{});await call('progress',learner,{id:enrollment.id,progress:100},401)
 console.log('PASSOU: jornada HTTP V11 com núcleo real, '+checks+' requisições verificadas, SQLite, avaliação, certificado, histórico e escopo.')
}catch(e){console.error(log.slice(-2500));throw e}finally{if(child&&child.exitCode===null){child.kill();await once(child,'exit')}await rm(dir,{recursive:true,force:true})}
