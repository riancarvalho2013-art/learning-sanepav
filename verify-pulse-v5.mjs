import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {handlePulseV5} from './pulse-secure-v5.mjs'

const directory=await mkdtemp(join(tmpdir(),'sanepav-pulse-v5-'))
const dbPath=join(directory,'pulse-test.sqlite')
const db=new DatabaseSync(dbPath)
process.env.LEARNING_DB=dbPath
const origin='https://learning.local.test'
const A=randomUUID(),B=randomUUID()
const users=Array.from({length:12},(_,i)=>({id:randomUUID(),name:'Colaborador '+i,email:`p${i}@example.test`,role:i===0?'Administrador':i===1?'RH/DHO':i===11?'Líder':'Colaborador',active:true,manager:i>1&&i<10?null:null}))
const assignment=new Map(users.map((u,i)=>[u.id,{company_id:i===10||i===11?B:A}]))
const tokens=new Map(users.map(u=>[u.id,randomUUID()]))
const sessions=users.map(u=>({digest:createHash('sha256').update(tokens.get(u.id)).digest('hex'),identity:'learning-test',person:u.id,until:Date.now()+3600000}))
const state={users,sessions,organization:{assignments:assignment,companies:[{id:A,name:'Sanepav',active:true},{id:B,name:'Beta Clean',active:true}]}}
const BUCKET={async get(key){return key==='system/state-v1'?{async json(){return state}}:null}}
const DOMAIN={allowedCompanies(received,user){assert.equal(received,state,'O domínio precisa receber o estado organizacional completo');return user.role==='Administrador'?[A,B]:[assignment.get(user.id)?.company_id].filter(Boolean)}}
let total=0
async function call(route,actor,body,method){
 const m=method|| (body===undefined?'GET':'POST')
 const req=new Request(origin+'/api/pulse/v5/'+route,{method:m,headers:{origin,'content-type':'application/json','oai-authenticated-user-id':'learning-test',...(actor?{cookie:'learning='+tokens.get(actor.id)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const response=await handlePulseV5(req,{BUCKET,DOMAIN})
 assert.ok(response,'O endpoint deve ser reconhecido.');total++
 return {status:response.status,body:await response.json()}
}
const date=days=>new Date(Date.now()+days*86400000).toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'})
const admin=users[0],hr=users[1],outsider=users[10],leaderB=users[11]
const participants=users.slice(2,10)
const standard={companyId:A,title:'Clima organizacional protegido',description:'Teste de piloto',startDate:date(0),endDate:date(10),participantIds:participants.map(u=>u.id),questions:[{title:'Tenho clareza sobre as minhas atividades',type:'likert5'},{title:'Indicaria a empresa como local de trabalho',type:'recommend10'}]}
try{
 assert.equal((await call('list',null)).status,401)
 assert.equal((await call('options',outsider)).status,403)
 assert.equal((await call('options',hr)).status,200)
 assert.equal((await call('create',outsider,standard)).status,403)
 assert.equal((await call('create',leaderB,standard)).status,403,'Um gestor não pode criar pesquisa para outra empresa')
 assert.equal((await call('create',admin,{...standard,participantIds:[outsider.id,...standard.participantIds]})).status,403,'Uma empresa não pode receber audiência da outra')
 assert.equal((await call('create',admin,{...standard,participantIds:standard.participantIds.slice(0,6)})).status,400,'Amostra mínima de 7 convidados')
 const created=await call('create',admin,standard);assert.equal(created.status,200,JSON.stringify(created.body))
 const surveyId=created.body.id
 assert.equal((await call('list',outsider)).body.items.length,0,'Colaborador de outra empresa não vê a pesquisa')
 assert.equal((await call('summary?id='+surveyId,outsider)).status,404,'Relatório de outra empresa deve ser proibido')
 assert.equal((await call('summary?id='+surveyId,participants[0])).status,403,'Colaborador não lê resultados gerenciais')
 assert.equal((await call('summary?id='+surveyId,admin)).body.status,'not-closed','Resultados ocultos antes do encerramento')
 assert.equal((await call('answer',outsider,{id:surveyId,values:[4,9]})).status,404,'Colaborador não convidado não pode responder')
 assert.equal((await call('answer',participants[0],{id:surveyId,values:[6,9]})).status,400,'Escala Likert 1–5 validada')
 for(let i=0;i<6;i++){
  const result=await call('answer',participants[i],{id:surveyId,values:[4,i>2?9:8]})
  assert.equal(result.status,200,JSON.stringify(result.body))
 }
 assert.equal((await call('answer',participants[0],{id:surveyId,values:[5,10]})).status,409,'Não aceitar duplicata')
 const before=db.prepare('SELECT SUM(answer_count) AS count FROM pulse_v5_answer_counts WHERE survey_id=?').get(surveyId).count
 assert.equal(before,12)
 assert.equal((await call('close',participants[0],{id:surveyId})).status,403,'Colaborador não encerra pesquisa')
 assert.equal((await call('close',admin,{id:surveyId})).status,200)
 assert.equal((await call('summary?id='+surveyId,admin)).body.status,'suppressed','Seis respostas são insuficientes')
 assert.equal((await call('answer',participants[6],{id:surveyId,values:[5,10]})).status,409,'Não aceitar respostas depois de encerrado')
 // Second survey reaches threshold and publishes exact aggregate without individual response rows.
 const next=await call('create',admin,{...standard,title:'Clima protegido — resultados válidos'})
 assert.equal(next.status,200)
 for(let i=0;i<7;i++)assert.equal((await call('answer',participants[i],{id:next.body.id,values:[i<4?5:3,i<4?10:4]})).status,200)
 assert.equal((await call('close',admin,{id:next.body.id})).status,200)
 const report=await call('summary?id='+next.body.id,admin)
 assert.equal(report.status,200)
 assert.equal(report.body.status,'available')
 assert.equal(report.body.summary.invited,8)
 assert.equal(report.body.summary.responded,7)
 assert.equal(report.body.summary.responseRate,87.5)
 assert.equal(report.body.summary.questions[0].count,7)
 assert.equal(report.body.summary.questions[0].mean,4.14)
 assert.equal(report.body.summary.questions[1].nps,14)
 assert.equal((await call('summary?id='+next.body.id,leaderB)).status,404,'Líder de outra empresa deve ser rejeitado')
 const cols=db.prepare('PRAGMA table_info(pulse_v5_answer_counts)').all().map(x=>x.name)
 assert.deepEqual(cols,['survey_id','question_id','value','answer_count'],'Somente contagens agregadas podem ser armazenadas')
 const raw=db.prepare('SELECT * FROM pulse_v5_answer_counts WHERE survey_id=?').all(next.body.id)
 assert.ok(raw.every(r=>Object.keys(r).every(k=>cols.includes(k))))
 assert.equal(db.prepare('SELECT COUNT(*) AS count FROM pulse_v5_invites WHERE survey_id=? AND responded=1').get(next.body.id).count,7)
 assert.equal((await call('list',participants[0])).body.items.filter(x=>x.answered).length,2)
 assert.equal((await call('list',outsider)).body.items.length,0)
 assert.equal(db.prepare('SELECT COUNT(*) AS count FROM pulse_v5_migrations WHERE version=1').get().count,1)
 db.close()
 const reopened=new DatabaseSync(dbPath)
 assert.equal(reopened.prepare('SELECT SUM(answer_count) AS count FROM pulse_v5_answer_counts WHERE survey_id=?').get(next.body.id).count,14,'Persistência após reabertura')
 reopened.close()
 console.log(`PASSOU: ${total} chamadas de API, restrição empresarial, autenticação, escalas, duplicidade, fechamento, limiar 7, eNPS, armazenamento somente de contagens agregadas e SQLite persistente.`)
}finally{
 try{db.close()}catch{}
 await rm(directory,{recursive:true,force:true})
}
