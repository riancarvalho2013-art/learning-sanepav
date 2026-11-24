import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {handleAssessmentsV6} from './learning-assessments-v6.mjs'

const temp=await mkdtemp(join(tmpdir(),'dna-assess-'))
const db=new DatabaseSync(join(temp,'assess.sqlite'))
const companyA=randomUUID(),companyB=randomUUID(),course=randomUUID(),otherCourse=randomUUID(),draftCourse=randomUUID()
const users=['Administrador','RH/DHO','Colaborador','Colaborador','Líder','Colaborador'].map((role,i)=>({id:randomUUID(),name:'Pessoa '+i,role,active:true}))
const admin=users[0],hr=users[1],learner=users[2],learnerB=users[3],leader=users[4],other=users[5]
const tok=new Map(users.map(u=>[u.id,randomUUID()]))
const assignment=new Map(users.map((u,i)=>[u.id,{company_id:i===3||i===5?companyB:companyA}]))
const state={users,sessions:users.map(u=>({digest:createHash('sha256').update(tok.get(u.id)).digest('hex'),identity:'test-identity',person:u.id,until:Date.now()+600000})),organization:{companies:[{id:companyA,name:'Sanepav',active:true},{id:companyB,name:'Beta Clean',active:true}],assignments:assignment},courses:[{id:course,title:'Conduta',status:'published'},{id:otherCourse,title:'Proteção de dados',status:'published'},{id:draftCourse,title:'Rascunho',status:'draft'}],enroll:[{id:randomUUID(),person:learner.id,course,progress:0},{id:randomUUID(),person:learnerB.id,course,progress:50},{id:randomUUID(),person:other.id,course,progress:100}]}
const BUCKET={async get(key){return key==='system/state-v1'?{async json(){return state}}:null}}
const DOMAIN={allowedCompanies(_,u){return u.role==='Administrador'?[companyA,companyB]:u.role==='RH/DHO'?[companyA]:[assignment.get(u.id).company_id]}}
const origin='https://learning.test'
let calls=0
async function call(route,user,body,method){
 calls++
 const headers={'oai-authenticated-user-id':'test-identity',origin,'content-type':'application/json'}
 if(user)headers.cookie='learning='+tok.get(user.id)
 const req=new Request(origin+'/api/assessment/v6/'+route,{method:method||(body===undefined?'GET':'POST'),headers,...(body===undefined?{}:{body:JSON.stringify(body)})})
 const res=await handleAssessmentsV6(req,{BUCKET,DOMAIN,assessmentDb:db})
 const data=res.headers.get('content-type')?.includes('json')?await res.json():await res.text()
 return {status:res.status,data}
}
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'})
const future='2099-12-31'
const question=(prompt='Qual a alternativa correta?')=>({prompt,options:['Opção A','Opção B','Opção C'],correctIndex:1,weight:2})
const payload={companyId:companyA,courseId:course,title:'Avaliação da Trilha',kind:'final',minScore:70,maxAttempts:2,durationMinutes:20,startsOn:today,endsOn:future,questions:[question('Qual é a resposta correta?'),question('Que alternativa vale mais?')]}
try{
 assert.equal((await call('options',null)).status,401)
 assert.equal((await call('options',learner)).status,403)
 assert.equal((await call('options',admin)).status,200)
 assert.equal((await call('create',learner,payload)).status,403)
 assert.equal((await call('create',hr,{...payload,companyId:companyB})).status,403)
 assert.equal((await call('create',hr,{...payload,courseId:draftCourse})).status,409)
 assert.equal((await call('create',hr,{...payload,questions:[{...question(),correctIndex:7}]})).status,400)
 assert.equal((await call('create',hr,{...payload,questions:[{...question(),options:['A','A']}]})).status,400)
 assert.equal((await call('create',hr,{...payload,minScore:120})).status,400)
 let created=await call('create',hr,payload)
 assert.equal(created.status,200,JSON.stringify(created.data));const id=created.data.id
 assert.equal((await call('list',learner)).data.items.length,0,'Rascunho invisível para aluno')
 assert.equal((await call('detail?id='+id,other)).status,403)
 assert.equal((await call('detail?id='+id,hr)).data.questions[0].correctIndex,1)
 assert.equal((await call('update',hr,{id,revision:2,...payload})).status,409)
 const changed=await call('update',hr,{id,revision:1,...payload,title:'Avaliação revisada'})
 assert.equal(changed.status,200);assert.equal(changed.data.revision,2)
 assert.equal((await call('publish',hr,{id,revision:1})).status,409)
 const pub=await call('publish',hr,{id,revision:2});assert.equal(pub.status,200)
 assert.equal((await call('update',hr,{id,revision:3,...payload})).status,409,'Não editar perguntas publicadas')
 const learnerList=await call('list',learner);assert.equal(learnerList.data.items.length,1)
 const learnerDetail=await call('detail?id='+id,learner)
 assert.equal(learnerDetail.status,200);assert.equal(learnerDetail.data.questions[0].correctIndex,undefined,'Resposta correta não deve vazar')
 assert.equal((await call('detail?id='+id,learnerB)).status,403,'Isolamento multiempresa')
 assert.equal((await call('results?id='+id,learner)).status,403)
 assert.equal((await call('submit',other,{id,attemptId:randomUUID(),answers:[1,1]})).status,403,'Outra empresa não pode responder')
 assert.equal((await call('submit',leader,{id,attemptId:randomUUID(),answers:[1,1]})).status,403,'Sem matrícula não pode responder')
 state.enroll[0].prerequisites=[otherCourse]
 assert.equal((await call('detail?id='+id,learner)).data.canAnswer,false,'Pré-requisito deve impedir iniciar avaliação')
 assert.equal((await call('submit',learner,{id,attemptId:randomUUID(),answers:[1,1]})).status,403,'Pré-requisitos da trilha são obrigatórios')
 state.enroll[0].prerequisites=[]
 assert.equal((await call('submit',learner,{id,attemptId:randomUUID(),answers:[1]})).status,400)
 assert.equal((await call('submit',learner,{id,attemptId:randomUUID(),answers:[1,1]})).status,403,'Deve iniciar sessão antes do envio')
 const startedA=await call('start',learner,{id});assert.equal(startedA.status,200);assert.equal(startedA.data.resumed,false)
 const attemptA=startedA.data.attemptId
 const resumedA=await call('start',learner,{id});assert.equal(resumedA.data.attemptId,attemptA);assert.equal(resumedA.data.resumed,true)
 const draft=await call('save',learner,{id,attemptId:attemptA,answers:[0,null],revision:1});assert.equal(draft.status,200);assert.equal(draft.data.revision,2)
 assert.equal((await call('save',learner,{id,attemptId:attemptA,answers:[0,1],revision:1})).status,409,'Conflito de revisão')
 assert.deepEqual((await call('start',learner,{id})).data.answers,[0,null])
 const failed=await call('submit',learner,{id,attemptId:attemptA,answers:[0,1]})
 assert.equal(failed.status,200);assert.equal(failed.data.score,50);assert.equal(failed.data.passed,false)
 const replay=await call('submit',learner,{id,attemptId:attemptA,answers:[0,1]})
 assert.equal(replay.status,200);assert.equal(replay.data.idempotent,true)
 const startedB=await call('start',learner,{id});assert.equal(startedB.status,200)
 const attemptB=startedB.data.attemptId
 const success=await call('submit',learner,{id,attemptId:attemptB,answers:[1,1]})
 assert.equal(success.status,200);assert.equal(success.data.score,100);assert.equal(success.data.passed,true)
 assert.equal((await call('start',learner,{id})).status,409,'Limite incluindo sessões')
 assert.equal((await call('submit',learner,{id,attemptId:randomUUID(),answers:[1,1]})).status,403)
 const results=await call('results?id='+id,hr)
 assert.equal(results.status,200);assert.equal(results.data.participants,1);assert.equal(results.data.attempts,2);assert.equal(results.data.passed,1)
 assert.equal(results.data.rows[0].bestScore,100)
 const analysis=await call('question-analysis?id='+id,hr);assert.equal(analysis.status,200);assert.equal(analysis.data.questions[0].accuracy,50)
 assert.equal((await call('question-analysis?id='+id,learner)).status,403)
 const csv=await call('export.csv?id='+id,hr);assert.equal(csv.status,200);assert.ok(csv.data.includes('Pessoa 2'))
 assert.equal((await call('export.csv?id='+id,other)).status,403)
 const dup=await call('duplicate',hr,{id});assert.equal(dup.status,200);assert.equal(dup.data.status,'draft')
 assert.equal((await call('detail?id='+dup.data.id,hr)).data.questions.length,2)
 const duplicatePublished=await call('publish',hr,{id:dup.data.id,revision:1});assert.equal(duplicatePublished.status,200)
 assert.equal((await call('start',other,{id:dup.data.id})).status,403,'Outro grupo não inicia prova')
 const concurrent=await Promise.all([call('start',learner,{id:dup.data.id}),call('start',learner,{id:dup.data.id})])
 assert.equal(concurrent[0].status,200);assert.equal(concurrent[1].status,200)
 assert.equal(concurrent[0].data.attemptId,concurrent[1].data.attemptId,'Inícios simultâneos devem retomar uma única sessão')
 const expiredId=concurrent[0].data.attemptId
 assert.equal((await call('save',other,{id:dup.data.id,attemptId:expiredId,answers:[null,null],revision:1})).status,403,'Usuário de outra empresa não altera respostas')
 db.prepare('UPDATE assessment_v7_sessions SET started_at_ms=?,expires_at_ms=? WHERE id=?').run(Date.now()-120000,Date.now()-500,expiredId)
 assert.equal((await call('submit',learner,{id:dup.data.id,attemptId:expiredId,answers:[1,1]})).status,409,'Cronômetro vencido não pode ser burlado')
 assert.equal((await call('save',learner,{id:dup.data.id,attemptId:expiredId,answers:[1,1],revision:1})).status,409,'Rascunho vencido deve falhar')
 const lastSlot=await call('start',learner,{id:dup.data.id});assert.equal(lastSlot.status,200,'Sessão expirada consome uma tentativa')
 db.prepare('UPDATE assessment_v7_sessions SET started_at_ms=?,expires_at_ms=? WHERE id=?').run(Date.now()-120000,Date.now()-500,lastSlot.data.attemptId)
 assert.equal((await call('start',learner,{id:dup.data.id})).status,409,'Não reabrir tentativas expiradas ilimitadamente')
 const archive=await call('archive',hr,{id,revision:3});assert.equal(archive.status,200)
 assert.equal((await call('start',learner,{id})).status,409,'Limite incluindo sessões')
 assert.equal((await call('submit',learner,{id,attemptId:randomUUID(),answers:[1,1]})).status,409)
 assert.equal((await call('results?id='+id,hr)).data.attempts,2,'Arquivo histórico preservado')
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assessment_v6_schema').get().n,2)
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assessment_v7_sessions').get().n,4)
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assessment_v6_attempts').get().n,2)
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assessment_v6_audit').get().n>=6,true)
 db.close();const reopened=new DatabaseSync(join(temp,'assess.sqlite'))
 assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM assessment_v6_attempts').get().n,2,'Persistência real entre sessões')
 reopened.close()
 console.log('PASSOU: Avaliações V6+V7 — '+calls+' chamadas; isolamento, validação, rascunho, revisão, publicação, tentativas idempotentes, nota, exportação, persistência, histórico.')
}catch(e){try{db.close()}catch{};throw e}
finally{await rm(temp,{force:true,recursive:true})}
