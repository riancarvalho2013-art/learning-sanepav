import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const directory=await mkdtemp(join(tmpdir(),'sanepav-lms-v2-'))
process.env.LEARNING_DB=join(directory,'learning.sqlite')
try{
const {BUCKET,DOMAIN}=await import('./storage.mjs')
const {default:app}=await import('./platform.mjs')
const origin='https://learning.example.test',password=crypto.randomUUID()
async function request(path,cookie='',body){return app.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',
headers:{origin,cookie,'content-type':'application/json','oai-authenticated-user-id':'lms-v2-test'},
...(body===undefined?{}:{body:JSON.stringify(body)})}),{BUCKET,DOMAIN})}
async function call(path,cookie='',body){const result=await request('/api/'+path,cookie,body);const text=await result.text();let data=null;try{data=JSON.parse(text)}catch{data=text};return {status:result.status,data,headers:result.headers,cookie:result.headers.get('set-cookie')?.split(';')[0]}}
async function good(path,cookie,body){const result=await call(path,cookie,body);assert.equal(result.status,200,JSON.stringify(result.data));return result}

const admin=(await good('login','',{name:'LMS Admin',email:'admin@example.test',password})).cookie
const company=(await good('v2/company',admin,{name:'Sanepav'})).data.id
const people={}
for(const [name,role] of [['hr','RH/DHO'],['learner','Colaborador'],['second','Colaborador']]){
  await good('user',admin,{name,email:name+'@example.test',role,active:true,password,organization:{company_id:company,revision:0}})
  people[name]=(await good('data',admin)).data.people.find(p=>p.name===name)
  people[name].cookie=(await good('login','',{email:people[name].email,password})).cookie
}
const hr=people.hr.cookie,learner=people.learner.cookie,second=people.second.cookie

await good('questionBank',hr,{title:'EPIs',competency:'Segurança',prompt:'Qual EPI protege a cabeça?',options:['Capacete','Luva'],answer:0})
await good('questionBank',hr,{title:'Altura',competency:'Segurança',prompt:'NR aplicável ao trabalho em altura?',options:['NR-10','NR-35'],answer:1})
let hrData=(await good('data',hr)).data
const qIds=hrData.questionBank.map(q=>q.id)
assert.equal(qIds.length,2)
assert.equal((await good('data',learner)).data.questionBank,undefined,'Question bank answers must not leak to learners')

await good('course',hr,{title:'NR-35 Avançado',type:'Questionário',body:'Avaliação NR-35',options:['A','B'],answer:0,minutes:60,questionIds:qIds,passingScore:70,maxAttempts:2})
let course=(await good('data',hr)).data.courses.at(-1)
await good('courseState',hr,{id:course.id,revision:course.revision,status:'published'})
await good('assign',hr,{course:course.id,person:people.learner.id})

let learnerData=(await good('data',learner)).data
let enroll=learnerData.enroll.find(e=>e.course===course.id)
const visibleCourse=learnerData.courses.find(c=>c.id===course.id)
assert.equal(visibleCourse.assessmentQuestions.length,2)
assert.equal(visibleCourse.assessmentQuestions[0].answer,undefined,'Assessment answers must be stripped')

await good('assessmentSubmit',learner,{id:enroll.id,answers:[0,0]})
learnerData=(await good('data',learner)).data
enroll=learnerData.enroll.find(e=>e.course===course.id)
assert.equal(enroll.score,50)
assert.equal(enroll.passed,false)
assert.equal(enroll.progress,1)
assert.equal(learnerData.certificates.length,0)

await good('assessmentSubmit',learner,{id:enroll.id,answers:[0,1]})
learnerData=(await good('data',learner)).data
enroll=learnerData.enroll.find(e=>e.course===course.id)
assert.equal(enroll.score,100)
assert.equal(enroll.passed,true)
assert.equal(enroll.progress,100)
assert.equal(learnerData.certificates.length,1)
const cert=learnerData.certificates[0]
assert.ok(cert.code.startsWith('SNPV-'))

const verify=await good('certificateVerify?code='+cert.code,learner)
assert.equal(verify.data.valid,true)
assert.equal(verify.data.personName,'learner')
const pdfRes=await request('/api/certificatePdf?id='+cert.id,learner)
assert.equal(pdfRes.status,200)
assert.equal(pdfRes.headers.get('content-type'),'application/pdf')
const pdfBytes=Buffer.from(await pdfRes.arrayBuffer()).toString('utf8')
assert.ok(pdfBytes.startsWith('%PDF-1.4'))
assert.ok(pdfBytes.includes(cert.code))

await good('course',hr,{title:'Integração Presencial',type:'Leitura',body:'Conteúdo presencial',minutes:120})
const presCourse=(await good('data',hr)).data.courses.at(-1)
await good('courseState',hr,{id:presCourse.id,revision:presCourse.revision,status:'published'})
await good('classCreate',hr,{course:presCourse.id,title:'Turma Novembro',instructor:'Carlos Lima',location:'Matriz Osasco',minAttendance:75,sessions:[{date:'2026-11-25',topic:'Módulo 1'}]})
const cls=(await good('data',hr)).data.classes.at(-1)
await good('classEnroll',hr,{classId:cls.id,people:[people.second.id]})
await good('classAttendance',hr,{classId:cls.id,sessionId:cls.sessions[0].id,records:[{personId:people.second.id,status:'present'}]})
const secondData=(await good('data',second)).data
assert.equal(secondData.enroll.find(e=>e.course===presCourse.id).progress,100)
assert.equal(secondData.certificates.length,1)
console.log('OK: banco de questões, tentativas com nota mínima, certificados PDF verificáveis e turmas presenciais.')
}finally{await rm(directory,{recursive:true,force:true})}
