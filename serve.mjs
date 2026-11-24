import http from 'node:http'
import {Readable} from 'node:stream'
import {createHash, timingSafeEqual, randomUUID} from 'node:crypto'
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

const portArgument=process.argv.indexOf('--port')
const devMode=process.env.NODE_ENV!=='production'&&portArgument>=0
const listenPort=Number(devMode?process.argv[portArgument+1]:(process.env.PORT||8080))
const protocol=devMode?'http:':'https:'
const configuredCode = process.env.SETUP_KEY
const validSetupKey = /^[A-Za-z0-9_-]{32,128}$/
const digest = value => createHash('sha256').update(value).digest()
const activationDigest = typeof configuredCode==='string'&&validSetupKey.test(configuredCode) ? digest(configuredCode) : null
const matches = value => Boolean(activationDigest && value && timingSafeEqual(digest(value), activationDigest))
const cookieName = '__Host-learning-activation'
const cookieFlags = '; Path=/; Secure; HttpOnly; SameSite=Strict'
// Never place user-controlled path segments, SCORM tickets or personal IDs in logs.
const safeLogRoute=raw=>{
 const segments=String(raw||'/').split('?')[0].split('/').filter(Boolean)
 const allowed=segments[0]==='api'?2:1
 return '/'+segments.slice(0,allowed).map(x=>x.slice(0,32)).join('/')+(segments.length>allowed?'/*':'')
}
// Explicit ownership of HTTP routes; fallback is only for the legacy platform.
const context={BUCKET,DOMAIN}
const routeRequest=createRouteRegistry([
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
const setupPage = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Ativar Learning Sanepav</title><form action="/ativar" method="post"><label>Código de ativação <input required type="password" name="code" autocomplete="off"></label><button>Ativar</button></form></html>'
http.createServer(async (req,res) => {
  const requestId=randomUUID()
  const requestAt=Date.now()
  res.setHeader('X-Request-ID',requestId)
  res.on('finish',()=>{
    const durationMs=Date.now()-requestAt
    if(process.env.LEARNING_LOG_REQUESTS==='true'||res.statusCode>=500){
      // Do not log query strings, request bodies, cookies, tokens, IP addresses or personal data.
      console.info(JSON.stringify({type:'http_access',at:new Date().toISOString(),requestId,method:req.method,
        route:safeLogRoute(req.url),status:res.statusCode,durationMs}))
    }
  })
  try {
    const host = req.headers.host
    if (!host || !/^[a-zA-Z0-9.:-]+$/.test(host)) {res.writeHead(400);return res.end()}
    const url = new URL(req.url, protocol+'//' + host)
    if(url.pathname==='/healthz'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end('{"ok":true}')}
    if(url.pathname==='/readyz'&&req.method==='GET'){
      // Readiness checks an actual SQLite query via the existing storage adapter.
      // No user data or sensitive environmental configuration is returned.
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
      if(!activationDigest){res.writeHead(503,{'Content-Type':'text/plain;charset=utf-8'});return res.end('A ativação requer SETUP_KEY própria deste ambiente. Configure uma chave de 32 a 128 caracteres, usando letras, números, hífen ou sublinhado, nas variáveis do serviço.')}
      if (req.method === 'GET') {res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(setupPage)}
      if (req.method !== 'POST' || req.headers.origin !== url.origin) {res.writeHead(403);return res.end()}
      let input = ''
      for await (const part of req) {input += part;if(input.length > 2048){res.writeHead(413);return res.end()}}
      const code = new URLSearchParams(input).get('code')
      if (!matches(code)) {res.writeHead(403);return res.end('Código inválido.')}
      res.writeHead(303,{'Set-Cookie':cookieName+'='+code+cookieFlags+'; Max-Age=600',Location:'/'})
      return res.end()
    }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      const stored = await BUCKET.get('system/state-v1')
      const initialized = stored && (await stored.json()).users.length > 0
      const code = (req.headers.cookie || '').split('; ').find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)
      if (!initialized && !matches(code)) {
        res.writeHead(403,{'Content-Type':'application/json;charset=utf-8'})
        return res.end(JSON.stringify({error:'O administrador deve acessar /ativar com o código de homologação.'}))
      }
    }
    const headers = new Headers(req.headers)
    headers.set('oai-authenticated-user-id','learning-railway')
    headers.set('cf-connecting-ip',req.socket.remoteAddress || 'local')
    const options = {method:req.method,headers}
    if (!['GET','HEAD'].includes(req.method)) {
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
        data.activationRequired=!matches(code)
        data.activationConfigured=Boolean(activationDigest)
      }
      res.writeHead(result.status,Object.fromEntries(result.headers));return res.end(JSON.stringify(data))
    }
    res.writeHead(result.status,Object.fromEntries(result.headers))
    if (result.body) Readable.fromWeb(result.body).pipe(res)
    else res.end()
  } catch(error) {
    console.error(JSON.stringify({type:'unhandled_request_error',at:new Date().toISOString(),requestId,name:error?.name||'Error'}))
    if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'})
    res.end(JSON.stringify({error:'Falha interna inesperada.',requestId}))
  }
}).listen(listenPort,devMode?'127.0.0.1':'0.0.0.0')
