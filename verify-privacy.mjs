import assert from 'node:assert/strict'
process.env.LEARNING_DB=':memory:'
const {BUCKET}=await import('./storage.mjs')
const {default:worker}=await import('./platform.mjs')
async function fetch(url,options={}){const req=new Request(url,options);req.headers.set('oai-authenticated-user-id','test');return worker.fetch(req,{BUCKET})}
const origin='http://127.0.0.1:4187',password=crypto.randomUUID()
async function call(path,cookie='',body){const res=await fetch(origin+'/api/'+path,{method:body?'POST':'GET',headers:{origin,cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]}}
async function good(path,cookie,body){const r=await call(path,cookie,body);assert.equal(r.status,200,JSON.stringify(r.data));return r}
{assert.equal((await call('data')).status,401)
const a=(await good('login','',{email:'admin@example.test',name:'Teste',password})).cookie
const create=(name,role,manager='')=>good('user',a,{name,email:name+'@example.test',role,manager,password,active:true})
await create('lider','Líder');const leader=(await good('data',a)).data.people.find(p=>p.name==='lider')
await create('pessoa','Colaborador',leader.id);await create('externo','Colaborador')
let all=(await good('data',a)).data;const employee=all.people.find(p=>p.name==='pessoa'),other=all.people.find(p=>p.name==='externo')
const l=(await good('login','',{email:leader.email,password})).cookie,e=(await good('login','',{email:employee.email,password})).cookie
assert.equal((await good('data',l)).data.people.length,2);assert.equal((await good('data',e)).data.people.length,1)
assert.equal((await call('assign',l,{person:other.id,course:all.courses[0].id})).status,403)
assert.equal((await call('theme',e,{})).status,403);await good('assign',a,{person:employee.id,course:all.courses[0].id})
const enrollment=(await good('data',e)).data.enroll[0];await good('progress',e,{id:enrollment.id,progress:100})
for(const kind of ['OKR','PDI','1:1','Feedback','Elogio','Desempenho'])await good('record',l,{kind,person:employee.id,title:kind,date:'2099-01-01',course:enrollment.course,target:5,actual:3,performance:3,potential:2})
await good('pulse',l,{person:employee.id,title:'Como foi a semana?',date:'2099-01-01'});const pulse=(await good('data',e)).data.pulses[0],answer={kind:'Pulse',person:employee.id,title:pulse.title,pulse:pulse.id,rating:4}
await good('record',e,answer);assert.equal((await call('record',e,answer)).status,409)
// Private answers and conversations must survive privileged readers and forged edits.
assert.equal((await good('data',l)).data.records.filter(r=>r.kind==='Pulse').length,0)
assert.equal((await good('data',a)).data.records.filter(r=>r.kind==='Pulse').length,0)
assert.equal((await good('data',e)).data.records.filter(r=>r.kind==='Pulse').length,1)
const meeting=(await good('data',e)).data.records.find(r=>r.kind==='1:1')
assert.ok(meeting)
assert.ok((await good('data',l)).data.records.some(r=>r.id===meeting.id))
assert.equal((await good('data',a)).data.records.some(r=>r.id===meeting.id),false)
assert.equal((await call('record',a,{kind:'PDI',person:employee.id,title:'Blocked meeting reference',date:'2099-01-01',link:meeting.id})).status,403)
await good('record',l,{kind:'PDI',person:employee.id,title:'Allowed meeting reference',date:'2099-01-01',link:meeting.id})
const privateFeedback=(await good('data',e)).data.records.find(r=>r.kind==='Feedback')
assert.ok(privateFeedback)
assert.equal((await good('data',a)).data.records.some(r=>r.id===privateFeedback.id),false)
assert.equal((await call('record',a,{...privateFeedback,title:'overwrite'})).status,403)
assert.equal((await call('record',e,{...privateFeedback,title:'overwrite'})).status,403)
await good('record',l,{...privateFeedback,title:'Author update'})
assert.equal((await call('record',a,{kind:'PDI',person:employee.id,title:'Invalid private link',link:privateFeedback.id})).status,403)

await good('course',a,{title:'Teste',type:'Questionário',body:'Escolha A',options:['A','B'],answer:0,minutes:5})
all=(await good('data',a)).data;const quiz=all.courses.at(-1);assert.equal(quiz.answer,undefined);await good('courseState',a,{id:quiz.id,revision:quiz.revision,status:'published'});await good('assign',a,{person:employee.id,course:quiz.id})
const qe=(await good('data',e)).data.enroll.at(-1);await good('progress',e,{id:qe.id,answer:0,progress:100});assert.equal((await good('data',e)).data.enroll.at(-1).score,100)
const key=crypto.randomUUID();assert.equal((await fetch(origin+'/api/upload?id='+key+'&path=index.html',{method:'POST',headers:{origin,cookie:a},body:'<!doctype html><title>SCO</title>'})).status,200)
await good('course',a,{title:'SCO',type:'SCORM',minutes:1,upload:key,entry:'index.html'});const sco=(await good('data',a)).data.courses.at(-1)
await good('courseState',a,{id:sco.id,revision:sco.revision,status:'published'});await good('assign',a,{person:employee.id,course:sco.id});const se=(await good('data',e)).data.enroll.at(-1);const launch=await fetch(origin+'/content/'+sco.id+'/index.html?key=123',{headers:{cookie:e}});assert.match(await launch.text(),/LMSInitialize/)
await good('progress',e,{id:se.id,progress:1,cmi:{'cmi.core.lesson_status':'passed','cmi.core.score.raw':'84','cmi.suspend_data':'continuar'}})
assert.equal((await good('data',e)).data.enroll.at(-1).progress,100);assert.equal((await good('data',e)).data.enroll.at(-1).score,84)
// Test the aggregate threshold using isolated test records.
let snapshot=await BUCKET.get('system/state-v1'),state=await snapshot.json()
const recipients=Array.from({length:7},(_,i)=>'aggregate-test-'+i)
state.users.push(...recipients.map(id=>({id,name:id,active:true,role:'Colaborador',manager:leader.id})))
state.pulses.push({id:'aggregate-survey',title:'Aggregate fixture',date:'2099-01-01',people:recipients,author:leader.id})
state.records.push(...recipients.slice(0,6).map(person=>({id:crypto.randomUUID(),person,author:person,kind:'Pulse',pulse:'aggregate-survey',rating:4})))
await BUCKET.put('system/state-v1',JSON.stringify(state),{onlyIf:{etagMatches:snapshot.etag}})
assert.equal((await good('data',l)).data.pulses.find(p=>p.id==='aggregate-survey').averageRating,undefined)
snapshot=await BUCKET.get('system/state-v1');state=await snapshot.json()
state.records.push({id:crypto.randomUUID(),person:recipients[6],author:recipients[6],kind:'Pulse',pulse:'aggregate-survey',rating:4})
await BUCKET.put('system/state-v1',JSON.stringify(state),{onlyIf:{etagMatches:snapshot.etag}})
assert.equal((await good('data',l)).data.pulses.find(p=>p.id==='aggregate-survey').averageRating,4)
await good('user',a,{...employee,active:false});assert.equal((await call('data',e)).status,401)
assert.ok((await good('data',a)).data.logs.length>15);console.log('OK: autenticação, hierarquia, cursos, questionário, SCORM, edição por autor e registros privados.')
}
