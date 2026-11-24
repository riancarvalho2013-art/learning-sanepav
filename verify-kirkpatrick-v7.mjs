import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {handleKirkpatrickV7} from './kirkpatrick-v7.mjs'
const dir=await mkdtemp(join(tmpdir(),'sanepav-kirkpatrick-'))
const path=join(dir,'data.sqlite'),db=new DatabaseSync(path)
process.env.LEARNING_DB=path
const a=randomUUID(),b=randomUUID(),course=randomUUID(),otherCourse=randomUUID()
const users=[{id:randomUUID(),role:'Administrador',active:true,name:'Admin'}, {id:randomUUID(),role:'RH/DHO',active:true,name:'RH'}, {id:randomUUID(),role:'Líder',active:true,name:'Líder'},...Array.from({length:7},(_,i)=>({id:randomUUID(),role:'Colaborador',active:true,name:'Pessoa '+i})),{id:randomUUID(),role:'Colaborador',active:true,name:'Outra empresa'}]
const [admin,hr,leader,...others]=users
const learner=others[0],outsider=others[7]
const tokens=new Map(users.map(u=>[u.id,randomUUID()]))
const assignments=new Map(users.map((u,i)=>[u.id,{company_id:i===users.length-1?b:a}]))
for(const u of others.slice(0,7))u.manager=leader.id
const state={users,sessions:users.map(u=>({digest:createHash('sha256').update(tokens.get(u.id)).digest('hex'),identity:'fixture',person:u.id,until:Date.now()+1000000})),organization:{companies:[{id:a,name:'Sanepav',active:1},{id:b,name:'Beta Clean',active:1}],assignments},courses:[{id:course,title:'Integração de Segurança',status:'published'},{id:otherCourse,title:'Curso Teste',status:'published'}],enroll:others.slice(0,7).map(u=>({id:randomUUID(),person:u.id,course,progress:100,completed:'2026-10-01T10:00:00.000Z'}))}
const BUCKET={async get(key){return key==='system/state-v1'?{async json(){return state}}:null}}
const DOMAIN={allowedCompanies(received,user){assert.equal(received,state,'O domínio precisa receber o estado organizacional completo');return user.role==='Administrador'?[a,b]:user.role==='RH/DHO'?[a]:[assignments.get(user.id).company_id]}}
const origin='https://learning.example'
let calls=0
async function call(route,user,body){calls++
 const headers={origin,'oai-authenticated-user-id':'fixture','content-type':'application/json'}
 if(user)headers.cookie='learning='+tokens.get(user.id)
 const req=new Request(origin+'/api/kirkpatrick/v7/'+route,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})})
 const res=await handleKirkpatrickV7(req,{BUCKET,DOMAIN})
 return {status:res.status,data:await res.json()}
}
try{
 assert.equal((await call('options',null)).status,401)
 assert.equal((await call('reaction',outsider,{courseId:course,clarity:5,relevance:5,applicability:5,recommendation:10,comment:''})).status,403)
 assert.equal((await call('reaction',learner,{courseId:course,clarity:6,relevance:5,applicability:5,recommendation:10,comment:''})).status,400)
 for(const [i,u] of others.slice(0,7).entries()){
  const result=await call('reaction',u,{courseId:course,clarity:4,relevance:5,applicability:4,recommendation:i<5?9:4,comment:''})
  assert.equal(result.status,200,JSON.stringify(result.data))
 }
 assert.equal((await call('reaction',learner,{courseId:course,clarity:4,relevance:4,applicability:4,recommendation:9,comment:''})).status,409)
 assert.equal((await call('summary?company='+a+'&course='+course,leader)).status,403)
 assert.equal((await call('summary?company='+a+'&course='+course,outsider)).status,403)
 const summary=await call('summary?company='+a+'&course='+course,hr)
 assert.equal(summary.status,200)
 assert.equal(summary.data.n1.responseCount,7)
 assert.equal(summary.data.n1.nps,42.86)
 assert.equal(summary.data.n2.status,'not_measured')
 assert.equal((await call('transfer/assign',leader,{companyId:a,courseId:course,offsetDays:30})).status,403)
 assert.equal((await call('transfer/assign',hr,{companyId:b,courseId:course,offsetDays:30})).status,403)
 const assign=await call('transfer/assign',hr,{companyId:a,courseId:course,offsetDays:30})
 assert.equal(assign.status,200);assert.equal(assign.data.created,7)
 const duplicated=await call('transfer/assign',hr,{companyId:a,courseId:course,offsetDays:30})
 assert.equal(duplicated.data.created,0,'Atribuição idempotente')
 const tasks=await call('transfer/tasks',leader)
 assert.equal(tasks.status,200);assert.equal(tasks.data.items.length,7)
 assert.equal((await call('transfer/submit',learner,{id:tasks.data.items[0].id,application:5,barrier:'',evidence:'',action:''})).status,403)
 for(const task of tasks.data.items){
  const r=await call('transfer/submit',leader,{id:task.id,application:4,barrier:'Sem barreiras',evidence:'Aplicação observada',action:'Manter acompanhamento'})
  assert.equal(r.status,200)
 }
 assert.equal((await call('transfer/submit',leader,{id:tasks.data.items[0].id,application:4,barrier:'',evidence:'',action:''})).status,409)
 const transferSummary=await call('summary?company='+a+'&course='+course,hr)
 assert.equal(transferSummary.data.n3.meanApplication,4)
 assert.equal(transferSummary.data.n3.submitted,7)
 assert.equal((await call('outcomes',hr,{companyId:a,courseId:course,metricName:'Qualidade',unit:'%',baseline:70,observed:75,periodStart:'2026-10-01',periodEnd:'2026-11-20',source:'Planilha operacional',method:'Série descritiva antes/depois',caveat:'Não houve grupo de controle'})).status,200)
 assert.equal((await call('outcomes',leader,{companyId:a,courseId:course,metricName:'Qualidade',unit:'%',baseline:70,observed:75,periodStart:'2026-10-01',periodEnd:'2026-11-20',source:'Planilha',method:'Série',caveat:''})).status,403)
 assert.equal((await call('summary?company='+a+'&course='+course,hr)).data.n4.observations.length,1)
 // N2: exactly one pre and one post, paired by subject and only existing recorded grades.
 db.exec('CREATE TABLE assessment_v6_forms(id TEXT,company_id TEXT,course_id TEXT,status TEXT,kind TEXT);CREATE TABLE assessment_v6_attempts(form_id TEXT,user_id TEXT,score INTEGER)')
 const pre=randomUUID(),post=randomUUID()
 db.prepare('INSERT INTO assessment_v6_forms VALUES(?,?,?,?,?)').run(pre,a,course,'published','pre')
 db.prepare('INSERT INTO assessment_v6_forms VALUES(?,?,?,?,?)').run(post,a,course,'published','post')
 db.prepare('INSERT INTO assessment_v6_attempts VALUES(?,?,?)').run(pre,learner.id,60)
 db.prepare('INSERT INTO assessment_v6_attempts VALUES(?,?,?)').run(post,learner.id,80)
 const after=await call('summary?company='+a+'&course='+course,hr)
 assert.equal(after.data.n2.pairedPeople,1);assert.equal(after.data.n2.changePoints,20)
 db.close();const check=new DatabaseSync(path)
 assert.equal(check.prepare('SELECT COUNT(*) AS n FROM kirkpatrick_reactions_v7').get().n,7)
 assert.equal(check.prepare('SELECT COUNT(*) AS n FROM kirkpatrick_transfer_v7 WHERE status=\'submitted\'').get().n,7)
 check.close()
 console.log('PASSOU: Kirkpatrick V7 — '+calls+' chamadas, N1/N2/N3/N4, multiempresa, confidencialidade, idempotência, reconciliação e persistência')
}catch(e){try{db.close()}catch{};throw e}
finally{await rm(dir,{recursive:true,force:true})}
