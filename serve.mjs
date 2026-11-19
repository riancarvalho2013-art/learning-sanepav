import http from 'node:http'
import {Readable} from 'node:stream'
import {createHash} from 'node:crypto'
import app from './platform.mjs'
import {BUCKET} from './storage.mjs'

const matches = value => createHash('sha256').update(value || '').digest('hex') === '38c2da7c250c117c8551fe314f4ac13e4a326671ce2672af167a3427135a3658'
const cookieName = '__Host-learning-activation'
const cookieFlags = '; Path=/; Secure; HttpOnly; SameSite=Strict'
const setupPage = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Ativar Learning Sanepav</title><form action="/ativar" method="post"><label>Código de ativação <input required type="password" name="code" autocomplete="off"></label><button>Ativar</button></form></html>'
http.createServer(async (req,res) => {
  try {
    const host = req.headers.host
    if (!host || !/^[a-zA-Z0-9.:-]+$/.test(host)) {res.writeHead(400);return res.end()}
    const url = new URL(req.url, 'https://' + host)
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
    if (!['GET','HEAD'].includes(req.method)) Object.assign(options,{body:Readable.toWeb(req),duplex:'half'})
    const result = await app.fetch(new Request(url,options),{BUCKET})
    res.writeHead(result.status,Object.fromEntries(result.headers))
    if (result.body) Readable.fromWeb(result.body).pipe(res)
    else res.end()
  } catch {if(!res.headersSent)res.writeHead(500);res.end()}
}).listen(Number(process.env.PORT || 8080),'0.0.0.0')
