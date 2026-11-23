import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {handleEvolution} from './learning-evolution.mjs'

const A=randomUUID(),B=randomUUID(),personId=randomUUID(),adminId=randomUUID(),learnerId=randomUUID(),courseId=randomUUID(),enrollId=randomUUID(),otherCourseId=randomUUID(),missionId=randomUUID()
const token='test-session-cookie',digest=createHash('sha256').update(token).digest('hex')
const raw={
 users:[{id:adminId,name:'Gestora de aprendizagem',role:'Administrador',active:true},{id:personId,name:'Aluna Exemplo',role:'Colaborador',active:true},{id:learnerId,name:'Usuário externo',role:'Colaborador',active:true}],
 sessions:[{digest,person:adminId,identity:'learning-railway',until:Date.now()+60_000}],
 courses:[{id:courseId,title:'Boas-vindas',track:'Integração',minutes:35,revision:1},{id:otherCourseId,title:'Curso sem participantes',track:'Integração',minutes:10,revision:0}],
 enroll:[{id:enrollId,person:personId,course:courseId,progress:0}],missions:[{id:missionId,courses:[courseId],revision:2}],missionEnrollments:[],logs:[],
 organization:null
}
const companies=[{id:A,name:'Sanepav',active:1},{id:B,name:'Beta Clean',active:1}]
const assignments=new Map([[personId,{company_id:A}],[learnerId,{company_id:B}],[adminId,{company_id:A}]])
const grants=[]
const DOMAIN={allowedCompanies(state,user){return user.role==='Administrador'?[A,B]:[assignments.get(user.id)?.company_id].filter(Boolean)},decorateState(s){Object.defineProperty(s,'organization',{value:{companies,assignments,grants},configurable:true});return s}}
const store=new Map([['system/state-v1',{value:JSON.stringify(raw),etag:'initial'}]])
const BUCKET={
 async get(key){const e=store.get(key);if(!e)return null;const body=Buffer.isBuffer(e.value)?e.value:Buffer.from(e.value);return {etag:e.etag,body,json:async()=>key==='system/state-v1'?DOMAIN.decorateState(JSON.parse(body.toString())):JSON.parse(body.toString()),text:async()=>body.toString()}}
 ,async put(key,value,options){const old=store.get(key);if(options?.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;if(options?.onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=randomUUID();store.set(key,{value,etag});return {etag}}
}
const call=async(path,{user=adminId,method='GET',body,origin='https://learning.test',bytes,headers={}}={})=>{
 const state=JSON.parse((await BUCKET.get('system/state-v1')).body.toString())
 state.sessions[0].person=user
 await BUCKET.put('system/state-v1',JSON.stringify(state),{onlyIf:{etagMatches:(await BUCKET.get('system/state-v1')).etag}})
 const url='https://learning.test'+path,init={method,headers:{cookie:'learning='+token,'oai-authenticated-user-id':'learning-railway',...headers}}
 if(method==='POST'){init.headers.origin=origin;init.body=bytes||JSON.stringify(body||{});if(!bytes)init.headers['content-type']='application/json'}
 const result=await handleEvolution(new Request(url,init),{BUCKET,DOMAIN})
 const rawOutput=await result.text()
 let parsed
 try{parsed=JSON.parse(rawOutput)}catch{parsed=rawOutput}
 return {status:result.status,body:parsed,headers:result.headers}
}
const companyParam='?company='+A
let result=await call('/api/evo/version');assert.equal(result.body.version,'2026.11.23-dna1')
result=await call('/api/evo/brand'+companyParam);assert.equal(result.status,200);assert.match(result.body.title,/Sanepav/)
result=await call('/api/evo/brand'+companyParam,{method:'POST',body:{title:'Sanepav Academy',subtitle:'DNA do Desenvolvimento',color:'#176bc1',accent:'#55c5fe'}})
assert.equal(result.status,200);assert.equal(result.body.title,'Sanepav Academy')
result=await call('/api/evo/brand'+companyParam);assert.equal(result.body.title,'Sanepav Academy')
result=await call('/api/evo/brand?company='+B,{user:personId});assert.equal(result.status,403)
result=await call('/api/evo/brand'+companyParam,{user:personId,method:'POST',body:{title:'Não pode',color:'#112233',accent:'#aabbcc'}});assert.equal(result.status,403)
result=await call('/api/evo/brand'+companyParam,{method:'POST',origin:'https://hostile.example',body:{title:'Invalido',color:'#112233',accent:'#aabbcc'}});assert.equal(result.status,403)
result=await call('/api/evo/brand'+companyParam,{method:'POST',body:{title:'Invalido',color:'red',accent:'#aabbcc'}});assert.equal(result.status,400)
const png=Buffer.from('89504e470d0a1a0a0000000049484452','hex')
result=await call('/api/evo/brand/logo'+companyParam+'&ext=png',{method:'POST',bytes:png});assert.equal(result.status,200);assert.equal(result.body.logoMime,'image/png')
result=await call('/api/evo/brand/logo'+companyParam);assert.equal(result.status,200);assert.equal(result.headers.get('content-type'),'image/png')
result=await call('/api/evo/brand/logo?company='+B+'&ext=png',{user:personId,method:'POST',bytes:png});assert.equal(result.status,403)
result=await call('/api/evo/certificate/template'+companyParam,{method:'POST',body:{track:'Integração',subtitle:'Conclusão DNA',signatory:'DHO',color:'#176bc1'}});assert.equal(result.status,200)
result=await call('/api/evo/certificate/background'+companyParam+'&track=Integra%C3%A7%C3%A3o&ext=png',{method:'POST',bytes:png});assert.equal(result.status,200)
result=await call('/api/evo/certificates/issue',{user:personId,method:'POST',body:{enrollmentId:enrollId}});assert.equal(result.status,409)
{
 const row=JSON.parse((await BUCKET.get('system/state-v1')).body.toString())
 row.enroll[0].progress=100
 await BUCKET.put('system/state-v1',JSON.stringify(row),{onlyIf:{etagMatches:(await BUCKET.get('system/state-v1')).etag}})
}
result=await call('/api/evo/certificates',{user:personId});assert.equal(result.body.items.length,1)
result=await call('/api/evo/certificates/issue',{user:personId,method:'POST',body:{enrollmentId:enrollId}});assert.equal(result.status,200);const issuedCode=result.body.code
result=await call('/api/evo/certificates/issue',{user:personId,method:'POST',body:{enrollmentId:enrollId}});assert.equal(result.body.code,issuedCode)
result=await call('/api/evo/verify?code='+issuedCode,{user:learnerId});assert.equal(result.body.valid,true);assert.equal(result.body.personName,undefined)
result=await call('/api/evo/certificates/print?id='+enrollId,{user:personId});assert.equal(result.status,200);assert.match(result.body,/Aluna Exemplo/);assert.match(result.body,/Imprimir ou salvar como PDF/)
result=await call('/api/evo/certificates/print?id='+enrollId,{user:learnerId});assert.equal(result.status,403)
result=await call('/api/evo/delete',{method:'POST',body:{type:'course',id:courseId,revision:1,confirm:true}});assert.equal(result.status,409)
result=await call('/api/evo/delete',{method:'POST',body:{type:'course',id:otherCourseId,revision:0,confirm:true}});assert.equal(result.status,200)
const final=JSON.parse((await BUCKET.get('system/state-v1')).body.toString());assert.equal(final.courses.length,1);assert.equal(final.enroll.length,1)
console.log('DNA Evolution: verificações de fluxos críticos e segurança passaram.')
