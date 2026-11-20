import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
const directory=await mkdtemp(join(tmpdir(),'sanepav-learning-'))
process.env.LEARNING_DB=join(directory,'learning.sqlite')
const {BUCKET,DOMAIN}=await import('./storage.mjs')
const {default:app}=await import('./platform.mjs')
const origin='https://learning.example.test',password=crypto.randomUUID()
async function call(path,cookie='',body){
 const result=await app.fetch(new Request(origin+'/api/'+path,{
  method:body===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json','oai-authenticated-user-id':'learning-test'},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 }),{BUCKET,DOMAIN})
 return {status:result.status,data:await result.json(),cookie:result.headers.get('set-cookie')?.split(';')[0]}
}
async function good(path,cookie,body){const result=await call(path,cookie,body);assert.equal(result.status,200,JSON.stringify(result.data));return result}
try{
 const admin=(await good('login','',{name:'Test admin',email:'admin@example.test',password})).cookie
 const company=(await good('v2/company',admin,{name:'Test company'})).data.id
 const people={}
 for(const [name,role] of [['hr','RH/DHO'],['leader','Líder'],['learner','Colaborador'],['second','Colaborador'],['executive','Diretoria']]){
  await good('user',admin,{name,email:name+'@example.test',role,active:true,password,manager:name==='learner'?people.leader.id:''})
  people[name]=(await good('data',admin)).data.people.find(p=>p.name===name)
  await good('v2/assignment',admin,{person_id:people[name].id,company_id:company,revision:0})
  people[name].cookie=(await good('login','',{email:name+'@example.test',password})).cookie
 }
 const hr=people.hr.cookie,learner=people.learner.cookie,leader=people.leader.cookie,executive=people.executive.cookie
 const list=async(cookie=admin)=>(await good('data',cookie)).data.courses
 const legacy=(await list())[0]
 assert.equal(legacy.status,'published');assert.equal(legacy.revision,0)
 await good('course',hr,{title:'Test draft',type:'Leitura',body:'Original lesson',minutes:10})
 let course=(await list()).at(-1)
 const courseId=course.id
 assert.equal(course.status,'draft');assert.equal(course.revision,1)
 assert.equal((await call('assign',hr,{course:courseId,person:people.learner.id})).status,409)
 assert.equal((await list(learner)).some(c=>c.id===courseId),false)
 assert.equal((await call('courseState',learner,{id:courseId,revision:1,status:'published'})).status,403)
 assert.equal((await call('courseState',leader,{id:courseId,revision:1,status:'published'})).status,403)
 assert.equal((await call('courseState',executive,{id:courseId,revision:1,status:'published'})).status,403)
 assert.equal((await call('courseState',hr,{id:courseId,revision:0,status:'published'})).status,409)
 await good('mission',hr,{title:'Test track',courses:[legacy.id,courseId]})
 const mission=(await good('data',hr)).data.missions.at(-1)
 assert.equal((await call('missionAssign',hr,{id:mission.id,person:people.learner.id})).status,409)
 assert.equal((await good('data',learner)).data.enroll.length,0,'A rejected track must create no partial enrollments')
 await good('courseEdit',hr,{id:courseId,revision:1,title:'Reviewed lesson',body:'Reviewed content',minutes:15,track:'Test track'})
 course=(await list()).at(-1)
 assert.equal(course.body,'Reviewed content');assert.equal(course.revision,2)
 assert.equal((await call('courseEdit',hr,{id:courseId,revision:1,title:'Stale write',minutes:20})).status,409)
 await good('courseState',hr,{id:courseId,revision:2,status:'published'})
 await good('assign',hr,{course:courseId,person:people.learner.id})
 assert.equal((await list(learner)).at(-1).history,undefined)
 const enrollment=(await good('data',learner)).data.enroll[0]
 await good('progress',learner,{id:enrollment.id,progress:50})
 await good('courseState',hr,{id:courseId,revision:3,status:'archived'})
 assert.equal((await call('assign',hr,{course:courseId,person:people.second.id})).status,409)
 assert.equal((await list(learner)).at(-1).status,'archived')
 await good('progress',learner,{id:enrollment.id,progress:100})
 assert.equal((await good('data',learner)).data.enroll[0].progress,100)
 assert.equal((await call('courseState',hr,{id:courseId,revision:4,status:'draft'})).status,400)
 await good('courseState',hr,{id:courseId,revision:4,status:'published'})
 await good('missionAssign',hr,{id:mission.id,person:people.second.id})
 assert.equal((await list()).at(-1).history.length,5)
 const check=new DatabaseSync(process.env.LEARNING_DB,{readOnly:true})
 const persisted=JSON.parse(new TextDecoder().decode(check.prepare('SELECT body FROM objects WHERE key=?').get('system/state-v1').body))
 check.close()
 assert.equal(persisted.courses.find(c=>c.id===courseId).status,'published')
 assert.equal(persisted.enroll.find(e=>e.id===enrollment.id).progress,100)
 console.log('OK: rascunhos, publicação, arquivamento, reativação, revisão concorrente, RH, atomicidade de trilhas e persistência real.')
}finally{await rm(directory,{recursive:true,force:true})}
