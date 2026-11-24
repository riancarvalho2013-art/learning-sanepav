// Runs only on the complete checkout, with a new isolated SQLite file and real server.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import net from 'node:net'
const dir=await mkdtemp(join(tmpdir(),'okr-http-v14-')),listener=net.createServer().listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r))
const endpoint='http://127.0.0.1:'+port,origin='https://127.0.0.1:'+port,key=randomUUID()+randomUUID(),password=randomUUID();let child,log='',checks=0
async function call(path,cookie='',body,expected=200){const res=await fetch(endpoint+path,{method:body===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const str=await res.text();assert.equal(res.status,expected,path+': '+str.slice(0,200));checks++;return {data:JSON.parse(str),cookie:res.headers.get('set-cookie')?.split(';')[0]}}
try{
 child=spawn(process.execPath,['serve.mjs'],{cwd:import.meta.dirname,env:{...process.env,PORT:String(port),NODE_ENV:'production',LEARNING_DB:join(dir,'test.sqlite'),SETUP_KEY:key},stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x)
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(endpoint+'/readyz')).ok){ready=true;break}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,50))}assert.ok(ready,'Servidor não iniciou: '+log.slice(-1000))
 const activation=await fetch(endpoint+'/ativar',{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:key})});assert.equal(activation.status,303)
 const admin=(await call('/api/login',activation.headers.get('set-cookie').split(';')[0],{name:'Admin QA',email:'admin@test.example',password})).cookie
 const A=(await call('/api/v2/company',admin,{name:'Empresa A'})).data.id,B=(await call('/api/v2/company',admin,{name:'Empresa B'})).data.id
 const D=(await call('/api/v2/department',admin,{name:'Financeiro',company_id:A})).data.id,E=(await call('/api/v2/department',admin,{name:'Compras',company_id:A})).data.id,F=(await call('/api/v2/department',admin,{name:'Outro',company_id:B})).data.id
 async function add(name,role,company_id,department_id,manager=''){await call('/api/user',admin,{name,email:name+'@test.example',role,password,active:true,manager,organization:{company_id,department_id,revision:0}});return (await call('/api/v2/organization',admin)).data.people.find(x=>x.name===name).id}
 const leaderId=await add('leader','Líder',A,D),staffId=await add('staff','Colaborador',A,D,leaderId),otherId=await add('other','Colaborador',A,E),foreignId=await add('foreign','Colaborador',B,F);await add('rh','RH/DHO',A,E)
 const login=async name=>(await call('/api/login','',{email:name+'@test.example',password})).cookie,leader=await login('leader'),staff=await login('staff'),other=await login('other'),foreign=await login('foreign'),rh=await login('rh')
 const path='/api/lxp/v2/okr',get=async c=>(await call(path,c)).data,p=(scope,companyId,departmentId,ownerId,title)=>({scope,companyId,departmentId,ownerId,title,requestId:randomUUID(),startsOn:'2020-01-01',endsOn:'2099-12-31',results:[{title:'Meta',unit:'unidades',baseline:0,target:100,weight:1}]})
 await call(path,'',undefined,401);const opts=await get(leader);assert.deepEqual(opts.departments.filter(x=>x.canManage).map(x=>x.id),[D]);assert.deepEqual(opts.people.map(x=>x.id),[staffId]);assert.equal((await get(rh)).canCreate,false)
 await call(path+'/create',leader,p('department',A,E,null,'Negado'),403);await call(path+'/create',leader,p('individual',A,D,otherId,'Negado'),403);await call(path+'/create',leader,p('individual',B,F,foreignId,'Negado'),403);await call(path+'/create',rh,p('individual',A,D,staffId,'Negado'),403)
 const corporate=(await call(path+'/create',admin,p('company',A,null,null,'Corporativo'))).data,department=(await call(path+'/create',leader,p('department',A,D,staffId,'Departamento'))).data,individual=(await call(path+'/create',leader,p('individual',A,D,staffId,'Individual'))).data
 assert.equal((await get(staff)).items.length,0)
 for(const [c,o] of [[admin,corporate],[leader,department],[leader,individual]])await call(path+'/publish',c,{id:o.id,revision:o.revision})
 assert.equal((await get(staff)).items.length,3);assert.deepEqual((await get(other)).items.map(x=>x.id),[corporate.id]);assert.equal((await get(foreign)).items.length,0);assert.equal((await get(admin)).items.length,3)
 const o=(await get(staff)).items.find(x=>x.id===department.id);await call(path+'/checkin',other,{id:o.id,resultId:o.results[0].id,revision:o.revision,requestId:randomUUID(),value:50,note:'Negado'},403);await call(path+'/checkin',staff,{id:o.id,resultId:o.results[0].id,revision:o.revision,requestId:randomUUID(),value:50,note:'QA'});assert.equal((await get(leader)).items.find(x=>x.id===department.id).progress,50)
 await call('/api/record',staff,{kind:'OKR',person:staffId,title:'Bypass legado'},403)
 const report=(await call('/api/reports/v3/summary',rh)).data;assert.equal(report.metrics.find(x=>x.code==='okr.objectives').value,1)
 const importPath='/api/users/v14/import',batch=[{nome:'Batch Worker',email:'batchworker@test.example',perfil:'Colaborador',empresa:A,departamento:D,unidade:'',cargo:'Analista',gestor_email:'batchleader@test.example',admissao:'2026-11-01',senha_inicial:password},{nome:'Batch Leader',email:'batchleader@test.example',perfil:'Líder',empresa:A,departamento:D,unidade:'',cargo:'Gestor',gestor_email:'leader@test.example',admissao:'',senha_inicial:password}]
 await call(importPath+'/preview',leader,{rows:batch},403);const preview=(await call(importPath+'/preview',admin,{rows:batch})).data;assert.equal(preview.valid,true);const result=(await call(importPath+'/commit',admin,{rows:batch,revision:preview.revision,organizationRevision:preview.organizationRevision})).data;assert.equal(result.created,2);const people=(await call('/api/v2/organization',admin)).data.people,bw=people.find(x=>x.email===batch[0].email),bl=people.find(x=>x.email===batch[1].email);assert.equal(bw.manager,bl.id);assert.equal(bw.department_id,D);assert.equal(bl.company_id,A);const batchCookie=await login('batchworker');assert.equal((await get(batchCookie)).items.some(x=>x.id===department.id),true);await call(importPath+'/commit',admin,{rows:batch,revision:preview.revision,organizationRevision:preview.organizationRevision},400)
 await call('/api/logout',leader,{});await call(path,leader,undefined,401)
 console.log(`PASS OKR V14 HTTP: ${checks} chamadas, servidor real, departamentos, permissões, SQLite e métricas.`)
}catch(e){console.error(log.slice(-2000));throw e}finally{if(child&&child.exitCode===null){child.kill();await once(child,'exit')}await rm(dir,{recursive:true,force:true})}
