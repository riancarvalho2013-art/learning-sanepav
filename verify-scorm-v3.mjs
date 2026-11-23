import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {runInNewContext} from 'node:vm'
import {createScormRuntime} from './scorm-v3.mjs'

const origin='https://homologacao.test',identity='learning-railway',cookieToken='valid-private-session'
const digest=createHash('sha256').update(cookieToken).digest('hex')
const cid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',person='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const eid='cccccccc-cccc-4ccc-8ccc-cccccccccccc',other='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const upload='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const content=new Map()
const add=(key,value)=>content.set(key,Buffer.from(value))
const course={id:cid,type:'SCORM',title:'DNA - Trilha segurança',track:'DNA do Desenvolvimento',minutes:20,status:'published',upload,entry:'mod/index.html'}
const state={users:[{id:person,name:'Pessoa teste',role:'Colaborador',active:true},{id:other,name:'Outra pessoa',role:'Colaborador',active:true}],
 sessions:[{person,digest,identity,until:Date.now()+60*60*1000}],courses:[course],enroll:[{id:eid,person,course:cid,progress:0}],uploads:[]}
add('files/'+upload+'/mod/index.html',`<!doctype html><html lang="pt-BR"><head><link rel="stylesheet" href="styles/course.css"><script src="scripts/course.js"></script><title>Conteúdo</title></head><body><img src="/images/mark.png"><p>Olá</p></body></html>`)
add('files/'+upload+'/mod/styles/course.css',`body {background: white} .logo {background:url('/images/mark.png')}`)
add('files/'+upload+'/mod/lesson2.html','<html><head></head><body><p>Outra tela da atividade.</p></body></html>')
add('files/'+upload+'/mod/scripts/course.js','window.__scorm_course_loaded=true;')
add('files/'+upload+'/images/mark.png',Buffer.from('89504e470d0a1a0a','hex'))
add('files/'+upload+'/imsmanifest.xml','<manifest><metadata><schemaversion>1.2</schemaversion></metadata></manifest>')
const BUCKET={get:async key=>{
 const bytes=key==='system/state-v1'?Buffer.from(JSON.stringify(state)):content.get(key)
 if(!bytes)return null
 return {body:bytes,text:async()=>bytes.toString(),json:async()=>JSON.parse(bytes.toString())}
}}
const run=createScormRuntime()
const req=(p,{cookie=true,method='GET',range,identityHeader=true}={})=>new Request(origin+p,{method,headers:{...(cookie?{cookie:'learning='+cookieToken}:{}),...(range?{range}:{}),...(identityHeader?{'oai-authenticated-user-id':identity}:{})}})
const call=(p,o)=>run(req(p,o),{BUCKET})
const read=async(p,o)=>{const res=await call(p,o);return {res,body:res?await res.text():''}}
const ensureStatus=async(path,status,options)=>{const {res,body}=await read(path,options);assert.equal(res?.status,status,`Expected ${status} for ${path}: ${body}`);return {res,body}}

