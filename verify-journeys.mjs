import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
const directory=await mkdtemp(join(tmpdir(),'sanepav-journeys-'))
process.env.LEARNING_DB=join(directory,'learning.sqlite')
try{
const {BUCKET,DOMAIN}=await import('./storage.mjs')
const {default:app}=await import('./platform.mjs')
const origin='https://learning.example.test',password=crypto.randomUUID()
async function request(path,cookie='',body){return app.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',
 headers:{origin,cookie,'content-type':'application/json','oai-authenticated-user-id':'journey-test'},
 ...(body===undefined?{}:{body:JSON.stringify(body)})}),{BUCKET,DOMAIN})}
async function call(path,cookie='',body){const result=await request('/api/'+path,cookie,body);return {status:result.status,data:await result.json(),cookie:result.headers.get('set-cookie')?.split(';')[0]}}
async function good(path,cookie,body){const result=await call(path,cookie,body);assert.equal(result.status,200,JSON.stringify(result.data));return result}
const admin=(await good('login','',{name:'Journey admin',email:'admin@example.test',password})).cookie
const company=(await good('v2/company',admin,{name:'Test company'})).data.id
const people={}
for(const [name,role] of [['hr','RH/DHO'],['first','Colaborador'],['second','Colaborador'],['third','Colaborador']]){
 await good('user',admin,{name,email:name+'@example.test',role,active:true,password,organization:{company_id:company,revision:0}})
 people[name]=(await good('data',admin)).data.people.find(person=>person.name===name)
 people[name].cookie=(await good('login','',{email:people[name].email,password})).cookie
}
const hr=people.hr.cookie,learner=people.first.cookie
const data=async cookie=>(await good('data',cookie)).data
const courses=[]
for(const title of ['First reading','Second reading']){
 await good('course',hr,{title,type:'Leitura',body:'Protected content '+title,minutes:5})
 const course=(await data(hr)).courses.at(-1);courses.push(course.id)
 await good('courseState',hr,{id:course.id,revision:course.revision,status:'published'})
}
const upload=crypto.randomUUID()
const uploadResult=await app.fetch(new Request(origin+'/api/upload?id='+upload+'&path=index.html',{method:'POST',headers:{origin,cookie:hr,'oai-authenticated-user-id':'journey-test'},body:'<!doctype html><title>Test SCO</title>'}),{BUCKET,DOMAIN})
assert.equal(uploadResult.status,200)
await good('course',hr,{title:'Third SCO',type:'SCORM',upload,entry:'index.html',minutes:5})
const sco=(await data(hr)).courses.at(-1);courses.push(sco.id)
await good('courseState',hr,{id:sco.id,revision:sco.revision,status:'published'})
await good('mission',hr,{title:'Sequential journey',courses,sequential:true})
let journey=(await data(hr)).missions.at(-1)
assert.equal((await call('missionAssign',hr,{id:journey.id,people:[people.first.id,'unauthorized-id']})).status,400)
assert.equal((await data(learner)).enroll.length,0,'Invalid bulk assignment must create no enrollments')
await good('missionAssign',hr,{id:journey.id,people:[people.first.id,people.second.id],date:'2099-01-01'})
await good('missionAssign',hr,{id:journey.id,person:people.first.id})
assert.equal((await data(hr)).missionEnrollments.length,2,'Assignment retries are idempotent')
let view=await data(learner)
assert.equal(view.missions.length,1);assert.equal(view.missionEnrollments.length,1)
assert.equal(view.courses.find(c=>c.id===courses[1]).body,undefined,'Locked reading content must be redacted')
assert.equal(view.courses.find(c=>c.id===sco.id).entry,undefined)
const enroll=course=>view.enroll.find(e=>e.course===course)
assert.equal((await call('progress',learner,{id:enroll(courses[1]).id,progress:100})).status,403)
assert.equal((await request('/content/'+sco.id+'/index.html',learner)).status,403)
await good('progress',learner,{id:enroll(courses[0]).id,progress:100})
view=await data(learner)
assert.equal(view.courses.find(c=>c.id===courses[1]).body,'Protected content Second reading')
assert.equal((await request('/content/'+sco.id+'/index.html',learner)).status,403)
await good('progress',learner,{id:enroll(courses[1]).id,progress:100})
assert.equal((await request('/content/'+sco.id+'/index.html',learner)).status,200)
await good('progress',learner,{id:enroll(sco.id).id,progress:100,cmi:{'cmi.core.lesson_status':'passed'}})
view=await data(learner);assert.equal(view.enroll.filter(e=>e.progress===100).length,3)
assert.equal((await call('mission',hr,{id:journey.id,title:'Changed structure',courses:[...courses].reverse(),sequential:true,revision:journey.revision})).status,409)
await good('mission',hr,{id:journey.id,title:'Updated description',description:'Same curriculum',courses,sequential:true,revision:journey.revision})
assert.equal((await call('mission',hr,{id:journey.id,title:'Stale title',courses,sequential:true,revision:journey.revision})).status,409)
await good('assign',hr,{person:people.third.id,course:courses[1]})
await good('missionAssign',hr,{id:journey.id,person:people.third.id})
const third=await data(people.third.cookie)
assert.equal(third.courses.find(c=>c.id===courses[1]).blockedBy.length,0,'Earlier independent enrollment must preserve access')
await good('login','',{email:people.first.email,password})
const stored=await (await BUCKET.get('system/state-v1')).json()
assert.equal(stored.missionEnrollments.length,3)
assert.equal(stored.enroll.find(e=>e.person===people.first.id&&e.course===sco.id).prerequisites.length,2)
const legacyId=crypto.randomUUID()
const legacySnapshot=await BUCKET.get('system/state-v1'),legacyState=await legacySnapshot.json()
legacyState.missions.push({id:legacyId,title:'Legacy journey',courses})
await BUCKET.put('system/state-v1',JSON.stringify(legacyState),{onlyIf:{etagMatches:legacySnapshot.etag}})
assert.ok((await data(learner)).missions.some(m=>m.id===legacyId))
await good('mission',hr,{id:legacyId,title:'Legacy journey edited',courses,sequential:false,revision:0})
assert.ok((await data(learner)).missions.some(m=>m.id===legacyId),'Editing legacy metadata must preserve implicit access')
const disk=new DatabaseSync(process.env.LEARNING_DB,{readOnly:true})
const persisted=JSON.parse(new TextDecoder().decode(disk.prepare('SELECT body FROM objects WHERE key=?').get('system/state-v1').body))
disk.close()
assert.equal(persisted.missionEnrollments.length,3)
assert.equal(persisted.enroll.find(e=>e.person===people.first.id&&e.course===sco.id).progress,100)
console.log('OK: trilhas sequenciais, atribuição coletiva atômica, bloqueio de leitura/SCORM/progresso, liberação, revisão e compatibilidade.')

}finally{await rm(directory,{recursive:true,force:true})}
