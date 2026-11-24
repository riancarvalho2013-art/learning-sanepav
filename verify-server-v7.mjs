import assert from 'node:assert/strict'
import {mkdtemp,writeFile,copyFile,rm} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const tmp=await mkdtemp(join(tmpdir(),'dna-server-v7-'))
let child
const freePort=()=>new Promise((resolve,reject)=>{const srv=createServer();srv.listen(0,'127.0.0.1',()=>{const port=srv.address().port;srv.close(()=>resolve(port))});srv.on('error',reject)})
try{
 await copyFile('serve.mjs',join(tmp,'serve.mjs'))
 await writeFile(join(tmp,'package.json'),'{"type":"module"}')
 await writeFile(join(tmp,'platform.mjs'),'export default {fetch: async()=>new Response("stub-response",{status:200})}')
 await writeFile(join(tmp,'storage.mjs'),'export const BUCKET={async get(){return null}};export const DOMAIN={}')
 for(const [name,fn] of [['learning-evolution.mjs','handleEvolution'],['lxp-v2.mjs','handleLxpV2'],['scorm-v3.mjs','handleScormV3'],['reports-v3.mjs','handleReportsV3'],['learning-discovery-v4.mjs','handleDiscoveryV4'],['pulse-secure-v5.mjs','handlePulseV5'],['learning-assessments-v6.mjs','handleAssessmentsV6'],['people-intelligence-v6.mjs','handleIntelligenceV6'],['kirkpatrick-v7.mjs','handleKirkpatrickV7']]){
  await writeFile(join(tmp,name),`export async function ${fn}(){return null}`)
 }
 const port=await freePort()
 let childErr=''
 child=spawn(process.execPath,['serve.mjs','--port',String(port)],{cwd:tmp,env:{...process.env,NODE_ENV:'test'},stdio:['ignore','pipe','pipe']})
 child.stderr.on('data',x=>{childErr+=String(x)})
 const origin=`http://127.0.0.1:${port}`
 let ready=false
 for(let attempt=0;attempt<55;attempt++){
  await new Promise(resolve=>setTimeout(resolve,100))
  try{if((await fetch(origin+'/healthz')).ok){ready=true;break}}catch{}
 }
 assert.equal(ready,true,'Servidor de testes não iniciou: '+childErr)
 const health=await fetch(origin+'/healthz');assert.equal(health.status,200);assert.ok(health.headers.get('X-Request-ID'))
 const readiness=await fetch(origin+'/readyz');assert.equal(readiness.status,200);assert.equal((await readiness.json()).checks.sqlite,'ready')
 const root=await fetch(origin+'/some-page');assert.equal(root.status,200);assert.equal(await root.text(),'stub-response')
 console.log('PASSOU: servidor V7 — healthz, readiness SQLite, ID de correlação e roteamento isolado')
}finally{if(child){child.kill('SIGTERM')}await rm(tmp,{recursive:true,force:true})}