const missing=await ensureStatus('/api/scorm/v3/launch?enrollment='+eid,401,{cookie:false})
assert.match(missing.body,/Entre no Learning/)
const bad=await ensureStatus('/api/scorm/v3/launch?enrollment='+other,403)
assert.match(bad.body,/indisponível/i)
const launch=JSON.parse((await ensureStatus('/api/scorm/v3/launch?enrollment='+eid,200)).body)
assert.match(launch.url,/^\/scorm\/v3\/[^/]+\/mod\/index\.html$/)
assert.equal(launch.title,course.title)
const token=launch.url.split('/')[3]
assert.equal(token.length,48)
const entry=await ensureStatus(launch.url,200,{cookie:false,identityHeader:false})
assert.match(entry.res.headers.get('content-security-policy'),/sandbox allow-scripts allow-forms/)
assert.doesNotMatch(entry.res.headers.get('content-security-policy'),/allow-same-origin/)
assert.match(entry.body,/data-dna-scorm-runtime="3"/)
assert.match(entry.body,/API_1484_11/)
assert.match(entry.body,new RegExp('/scorm/v3/'+token+'/images/mark.png'))
const second=await ensureStatus('/scorm/v3/'+token+'/mod/lesson2.html',200,{cookie:false,identityHeader:false})
assert.match(second.body,/DNA_SCORM_READY_V3/)
const css=await ensureStatus('/scorm/v3/'+token+'/mod/styles/course.css',200,{cookie:false,identityHeader:false})
assert.match(css.body,new RegExp('/scorm/v3/'+token+'/images/mark.png'))
assert.equal(css.res.headers.get('access-control-allow-origin'),'null')
const js=await ensureStatus('/scorm/v3/'+token+'/mod/scripts/course.js',200,{cookie:false,identityHeader:false})
assert.equal(js.res.headers.get('content-type'),'text/javascript;charset=utf-8')
const png=await call('/scorm/v3/'+token+'/images/mark.png',{cookie:false,identityHeader:false})
assert.equal(png.status,200)
assert.equal((await png.arrayBuffer()).byteLength,8)
const range=await call('/scorm/v3/'+token+'/images/mark.png',{cookie:false,identityHeader:false,range:'bytes=0-3'})
assert.equal(range.status,206)
assert.equal(range.headers.get('content-range'),'bytes 0-3/8')
assert.equal((await range.arrayBuffer()).byteLength,4)
await ensureStatus('/scorm/v3/'+token+'/mod/missing.css',404,{cookie:false})
await ensureStatus('/scorm/v3/'+token+'/mod/%2e%2e%2fmod%2findex.html',400,{cookie:false})
await ensureStatus('/scorm/v3/not-a-valid-token/mod/index.html',404,{cookie:false})
const diag=JSON.parse((await ensureStatus('/api/scorm/v3/diagnostics?course='+cid,403)).body)
assert.ok(diag.error)
state.users[0].role='Administrador'
const audit=JSON.parse((await ensureStatus('/api/scorm/v3/diagnostics?course='+cid,200)).body)
assert.equal(audit.version,'SCORM 1.2')
assert.equal(audit.entryExists,true)
assert.deepEqual(audit.missingResources,[])
state.users[0].role='Colaborador'
const stay=await ensureStatus('/api/scorm/v3/keepalive?token='+token,200)
assert.match(stay.body,/active/)
// Exercise the SCORM API objects injected into the HTML document.
const bridgeScript=entry.body.match(/<script data-dna-scorm-runtime="3">([\s\S]*?)<\/script>/)?.[1]
assert.ok(bridgeScript)
const messages=[]
const stub={top:{postMessage:message=>messages.push(message)},addEventListener:()=>{}}
runInNewContext(bridgeScript,{window:stub})
assert.equal(stub.API.LMSInitialize(''),'true')
assert.equal(stub.API.LMSSetValue('cmi.core.lesson_status','completed'),'true')
assert.equal(stub.API.LMSCommit(''),'true')
assert.ok(messages.some(m=>m.type==='DNA_SCORM_COMMIT_V3'&&m.values['cmi.core.lesson_status']==='completed'))
assert.equal(stub.API_1484_11.GetValue('cmi.learner_id'),person)
assert.equal(stub.API_1484_11.SetValue('cmi.core.student_id','hijack'),'false')
assert.equal(stub.API_1484_11.SetValue('cmi.suspend_data','S'.repeat(60000)),'true')
assert.equal(stub.API.LMSFinish(''),'true')
state.enroll[0].prerequisites=['ffffffff-ffff-4fff-8fff-ffffffffffff']
await ensureStatus(launch.url,403,{cookie:false,identityHeader:false})
state.enroll[0].prerequisites=[]
state.users[0].active=false
await ensureStatus(launch.url,403,{cookie:false,identityHeader:false})
console.log('OK SCORM V3: ACL/session, isolated iframe, CSS/JS/images without cookies, range, CORS, diagnostics, 1.2/2004 bridge and revocation')
