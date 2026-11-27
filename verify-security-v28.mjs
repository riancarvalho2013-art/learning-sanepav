import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
const source=readFileSync(new URL('./serve.mjs',import.meta.url),'utf8')
const section=source.split('// BEGIN V28 INGRESS\n')[1]?.split('// END V28 INGRESS')[0]
assert.ok(section,'Ingress code missing')
const {inspectRequest,parseAllowedHosts,securityHeaders,logRoute,createAuthGate}=await import('data:text/javascript;base64,'+Buffer.from(section+'\nexport {inspectRequest,parseAllowedHosts,securityHeaders,logRoute,createAuthGate}').toString('base64'))
let n=0
const eq=(a,b)=>{assert.deepEqual(a,b);n++}
const base={host:'academy.example',target:'/api/lxp/v2/okr',method:'POST',origin:'https://academy.example',protocol:'https:',allowedHosts:parseAllowedHosts('academy.example')}
const status=x=>inspectRequest({...base,...x}).status||200
for(const x of [{},{method:'GET',origin:undefined},{method:'HEAD',origin:undefined},{method:'OPTIONS',target:'/scorm/v3/ticket/course.js',origin:'null'},{method:'GET',target:'/readyz',host:'health.internal'},{method:'POST',fetchSite:'same-origin'}])eq(status(x),200)
for(const x of [{origin:undefined},{origin:'null'},{origin:'https://evil.example'},{fetchSite:'cross-site'},{method:'DELETE',origin:undefined},{method:'PATCH',origin:'https://evil.example'},{method:'PUT',origin:'null'}])eq(status(x),403)
for(const x of [{target:'//evil.example/api'},{target:'/\\evil.example/api'},{target:'https://evil.example/'},{target:'/bad path'},{host:'bad..example'},{host:'academy.example:99999'},{host:'academy.example@evil.example'},{target:'/'+ 'a'.repeat(17000)}])eq(status(x),400)
eq(status({host:'evil.example'}),421);eq(status({method:'TRACE'}),405);eq(status({method:'OPTIONS'}),405)
eq(parseAllowedHosts(''),null);eq([...parseAllowedHosts('ACADEMY.example, other.example')],['academy.example','other.example']);assert.throws(()=>parseAllowedHosts('https://academy.example'));n++
eq(logRoute('/api/unknown-secret?token=hidden'),'/api/other');eq(logRoute('/scorm/v3/private-ticket/file.html'),'/scorm/*');eq(logRoute('/secret-token'),'/other');eq(logRoute('/api/users/v14/import/a-person'),'/api/users');eq(logRoute('/social/post/id'),'/social/*')
eq(securityHeaders('https:')['Strict-Transport-Security'],'max-age=31536000');eq(securityHeaders('http:')['Strict-Transport-Security'],undefined);eq(securityHeaders('https:')['X-Frame-Options'],undefined)
let now=0;const gate=createAuthGate({max:2,activationMax:2,windowMs:100,clock:()=>now})
const a=gate.enter('/api/login','POST'),b=gate.enter('/api/reset-password','POST');eq(!!a&&!!b,true);eq(gate.enter('/api/login','POST'),null);a.release();a.release();const c=gate.enter('/api/login','POST');eq(!!c,true);eq(gate.enter('/api/login','POST'),null);b.release();c.release();gate.enter('/ativar','POST').release();gate.enter('/ativar','POST').release();eq(gate.enter('/ativar','POST'),null);now=101;gate.enter('/ativar','POST').release();n++;eq(!!gate.enter('/api/data','GET'),true)
// Run the actual HTTP server with stub business handlers; not an authenticated module test.
const tmp=mkdtempSync(join(tmpdir(),'learning-v28-'));let child
const port=await new Promise((resolve,reject)=>{let s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})
try{
 writeFileSync(join(tmp,'serve.mjs'),source)
 writeFileSync(join(tmp,'platform.mjs'),'export default {fetch:async()=>new Response("fixture",{status:200})}')
 writeFileSync(join(tmp,'storage.mjs'),'export const BUCKET={get:async()=>null};export const DOMAIN={}')
 // V39.1.1: use the real synchronous authentication limiter, not an async handler stub.
 assert.ok(source.includes("import {createAuthRateV391} from './estabilidade-v39-1.mjs'"),'Limitador V39.1 ausente do servidor');n++
 writeFileSync(join(tmp,'estabilidade-v39-1.mjs'),readFileSync(new URL('./estabilidade-v39-1.mjs',import.meta.url)))
 for(const m of source.matchAll(/^import \{([^}]+)\} from '\.\/(.+\.mjs)'$/gm)){
  if(m[2]==='storage.mjs'||m[2]==='estabilidade-v39-1.mjs')continue
  const lines=m[1].split(',').map(x=>x.trim()).map(x=>x==='createRouteRegistry'?`export const ${x}=(rules,fallback)=>async req=>fallback(req)` :x==='guardLegacyOKR'?`export const ${x}=(req,ctx,fallback)=>fallback(req)`:`export const ${x}=async()=>new Response('stub')`)
  writeFileSync(join(tmp,m[2]),lines.join('\n'))
 }
 child=spawn(process.execPath,['serve.mjs','--port',String(port)],{cwd:tmp,env:{...process.env,NODE_ENV:'test',LEARNING_ALLOWED_HOSTS:'127.0.0.1:'+port,SETUP_KEY:'a'.repeat(40)},stdio:['ignore','pipe','pipe']})
 let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x)
 const origin='http://127.0.0.1:'+port;let ready=false
 for(let i=0;i<100;i++){try{ready=(await fetch(origin+'/healthz')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,25))}
 assert.ok(ready,logs);n++
 let r=await fetch(origin+'/healthz');eq(r.status,200);eq(r.headers.get('x-content-type-options'),'nosniff');eq(!!r.headers.get('x-request-id'),true)
 r=await fetch(origin+'/api/lxp/v2/okr',{method:'POST',headers:{origin:'https://evil.example'},body:'{}'});eq(r.status,403)
 r=await fetch(origin+'/api/lxp/v2/okr',{method:'POST',headers:{origin},body:'{}'});eq(r.status,200);eq(r.headers.get('cache-control'),'private,no-store')
 r=await fetch(origin+'/api/unknown-private-id',{method:'POST',body:'{}'});eq(r.status,403)
 r=await fetch(origin+'/ativar');eq(r.status,200);eq(r.headers.get('x-frame-options'),'DENY');eq(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"),true)
 r=await fetch(origin+'/ativar',{method:'POST',headers:{origin},body:'code=wrong',redirect:'manual'});eq(r.status,403)
 r=await fetch(origin+'/ativar',{method:'POST',headers:{origin},body:'code='+ 'a'.repeat(40),redirect:'manual'});eq(r.status,303);eq(r.headers.get('set-cookie').includes('HttpOnly; SameSite=Strict'),true)
 const cookie=r.headers.get('set-cookie').split(';')[0];eq(cookie.includes('a'.repeat(40)),false)
 const login=async cookie=>fetch(origin+'/api/login',{method:'POST',headers:{origin,cookie},body:'{}'})
 eq((await login(cookie)).status,200);eq((await login('__Host-learning-activation='+ 'a'.repeat(40))).status,403)
 eq((await login(cookie.slice(0,-1)+(cookie.endsWith('a')?'b':'a'))).status,403)
 eq((await login(cookie.replace(/=\d{13}\./,'=1000000000000.'))).status,403)
 r=await fetch(origin+'/api/data',{method:'POST',headers:{origin},body:'x'.repeat(256*1024+1)});eq(r.status,413)
 // Exercise the actual V39.1 rate limiter through HTTP. No real email is sent by the fixture.
 for(let i=0;i<30;i++){r=await fetch(origin+'/api/request-password-reset',{method:'POST',headers:{origin},body:'{}'});eq(r.status,200);await r.text()}
 r=await fetch(origin+'/api/request-password-reset',{method:'POST',headers:{origin},body:'{}'});eq(r.status,429);eq(r.headers.get('retry-after'),'60');await r.text()
 r=await fetch(origin+'/api/reset-password',{method:'POST',headers:{origin},body:'{}'});eq(r.status,200);await r.text()
 r=await fetch(origin+'/healthz');eq(r.status,200);eq((await r.json()).ok,true)
 r=await fetch(origin+'/readyz');eq(r.status,200);eq((await r.json()).checks.sqlite,'ready')
 await new Promise(r=>setTimeout(r,100));eq(logs.includes('unknown-private-id'),false);eq(logs.includes('/api/other'),true);eq(logs.includes('unhandled_request_error'),false)
}finally{if(child){child.kill();if(child.exitCode===null&&child.signalCode===null)await new Promise(r=>child.once('exit',r))}rmSync(tmp,{recursive:true,force:true})}
console.log(`PASS V28/V39.1.1 ingress: ${n} verificações (funções reais, limitador real e servidor HTTP com handlers simulados).`)
