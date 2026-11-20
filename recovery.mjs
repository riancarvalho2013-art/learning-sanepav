import {randomBytes,randomUUID,createHash} from 'node:crypto'
import {hashPassword} from './credentials.mjs'
const digest=value=>createHash('sha256').update(value).digest('hex')
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}})
const generic={ok:true,message:'Se o cadastro estiver ativo, você receberá as orientações no e-mail informado.'}
function configuration(){
 try{
  const key=process.env.RESEND_API_KEY?.trim(),from=process.env.EMAIL_FROM?.trim()
  const origin=process.env.APP_ORIGIN||'https://learning-sanepav-production.up.railway.app'
  if(!key||!from||/[\r\n]/.test(from)||new URL(origin).protocol!=='https:')return null
  return {key,from,origin:new URL(origin).origin}
 }catch{return null}
}
export const recoveryConfigured=()=>Boolean(configuration())
export function createRecovery(database,delivery){
 const send=delivery||(async(message,config)=>{
  const result=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{authorization:'Bearer '+config.key,'content-type':'application/json','idempotency-key':message.id},
   body:JSON.stringify({from:config.from,to:[message.email],subject:'Recuperação de acesso ao Sanepav Learning',
    text:'Você solicitou a recuperação do seu acesso. Defina sua senha pelo link abaixo em até 30 minutos.\n\n'+config.origin+'/#reset='+message.token+'\n\nSe você não solicitou esta ação, ignore esta mensagem.'}),
   signal:AbortSignal.timeout(15000)
  })
  if(!result.ok)throw new Error('Não foi possível enviar a recuperação de acesso.')
 })
 return async function recovery(request,identity,settings=configuration()){
  const body=await request.json()
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Dados inválidos.'},400)
  if(new URL(request.url).pathname.endsWith('/reset-password')){
   if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return reply({error:'Link inválido ou expirado.'},400)
   const tokenHash=digest(body.token)
   const token=database.prepare('SELECT * FROM password_resets WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?').get(tokenHash,Date.now())
   if(!token)return reply({error:'Link inválido ou expirado.'},400)
   const secret=await hashPassword(body.password)
   database.exec('BEGIN IMMEDIATE')
   try{
    const consume=database.prepare('UPDATE password_resets SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?').run(Date.now(),tokenHash,Date.now())
    if(!consume.changes)throw Object.assign(new Error('Link inválido ou expirado.'),{status:400})
    const stored=database.prepare('SELECT body FROM objects WHERE key=?').get('system/state-v1')
    const state=JSON.parse(Buffer.from(stored.body).toString())
    const person=state.users.find(user=>user.id===token.person_id&&user.active)
    if(!person)throw Object.assign(new Error('Link inválido ou expirado.'),{status:400})
    Object.assign(person,secret)
    state.sessions=state.sessions.filter(session=>session.person!==person.id)
    state.logs.unshift({at:new Date().toISOString(),who:person.name,event:'Senha redefinida e sessões revogadas'})
    state.logs=state.logs.slice(0,5000)
    database.prepare('UPDATE password_resets SET consumed_at=? WHERE person_id=? AND consumed_at IS NULL').run(Date.now(),person.id)
    database.prepare('UPDATE objects SET body=?,etag=? WHERE key=?').run(Buffer.from(JSON.stringify(state)),randomUUID(),'system/state-v1')
    database.exec('COMMIT')
    return reply({ok:true,message:'Senha redefinida. Entre com sua nova senha.'})
   }catch(error){database.exec('ROLLBACK');throw error}
  }
  if(!settings)return reply({error:'Recuperação por e-mail indisponível. Solicite apoio à administração.'},503)
  const email=String(body.email||'').trim().toLowerCase()
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>300)return reply({error:'Informe um e-mail válido.'},400)
  const rateKey=digest(identity+'|'+(request.headers.get('cf-connecting-ip')||''))
  const now=Date.now(),since=now-15*60*1000
  let message
  database.exec('BEGIN IMMEDIATE')
  try{
   const count=database.prepare('SELECT count(*) AS total FROM password_reset_requests WHERE rate_key=? AND requested_at>?').get(rateKey,since).total
   if(count>=5){database.exec('ROLLBACK');return reply({error:'Muitas solicitações. Aguarde 15 minutos.'},429)}
   database.prepare('DELETE FROM password_reset_requests WHERE requested_at<?').run(now-86400000)
   database.prepare('DELETE FROM password_resets WHERE expires_at<?').run(now-86400000)
   database.prepare('INSERT INTO password_reset_requests(rate_key,requested_at) VALUES(?,?)').run(rateKey,now)
   const stored=database.prepare('SELECT body FROM objects WHERE key=?').get('system/state-v1')
   const state=stored?JSON.parse(Buffer.from(stored.body).toString()):{users:[]}
   const person=state.users.find(user=>user.email===email&&user.active)
   if(person){
    const token=randomBytes(32).toString('hex'),id=randomUUID()
    database.prepare('INSERT INTO password_resets(token_hash,person_id,expires_at) VALUES(?,?,?)').run(digest(token),person.id,now+30*60*1000)
    message={token,email,id}
   }
   database.exec('COMMIT')
  }catch(error){database.exec('ROLLBACK');throw error}
  if(message){
   try{await send(message,settings)}catch{
    database.prepare('UPDATE password_resets SET consumed_at=? WHERE token_hash=?').run(Date.now(),digest(message.token))
    // The same response for all accounts prevents account enumeration.
    console.warn('Falha na entrega de recuperação de acesso. Confira a configuração do provedor de e-mail.')
   }
  }
  return reply(generic)
 }
}
