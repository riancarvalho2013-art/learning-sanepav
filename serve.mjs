import http from 'node:http'
import {Readable} from 'node:stream'
import {createHash, timingSafeEqual} from 'node:crypto'
import app from './platform.mjs'
import {BUCKET,DOMAIN} from './storage.mjs'

const portArgument=process.argv.indexOf('--port')
const devMode=process.env.NODE_ENV!=='production'&&portArgument>=0
const listenPort=Number(devMode?process.argv[portArgument+1]:(process.env.PORT||8080))
const protocol=devMode?'http:':'https:'
const configuredCode = process.env.SETUP_KEY
const validSetupKey = /^[A-Za-z0-9_-]{32,128}$/
const digest = value => createHash('sha256').update(value).digest()
const activationDigest = configuredCode === undefined
  ? Buffer.from('38c2da7c250c117c8551fe314f4ac13e4a326671ce2672af167a3427135a3658', 'hex')
  : validSetupKey.test(configuredCode) ? digest(configuredCode) : null
const matches = value => Boolean(activationDigest && value && timingSafeEqual(digest(value), activationDigest))
const cookieName = '__Host-learning-activation'
const cookieFlags = '; Path=/; Secure; HttpOnly; SameSite=Strict'
const setupPage = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Ativar Learning Sanepav</title><form action="/ativar" method="post"><label>Código de ativação <input required type="password" name="code" autocomplete="off"></label><button>Ativar</button></form></html>'
http.createServer(async (req,res) => {
  try {
    const host = req.headers.host
    if (!host || !/^[a-zA-Z0-9.:-]+$/.test(host)) {res.writeHead(400);return res.end()}
    const url = new URL(req.url, protocol+'//' + host)
    if(url.pathname==='/healthz'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end('{"ok":true}')}
    if (url.pathname === '/ativar') {
      res.setHeader('Cache-Control','no-store')
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
      const upload = ['/api/upload','/api/socialUpload'].includes(url.pathname)
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
    const result = await app.fetch(new Request(url,options),{BUCKET,DOMAIN})
    res.writeHead(result.status,Object.fromEntries(result.headers))
    if (result.body) Readable.fromWeb(result.body).pipe(res)
    else res.end()
  } catch {if(!res.headersSent)res.writeHead(500);res.end()}
}).listen(listenPort,devMode?'127.0.0.1':'0.0.0.0')
