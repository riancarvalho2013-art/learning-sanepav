// Integration gate: real HTTP server, real handlers and persistent SQLite.
// --fixture exists for patch-only workspaces; CI must use the full repository without it.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtemp,rm,writeFile,copyFile,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import net from 'node:net'
const fixture=process.argv.includes('--fixture'),root=import.meta.dirname
const directory=await mkdtemp(join(tmpdir(),'learning-runtime-v8-'))
let child,log='',checks=0
const listener=net.createServer().listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r))
const endpoint='http://127.0.0.1:'+port,origin='https://127.0.0.1:'+port
const key=randomUUID()+randomUUID(),password=randomUUID(),token=randomUUID(),uid=randomUUID(),company=randomUUID()
async function stop(){if(child&&child.exitCode===null){child.kill();await once(child,'exit')}}
async function call(path,cookie='',body,expected=200){
 const r=await fetch(endpoint+path,{method:body===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const text=await r.text();assert.equal(r.status,expected,`${path}: ${text.slice(0,250)}`);checks++
 const data=JSON.parse(text);return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]}
}
try{
 let cwd=root
 if(fixture){
  cwd=directory
  for(const f of ['serve.mjs','learning.mjs','learning-evolution.mjs','lxp-v2.mjs','scorm-v3.mjs','reports-v3.mjs','learning-discovery-v4.mjs','pulse-secure-v5.mjs','learning-assessments-v6.mjs','people-intelligence-v6.mjs','kirkpatrick-v7.mjs','organization-chart-v9.mjs'])await copyFile(join(root,f),join(cwd,f))
  await writeFile(join(cwd,'platform.mjs'),'export default {fetch:async()=>new Response("Not found",{status:404})}')
  const seed={users:[{id:uid,name:'QA',role:'Administrador',active:true}],sessions:[{person:uid,digest:createHash('sha256').update(token).digest('hex'),identity:'learning-railway',until:Date.now()+600000}],courses:[],enroll:[],records:[],pulses:[],missions:[],missionEnrollments:[],organization:{companies:[{id:company,name:'QA',active:1}],units:[],departments:[],grants:[],assignments:[]}}
  await writeFile(join(cwd,'storage.mjs'),`const state=${JSON.stringify(seed)};state.organization.assignments=new Map([[${JSON.stringify(uid)},{company_id:${JSON.stringify(company)}}]]);export const BUCKET={async get(key){return key==='system/state-v1'?{async json(){return state}}:null}};export const DOMAIN={allowedCompanies(s,u){if(s!==state)throw Error('Invalid domain state');return s.organization.companies.map(c=>c.id)}};`)
 }
 child=spawn(process.execPath,['serve.mjs'],{cwd,env:{...process.env,PORT:String(port),NODE_ENV:'production',SETUP_KEY:key,LEARNING_DB:join(directory,'learning.sqlite')},stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>log+=String(x));child.stderr.on('data',x=>log+=String(x))
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(endpoint+'/readyz')).ok){ready=true;break}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,50))}assert.ok(ready,'Servidor não iniciou: '+log.slice(-1500))
 let auth='learning='+token
 if(!fixture){
  const activation=await fetch(endpoint+'/ativar',{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:key})});assert.equal(activation.status,303);checks++
  auth=(await call('/api/login',activation.headers.get('set-cookie').split(';')[0],{name:'QA runtime',email:'qa-runtime@example.test',password})).cookie;assert.ok(auth)
  await call('/api/v2/company',auth,{name:'QA runtime — empresa'});
  // Every served asset must exist, be nonempty and have the correct MIME type.
  const manifest=JSON.parse(await readFile(join(root,'asset-manifest.json'),'utf8'))
  for(const [route,entry] of Object.entries(manifest)){const r=await fetch(endpoint+route,{headers:{cookie:auth}});assert.equal(r.status,200,route);assert.ok(r.headers.get('content-type')?.startsWith(entry.mime.split(';')[0]),route+' MIME');assert.ok((await r.arrayBuffer()).byteLength>0,route+' vazio');checks++}
 }
 const routes=['/api/lxp/v2/me','/api/lxp/v2/pulse','/api/lxp/v2/performance','/api/lxp/v2/growth','/api/lxp/v2/meetings','/api/lxp/v2/feedback','/api/lxp/v2/overview','/api/pulse/v5/list','/api/pulse/v5/options','/api/kirkpatrick/v7/options','/api/kirkpatrick/v7/transfer/tasks','/api/discovery/v4/mine','/api/discovery/v4/metrics','/api/assessment/v6/list','/api/assessment/v6/options','/api/reports/v3/catalog','/api/reports/v3/summary','/api/reports/v3/views','/api/intelligence/v6/summary']
 for(const path of routes){await call(path,auth);await call(path,'',undefined,401)}
 await call('/api/scorm/v3/launch',auth,undefined,400)
 const pulse=(await call('/api/pulse/v5/list',auth)).data;assert.ok(Array.isArray(pulse.items));checks++
 const kp=(await call('/api/kirkpatrick/v7/options',auth)).data;assert.ok(Array.isArray(kp.companies)&&Array.isArray(kp.courses));checks++
 const analytics=(await call('/api/intelligence/v6/summary',auth)).data;assert.ok(analytics.sources.pulseSafe&&analytics.sources.kirkpatrick);checks++
 console.log(`PASSOU: runtime V8 — ${checks} verificações HTTP/contrato; ${fixture?'fixture de identidade e BUCKET, handlers reais e SQLite persistente':'servidor e domínio reais, sem mocks'}`)
}catch(error){console.error(log.slice(-1500));throw error}finally{await stop();await rm(directory,{recursive:true,force:true})}
