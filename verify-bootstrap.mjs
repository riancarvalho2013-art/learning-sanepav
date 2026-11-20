import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import net from 'node:net'
const directory=await mkdtemp(join(tmpdir(),'sanepav-bootstrap-'))
const listener=net.createServer().listen(0,'127.0.0.1')
await once(listener,'listening')
const port=listener.address().port
await new Promise(resolve=>listener.close(resolve))
const endpoint='http://127.0.0.1:'+port,origin='https://127.0.0.1:'+port
let child
async function start(key){
 const env={...process.env,PORT:String(port),NODE_ENV:'production',LEARNING_DB:join(directory,'learning.sqlite')}
 delete env.SETUP_KEY
 if(key!==undefined)env.SETUP_KEY=key
 child=spawn(process.execPath,['serve.mjs'],{cwd:import.meta.dirname,env,stdio:'ignore'})
 for(let attempt=0;attempt<100;attempt++){
  try{if((await fetch(endpoint+'/healthz')).ok)return}catch{}
  if(child.exitCode!==null)throw Error('The test server failed to start')
  await new Promise(resolve=>setTimeout(resolve,25))
 }
 throw Error('The test server did not become healthy')
}
async function stop(){if(child&&child.exitCode===null){child.kill();await once(child,'exit')}}
const access=async()=>(await fetch(endpoint+'/api/access')).json()
const key=crypto.randomUUID()+crypto.randomUUID(),password=crypto.randomUUID()
const login=cookie=>fetch(endpoint+'/api/login',{method:'POST',headers:{origin,'content-type':'application/json',cookie},
 body:JSON.stringify({name:'Bootstrap test',email:'test@example.test',password})})
try{
 await start()
 assert.equal((await access()).activationConfigured,false)
 assert.equal((await access()).activationRequired,true)
 assert.equal((await fetch(endpoint+'/ativar')).status,503)
 assert.equal((await login('__Host-learning-activation=anything')).status,403)
 await stop();await start(key)
 assert.equal((await access()).activationConfigured,true)
 assert.equal((await login('')).status,403)
 const activate=async(code,requestOrigin=origin)=>fetch(endpoint+'/ativar',{method:'POST',redirect:'manual',
  headers:{origin:requestOrigin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code})})
 assert.equal((await activate(key,'https://outside.example.test')).status,403)
 assert.equal((await activate('invalid')).status,403)
 const response=await activate(key)
 assert.equal(response.status,303)
 const cookie=response.headers.get('set-cookie')
 assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/)
 assert.equal((await login(cookie.split(';')[0])).status,200)
 assert.equal((await access()).setup,false)
 await stop();await start()
 assert.equal((await access()).setup,false)
 assert.equal((await login('')).status,200,'Removing a setup key must not block existing accounts')
 console.log('OK: ativação sem chave padrão, proteção CSRF, bloqueio de bootstrap e preservação do login após reinício.')
}finally{await stop();await rm(directory,{recursive:true,force:true})}
