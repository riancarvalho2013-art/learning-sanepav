import assert from 'node:assert/strict'
import {mkdtemp,writeFile,copyFile,rm,readdir} from 'node:fs/promises'
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
 // Copy the real extension modules, not a fixed list of fake handlers. A new
 // server import must be present in the fixture and load successfully.
 for(const name of await readdir(import.meta.dirname)){
  if(name.endsWith('.mjs')&&!name.startsWith('verify-')&&!['serve.mjs','platform.mjs','storage.mjs','assets.mjs'].includes(name))await copyFile(join(import.meta.dirname,name),join(tmp,name))
 }
 const port=await freePort()
 let childErr=''
 child=spawn(process.execPath,['serve.mjs','--port',String(port)],{cwd:tmp,env:{...process.env,NODE_ENV:'test',LEARNING_DB:join(tmp,'fixture.sqlite')},stdio:['ignore','pipe','pipe']})
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
 const denied=await fetch(origin+'/api/orgchart/v9');assert.equal(denied.status,401);assert.equal((await denied.json()).error,'Entre no Learning para continuar.')
 console.log('PASSOU: servidor V7/V9 — healthz, readiness com adapter, ID de correlação, roteamento e importação dos handlers reais')
}finally{if(child){child.kill('SIGTERM')}await rm(tmp,{recursive:true,force:true})}
