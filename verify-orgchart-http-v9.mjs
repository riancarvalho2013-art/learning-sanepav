// Full-repository HTTP gate: uses real server, real SQLite and real organization API.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import net from 'node:net'
const dir=await mkdtemp(join(tmpdir(),'orgchart-v9-')),listener=net.createServer().listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r))
const endpoint='http://127.0.0.1:'+port,origin='https://127.0.0.1:'+port,key=randomUUID()+randomUUID(),password=randomUUID();let child,log='',checks=0
async function call(path,cookie='',body,expected=200){const res=await fetch(endpoint+path,{method:body===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const str=await res.text();assert.equal(res.status,expected,path+': '+str.slice(0,200));checks++;return {data:JSON.parse(str),cookie:res.headers.get('set-cookie')?.split(';')[0]}}
try{
 child=spawn(process.execPath,['serve.mjs'],{cwd:import.meta.dirname,env:{...process.env,PORT:String(port),NODE_ENV:'production',LEARNING_DB:join(dir,'test.sqlite'),SETUP_KEY:key},stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x)
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(endpoint+'/readyz')).ok){ready=true;break}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,50))}assert.ok(ready,'Servidor não iniciou: '+log.slice(-1000))
 const activation=await fetch(endpoint+'/ativar',{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:key})});assert.equal(activation.status,303)
 const admin=(await call('/api/login',activation.headers.get('set-cookie').split(';')[0],{name:'Admin QA',email:'admin@test.example',password})).cookie
 const a=(await call('/api/v2/company',admin,{name:'Empresa A'})).data.id,b=(await call('/api/v2/company',admin,{name:'Empresa B'})).data.id
 const dept=(await call('/api/v2/department',admin,{name:'Financeiro',company_id:a})).data.id;await call('/api/v2/department',admin,{name:'Vazio',company_id:a});const unit=(await call('/api/v2/unit',admin,{name:'Matriz',company_id:a})).data.id
 async function add(name,role,company,manager=''){await call('/api/user',admin,{name,email:name+'@test.example',role,password,active:true,manager,organization:{company_id:company,revision:0,position:'Cargo '+name,...(company===a?{department_id:dept,unit_id:unit}:{})}});const registry=(await call('/api/v2/organization',admin)).data;return registry.people.find(x=>x.name===name).id}
 const leaderId=await add('leader','Líder',a),staffId=await add('staff','Colaborador',a,leaderId),otherId=await add('other','Colaborador',a),foreignId=await add('foreign','Colaborador',b);await add('rh','RH/DHO',a)
 const login=async name=>(await call('/api/login','',{email:name+'@test.example',password})).cookie
 const leader=await login('leader'),staff=await login('staff'),rh=await login('rh')
 const path='/api/orgchart/v9';await call(path,'',undefined,401);await call(path,staff,undefined,403);await call(path,rh,undefined,403);await call(path+'?company='+b,leader,undefined,403);await call(path,leader,{},405)
 const chart=(await call(path,leader)).data;assert.deepEqual(chart.companies.map(x=>x.id),[a]);assert.equal(chart.departments.length,2);assert.equal(chart.people.find(x=>x.id===staffId).managerId,leaderId);assert.ok(chart.people.some(x=>x.id===otherId));assert.ok(!chart.people.some(x=>x.id===foreignId));assert.ok(!JSON.stringify(chart).includes('@test.example'));assert.equal((await call(path+'?company='+b,admin)).data.people.length,1)
 for(const asset of ['/orgchart-v9.js','/orgchart-v9.css']){const res=await fetch(endpoint+asset);assert.equal(res.status,200);assert.ok((await res.arrayBuffer()).byteLength>0);checks++}
 await call('/api/logout',leader,{});await call(path,leader,undefined,401)
 console.log(`PASSOU: ${checks} chamadas HTTP, cadastro real, sessão real, SQLite, assets, empresa, perfil e revogação.`)
}catch(e){console.error(log.slice(-2000));throw e}finally{if(child&&child.exitCode===null){child.kill();await once(child,'exit')}await rm(dir,{recursive:true,force:true})}
