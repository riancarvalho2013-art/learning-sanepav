import http from 'node:http'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {createHash, createHmac, timingSafeEqual, randomUUID} from 'node:crypto'
import app from './platform.mjs'
import {BUCKET,DOMAIN} from './storage.mjs'
import {handleEvolution} from './learning-evolution.mjs'
import {handleLxpV2} from './lxp-v2.mjs'
import {handleScormV3} from './scorm-v3.mjs'
import {handleReportsV3} from './reports-v3.mjs'
import {handleDiscoveryV4} from './learning-discovery-v4.mjs'
import {handlePulseV5} from './pulse-secure-v5.mjs'
import {handleAssessmentsV6} from './learning-assessments-v6.mjs'
import {handleIntelligenceV6} from './people-intelligence-v6.mjs'
import {handleKirkpatrickV7} from './kirkpatrick-v7.mjs'
import {handleOrganizationChart} from './organization-chart-v9.mjs'
import {handleCompletionV11,reconcileCompletion} from './completion-v11.mjs'
import {createRouteRegistry} from './http-router-v11.mjs'
import {handleOrganizationHistory} from './organization-history-v11.mjs'
import {guardLegacyOKR} from './okr-v13.mjs'
import {handleUserImport} from './user-import-v14.mjs'
// BEGIN V28 INGRESS
/** Ingress defense in depth. Module-specific authorization remains mandatory. */
const methods=new Set(['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'])
const reads=new Set(['GET','HEAD','OPTIONS'])
const categories=new Set(['access','login','logout','request-password-reset','reset-password','first-access','progress','completion','organization','orgchart','kirkpatrick','assessment','intelligence','pulse','discovery','reports','scorm','users','lxp','evo','data','upload','socialUpload','socialFeed','socialPost','socialComment','socialReaction','avatar','notifications','record','course','user','assign'])
function logRoute(path){
 const parts=String(path||'/').split('?')[0].split('/').filter(Boolean)
 if(!parts.length)return '/'
 if(parts[0]==='api')return '/api/'+(categories.has(parts[1])?parts[1]:'other')
 if(['healthz','readyz','ativar'].includes(parts[0])&&parts.length===1)return '/'+parts[0]
 if(['scorm','content','cover','social'].includes(parts[0]))return '/'+parts[0]+'/*'
 return '/other'
}
function parseAllowedHosts(value=''){
 if(!value.trim())return null
 const hosts=value.split(',').map(x=>x.trim().toLowerCase())
 if(hosts.some(x=>!validHost(x)))throw Error('LEARNING_ALLOWED_HOSTS inválido.')
 return new Set(hosts)
}
function validHost(host){return typeof host==='string'&&host.length<=253&&/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host)&&!host.includes('..')&&host.split(':')[0].split('.').every(x=>x&&/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(x))&&(!host.includes(':')||Number(host.split(':')[1])>=1&&Number(host.split(':')[1])<=65535)}
function inspectRequest({host,target,method,origin,fetchSite,protocol,allowedHosts}){
 if(!validHost(host))return {status:400,error:'Host inválido.'}
 // Only origin-form request targets are accepted. URL parsing must not change the authority.
 if(typeof target!=='string'||!target.startsWith('/')||target.startsWith('//')||/[\\\x00-\x20\x7f]/.test(target)||target.length>16384)return {status:400,error:'Solicitação inválida.'}
 let url;try{url=new URL(target,protocol+'//'+host)}catch{return {status:400,error:'Solicitação inválida.'}}
 if(url.origin!==new URL(protocol+'//'+host).origin)return {status:400,error:'Solicitação inválida.'}
 if(!methods.has(method))return {status:405,error:'Método não permitido.'}
 // Railway health probes may use an internal Host. They expose no data and bypass only the allowlist.
 const probe=method==='GET'&&['/healthz','/readyz'].includes(url.pathname)
 if(!probe&&allowedHosts&&!allowedHosts.has(host.toLowerCase()))return {status:421,error:'Host não autorizado.'}
 // Origin validation on every mutating route, including newly introduced APIs. Read-only sandbox SCORM stays intact.
 if(!reads.has(method)&&(origin!==url.origin||fetchSite==='cross-site'))return {status:403,error:'Origem da solicitação inválida.'}
 if(method==='OPTIONS'&&!url.pathname.startsWith('/scorm/v3/'))return {status:405,error:'Método não permitido.'}
 return {url}
}
function securityHeaders(protocol){
 return {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()',...(protocol==='https:'?{'Strict-Transport-Security':'max-age=31536000'}:{})}
}
// Concurrency protection for expensive authentication operations; no reliance on proxy IP headers.
function createAuthGate({max=8,activationMax=20,windowMs=600000,clock=Date.now}={}){
 let active=0,attempts=[]
 return {enter(path,method){
  if(method!=='POST'||!['/ativar','/api/login','/api/request-password-reset','/api/reset-password'].includes(path))return {release(){}}
  if(path==='/ativar'){const t=clock();attempts=attempts.filter(x=>t-x<windowMs);if(attempts.length>=activationMax)return null;attempts.push(t)}
  if(active>=max)return null
  active++;let released=false;return {release(){if(!released){released=true;active--}}}
 }}
}
// END V28 INGRESS

const portArgument=process.argv.indexOf('--port')
const devMode=process.env.NODE_ENV!=='production'&&portArgument>=0
const listenPort=Number(devMode?process.argv[portArgument+1]:(process.env.PORT||8080))
const protocol=devMode?'http:':'https:'
const allowedHosts=parseAllowedHosts(process.env.LEARNING_ALLOWED_HOSTS||'')
const authGate=createAuthGate()
const configuredCode = process.env.SETUP_KEY
const validSetupKey = /^[A-Za-z0-9_-]{32,128}$/
const digest = value => createHash('sha256').update(value).digest()
const activationDigest = typeof configuredCode==='string'&&validSetupKey.test(configuredCode) ? digest(configuredCode) : null
const matches = value => Boolean(activationDigest && value && timingSafeEqual(digest(value), activationDigest))
// Signed, time-limited bootstrap proof: never send the actual setup secret back in a cookie.
const activationMac=payload=>createHmac('sha256',activationDigest).update('learning-bootstrap-v28:'+payload).digest('hex')
const issueActivation=()=>{const payload=String(Date.now()+600000)+'.'+randomUUID();return payload+'.'+activationMac(payload)}
const validActivation=value=>{
 if(!activationDigest||typeof value!=='string'||!/^\d{13}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(value))return false
 const [expires,nonce,mac]=value.split('.'),remaining=Number(expires)-Date.now()
 if(remaining<=0||remaining>600000)return false
 return timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(activationMac(expires+'.'+nonce),'hex'))
}
const cookieName = '__Host-learning-activation'
const cookieFlags = '; Path=/; Secure; HttpOnly; SameSite=Strict'
// Explicit ownership of HTTP routes; fallback is only for the legacy platform.
const context={BUCKET,DOMAIN}
const routeRequest=createRouteRegistry([
 {exact:'/api/first-access/invite',handler:request=>request.method==='POST'?DOMAIN.recovery(request,request.headers.get('oai-authenticated-user-id')||''):new Response(JSON.stringify({error:'Método não permitido.'}),{status:405,headers:{'content-type':'application/json','cache-control':'no-store'}})},
 {exact:'/api/progress',handler:request=>handleCompletionV11(request,context)},
 {prefix:'/api/completion/v11/',handler:request=>handleCompletionV11(request,context)},
 {exact:'/api/organization/v11/history',handler:request=>handleOrganizationHistory(request,context)},
 {exact:'/api/orgchart/v9',handler:request=>handleOrganizationChart(request,context)},
 {prefix:'/api/kirkpatrick/v7/',handler:request=>handleKirkpatrickV7(request,context)},
 {prefix:'/api/assessment/v6/',handler:request=>handleAssessmentsV6(request,{...context,onAssessmentSubmitted:(req,courseId)=>reconcileCompletion(req,context,courseId)})},
 {prefix:'/api/intelligence/v6/',handler:request=>handleIntelligenceV6(request,context)},
 {prefix:'/api/pulse/v5/',handler:request=>handlePulseV5(request,context)},
 {prefix:'/api/discovery/v4/',handler:request=>handleDiscoveryV4(request,context)},
 {prefix:'/api/reports/v3/',handler:request=>handleReportsV3(request,context)},
 {prefix:'/api/scorm/v3/',handler:request=>handleScormV3(request,context)},
 {prefix:'/scorm/v3/',handler:request=>handleScormV3(request,context)},
 {prefix:'/api/users/v14/import/',handler:request=>handleUserImport(request,context)},
 {prefix:'/api/lxp/v2/',handler:request=>handleLxpV2(request,context)},
 {prefix:'/api/evo/',handler:request=>handleEvolution(request,context)}
],request=>guardLegacyOKR(request,context,r=>app.fetch(r,context)))
const setupPage = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Ativar Learning Academy</title><form action="/ativar" method="post"><label>Código de ativação <input required type="password" name="code" autocomplete="off"></label><button>Ativar</button></form></html>'
const server=http.createServer({headersTimeout:15000,requestTimeout:300000,keepAliveTimeout:5000,maxHeaderSize:16384},async (req,res) => {
  const requestId=randomUUID()
  const requestAt=Date.now()
  let gate
  res.setHeader('X-Request-ID',requestId)
  for(const [name,value] of Object.entries(securityHeaders(protocol)))res.setHeader(name,value)
  res.on('finish',()=>{
    const durationMs=Date.now()-requestAt
    if(process.env.LEARNING_LOG_REQUESTS==='true'||res.statusCode>=500||[401,403,421,429].includes(res.statusCode)){
      console.info(JSON.stringify({type:'http_access',at:new Date().toISOString(),requestId,method:req.method,
        route:logRoute(req.url),status:res.statusCode,durationMs}))
    }
  })
  try {
    const inspection=inspectRequest({host:req.headers.host,target:req.url,method:req.method,origin:req.headers.origin,fetchSite:req.headers['sec-fetch-site'],protocol,allowedHosts})
    if(inspection.status){res.writeHead(inspection.status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify({error:inspection.error,requestId}))}
    const url=inspection.url
    if(url.pathname.startsWith('/api/'))res.setHeader('Cache-Control','private,no-store')
    gate=authGate.enter(url.pathname,req.method)
    if(!gate){res.writeHead(429,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Retry-After':'60'});return res.end(JSON.stringify({error:'Muitas solicitações. Tente novamente mais tarde.',requestId}))}
    if(url.pathname==='/healthz'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end('{"ok":true}')}
    if(url.pathname==='/readyz'&&req.method==='GET'){
      // Readiness checks SQLite; does not prove object storage or external backups are available.
      try{
        await BUCKET.get('__readiness_check_v1__')
        res.writeHead(200,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'})
        return res.end('{"ok":true,"checks":{"sqlite":"ready"}}')
      }catch{
        res.writeHead(503,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'})
        return res.end('{"ok":false,"checks":{"sqlite":"unavailable"}}')
      }
    }
    if (url.pathname === '/ativar') {
      res.setHeader('Cache-Control','no-store')
      res.setHeader('Content-Security-Policy',"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
      res.setHeader('X-Frame-Options','DENY')
      if(!activationDigest){res.writeHead(503,{'Content-Type':'text/plain;charset=utf-8'});return res.end('A ativação requer SETUP_KEY própria deste ambiente. Configure uma chave de 32 a 128 caracteres, usando letras, números, hífen ou sublinhado, nas variáveis do serviço.')}
      if (req.method === 'GET') {res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(setupPage)}
      if (req.method !== 'POST' || req.headers.origin !== url.origin) {res.writeHead(403);return res.end()}
      let input = ''
      for await (const part of req) {input += part;if(input.length > 2048){res.writeHead(413);return res.end()}}
      const code = new URLSearchParams(input).get('code')
      if (!matches(code)) {res.writeHead(403);return res.end('Código inválido.')}
      res.writeHead(303,{'Set-Cookie':cookieName+'='+issueActivation()+cookieFlags+'; Max-Age=600',Location:'/'})
      return res.end()
    }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const stored = await BUCKET.get('system/state-v1')
      const initialized = stored && (await stored.json()).users.length > 0
      const code = (req.headers.cookie || '').split('; ').find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)
      if (!initialized && !validActivation(code)) {
        res.writeHead(403,{'Content-Type':'application/json;charset=utf-8'})
        return res.end(JSON.stringify({error:'O administrador deve acessar /ativar com o código de homologação.'}))
      }
    }
    const headers = new Headers(req.headers)
    headers.set('oai-authenticated-user-id','learning-railway')
    headers.set('cf-connecting-ip',req.socket.remoteAddress || 'local')
    const options = {method:req.method,headers}
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const upload = ['/api/upload','/api/socialUpload','/api/evo/brand/logo','/api/evo/certificate/background'].includes(url.pathname)
      if (upload) Object.assign(options,{body:Readable.toWeb(req),duplex:'half'})
      else {
        let bytes=0
        const chunks=[]
        for await(const chunk of req){
          bytes+=chunk.length
          if(bytes>256*1024){res.writeHead(413,{'Content-Type':'application/json'});return res.end('{"error":"Solicitação acima de 256 KB."}')}
          chunks.push(chunk)
        }
        options.body=Buffer.concat(chunks)
      }
    }
    const request = new Request(url,options)
    const result = await routeRequest(request)
    if(req.method==='GET'&&url.pathname==='/api/access'&&result.ok){
      const data=await result.json()
      if(data.setup){
        const code=(req.headers.cookie||'').split('; ').find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)
        data.activationRequired=!validActivation(code)
        data.activationConfigured=Boolean(activationDigest)
      }
      res.writeHead(result.status,Object.fromEntries(result.headers));return res.end(JSON.stringify(data))
    }
    res.writeHead(result.status,Object.fromEntries(result.headers))
    if (result.body) await pipeline(Readable.fromWeb(result.body),res)
    else res.end()
  } catch(error) {
    console.error(JSON.stringify({type:'unhandled_request_error',at:new Date().toISOString(),requestId,name:error?.name||'Error'}))
    if(res.headersSent){res.destroy();return}
    res.writeHead(500,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'})
    res.end(JSON.stringify({error:'Falha interna inesperada.',requestId}))
  } finally {gate?.release()}
})
server.listen(listenPort,devMode?'127.0.0.1':'0.0.0.0')
